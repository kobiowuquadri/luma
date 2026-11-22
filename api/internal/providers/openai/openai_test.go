package openai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"luma/api/internal/apierr"
	"luma/api/internal/ask"
)

func prompt() ask.Prompt {
	return ask.Prompt{Instructions: "rules", Input: []ask.Message{{Role: "user", Content: "[L1] hello"}}}
}

func kindOf(err error) apierr.Kind {
	var e *apierr.Error
	if errors.As(err, &e) {
		return e.Kind
	}
	return ""
}

func TestAnswerSendsStrictSchemaAndParsesOutput(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/responses" || r.Method != http.MethodPost {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer sk-test" {
			t.Errorf("missing bearer auth")
		}
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &got)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{
		  "status": "completed",
		  "output": [
		    {"type": "reasoning", "content": []},
		    {"type": "message", "role": "assistant", "content": [
		      {"type": "output_text", "text": "{\"answer\":\"Friday, 21 November 2026.\",\"answer_in_page\":true,\"source_line_ids\":[\"L5\"]}"}
		    ]}
		  ]
		}`)
	}))
	defer srv.Close()

	c := New(srv.URL+"/v1", "sk-test", "gpt-6-luna", "low", 1200, 5*time.Second)
	a, err := c.Answer(context.Background(), ask.Request{}, prompt())
	if err != nil {
		t.Fatal(err)
	}
	if a.Answer != "Friday, 21 November 2026." || !a.AnswerInPage || len(a.SourceLineIDs) != 1 {
		t.Fatalf("answer = %+v", a)
	}
	if got["store"] != false || got["model"] != "gpt-6-luna" || got["max_output_tokens"].(float64) != 1200 {
		t.Fatalf("request = %v", got)
	}
	format := got["text"].(map[string]any)["format"].(map[string]any)
	if format["type"] != "json_schema" || format["strict"] != true || format["name"] != "luma_answer" {
		t.Fatalf("format = %v", format)
	}
	if got["reasoning"].(map[string]any)["effort"] != "low" {
		t.Fatalf("reasoning = %v", got["reasoning"])
	}
}

func TestAnswerOmitsReasoningWhenUnset(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &got)
		_, _ = io.WriteString(w, `{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"answer\":\"a\",\"answer_in_page\":false,\"source_line_ids\":[]}"}]}]}`)
	}))
	defer srv.Close()
	c := New(srv.URL, "k", "m", "", 500, 5*time.Second)
	if _, err := c.Answer(context.Background(), ask.Request{}, prompt()); err != nil {
		t.Fatal(err)
	}
	if _, ok := got["reasoning"]; ok {
		t.Fatal("reasoning should be omitted")
	}
}

func TestAnswerErrorMapping(t *testing.T) {
	cases := []struct {
		name      string
		status    int
		body      string
		header    string
		kind      apierr.Kind
		retryable bool
	}{
		{"credits exhausted", 429, `{"error":{"message":"no credits","type":"insufficient_quota","code":"credit_balance_exhausted"}}`, "", apierr.KindCreditsExhausted, false},
		{"legacy insufficient quota", 429, `{"error":{"message":"quota","type":"insufficient_quota","code":"insufficient_quota"}}`, "", apierr.KindCreditsExhausted, false},
		{"spend limit", 429, `{"error":{"message":"limit","type":"insufficient_quota","code":"project_spend_limit_exceeded"}}`, "", apierr.KindCreditsExhausted, false},
		{"rate limited", 429, `{"error":{"message":"slow down","type":"rate_limit_error","code":"slow_down"}}`, "7", apierr.KindProviderBusy, true},
		{"bad key", 401, `{"error":{"message":"Incorrect API key provided","type":"invalid_request_error","code":"invalid_api_key"}}`, "", apierr.KindProviderMisconfig, false},
		{"unknown model", 404, `{"error":{"message":"model not found","code":"model_not_found"}}`, "", apierr.KindProviderMisconfig, false},
		{"overloaded", 503, `{"error":{"message":"overloaded","type":"service_unavailable_error","code":"server_is_overloaded"}}`, "", apierr.KindProviderUnavailable, true},
		{"server error", 500, `{"error":{"message":"oops"}}`, "", apierr.KindProviderUnavailable, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tc.header != "" {
					w.Header().Set("Retry-After", tc.header)
				}
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, tc.body)
			}))
			defer srv.Close()
			_, err := New(srv.URL, "k", "m", "low", 500, 5*time.Second).Answer(context.Background(), ask.Request{}, prompt())
			var e *apierr.Error
			if !errors.As(err, &e) || e.Kind != tc.kind || e.Retryable != tc.retryable {
				t.Fatalf("err = %#v, want kind %s retryable %v", err, tc.kind, tc.retryable)
			}
			if tc.header != "" && e.RetryAfter != 7*time.Second {
				t.Fatalf("RetryAfter = %v", e.RetryAfter)
			}
		})
	}
}

func TestAnswerRefusalAndIncomplete(t *testing.T) {
	bodies := map[string]string{
		"refusal":    `{"status":"completed","output":[{"type":"message","content":[{"type":"refusal","refusal":"I can't help with that."}]}]}`,
		"incomplete": `{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"output":[]}`,
		"not json":   `{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"Friday"}]}]}`,
	}
	for name, body := range bodies {
		t.Run(name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.WriteString(w, body)
			}))
			defer srv.Close()
			_, err := New(srv.URL, "k", "m", "", 500, 5*time.Second).Answer(context.Background(), ask.Request{}, prompt())
			if kindOf(err) != apierr.KindProviderRejected {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestAnswerTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
	}))
	defer srv.Close()
	_, err := New(srv.URL, "k", "m", "", 500, 50*time.Millisecond).Answer(context.Background(), ask.Request{}, prompt())
	var e *apierr.Error
	if !errors.As(err, &e) || e.Kind != apierr.KindProviderTimeout || !e.Retryable {
		t.Fatalf("err = %v", err)
	}
}
