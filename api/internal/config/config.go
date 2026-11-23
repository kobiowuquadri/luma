// Package config loads the API configuration from environment variables.
//
// Provider keys are optional: a missing key turns the matching feature off
// and the API reports it as unavailable instead of failing to start.
package config

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Limits bound request sizes and paid usage.
type Limits struct {
	MaxQuestionChars   int `json:"maxQuestionChars"`
	MaxLineChars       int `json:"maxLineChars"`
	MaxLines           int `json:"maxLines"`
	MaxDocumentChars   int `json:"maxDocumentChars"`
	MaxHistoryTurns    int `json:"maxHistoryTurns"`
	MaxHistoryChars    int `json:"maxHistoryChars"`
	MaxAnswerWords     int `json:"maxAnswerWords"`
	MaxExplainWords    int `json:"maxExplainWords"`
	MaxSpeechChars     int `json:"maxSpeechChars"`
	MaxAudioBytes      int `json:"maxAudioBytes"`
	MaxRecordingSecs   int `json:"maxRecordingSeconds"`
	MaxOutputTokens    int `json:"-"`
	PerDevicePerMinute int `json:"perDevicePerMinute"`
	PerDevicePerDay    int `json:"perDevicePerDay"`
	DailyAsk           int `json:"-"`
	DailyTranscribe    int `json:"-"`
	DailySpeech        int `json:"-"`
}

// Config is the full service configuration.
type Config struct {
	Port     string
	BindHost string // empty = all interfaces (Render); 127.0.0.1 for local runs
	// BindHostIgnored is true when BIND_HOST was set on Render and ignored.
	BindHostIgnored bool
	Version         string
	ClientToken     string
	TrustProxy      bool
	// PreviewFixtures swaps OpenAI and YarnGPT for labelled fixtures so the
	// online flow can be tried without keys. Never combined with real keys.
	PreviewFixtures bool

	OpenAIKey             string
	OpenAIBaseURL         string
	OpenAIModel           string
	OpenAIReasoningEffort string
	OpenAITimeout         time.Duration

	YarnKey      string
	YarnBaseURL  string
	YarnTimeout  time.Duration
	YarnVoices   map[string]string // language code -> voice id override
	YarnASRLangs []string          // optional override of the transcription language list

	Limits Limits
}

// Load reads configuration using getenv (os.Getenv in production).
func Load(getenv func(string) string) (Config, error) {
	var errs []string
	str := func(key, def string) string {
		if v := strings.TrimSpace(getenv(key)); v != "" {
			return v
		}
		return def
	}
	num := func(key string, def, min, max int) int {
		v := strings.TrimSpace(getenv(key))
		if v == "" {
			return def
		}
		n, err := strconv.Atoi(v)
		if err != nil || n < min || n > max {
			errs = append(errs, fmt.Sprintf("%s must be a whole number between %d and %d", key, min, max))
			return def
		}
		return n
	}
	secs := func(key string, def, min, max int) time.Duration {
		return time.Duration(num(key, def, min, max)) * time.Second
	}

	c := Config{
		Port:            str("PORT", "8080"),
		BindHost:        str("BIND_HOST", ""),
		Version:         str("LUMA_API_VERSION", "0.1.0"),
		ClientToken:     str("LUMA_CLIENT_TOKEN", ""),
		TrustProxy:      strings.EqualFold(str("TRUST_PROXY", "false"), "true"),
		PreviewFixtures: strings.EqualFold(str("LUMA_PREVIEW_FIXTURES", "false"), "true"),

		OpenAIKey:             str("OPENAI_API_KEY", ""),
		OpenAIBaseURL:         strings.TrimRight(str("OPENAI_BASE_URL", "https://api.openai.com/v1"), "/"),
		OpenAIModel:           str("OPENAI_MODEL", "gpt-6-luna"),
		OpenAIReasoningEffort: strings.ToLower(str("OPENAI_REASONING_EFFORT", "low")),
		OpenAITimeout:         secs("OPENAI_TIMEOUT_SECONDS", 45, 5, 120),

		YarnKey:     str("YARNGPT_API_KEY", ""),
		YarnBaseURL: strings.TrimRight(str("YARNGPT_BASE_URL", "https://api.yarngpt.ai"), "/"),
		YarnTimeout: secs("YARNGPT_TIMEOUT_SECONDS", 75, 10, 240),
		YarnVoices:  map[string]string{},

		Limits: Limits{
			MaxQuestionChars:   num("MAX_QUESTION_CHARS", 600, 50, 4000),
			MaxLineChars:       num("MAX_LINE_CHARS", 600, 80, 4000),
			MaxLines:           num("MAX_LINES", 400, 10, 2000),
			MaxDocumentChars:   num("MAX_DOCUMENT_CHARS", 16000, 500, 100000),
			MaxHistoryTurns:    num("MAX_HISTORY_TURNS", 6, 0, 20),
			MaxHistoryChars:    num("MAX_HISTORY_CHARS", 700, 50, 4000),
			MaxAnswerWords:     num("MAX_ANSWER_WORDS", 110, 20, 400),
			MaxExplainWords:    num("MAX_EXPLAIN_WORDS", 170, 20, 600),
			MaxSpeechChars:     num("MAX_SPEECH_CHARS", 1500, 100, 15000),
			MaxAudioBytes:      num("MAX_AUDIO_BYTES", 8<<20, 64<<10, 64<<20),
			MaxRecordingSecs:   num("MAX_RECORDING_SECONDS", 60, 5, 600),
			MaxOutputTokens:    num("OPENAI_MAX_OUTPUT_TOKENS", 1600, 64, 32000),
			PerDevicePerMinute: num("PER_DEVICE_PER_MINUTE", 8, 1, 1000),
			PerDevicePerDay:    num("PER_DEVICE_PER_DAY", 80, 1, 100000),
			DailyAsk:           num("DAILY_ASK_LIMIT", 400, 0, 1000000),
			DailyTranscribe:    num("DAILY_TRANSCRIBE_LIMIT", 100, 0, 1000000),
			DailySpeech:        num("DAILY_SPEECH_LIMIT", 100, 0, 1000000),
		},
	}

	switch c.OpenAIReasoningEffort {
	case "", "none", "minimal", "low", "medium", "high", "xhigh", "max":
	case "off", "omit":
		c.OpenAIReasoningEffort = ""
	default:
		errs = append(errs, "OPENAI_REASONING_EFFORT must be one of none, minimal, low, medium, high, xhigh, max, or omit")
	}

	for _, code := range []string{"en", "yo", "ha", "ig", "pcm"} {
		if v := strings.TrimSpace(getenv("YARNGPT_VOICE_" + strings.ToUpper(code))); v != "" {
			c.YarnVoices[code] = v
		}
	}
	if v := strings.TrimSpace(getenv("YARNGPT_ASR_LANGUAGES")); v != "" {
		for _, p := range strings.Split(v, ",") {
			if p = strings.TrimSpace(p); p != "" {
				c.YarnASRLangs = append(c.YarnASRLangs, strings.ToLower(p))
			}
		}
	}
	if _, err := strconv.Atoi(c.Port); err != nil {
		errs = append(errs, "PORT must be a number")
	}
	// Render sets RENDER=true and can only reach the service on all
	// interfaces. A BIND_HOST copied from a local .env would make the
	// service unreachable there, so it is ignored.
	if strings.EqualFold(getenv("RENDER"), "true") && c.BindHost != "" {
		c.BindHost = ""
		c.BindHostIgnored = true
	}
	if c.PreviewFixtures && (c.OpenAIKey != "" || c.YarnKey != "") {
		errs = append(errs, "LUMA_PREVIEW_FIXTURES cannot be combined with OPENAI_API_KEY or YARNGPT_API_KEY; unset one or the other")
	}
	if len(errs) > 0 {
		return c, fmt.Errorf("configuration: %s", strings.Join(errs, "; "))
	}
	return c, nil
}

// AnswersConfigured reports whether the answer model can be called.
func (c Config) AnswersConfigured() bool { return c.OpenAIKey != "" && c.OpenAIModel != "" }

// YarnConfigured reports whether YarnGPT can be called.
func (c Config) YarnConfigured() bool { return c.YarnKey != "" }
