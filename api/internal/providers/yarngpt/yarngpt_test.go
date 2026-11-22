package yarngpt

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"luma/api/internal/apierr"
)

func fastClient(url string) *Client {
	c := New(url, "sk_live_test.secret")
	c.SetPollInterval(time.Millisecond, 2*time.Millisecond)
	return c
}

func kindOf(err error) apierr.Kind {
	var e *apierr.Error
	if errors.As(err, &e) {
		return e.Kind
	}
	return ""
}

func TestTranscribeSubmitsMultipartAndPolls(t *testing.T) {
	var polls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk_live_test.secret" {
			t.Errorf("missing auth on %s", r.URL.Path)
		}
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/asr":
			if k := r.Header.Get("Idempotency-Key"); !strings.HasPrefix(k, "luma-asr-") || len(k) > 64 || strings.Contains(k, ":") {
				t.Errorf("bad Idempotency-Key %q", k)
			}
			f, hdr, err := r.FormFile("file")
			if err != nil {
				t.Errorf("no file part: %v", err)
			} else {
				b, _ := io.ReadAll(f)
				if string(b) != "fake-m4a" || hdr.Filename != "question.m4a" {
					t.Errorf("file = %q %q", b, hdr.Filename)
				}
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = io.WriteString(w, `{"job_id":"job-1","status":"queued","audio_seconds":3.2}`)
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/asr/job-1":
			if atomic.AddInt32(&polls, 1) < 3 {
				_, _ = io.WriteString(w, `{"status":"processing","percentage":0,"transcript":null}`)
				return
			}
			_, _ = io.WriteString(w, `{"status":"completed","percentage":100,"transcript":"  Ìgbà wo ni a ó fi iṣẹ́ sílẹ̀?  "}`)
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
	}))
	defer srv.Close()

	got, err := fastClient(srv.URL).Transcribe(context.Background(), "req-12345678", []byte("fake-m4a"), "question.m4a")
	if err != nil {
		t.Fatal(err)
	}
	if got != "Ìgbà wo ni a ó fi iṣẹ́ sílẹ̀?" {
		t.Fatalf("transcript = %q", got)
	}
	if polls != 3 {
		t.Fatalf("polls = %d", polls)
	}
}

func TestSynthesizeDownloadsWithoutLeakingKey(t *testing.T) {
	storage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Error("API key was sent to the storage host")
		}
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = io.WriteString(w, "ID3-mp3-bytes")
	}))
	defer storage.Close()

	var body string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/tts":
			b, _ := io.ReadAll(r.Body)
			body = string(b)
			w.WriteHeader(http.StatusAccepted)
			_, _ = io.WriteString(w, `{"job_id":"tts-9","status":"queued"}`)
		case r.URL.Path == "/api/v1/status/tts-9":
			_, _ = io.WriteString(w, `{"status":"completed","percentage":100,"audio_url":"`+storage.URL+`/signed/a.mp3?sig=x"}`)
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
	}))
	defer srv.Close()

	audio, ct, err := fastClient(srv.URL).Synthesize(context.Background(), "req-abcdefgh", "Ẹ kú àárọ̀", "idera")
	if err != nil {
		t.Fatal(err)
	}
	if string(audio) != "ID3-mp3-bytes" || ct != "audio/mpeg" {
		t.Fatalf("audio = %q ct = %q", audio, ct)
	}
	if !strings.Contains(body, `"voice":"idera"`) || !strings.Contains(body, `"output_format":"mp3"`) || strings.Contains(body, "target_language") {
		t.Fatalf("tts body = %s", body)
	}
}

func TestSubmitReplaysAfterAlreadyExists(t *testing.T) {
	var posts int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/asr":
			if atomic.AddInt32(&posts, 1) == 1 {
				w.WriteHeader(http.StatusConflict)
				_, _ = io.WriteString(w, `{"error":{"code":"ALREADY_EXISTS","message":"in progress"}}`)
				return
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = io.WriteString(w, `{"job_id":"j"}`)
		case "/api/v1/asr/j":
			_, _ = io.WriteString(w, `{"status":"completed","transcript":""}`)
		}
	}))
	defer srv.Close()
	c := fastClient(srv.URL)
	c.sleep = func(ctx context.Context, d time.Duration) error { return nil }
	got, err := c.Transcribe(context.Background(), "req-12345678", []byte("x"), "q.m4a")
	if err != nil || got != "" || posts != 2 {
		t.Fatalf("got %q err %v posts %d", got, err, posts)
	}
}

func TestErrorMapping(t *testing.T) {
	cases := []struct {
		status int
		body   string
		kind   apierr.Kind
	}{
		{402, `{"error":{"code":"QUOTA_EXCEEDED","message":"Insufficient credits","details":{"credits_remaining":0}}}`, apierr.KindCreditsExhausted},
		{402, `{"error":{"code":"SUBSCRIPTION_INACTIVE"}}`, apierr.KindCreditsExhausted},
		{401, `{"error":{"code":"INVALID_API_KEY"}}`, apierr.KindProviderMisconfig},
		{429, `{"error":{"code":"RATE_LIMITED"}}`, apierr.KindProviderBusy},
		{413, `{"error":{"code":"PAYLOAD_TOO_LARGE","service":"nginx-ingress"}}`, apierr.KindTooLarge},
		{404, `{"error":{"code":"VOICE_NOT_FOUND"}}`, apierr.KindLanguageUnavailable},
		{503, `{"error":{"code":"SERVICE_UNAVAILABLE"}}`, apierr.KindProviderUnavailable},
		{504, `{"error":{"code":"PROVIDER_TIMEOUT"}}`, apierr.KindProviderTimeout},
	}
	for _, tc := range cases {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			_, _ = io.WriteString(w, tc.body)
		}))
		_, _, err := fastClient(srv.URL).Synthesize(context.Background(), "req-12345678", "hi", "v")
		srv.Close()
		if got := kindOf(err); got != tc.kind {
			t.Errorf("status %d %s: kind = %q, want %q", tc.status, tc.body, got, tc.kind)
		}
	}
}

func TestFailedJobIsReported(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.WriteHeader(http.StatusAccepted)
			_, _ = io.WriteString(w, `{"job_id":"bad"}`)
			return
		}
		_, _ = io.WriteString(w, `{"status":"failed","error_code":"INVALID_INPUT","error_message":"No speech"}`)
	}))
	defer srv.Close()
	_, err := fastClient(srv.URL).Transcribe(context.Background(), "req-12345678", []byte("x"), "q.m4a")
	if kindOf(err) != apierr.KindProviderRejected {
		t.Fatalf("err = %v", err)
	}
}

func TestPollingStopsAtDeadline(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.WriteHeader(http.StatusAccepted)
			_, _ = io.WriteString(w, `{"job_id":"slow"}`)
			return
		}
		_, _ = io.WriteString(w, `{"status":"processing"}`)
	}))
	defer srv.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, err := fastClient(srv.URL).Transcribe(ctx, "req-12345678", []byte("x"), "q.m4a")
	var e *apierr.Error
	if !errors.As(err, &e) || e.Kind != apierr.KindProviderTimeout || !e.Retryable {
		t.Fatalf("err = %v", err)
	}
}

func TestProviderKeyFitsLimits(t *testing.T) {
	k := ProviderKey("tts", strings.Repeat("a", 64))
	if len(k) > 64 || strings.Contains(k, ":") {
		t.Fatalf("key %q is invalid", k)
	}
	if ProviderKey("tts", "abc12345") != "luma-tts-abc12345" {
		t.Fatal("short keys should pass through")
	}
}

func TestDirectoryResolvesVoicesAndASRLanguages(t *testing.T) {
	var voiceCalls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/voices":
			atomic.AddInt32(&voiceCalls, 1)
			_, _ = io.WriteString(w, `{"voices":[
			  {"name":"umar","languages":["en","ha"],"default":true},
			  {"name":"idera","languages":[{"code":"yo","name":"Yoruba"}]},
			  {"name":"chinenye","language":"Igbo"}
			]}`)
		case "/api/v1/asr/languages":
			_, _ = io.WriteString(w, `{"model_id":"m","languages":["en","yo","ig","pcm"]}`)
		}
	}))
	defer srv.Close()
	d := NewDirectory(fastClient(srv.URL), map[string]string{"pcm": "wura"}, nil)
	ctx := context.Background()

	for lang, want := range map[string]string{"en": "umar", "ha": "umar", "yo": "idera", "ig": "chinenye", "pcm": "wura"} {
		if v, ok := d.VoiceFor(ctx, lang); !ok || v != want {
			t.Errorf("VoiceFor(%s) = %q %v, want %q", lang, v, ok, want)
		}
	}
	if voiceCalls != 1 {
		t.Fatalf("voices fetched %d times, want cached", voiceCalls)
	}
	if l := d.TranscriptionListed(ctx, "yo"); l == nil || !*l {
		t.Fatal("yo should be listed")
	}
	if l := d.TranscriptionListed(ctx, "ha"); l == nil || *l {
		t.Fatal("ha should be reported as not listed")
	}
}

func TestDirectoryNeverSubstitutesLanguage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `[{"name":"umar","languages":["en"],"default":true}]`)
	}))
	defer srv.Close()
	d := NewDirectory(fastClient(srv.URL), nil, nil)
	if v, ok := d.VoiceFor(context.Background(), "ig"); ok {
		t.Fatalf("got voice %q for Igbo from an English-only list", v)
	}
}

func TestDirectoryUnknownWhenListUnavailable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, `{"error":{"code":"PROVIDER_TIMEOUT"}}`)
	}))
	defer srv.Close()
	d := NewDirectory(fastClient(srv.URL), nil, nil)
	if l := d.TranscriptionListed(context.Background(), "yo"); l != nil {
		t.Fatalf("listed = %v, want unknown (nil)", *l)
	}
}
