// Package openai calls the OpenAI Responses API over plain HTTP to produce a
// short grounded answer as strict JSON.
//
// Reference: POST https://api.openai.com/v1/responses with text.format of
// type "json_schema" (strict). store is false so responses are not retained
// for later retrieval.
package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"luma/api/internal/apierr"
	"luma/api/internal/ask"
)

const provider = "openai"

// Client is a minimal Responses API client.
type Client struct {
	baseURL         string
	apiKey          string
	model           string
	reasoningEffort string
	maxOutputTokens int
	http            *http.Client
}

// New creates a client. timeout bounds each call.
func New(baseURL, apiKey, model, reasoningEffort string, maxOutputTokens int, timeout time.Duration) *Client {
	return &Client{
		baseURL:         strings.TrimRight(baseURL, "/"),
		apiKey:          apiKey,
		model:           model,
		reasoningEffort: reasoningEffort,
		maxOutputTokens: maxOutputTokens,
		http:            &http.Client{Timeout: timeout},
	}
}

// Model returns the configured model ID.
func (c *Client) Model() string { return c.model }

type reasoning struct {
	Effort string `json:"effort"`
}

type jsonSchemaFormat struct {
	Type   string         `json:"type"`
	Name   string         `json:"name"`
	Schema map[string]any `json:"schema"`
	Strict bool           `json:"strict"`
}

type textConfig struct {
	Format jsonSchemaFormat `json:"format"`
}

type createRequest struct {
	Model           string        `json:"model"`
	Instructions    string        `json:"instructions"`
	Input           []ask.Message `json:"input"`
	MaxOutputTokens int           `json:"max_output_tokens"`
	Store           bool          `json:"store"`
	Reasoning       *reasoning    `json:"reasoning,omitempty"`
	Text            textConfig    `json:"text"`
}

type contentPart struct {
	Type    string `json:"type"`
	Text    string `json:"text"`
	Refusal string `json:"refusal"`
}

type outputItem struct {
	Type    string        `json:"type"`
	Role    string        `json:"role"`
	Content []contentPart `json:"content"`
}

type createResponse struct {
	Status            string `json:"status"`
	Model             string `json:"model"`
	IncompleteDetails *struct {
		Reason string `json:"reason"`
	} `json:"incomplete_details"`
	Output []outputItem `json:"output"`
}

type errorEnvelope struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    any    `json:"code"`
	} `json:"error"`
}

// Answer sends the prompt and returns the parsed structured answer.
func (c *Client) Answer(ctx context.Context, _ ask.Request, p ask.Prompt) (ask.ModelAnswer, error) {
	body := createRequest{
		Model:           c.model,
		Instructions:    p.Instructions,
		Input:           p.Input,
		MaxOutputTokens: c.maxOutputTokens,
		Store:           false,
		Text: textConfig{Format: jsonSchemaFormat{
			Type: "json_schema", Name: "luma_answer", Schema: ask.Schema(), Strict: true,
		}},
	}
	if c.reasoningEffort != "" {
		body.Reasoning = &reasoning{Effort: c.reasoningEffort}
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return ask.ModelAnswer{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/responses", bytes.NewReader(buf))
	if err != nil {
		return ask.ModelAnswer{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return ask.ModelAnswer{}, transportError(ctx, err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return ask.ModelAnswer{}, transportError(ctx, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return ask.ModelAnswer{}, mapHTTPError(resp, raw)
	}

	var out createResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return ask.ModelAnswer{}, &apierr.Error{Kind: apierr.KindProviderUnavailable, Provider: provider, Retryable: true,
			Message: apierr.DefaultMessage(apierr.KindProviderUnavailable), Err: fmt.Errorf("decode response: %w", err)}
	}
	return parseAnswer(out)
}

func parseAnswer(out createResponse) (ask.ModelAnswer, error) {
	switch out.Status {
	case "completed", "":
	case "incomplete":
		reason := ""
		if out.IncompleteDetails != nil {
			reason = out.IncompleteDetails.Reason
		}
		msg := "The answer was cut short. Try a shorter or simpler question."
		if reason == "content_filter" {
			msg = "LUMA can't answer that question. Try asking about the page in a different way."
		}
		return ask.ModelAnswer{}, &apierr.Error{Kind: apierr.KindProviderRejected, Provider: provider, Message: msg, UpstreamCode: "incomplete:" + reason}
	default:
		return ask.ModelAnswer{}, &apierr.Error{Kind: apierr.KindProviderUnavailable, Provider: provider, Retryable: true,
			Message: apierr.DefaultMessage(apierr.KindProviderUnavailable), UpstreamCode: "status:" + out.Status}
	}
	for _, item := range out.Output {
		if item.Type != "message" {
			continue
		}
		for _, part := range item.Content {
			switch part.Type {
			case "refusal":
				return ask.ModelAnswer{}, &apierr.Error{Kind: apierr.KindProviderRejected, Provider: provider,
					Message: "LUMA can't answer that question. Try asking about the page in a different way.", UpstreamCode: "refusal"}
			case "output_text":
				var a ask.ModelAnswer
				if err := json.Unmarshal([]byte(part.Text), &a); err != nil {
					return ask.ModelAnswer{}, &apierr.Error{Kind: apierr.KindProviderRejected, Provider: provider,
						Message: "LUMA could not write an answer. Try again.", Err: fmt.Errorf("answer was not valid JSON: %w", err)}
				}
				return a, nil
			}
		}
	}
	return ask.ModelAnswer{}, &apierr.Error{Kind: apierr.KindProviderRejected, Provider: provider,
		Message: "LUMA could not write an answer. Try again.", UpstreamCode: "no_output_text"}
}

// creditCodes are OpenAI billing errors that retrying will not fix.
var creditCodes = map[string]bool{
	"insufficient_quota":                true,
	"credit_balance_exhausted":          true,
	"billing_hard_limit_reached":        true,
	"project_spend_limit_exceeded":      true,
	"organization_spend_limit_exceeded": true,
	"organization_usage_limit_exceeded": true,
}

func mapHTTPError(resp *http.Response, raw []byte) error {
	var env errorEnvelope
	_ = json.Unmarshal(raw, &env)
	code := ""
	if env.Error.Code != nil {
		code = fmt.Sprint(env.Error.Code)
	}
	e := &apierr.Error{Provider: provider, UpstreamStatus: resp.StatusCode, UpstreamCode: firstNonEmpty(code, env.Error.Type)}
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		e.Kind = apierr.KindProviderMisconfig
	case resp.StatusCode == http.StatusNotFound:
		e.Kind = apierr.KindProviderMisconfig // usually an unknown model ID
	case resp.StatusCode == http.StatusTooManyRequests && (creditCodes[code] || creditCodes[env.Error.Type]):
		e.Kind = apierr.KindCreditsExhausted
	case resp.StatusCode == http.StatusTooManyRequests:
		e.Kind = apierr.KindProviderBusy
		e.RetryAfter = retryAfter(resp.Header.Get("Retry-After"))
	case resp.StatusCode == http.StatusBadRequest && code == "context_length_exceeded":
		e.Kind = apierr.KindTooLarge
	case resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnprocessableEntity:
		e.Kind = apierr.KindProviderMisconfig // our request shape or model settings were rejected
	case resp.StatusCode >= 500:
		e.Kind = apierr.KindProviderUnavailable
		e.RetryAfter = retryAfter(resp.Header.Get("Retry-After"))
	default:
		e.Kind = apierr.KindProviderUnavailable
	}
	e.Message = apierr.DefaultMessage(e.Kind)
	e.Retryable = apierr.DefaultRetryable(e.Kind)
	return e
}

func transportError(ctx context.Context, err error) error {
	kind := apierr.KindProviderUnavailable
	var ne interface{ Timeout() bool }
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout()) {
		kind = apierr.KindProviderTimeout
	}
	return &apierr.Error{Kind: kind, Provider: provider, Retryable: true, Message: apierr.DefaultMessage(kind), Err: err}
}

func retryAfter(v string) time.Duration {
	if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 && n < 3600 {
		return time.Duration(n) * time.Second
	}
	return 0
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if s != "" {
			return s
		}
	}
	return ""
}
