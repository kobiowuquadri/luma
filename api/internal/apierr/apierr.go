// Package apierr defines the error kinds the API returns to the app.
//
// Every error response has the shape
//
//	{"error": {"code": "...", "message": "...", "retryable": bool, "provider": "..."}}
//
// The code is stable and machine-readable; the app maps it to its own words.
// The message is a short, actionable English fallback.
package apierr

import (
	"errors"
	"fmt"
	"net/http"
	"time"
)

// Kind is a stable error code.
type Kind string

const (
	KindInvalid             Kind = "invalid_request"
	KindTooLarge            Kind = "payload_too_large"
	KindUnsupportedMedia    Kind = "unsupported_media"
	KindUnauthorized        Kind = "unauthorized"
	KindNotConfigured       Kind = "not_configured"
	KindLanguageUnavailable Kind = "language_unavailable"
	KindRateLimited         Kind = "rate_limited"
	KindDailyLimit          Kind = "daily_limit_reached"
	KindIdempotencyConflict Kind = "idempotency_conflict"
	KindCreditsExhausted    Kind = "credits_exhausted"
	KindProviderBusy        Kind = "provider_busy"
	KindProviderUnavailable Kind = "provider_unavailable"
	KindProviderTimeout     Kind = "provider_timeout"
	KindProviderMisconfig   Kind = "provider_misconfigured"
	KindProviderRejected    Kind = "provider_rejected"
	KindInternal            Kind = "internal"
)

// Error is an API error with a user-facing message and log-only detail.
type Error struct {
	Kind       Kind
	Message    string
	Provider   string
	Retryable  bool
	RetryAfter time.Duration
	// Log-only fields. Never copy request content into these.
	UpstreamStatus int
	UpstreamCode   string
	Err            error
}

func (e *Error) Error() string {
	s := string(e.Kind)
	if e.Provider != "" {
		s = e.Provider + ": " + s
	}
	if e.UpstreamStatus != 0 {
		s += fmt.Sprintf(" (upstream %d %s)", e.UpstreamStatus, e.UpstreamCode)
	}
	if e.Err != nil {
		s += ": " + e.Err.Error()
	}
	return s
}

func (e *Error) Unwrap() error { return e.Err }

// New creates an error of the given kind with the default message.
func New(kind Kind) *Error {
	return &Error{Kind: kind, Message: DefaultMessage(kind), Retryable: DefaultRetryable(kind)}
}

// Invalid creates a validation error with a specific message.
func Invalid(msg string) *Error {
	return &Error{Kind: KindInvalid, Message: msg}
}

// As extracts an *Error, wrapping unknown errors as internal errors.
func As(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return &Error{Kind: KindInternal, Message: DefaultMessage(KindInternal), Retryable: true, Err: err}
}

// HTTPStatus maps a kind to the status code the API responds with.
func HTTPStatus(k Kind) int {
	switch k {
	case KindInvalid:
		return http.StatusBadRequest
	case KindTooLarge:
		return http.StatusRequestEntityTooLarge
	case KindUnsupportedMedia:
		return http.StatusUnsupportedMediaType
	case KindUnauthorized:
		return http.StatusUnauthorized
	case KindLanguageUnavailable:
		return http.StatusUnprocessableEntity
	case KindRateLimited, KindDailyLimit, KindProviderBusy:
		return http.StatusTooManyRequests
	case KindIdempotencyConflict:
		return http.StatusConflict
	case KindNotConfigured, KindCreditsExhausted, KindProviderUnavailable, KindProviderMisconfig:
		return http.StatusServiceUnavailable
	case KindProviderTimeout:
		return http.StatusGatewayTimeout
	case KindProviderRejected:
		return http.StatusBadGateway
	default:
		return http.StatusInternalServerError
	}
}

// DefaultRetryable reports whether retrying the same request may succeed.
func DefaultRetryable(k Kind) bool {
	switch k {
	case KindRateLimited, KindProviderBusy, KindProviderUnavailable, KindProviderTimeout, KindInternal:
		return true
	default:
		return false
	}
}

// DefaultMessage is the English fallback message for each kind.
func DefaultMessage(k Kind) string {
	switch k {
	case KindInvalid:
		return "The request was not valid."
	case KindTooLarge:
		return "That is too large to send. Try a shorter recording or a shorter passage."
	case KindUnsupportedMedia:
		return "That audio format is not supported. Record again in the app."
	case KindUnauthorized:
		return "This copy of the app is not allowed to use the LUMA server."
	case KindNotConfigured:
		return "This feature is not set up on the LUMA server yet. Reading and saving still work."
	case KindLanguageUnavailable:
		return "This is not available in the selected language yet. No other language was used instead."
	case KindRateLimited:
		return "You have asked many questions in a short time. Wait a minute, then try again."
	case KindDailyLimit:
		return "LUMA has reached today's limit for this feature. Reading still works. Try again tomorrow."
	case KindIdempotencyConflict:
		return "This retry does not match the original request. Start a new request."
	case KindCreditsExhausted:
		return "The LUMA service has run out of AI credits. Reading still works. Please tell the LUMA team."
	case KindProviderBusy:
		return "The AI service is busy. Wait a moment, then try again."
	case KindProviderUnavailable:
		return "The AI service is not responding right now. Try again in a few minutes."
	case KindProviderTimeout:
		return "The AI service took too long to respond. Your request is kept; try again."
	case KindProviderMisconfig:
		return "The LUMA server is not set up correctly for this feature. Please tell the LUMA team."
	case KindProviderRejected:
		return "The AI service could not handle this request. Try asking in a different way."
	default:
		return "Something went wrong on the LUMA server. Try again."
	}
}
