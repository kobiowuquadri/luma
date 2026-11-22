// Package server wires the HTTP routes, middleware and handlers.
//
// Logging rule: never log request or response bodies. That excludes
// recordings, transcripts, questions, answers, document lines and keys.
// Access logs carry only route, status, sizes, timings, counts and a hashed
// device identifier.
package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"luma/api/internal/apierr"
	"luma/api/internal/ask"
	"luma/api/internal/config"
	"luma/api/internal/guard"
)

// Answerer produces a structured answer from a grounded prompt.
type Answerer interface {
	Answer(ctx context.Context, req ask.Request, p ask.Prompt) (ask.ModelAnswer, error)
	Model() string
}

// Transcriber turns a recording into text.
type Transcriber interface {
	Transcribe(ctx context.Context, idemKey string, audio []byte, filename string) (string, error)
}

// Synthesizer turns text into audio.
type Synthesizer interface {
	Synthesize(ctx context.Context, idemKey, text, voice string) ([]byte, string, error)
}

// VoiceDirectory resolves per-language speech and transcription support.
type VoiceDirectory interface {
	VoiceFor(ctx context.Context, lang string) (string, bool)
	TranscriptionListed(ctx context.Context, lang string) *bool
}

// Deps are the server's dependencies. Nil providers mean "not configured".
type Deps struct {
	Config      config.Config
	Logger      *slog.Logger
	Answerer    Answerer
	Transcriber Transcriber
	Synthesizer Synthesizer
	Voices      VoiceDirectory
}

// Server holds handler state.
type Server struct {
	cfg         config.Config
	log         *slog.Logger
	answerer    Answerer
	transcriber Transcriber
	synthesizer Synthesizer
	voices      VoiceDirectory
	idem        *guard.Idempotency
	devices     *guard.DeviceLimiter
	budget      *guard.Budget
	started     time.Time
}

// New builds the HTTP handler.
func New(d Deps) http.Handler {
	s := newServer(d)
	return s.routes()
}

func newServer(d Deps) *Server {
	if d.Logger == nil {
		d.Logger = slog.New(slog.DiscardHandler)
	}
	lim := d.Config.Limits
	return &Server{
		cfg:         d.Config,
		log:         d.Logger,
		answerer:    d.Answerer,
		transcriber: d.Transcriber,
		synthesizer: d.Synthesizer,
		voices:      d.Voices,
		idem:        guard.NewIdempotency(30*time.Minute, 64<<20),
		devices:     guard.NewDeviceLimiter(lim.PerDevicePerMinute, lim.PerDevicePerDay),
		budget: guard.NewBudget(map[string]int{
			"ask": lim.DailyAsk, "transcribe": lim.DailyTranscribe, "speech": lim.DailySpeech,
		}),
		started: time.Now(),
	}
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /v1/capabilities", s.capabilities)
	mux.HandleFunc("POST /v1/ask", s.ask)
	mux.HandleFunc("POST /v1/transcribe", s.transcribe)
	mux.HandleFunc("POST /v1/speech", s.speech)
	allowed := map[string]string{
		"/health": "GET", "/v1/capabilities": "GET",
		"/v1/ask": "POST", "/v1/transcribe": "POST", "/v1/speech": "POST",
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if m, ok := allowed[r.URL.Path]; ok {
			w.Header().Set("Allow", m)
			s.writeError(w, r, &apierr.Error{Kind: apierr.KindInvalid, Message: "Use " + m + " for this endpoint."}, http.StatusMethodNotAllowed)
			return
		}
		s.writeError(w, r, &apierr.Error{Kind: apierr.KindInvalid, Message: "Not found."}, http.StatusNotFound)
	})
	return s.middleware(mux)
}

// reqInfo collects log fields for the access log line.
type reqInfo struct {
	id       string
	client   string
	errCode  string
	provider string
	upstream string
	fields   []any
}

type ctxKey struct{}

func info(r *http.Request) *reqInfo {
	if v, ok := r.Context().Value(ctxKey{}).(*reqInfo); ok {
		return v
	}
	return &reqInfo{}
}

type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{6,64}$`)

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ri := &reqInfo{id: r.Header.Get("X-Request-Id")}
		if !requestIDPattern.MatchString(ri.id) {
			ri.id = randomID(8)
		}
		ri.client = s.clientKey(r)
		r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, ri))
		sw := &statusWriter{ResponseWriter: w}
		h := sw.Header()
		h.Set("X-Request-Id", ri.id)
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")

		defer func() {
			if p := recover(); p != nil {
				s.log.Error("panic", "request_id", ri.id, "route", r.Pattern)
				if sw.status == 0 {
					s.writeError(sw, r, apierr.New(apierr.KindInternal), 0)
				}
			}
			attrs := []any{
				"request_id", ri.id, "method", r.Method, "route", routeName(r),
				"status", sw.status, "bytes_in", r.ContentLength, "bytes_out", sw.bytes,
				"duration_ms", time.Since(start).Milliseconds(), "device", hashClient(ri.client),
			}
			if ri.errCode != "" {
				attrs = append(attrs, "error", ri.errCode, "provider", ri.provider, "upstream", ri.upstream)
			}
			attrs = append(attrs, ri.fields...)
			s.log.Info("request", attrs...)
		}()

		if s.cfg.ClientToken != "" && r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/v1/") {
			got := r.Header.Get("X-Luma-Client")
			if subtle.ConstantTimeCompare([]byte(got), []byte(s.cfg.ClientToken)) != 1 {
				s.writeError(sw, r, apierr.New(apierr.KindUnauthorized), 0)
				return
			}
		}
		next.ServeHTTP(sw, r)
	})
}

func routeName(r *http.Request) string {
	if r.Pattern != "" {
		return r.Pattern
	}
	return "unmatched"
}

var installPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// clientKey identifies the device for rate limiting: the app's random
// install ID when present, otherwise the client IP.
func (s *Server) clientKey(r *http.Request) string {
	if id := r.Header.Get("X-Luma-Install"); installPattern.MatchString(id) {
		return "install:" + strings.ToLower(id)
	}
	if s.cfg.TrustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			first := strings.TrimSpace(strings.Split(xff, ",")[0])
			if net.ParseIP(first) != nil {
				return "ip:" + first
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return "ip:" + host
}

func hashClient(c string) string {
	sum := sha256.Sum256([]byte("luma-log:" + c))
	return hex.EncodeToString(sum[:])[:10]
}

func randomID(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

// writeError sends the JSON error envelope. status 0 means "derive from kind".
func (s *Server) writeError(w http.ResponseWriter, r *http.Request, err error, status int) {
	e := apierr.As(err)
	if status == 0 {
		status = apierr.HTTPStatus(e.Kind)
	}
	ri := info(r)
	ri.errCode = string(e.Kind)
	ri.provider = e.Provider
	if e.UpstreamStatus != 0 || e.UpstreamCode != "" {
		ri.upstream = strconv.Itoa(e.UpstreamStatus) + " " + e.UpstreamCode
	}
	if e.Kind == apierr.KindInternal && e.Err != nil {
		s.log.Error("internal error", "request_id", ri.id, "error", e.Err.Error())
	}
	if e.RetryAfter > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(int(e.RetryAfter.Round(time.Second).Seconds())))
	}
	writeJSON(w, status, map[string]any{"error": map[string]any{
		"code":      e.Kind,
		"message":   e.Message,
		"retryable": e.Retryable,
		"provider":  e.Provider,
	}})
}

var idemPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$`)

// idempotencyKey returns the client's Idempotency-Key, or a fresh one when
// the client did not send one (no replay protection in that case).
func idempotencyKey(r *http.Request) (string, error) {
	k := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if k == "" {
		return randomID(16), nil
	}
	if !idemPattern.MatchString(k) {
		return "", apierr.Invalid("Idempotency-Key must be 8-64 letters, digits, '-' or '_'.")
	}
	return k, nil
}

// admit applies the per-device limit and the daily budget before a paid call.
func (s *Server) admit(r *http.Request, op string) error {
	ok, wait, daily := s.devices.Allow(info(r).client)
	if !ok {
		e := apierr.New(apierr.KindRateLimited)
		if daily {
			e.Message = "You have reached today's limit for this phone. Reading still works. Try again tomorrow."
			e.Retryable = false
		}
		e.RetryAfter = wait
		return e
	}
	if !s.budget.Take(op) {
		e := apierr.New(apierr.KindDailyLimit)
		e.RetryAfter = s.budget.UntilReset()
		return e
	}
	return nil
}
