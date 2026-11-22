package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"luma/api/internal/apierr"
	"luma/api/internal/ask"
	"luma/api/internal/config"
)

// Test fixtures. These fakes stand in for OpenAI and YarnGPT in automated
// tests only; production code never returns canned answers.

type fakeAnswerer struct {
	calls int32
	ans   ask.ModelAnswer
	err   error
}

func (f *fakeAnswerer) Answer(ctx context.Context, req ask.Request, p ask.Prompt) (ask.ModelAnswer, error) {
	atomic.AddInt32(&f.calls, 1)
	return f.ans, f.err
}
func (f *fakeAnswerer) Model() string { return "test-model" }

type fakeYarn struct {
	asrCalls, ttsCalls int32
	transcript         string
	err                error
}

func (f *fakeYarn) Transcribe(ctx context.Context, key string, audio []byte, filename string) (string, error) {
	atomic.AddInt32(&f.asrCalls, 1)
	return f.transcript, f.err
}

func (f *fakeYarn) Synthesize(ctx context.Context, key, text, voice string) ([]byte, string, error) {
	atomic.AddInt32(&f.ttsCalls, 1)
	return []byte("ID3fake"), "audio/mpeg", f.err
}

type fakeVoices struct {
	voices map[string]string
	asr    map[string]bool
}

func (f fakeVoices) VoiceFor(ctx context.Context, lang string) (string, bool) {
	v, ok := f.voices[lang]
	return v, ok
}

func (f fakeVoices) TranscriptionListed(ctx context.Context, lang string) *bool {
	if f.asr == nil {
		return nil
	}
	v := f.asr[lang]
	return &v
}

type env struct {
	t        *testing.T
	handler  http.Handler
	answerer *fakeAnswerer
	yarn     *fakeYarn
	logs     *bytes.Buffer
}

func newEnv(t *testing.T, mutate func(*config.Config, *Deps)) *env {
	t.Helper()
	cfg, err := config.Load(func(string) string { return "" })
	if err != nil {
		t.Fatal(err)
	}
	logs := &bytes.Buffer{}
	e := &env{t: t, logs: logs,
		answerer: &fakeAnswerer{ans: ask.ModelAnswer{Answer: "Submit it on Friday, 21 November 2026.", AnswerInPage: true, SourceLineIDs: []string{"L5", "L42"}}},
		yarn:     &fakeYarn{transcript: "When is the assignment due?"},
	}
	d := Deps{
		Config:      cfg,
		Logger:      slog.New(slog.NewJSONHandler(logs, nil)),
		Answerer:    e.answerer,
		Transcriber: e.yarn,
		Synthesizer: e.yarn,
		Voices:      fakeVoices{voices: map[string]string{"en": "umar", "yo": "idera"}, asr: map[string]bool{"en": true, "yo": true}},
	}
	if mutate != nil {
		mutate(&cfg, &d)
		d.Config = cfg
	}
	e.handler = New(d)
	return e
}

func (e *env) do(method, path string, body io.Reader, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, body)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	return rec
}

const secretQuestion = "When is the photosynthesis assignment due?"
const secretLine = "Submit on Friday, 21 November 2026."

func askBody(question string) *bytes.Buffer {
	b, _ := json.Marshal(map[string]any{
		"mode":     "question",
		"language": "yo",
		"question": question,
		"lines": []map[string]string{
			{"id": "L1", "text": "SS2 BIOLOGY - HANDOUT 3"},
			{"id": "L4", "text": "Assignment: Answer questions 1-5 on page 47."},
			{"id": "L5", "text": secretLine},
		},
	})
	return bytes.NewBuffer(b)
}

var jsonHeaders = map[string]string{"Content-Type": "application/json"}

func withKey(k string) map[string]string {
	return map[string]string{"Content-Type": "application/json", "Idempotency-Key": k}
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("not an error envelope: %s", rec.Body.String())
	}
	return body.Error.Code
}

func TestHealth(t *testing.T) {
	e := newEnv(t, nil)
	rec := e.do("GET", "/health", nil, nil)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"status":"ok"`) {
		t.Fatalf("health = %d %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("X-Request-Id") == "" {
		t.Fatal("missing request id header")
	}
}

func TestMissingCredentialsLeaveHonestUnavailableState(t *testing.T) {
	e := newEnv(t, func(c *config.Config, d *Deps) {
		d.Answerer, d.Transcriber, d.Synthesizer, d.Voices = nil, nil, nil, nil
	})
	rec := e.do("GET", "/v1/capabilities", nil, nil)
	if rec.Code != 200 {
		t.Fatalf("capabilities = %d", rec.Code)
	}
	var caps struct {
		Features map[string]featureCap `json:"features"`
		Langs    []languageCap         `json:"languages"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &caps)
	for name, f := range caps.Features {
		if f.Available || f.Reason != "not_configured" {
			t.Errorf("feature %s = %+v, want not_configured", name, f)
		}
	}
	if len(caps.Langs) != 5 {
		t.Fatalf("languages = %d, want 5", len(caps.Langs))
	}
	for path, body := range map[string]io.Reader{"/v1/ask": askBody("q"), "/v1/speech": strings.NewReader(`{"text":"hi","language":"en"}`)} {
		rec := e.do("POST", path, body, jsonHeaders)
		if rec.Code != http.StatusServiceUnavailable || errorCode(t, rec) != "not_configured" {
			t.Errorf("%s = %d %s", path, rec.Code, rec.Body.String())
		}
	}
	if rec := e.do("GET", "/health", nil, nil); rec.Code != 200 {
		t.Fatal("health must work without credentials")
	}
}

func TestCapabilitiesReportPerLanguageSupport(t *testing.T) {
	e := newEnv(t, nil)
	rec := e.do("GET", "/v1/capabilities", nil, nil)
	var caps struct {
		Langs []languageCap `json:"languages"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &caps)
	byCode := map[string]languageCap{}
	for _, l := range caps.Langs {
		byCode[l.Code] = l
	}
	if !byCode["yo"].Speech.Available || !byCode["yo"].Transcription.Available {
		t.Fatalf("yo = %+v", byCode["yo"])
	}
	if byCode["ha"].Speech.Available || byCode["ha"].Speech.Reason != "no_voice_for_language" {
		t.Fatalf("ha speech = %+v", byCode["ha"].Speech)
	}
	if byCode["ha"].Transcription.Available || byCode["ha"].Transcription.Reason != "language_not_listed" {
		t.Fatalf("ha transcription = %+v", byCode["ha"].Transcription)
	}
	if !byCode["ig"].Answers.Available {
		t.Fatal("answers should be available for every language when configured")
	}
}

func TestAskReturnsOnlyValidatedSourceLines(t *testing.T) {
	e := newEnv(t, nil)
	rec := e.do("POST", "/v1/ask", askBody(secretQuestion), withKey("ask-0000000001"))
	if rec.Code != 200 {
		t.Fatalf("ask = %d %s", rec.Code, rec.Body.String())
	}
	var res ask.Result
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if strings.Join(res.SourceLineIDs, ",") != "L5" || res.DroppedSourceIDs != 1 || !res.AnswerFound {
		t.Fatalf("result = %+v", res)
	}
	if res.Language != "yo" || res.Model != "test-model" {
		t.Fatalf("result = %+v", res)
	}
}

func TestAskRetryWithSameKeyDoesNotPayTwice(t *testing.T) {
	e := newEnv(t, nil)
	first := e.do("POST", "/v1/ask", askBody(secretQuestion), withKey("retry-key-123"))
	second := e.do("POST", "/v1/ask", askBody(secretQuestion), withKey("retry-key-123"))
	if first.Code != 200 || second.Code != 200 || first.Body.String() != second.Body.String() {
		t.Fatalf("first %d, second %d", first.Code, second.Code)
	}
	if second.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatal("second response should be a replay")
	}
	if e.answerer.calls != 1 {
		t.Fatalf("answer model called %d times, want 1", e.answerer.calls)
	}
	conflict := e.do("POST", "/v1/ask", askBody("A different question?"), withKey("retry-key-123"))
	if conflict.Code != http.StatusConflict || errorCode(t, conflict) != "idempotency_conflict" {
		t.Fatalf("conflict = %d %s", conflict.Code, conflict.Body.String())
	}
}

func TestAskFailedAttemptCanBeRetried(t *testing.T) {
	e := newEnv(t, nil)
	e.answerer.err = &apierr.Error{Kind: apierr.KindProviderTimeout, Provider: "openai", Retryable: true, Message: "slow"}
	rec := e.do("POST", "/v1/ask", askBody(secretQuestion), withKey("flaky-key-123"))
	if rec.Code != http.StatusGatewayTimeout || errorCode(t, rec) != "provider_timeout" {
		t.Fatalf("first = %d %s", rec.Code, rec.Body.String())
	}
	e.answerer.err = nil
	rec = e.do("POST", "/v1/ask", askBody(secretQuestion), withKey("flaky-key-123"))
	if rec.Code != 200 || e.answerer.calls != 2 {
		t.Fatalf("retry = %d calls %d", rec.Code, e.answerer.calls)
	}
}

func TestAskCreditsExhausted(t *testing.T) {
	e := newEnv(t, nil)
	e.answerer.err = &apierr.Error{Kind: apierr.KindCreditsExhausted, Provider: "openai", Message: apierr.DefaultMessage(apierr.KindCreditsExhausted)}
	rec := e.do("POST", "/v1/ask", askBody(secretQuestion), withKey("credits-key-1"))
	if rec.Code != http.StatusServiceUnavailable || errorCode(t, rec) != "credits_exhausted" {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"retryable":false`) || !strings.Contains(rec.Body.String(), `"provider":"openai"`) {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestAskValidation(t *testing.T) {
	e := newEnv(t, nil)
	cases := map[string]struct {
		body    string
		headers map[string]string
		status  int
		code    string
	}{
		"not json":         {`{`, jsonHeaders, 400, "invalid_request"},
		"wrong type":       {`{}`, map[string]string{"Content-Type": "text/plain"}, 415, "unsupported_media"},
		"empty question":   {`{"language":"en","lines":[{"id":"L1","text":"x"}]}`, jsonHeaders, 400, "invalid_request"},
		"unsupported lang": {`{"language":"de","question":"q","lines":[{"id":"L1","text":"x"}]}`, jsonHeaders, 422, "language_unavailable"},
		"bad key":          {askBody("q").String(), map[string]string{"Content-Type": "application/json", "Idempotency-Key": "bad key!"}, 400, "invalid_request"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			rec := e.do("POST", "/v1/ask", strings.NewReader(tc.body), tc.headers)
			if rec.Code != tc.status || errorCode(t, rec) != tc.code {
				t.Fatalf("= %d %s", rec.Code, rec.Body.String())
			}
		})
	}
	if e.answerer.calls != 0 {
		t.Fatal("invalid requests must not reach the paid provider")
	}
}

func TestAskBodyTooLarge(t *testing.T) {
	e := newEnv(t, nil)
	big := `{"language":"en","question":"q","lines":[{"id":"L1","text":"` + strings.Repeat("a", 600<<10) + `"}]}`
	rec := e.do("POST", "/v1/ask", strings.NewReader(big), jsonHeaders)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
}

func TestDailyBudgetAndDeviceLimit(t *testing.T) {
	e := newEnv(t, func(c *config.Config, d *Deps) { c.Limits.DailyAsk = 1 })
	if rec := e.do("POST", "/v1/ask", askBody("q1"), jsonHeaders); rec.Code != 200 {
		t.Fatalf("first = %d", rec.Code)
	}
	rec := e.do("POST", "/v1/ask", askBody("q2"), jsonHeaders)
	if rec.Code != 429 || errorCode(t, rec) != "daily_limit_reached" || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("second = %d %s", rec.Code, rec.Body.String())
	}

	e = newEnv(t, func(c *config.Config, d *Deps) { c.Limits.PerDevicePerMinute = 1 })
	h := map[string]string{"Content-Type": "application/json", "X-Luma-Install": "3f1c2b9e-1a2b-4c3d-8e9f-0123456789ab"}
	if rec := e.do("POST", "/v1/ask", askBody("q1"), h); rec.Code != 200 {
		t.Fatalf("first = %d", rec.Code)
	}
	rec = e.do("POST", "/v1/ask", askBody("q2"), h)
	if rec.Code != 429 || errorCode(t, rec) != "rate_limited" {
		t.Fatalf("second = %d %s", rec.Code, rec.Body.String())
	}
}

func multipartAudio(t *testing.T, audio []byte, language string) (*bytes.Buffer, string) {
	t.Helper()
	var b bytes.Buffer
	mw := multipart.NewWriter(&b)
	_ = mw.WriteField("language", language)
	fw, _ := mw.CreateFormFile("audio", "question.m4a")
	_, _ = fw.Write(audio)
	_ = mw.Close()
	return &b, mw.FormDataContentType()
}

var m4a = append([]byte{0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'M', '4', 'A', ' '}, bytes.Repeat([]byte{1}, 64)...)

func TestTranscribe(t *testing.T) {
	e := newEnv(t, nil)
	body, ct := multipartAudio(t, m4a, "yo")
	rec := e.do("POST", "/v1/transcribe", body, map[string]string{"Content-Type": ct, "Idempotency-Key": "asr-key-0001"})
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"transcript":"When is the assignment due?"`) {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
	body, ct = multipartAudio(t, m4a, "yo")
	rec = e.do("POST", "/v1/transcribe", body, map[string]string{"Content-Type": ct, "Idempotency-Key": "asr-key-0001"})
	if rec.Code != 200 || e.yarn.asrCalls != 1 {
		t.Fatalf("retry = %d, asr calls %d", rec.Code, e.yarn.asrCalls)
	}
}

func TestTranscribeRejectsUnsupportedAudioAndUnlistedLanguage(t *testing.T) {
	e := newEnv(t, nil)
	body, ct := multipartAudio(t, []byte("this is not audio at all"), "en")
	rec := e.do("POST", "/v1/transcribe", body, map[string]string{"Content-Type": ct})
	if rec.Code != 415 || errorCode(t, rec) != "unsupported_media" {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
	body, ct = multipartAudio(t, m4a, "ha")
	rec = e.do("POST", "/v1/transcribe", body, map[string]string{"Content-Type": ct})
	if rec.Code != 422 || errorCode(t, rec) != "language_unavailable" || !strings.Contains(rec.Body.String(), "type your question") {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
	if e.yarn.asrCalls != 0 {
		t.Fatal("rejected uploads must not reach YarnGPT")
	}
}

func TestTranscribeTooLarge(t *testing.T) {
	e := newEnv(t, func(c *config.Config, d *Deps) { c.Limits.MaxAudioBytes = 70 << 10 })
	body, ct := multipartAudio(t, append(m4a, bytes.Repeat([]byte{2}, 200<<10)...), "en")
	rec := e.do("POST", "/v1/transcribe", body, map[string]string{"Content-Type": ct})
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
}

func TestSpeech(t *testing.T) {
	e := newEnv(t, nil)
	rec := e.do("POST", "/v1/speech", strings.NewReader(`{"text":"Ẹ kú àárọ̀","language":"yo"}`), withKey("tts-key-0001"))
	if rec.Code != 200 || rec.Header().Get("Content-Type") != "audio/mpeg" || rec.Body.String() != "ID3fake" {
		t.Fatalf("= %d %q %q", rec.Code, rec.Header().Get("Content-Type"), rec.Body.String())
	}
	if rec.Header().Get("X-Luma-Voice") != "idera" {
		t.Fatalf("voice header = %q", rec.Header().Get("X-Luma-Voice"))
	}
	rec = e.do("POST", "/v1/speech", strings.NewReader(`{"text":"Ẹ kú àárọ̀","language":"yo"}`), withKey("tts-key-0001"))
	if rec.Code != 200 || e.yarn.ttsCalls != 1 {
		t.Fatalf("replay = %d, tts calls %d", rec.Code, e.yarn.ttsCalls)
	}
}

func TestSpeechNeverSubstitutesLanguage(t *testing.T) {
	e := newEnv(t, nil)
	rec := e.do("POST", "/v1/speech", strings.NewReader(`{"text":"Ina kwana","language":"ha"}`), jsonHeaders)
	if rec.Code != 422 || errorCode(t, rec) != "language_unavailable" || !strings.Contains(rec.Body.String(), "No other language was used") {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
	if e.yarn.ttsCalls != 0 {
		t.Fatal("no voice should have been used")
	}
}

func TestSpeechTooLong(t *testing.T) {
	e := newEnv(t, nil)
	rec := e.do("POST", "/v1/speech", strings.NewReader(`{"text":"`+strings.Repeat("a", 2000)+`","language":"en"}`), jsonHeaders)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("= %d %s", rec.Code, rec.Body.String())
	}
}

func TestClientTokenRequiredWhenConfigured(t *testing.T) {
	e := newEnv(t, func(c *config.Config, d *Deps) { c.ClientToken = "pilot-token" })
	if rec := e.do("POST", "/v1/ask", askBody("q"), jsonHeaders); rec.Code != 401 {
		t.Fatalf("without token = %d", rec.Code)
	}
	h := map[string]string{"Content-Type": "application/json", "X-Luma-Client": "pilot-token"}
	if rec := e.do("POST", "/v1/ask", askBody("q"), h); rec.Code != 200 {
		t.Fatalf("with token = %d", rec.Code)
	}
	if rec := e.do("GET", "/health", nil, nil); rec.Code != 200 {
		t.Fatal("health must not require the token")
	}
}

func TestLogsNeverContainContent(t *testing.T) {
	e := newEnv(t, nil)
	e.do("POST", "/v1/ask", askBody(secretQuestion), withKey("log-key-00001"))
	body, ct := multipartAudio(t, m4a, "en")
	e.do("POST", "/v1/transcribe", body, map[string]string{"Content-Type": ct})
	e.do("POST", "/v1/speech", strings.NewReader(`{"text":"The secret spoken answer","language":"en"}`), jsonHeaders)
	logs := e.logs.String()
	for _, secret := range []string{secretQuestion, secretLine, "When is the assignment due?", "Submit it on Friday", "The secret spoken answer", "ftyp"} {
		if strings.Contains(logs, secret) {
			t.Errorf("logs contain request content %q", secret)
		}
	}
	if !strings.Contains(logs, `"route":"POST /v1/ask"`) || !strings.Contains(logs, `"lines":3`) {
		t.Fatalf("access log missing expected metadata:\n%s", logs)
	}
}

func TestUnknownRoute(t *testing.T) {
	e := newEnv(t, nil)
	if rec := e.do("GET", "/v1/nope", nil, nil); rec.Code != 404 {
		t.Fatalf("= %d", rec.Code)
	}
	if rec := e.do("GET", "/v1/ask", nil, nil); rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET /v1/ask = %d", rec.Code)
	}
}

func TestPreviewFixturesModeIsReported(t *testing.T) {
	e := newEnv(t, func(c *config.Config, d *Deps) { c.PreviewFixtures = true })
	for _, path := range []string{"/health", "/v1/capabilities"} {
		rec := e.do("GET", path, nil, nil)
		if !strings.Contains(rec.Body.String(), `"mode":"preview-fixtures"`) {
			t.Fatalf("%s does not report preview mode: %s", path, rec.Body.String())
		}
	}
	e = newEnv(t, nil)
	if rec := e.do("GET", "/v1/capabilities", nil, nil); !strings.Contains(rec.Body.String(), `"mode":"live"`) {
		t.Fatalf("live mode not reported: %s", rec.Body.String())
	}
}
