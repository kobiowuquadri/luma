package yarngpt

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"luma/api/internal/lang"
)

// Voice is one YarnGPT voice and the LUMA language codes it lists.
type Voice struct {
	ID        string
	Languages []string
	Default   bool
}

// Directory answers "which voice speaks this language?" and "does YarnGPT
// list this language for transcription?" from YarnGPT's live endpoints
// (GET /api/v1/voices, GET /api/v1/asr/languages), which its docs say change
// over time and must not be hard-coded. Operator overrides from the
// environment take precedence. Results are cached.
type Directory struct {
	client      *Client
	overrides   map[string]string
	asrOverride []string
	ttl         time.Duration

	mu       sync.Mutex
	voices   []Voice
	voicesAt time.Time
	asr      []string
	asrOK    bool
	asrAt    time.Time
	now      func() time.Time
}

// NewDirectory creates a directory. overrides maps language code to voice ID.
func NewDirectory(c *Client, overrides map[string]string, asrOverride []string) *Directory {
	return &Directory{client: c, overrides: overrides, asrOverride: asrOverride, ttl: time.Hour, now: time.Now}
}

// VoiceFor returns the voice to use for lang, or false when no voice is
// known to speak it. It never substitutes another language's voice.
func (d *Directory) VoiceFor(ctx context.Context, code string) (string, bool) {
	if v, ok := d.overrides[code]; ok && v != "" {
		return v, true
	}
	voices := d.loadVoices(ctx)
	var first string
	for _, v := range voices {
		for _, l := range v.Languages {
			if l != code {
				continue
			}
			if v.Default {
				return v.ID, true
			}
			if first == "" {
				first = v.ID
			}
		}
	}
	return first, first != ""
}

// TranscriptionListed reports whether YarnGPT lists lang for transcription.
// nil means the list could not be fetched.
func (d *Directory) TranscriptionListed(ctx context.Context, code string) *bool {
	if len(d.asrOverride) > 0 {
		v := contains(d.asrOverride, code)
		return &v
	}
	langs, ok := d.loadASR(ctx)
	if !ok {
		return nil
	}
	v := contains(langs, code)
	return &v
}

func (d *Directory) loadVoices(ctx context.Context) []Voice {
	d.mu.Lock()
	if d.voices != nil && d.now().Sub(d.voicesAt) < d.ttl {
		v := d.voices
		d.mu.Unlock()
		return v
	}
	d.mu.Unlock()

	body, err := d.client.get(ctx, "/api/v1/voices")
	d.mu.Lock()
	defer d.mu.Unlock()
	if err != nil {
		return d.voices // keep the last good list, if any
	}
	d.voices = parseVoices(body)
	d.voicesAt = d.now()
	return d.voices
}

func (d *Directory) loadASR(ctx context.Context) ([]string, bool) {
	d.mu.Lock()
	if d.asrOK && d.now().Sub(d.asrAt) < d.ttl {
		v := d.asr
		d.mu.Unlock()
		return v, true
	}
	d.mu.Unlock()

	body, err := d.client.get(ctx, "/api/v1/asr/languages")
	d.mu.Lock()
	defer d.mu.Unlock()
	if err != nil {
		return d.asr, d.asrOK
	}
	var raw map[string]any
	if json.Unmarshal(body, &raw) != nil {
		return d.asr, d.asrOK
	}
	d.asr = normalizeLangs(collect(raw["languages"]))
	d.asrOK = true
	d.asrAt = d.now()
	return d.asr, true
}

// get performs an authenticated GET with a short timeout.
func (c *Client) get(ctx context.Context, path string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, transportError(ctx, err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, mapHTTPError(resp, raw)
	}
	return raw, nil
}

// parseVoices accepts the documented list shape and tolerates wrappers
// ({"voices": [...]}, {"data": [...]}) because the static docs do not show a
// full example. Each voice's ID is "name" per the quickstart.
func parseVoices(body []byte) []Voice {
	var raw any
	if json.Unmarshal(body, &raw) != nil {
		return []Voice{}
	}
	var list []any
	switch v := raw.(type) {
	case []any:
		list = v
	case map[string]any:
		for _, k := range []string{"voices", "data", "items", "results"} {
			if l, ok := v[k].([]any); ok {
				list = l
				break
			}
		}
	}
	out := []Voice{}
	for _, item := range list {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		id := firstString(m, "name", "id", "voice", "voice_id", "slug")
		if id == "" {
			continue
		}
		var labels []string
		for _, k := range []string{"languages", "language", "langs", "lang", "locales", "locale", "supported_languages"} {
			labels = append(labels, collect(m[k])...)
		}
		def, _ := m["default"].(bool)
		out = append(out, Voice{ID: id, Languages: normalizeLangs(labels), Default: def})
	}
	return out
}

// collect flattens a string, a list of strings, or a list of objects with a
// code/language/name field into labels.
func collect(v any) []string {
	switch t := v.(type) {
	case string:
		return []string{t}
	case []any:
		var out []string
		for _, x := range t {
			switch y := x.(type) {
			case string:
				out = append(out, y)
			case map[string]any:
				if s := firstString(y, "code", "language", "lang", "id", "name"); s != "" {
					out = append(out, s)
				}
			}
		}
		return out
	case map[string]any:
		if s := firstString(t, "code", "language", "lang", "id", "name"); s != "" {
			return []string{s}
		}
	}
	return nil
}

func normalizeLangs(labels []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, l := range labels {
		if code, ok := lang.Normalize(l); ok && !seen[code] {
			seen[code] = true
			out = append(out, code)
		}
	}
	return out
}

func firstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s, ok := m[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
