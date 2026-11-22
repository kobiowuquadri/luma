// Package yarngpt calls the hosted YarnGPT API for transcription (ASR) and
// text-to-speech (TTS). These are two separate operations; LUMA never uses
// the speech-to-speech revoicing workflow, which does not answer questions.
//
// Both operations are asynchronous jobs (per https://yarngpt.ai/api-docs):
//
//	POST /api/v1/asr  (multipart "file", Idempotency-Key) -> 202 {job_id}
//	GET  /api/v1/asr/{job_id}                             -> {status, transcript, ...}
//	POST /api/v1/tts  (JSON {text, voice, output_format}, Idempotency-Key) -> 202 {job_id}
//	GET  /api/v1/status/{job_id}                          -> {status, audio_url, ...}
//
// Replaying an Idempotency-Key with the same body returns the original job
// without charging again, so retries reuse the key.
package yarngpt

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"luma/api/internal/apierr"
)

const provider = "yarngpt"

// Client is a YarnGPT API client.
type Client struct {
	baseURL       string
	apiKey        string
	http          *http.Client
	pollMin       time.Duration
	pollMax       time.Duration
	maxAudioBytes int64
	sleep         func(ctx context.Context, d time.Duration) error
}

// New creates a client for baseURL (for example https://api.yarngpt.ai).
func New(baseURL, apiKey string) *Client {
	return &Client{
		baseURL:       strings.TrimRight(baseURL, "/"),
		apiKey:        apiKey,
		http:          &http.Client{Timeout: 60 * time.Second},
		pollMin:       time.Second,
		pollMax:       5 * time.Second,
		maxAudioBytes: 25 << 20,
		sleep:         sleepCtx,
	}
}

// SetPollInterval overrides the polling backoff (used by tests).
func (c *Client) SetPollInterval(min, max time.Duration) { c.pollMin, c.pollMax = min, max }

type submitResponse struct {
	JobID  string `json:"job_id"`
	Status string `json:"status"`
}

type jobStatus struct {
	Status       string  `json:"status"`
	Transcript   *string `json:"transcript"`
	AudioURL     string  `json:"audio_url"`
	ErrorCode    *string `json:"error_code"`
	ErrorMessage string  `json:"error_message"`
	UserMessage  string  `json:"user_message"`
}

type errorEnvelope struct {
	Error struct {
		Code        string          `json:"code"`
		Message     string          `json:"message"`
		UserMessage string          `json:"user_message"`
		TraceID     string          `json:"trace_id"`
		Details     json.RawMessage `json:"details"`
	} `json:"error"`
}

// ProviderKey derives the Idempotency-Key sent to YarnGPT (1-64 chars, no
// colon) from the app's request key, namespaced by operation.
func ProviderKey(op, clientKey string) string {
	k := "luma-" + op + "-" + clientKey
	if len(k) <= 64 && !strings.Contains(k, ":") {
		return k
	}
	sum := sha256.Sum256([]byte(clientKey))
	return "luma-" + op + "-" + hex.EncodeToString(sum[:])[:40]
}

// Transcribe uploads a recording and waits for its transcript. An empty
// transcript (silence) is returned as "" without an error.
func (c *Client) Transcribe(ctx context.Context, idemKey string, audio []byte, filename string) (string, error) {
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err := fw.Write(audio); err != nil {
		return "", err
	}
	if err := mw.Close(); err != nil {
		return "", err
	}
	payload := body.Bytes()
	jobID, err := c.submit(ctx, "/api/v1/asr", ProviderKey("asr", idemKey), mw.FormDataContentType(), payload)
	if err != nil {
		return "", err
	}
	st, err := c.poll(ctx, "/api/v1/asr/"+url.PathEscape(jobID))
	if err != nil {
		return "", err
	}
	if st.Transcript == nil {
		return "", nil
	}
	return strings.TrimSpace(*st.Transcript), nil
}

type ttsRequest struct {
	Text         string `json:"text"`
	Voice        string `json:"voice,omitempty"`
	OutputFormat string `json:"output_format"`
}

// Synthesize turns text into MP3 audio with the given voice.
func (c *Client) Synthesize(ctx context.Context, idemKey, text, voice string) ([]byte, string, error) {
	payload, err := json.Marshal(ttsRequest{Text: text, Voice: voice, OutputFormat: "mp3"})
	if err != nil {
		return nil, "", err
	}
	jobID, err := c.submit(ctx, "/api/v1/tts", ProviderKey("tts", idemKey), "application/json", payload)
	if err != nil {
		return nil, "", err
	}
	st, err := c.poll(ctx, "/api/v1/status/"+url.PathEscape(jobID))
	if err != nil {
		return nil, "", err
	}
	if st.AudioURL == "" {
		return nil, "", &apierr.Error{Kind: apierr.KindProviderUnavailable, Provider: provider, Retryable: true,
			Message: apierr.DefaultMessage(apierr.KindProviderUnavailable), UpstreamCode: "no_audio_url"}
	}
	return c.download(ctx, st.AudioURL)
}

// submit POSTs a job and returns its ID. A 409 ALREADY_EXISTS means the same
// key is still being accepted, so it waits and replays.
func (c *Client) submit(ctx context.Context, path, idemKey, contentType string, payload []byte) (string, error) {
	for attempt := 0; ; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(payload))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Content-Type", contentType)
		req.Header.Set("Idempotency-Key", idemKey)
		resp, err := c.http.Do(req)
		if err != nil {
			return "", transportError(ctx, err)
		}
		raw, rerr := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()
		if rerr != nil {
			return "", transportError(ctx, rerr)
		}
		if resp.StatusCode == http.StatusConflict && attempt < 5 {
			var env errorEnvelope
			_ = json.Unmarshal(raw, &env)
			if env.Error.Code == "ALREADY_EXISTS" {
				if err := c.sleep(ctx, 1500*time.Millisecond); err != nil {
					return "", transportError(ctx, err)
				}
				continue
			}
		}
		if resp.StatusCode < 200 || resp.StatusCode > 299 {
			return "", mapHTTPError(resp, raw)
		}
		var sr submitResponse
		if err := json.Unmarshal(raw, &sr); err != nil || sr.JobID == "" {
			return "", &apierr.Error{Kind: apierr.KindProviderUnavailable, Provider: provider, Retryable: true,
				Message: apierr.DefaultMessage(apierr.KindProviderUnavailable), UpstreamCode: "no_job_id"}
		}
		return sr.JobID, nil
	}
}

// poll waits for a job to finish, backing off from pollMin toward pollMax.
func (c *Client) poll(ctx context.Context, path string) (jobStatus, error) {
	wait := c.pollMin
	for {
		if err := c.sleep(ctx, wait); err != nil {
			return jobStatus{}, transportError(ctx, err)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
		if err != nil {
			return jobStatus{}, err
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		resp, err := c.http.Do(req)
		if err != nil {
			return jobStatus{}, transportError(ctx, err)
		}
		raw, rerr := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		resp.Body.Close()
		if rerr != nil {
			return jobStatus{}, transportError(ctx, rerr)
		}
		if resp.StatusCode < 200 || resp.StatusCode > 299 {
			return jobStatus{}, mapHTTPError(resp, raw)
		}
		var st jobStatus
		if err := json.Unmarshal(raw, &st); err != nil {
			return jobStatus{}, &apierr.Error{Kind: apierr.KindProviderUnavailable, Provider: provider, Retryable: true,
				Message: apierr.DefaultMessage(apierr.KindProviderUnavailable), Err: err}
		}
		switch strings.ToLower(st.Status) {
		case "completed", "complete", "succeeded", "success", "done":
			return st, nil
		case "failed", "error", "cancelled", "canceled":
			return st, jobFailed(st)
		}
		wait = time.Duration(float64(wait) * 1.5)
		if wait > c.pollMax {
			wait = c.pollMax
		}
	}
}

func jobFailed(st jobStatus) error {
	code := ""
	if st.ErrorCode != nil {
		code = *st.ErrorCode
	}
	e := &apierr.Error{Provider: provider, UpstreamCode: "job_failed:" + code}
	switch code {
	case "INVALID_INPUT", "PROVIDER_REJECTED":
		e.Kind = apierr.KindProviderRejected
		e.Message = "The recording could not be understood. Record again a little closer to the phone, or type your question."
	case "PROVIDER_TIMEOUT":
		e.Kind = apierr.KindProviderTimeout
	default:
		e.Kind = apierr.KindProviderUnavailable
	}
	if e.Message == "" {
		e.Message = apierr.DefaultMessage(e.Kind)
	}
	e.Retryable = apierr.DefaultRetryable(e.Kind)
	return e
}

// download fetches the signed audio URL. The API key is only sent when the
// URL is on the API host itself, never to a third-party storage host.
func (c *Client) download(ctx context.Context, audioURL string) ([]byte, string, error) {
	base, _ := url.Parse(c.baseURL)
	u, err := url.Parse(audioURL)
	if err == nil && !u.IsAbs() && base != nil {
		u = base.ResolveReference(u)
	}
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return nil, "", &apierr.Error{Kind: apierr.KindProviderUnavailable, Provider: provider, Retryable: true,
			Message: apierr.DefaultMessage(apierr.KindProviderUnavailable), UpstreamCode: "bad_audio_url"}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, "", err
	}
	if base != nil && base.Host == u.Host {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, "", transportError(ctx, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, "", &apierr.Error{Kind: apierr.KindProviderUnavailable, Provider: provider, Retryable: true,
			Message: apierr.DefaultMessage(apierr.KindProviderUnavailable), UpstreamStatus: resp.StatusCode, UpstreamCode: "audio_download"}
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, c.maxAudioBytes+1))
	if err != nil {
		return nil, "", transportError(ctx, err)
	}
	if int64(len(data)) > c.maxAudioBytes {
		return nil, "", &apierr.Error{Kind: apierr.KindTooLarge, Provider: provider, Message: "The spoken answer was too long to download."}
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" || strings.HasPrefix(ct, "binary/") || strings.HasPrefix(ct, "application/octet-stream") {
		ct = "audio/mpeg"
	}
	return data, ct, nil
}

// mapHTTPError converts YarnGPT's {"error": {"code": ...}} envelope.
func mapHTTPError(resp *http.Response, raw []byte) error {
	var env errorEnvelope
	_ = json.Unmarshal(raw, &env)
	code := env.Error.Code
	e := &apierr.Error{Provider: provider, UpstreamStatus: resp.StatusCode, UpstreamCode: code}
	switch {
	case resp.StatusCode == http.StatusUnauthorized || code == "INVALID_API_KEY":
		e.Kind = apierr.KindProviderMisconfig
	case resp.StatusCode == http.StatusPaymentRequired || code == "QUOTA_EXCEEDED" || code == "SUBSCRIPTION_INACTIVE" || code == "SPENDING_LIMIT_REACHED":
		e.Kind = apierr.KindCreditsExhausted
	case code == "VOICE_NOT_FOUND":
		e.Kind = apierr.KindLanguageUnavailable
		e.Message = "The voice set up for this language is not available. No other voice was used."
	case resp.StatusCode == http.StatusTooManyRequests:
		e.Kind = apierr.KindProviderBusy
		e.RetryAfter = retryAfter(resp.Header.Get("Retry-After"))
	case resp.StatusCode == http.StatusRequestEntityTooLarge || code == "TEXT_TOO_LONG":
		e.Kind = apierr.KindTooLarge
	case code == "IDEMPOTENCY_KEY_REUSED":
		e.Kind = apierr.KindIdempotencyConflict
	case resp.StatusCode == http.StatusGatewayTimeout || code == "PROVIDER_TIMEOUT":
		e.Kind = apierr.KindProviderTimeout
	case resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnprocessableEntity:
		e.Kind = apierr.KindProviderRejected
		e.Message = "The speech service could not use this input. Try recording again, or type instead."
	case resp.StatusCode == http.StatusNotFound:
		e.Kind = apierr.KindProviderMisconfig
	default:
		e.Kind = apierr.KindProviderUnavailable
	}
	if e.Message == "" {
		e.Message = apierr.DefaultMessage(e.Kind)
	}
	e.Retryable = apierr.DefaultRetryable(e.Kind)
	return e
}

func transportError(ctx context.Context, err error) error {
	kind := apierr.KindProviderUnavailable
	var ne interface{ Timeout() bool }
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout()) {
		kind = apierr.KindProviderTimeout
	} else if errors.Is(err, context.Canceled) {
		kind = apierr.KindProviderTimeout
	}
	return &apierr.Error{Kind: kind, Provider: provider, Retryable: true, Message: apierr.DefaultMessage(kind), Err: err}
}

func retryAfter(v string) time.Duration {
	if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 && n < 86400 {
		return time.Duration(n) * time.Second
	}
	return 0
}

func sleepCtx(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("waiting for job: %w", ctx.Err())
	}
}
