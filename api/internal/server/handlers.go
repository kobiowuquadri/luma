package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"luma/api/internal/apierr"
	"luma/api/internal/ask"
	"luma/api/internal/guard"
	"luma/api/internal/lang"
)

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "luma-api",
		"version": s.cfg.Version,
		"mode":    s.mode(),
		"uptimeS": int(time.Since(s.started).Seconds()),
	})
}

type featureCap struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}

type transcriptionCap struct {
	Available bool `json:"available"`
	// Listed is whether YarnGPT's live language list includes this language;
	// null when the list could not be fetched.
	Listed *bool  `json:"listed"`
	Reason string `json:"reason,omitempty"`
}

type languageCap struct {
	Code          string           `json:"code"`
	Name          string           `json:"name"`
	NativeName    string           `json:"nativeName"`
	Answers       featureCap       `json:"answers"`
	Transcription transcriptionCap `json:"transcription"`
	Speech        featureCap       `json:"speech"`
}

func (s *Server) capabilities(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	answers := featureCap{Available: s.answerer != nil}
	if !answers.Available {
		answers.Reason = "not_configured"
	} else if s.budget.Remaining("ask") <= 0 {
		answers = featureCap{Reason: "daily_limit_reached"}
	}
	transcription := featureCap{Available: s.transcriber != nil && s.voices != nil}
	if !transcription.Available {
		transcription.Reason = "not_configured"
	} else if s.budget.Remaining("transcribe") <= 0 {
		transcription = featureCap{Reason: "daily_limit_reached"}
	}
	speech := featureCap{Available: s.synthesizer != nil && s.voices != nil}
	if !speech.Available {
		speech.Reason = "not_configured"
	} else if s.budget.Remaining("speech") <= 0 {
		speech = featureCap{Reason: "daily_limit_reached"}
	}

	langs := []languageCap{}
	for _, l := range lang.All() {
		lc := languageCap{Code: l.Code, Name: l.Name, NativeName: l.NativeName, Answers: answers}
		lc.Transcription = transcriptionCap{Available: transcription.Available, Reason: transcription.Reason}
		if transcription.Available {
			lc.Transcription.Listed = s.voices.TranscriptionListed(ctx, l.Code)
			if lc.Transcription.Listed != nil && !*lc.Transcription.Listed {
				lc.Transcription.Available = false
				lc.Transcription.Reason = "language_not_listed"
			}
		}
		lc.Speech = speech
		if speech.Available {
			if _, ok := s.voices.VoiceFor(ctx, l.Code); !ok {
				lc.Speech = featureCap{Reason: "no_voice_for_language"}
			}
		}
		langs = append(langs, lc)
	}

	lim := s.cfg.Limits
	writeJSON(w, http.StatusOK, map[string]any{
		"service": "luma-api",
		"version": s.cfg.Version,
		"mode":    s.mode(),
		"features": map[string]any{
			"answers":       answers,
			"transcription": transcription,
			"speech":        speech,
		},
		"languages": langs,
		"limits": map[string]any{
			"maxQuestionChars":    lim.MaxQuestionChars,
			"maxLineChars":        lim.MaxLineChars,
			"maxLines":            lim.MaxLines,
			"maxDocumentChars":    lim.MaxDocumentChars,
			"maxHistoryTurns":     lim.MaxHistoryTurns,
			"maxAnswerWords":      lim.MaxAnswerWords,
			"maxSpeechChars":      lim.MaxSpeechChars,
			"maxAudioBytes":       lim.MaxAudioBytes,
			"maxRecordingSeconds": lim.MaxRecordingSecs,
		},
		"providers": map[string]any{
			"answers":       "OpenAI",
			"transcription": "YarnGPT",
			"speech":        "YarnGPT",
		},
	})
}

// decodeJSON reads a size-limited JSON body.
func decodeJSON(w http.ResponseWriter, r *http.Request, limit int64, dst any) error {
	if ct, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); ct != "application/json" {
		return &apierr.Error{Kind: apierr.KindUnsupportedMedia, Message: "Send the request as JSON."}
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return apierr.New(apierr.KindTooLarge)
		}
		return apierr.Invalid("The request body is not valid JSON.")
	}
	return nil
}

// replay writes a stored idempotent response.
func replay(w http.ResponseWriter, resp *guard.Response) {
	for k, v := range resp.Headers {
		w.Header().Set(k, v)
	}
	w.Header().Set("Content-Type", resp.ContentType)
	w.Header().Set("Idempotent-Replayed", "true")
	w.WriteHeader(resp.Status)
	_, _ = w.Write(resp.Body)
}

func (s *Server) beginIdempotent(w http.ResponseWriter, r *http.Request, scope, fingerprint string) (string, *guard.Ticket, bool) {
	key, err := idempotencyKey(r)
	if err != nil {
		s.writeError(w, r, err, 0)
		return "", nil, false
	}
	prev, ticket, err := s.idem.Begin(r.Context(), scope+"/"+key, fingerprint)
	switch {
	case errors.Is(err, guard.ErrConflict):
		s.writeError(w, r, apierr.New(apierr.KindIdempotencyConflict), 0)
		return "", nil, false
	case err != nil:
		s.writeError(w, r, apierr.New(apierr.KindProviderTimeout), 0)
		return "", nil, false
	case prev != nil:
		replay(w, prev)
		return "", nil, false
	}
	return key, ticket, true
}

// ask answers a question about, or explains, the student's current page.
func (s *Server) ask(w http.ResponseWriter, r *http.Request) {
	if s.answerer == nil {
		s.writeError(w, r, &apierr.Error{Kind: apierr.KindNotConfigured,
			Message: "Ask LUMA is not set up on this server yet. Reading and saving still work."}, 0)
		return
	}
	var req ask.Request
	if err := decodeJSON(w, r, 512<<10, &req); err != nil {
		s.writeError(w, r, err, 0)
		return
	}
	lim := s.cfg.Limits
	if err := req.Normalize(lim); err != nil {
		s.writeError(w, r, err, 0)
		return
	}
	ri := info(r)
	ri.fields = append(ri.fields, "mode", req.Mode, "language", req.Language, "lines", len(req.Lines), "history", len(req.History))

	_, ticket, ok := s.beginIdempotent(w, r, "ask", req.Fingerprint())
	if !ok {
		return
	}
	if err := s.admit(r, "ask"); err != nil {
		ticket.Abort()
		s.writeError(w, r, err, 0)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.OpenAITimeout+5*time.Second)
	defer cancel()
	ma, err := s.answerer.Answer(ctx, req, ask.BuildPrompt(req, lim))
	if err != nil {
		ticket.Abort()
		s.writeError(w, r, err, 0)
		return
	}
	words := lim.MaxAnswerWords
	if req.Mode == ask.ModeExplain {
		words = lim.MaxExplainWords
	}
	res, err := ask.Validate(ma, req, words)
	if err != nil {
		ticket.Abort()
		s.writeError(w, r, err, 0)
		return
	}
	res.Model = s.answerer.Model()
	ri.fields = append(ri.fields, "answer_found", res.AnswerFound, "sources", len(res.SourceLineIDs), "dropped_sources", res.DroppedSourceIDs)

	body, _ := json.Marshal(res)
	ticket.Complete(&guard.Response{Status: http.StatusOK, ContentType: "application/json; charset=utf-8", Body: body})
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

// sniffAudio identifies the recording container from its first bytes. These
// are formats YarnGPT documents for transcription.
func sniffAudio(b []byte) (string, bool) {
	switch {
	case len(b) >= 12 && string(b[4:8]) == "ftyp":
		return "question.m4a", true
	case len(b) >= 3 && string(b[:3]) == "ID3":
		return "question.mp3", true
	case len(b) >= 2 && b[0] == 0xFF && b[1]&0xE0 == 0xE0 && b[1]&0x06 != 0:
		return "question.mp3", true // MPEG audio frame (not raw ADTS AAC)
	case len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WAVE":
		return "question.wav", true
	case len(b) >= 4 && string(b[:4]) == "OggS":
		return "question.ogg", true
	case len(b) >= 4 && string(b[:4]) == "fLaC":
		return "question.flac", true
	case len(b) >= 4 && b[0] == 0x1A && b[1] == 0x45 && b[2] == 0xDF && b[3] == 0xA3:
		return "question.webm", true
	}
	return "", false
}

// transcribe turns a spoken question into text the student can correct.
func (s *Server) transcribe(w http.ResponseWriter, r *http.Request) {
	if s.transcriber == nil || s.voices == nil {
		s.writeError(w, r, &apierr.Error{Kind: apierr.KindNotConfigured,
			Message: "Spoken questions are not set up on this server yet. You can type your question."}, 0)
		return
	}
	lim := s.cfg.Limits
	r.Body = http.MaxBytesReader(w, r.Body, int64(lim.MaxAudioBytes)+(64<<10))
	mr, err := r.MultipartReader()
	if err != nil {
		s.writeError(w, r, apierr.Invalid("Send the recording as multipart form data with an \"audio\" file."), 0)
		return
	}
	var audio []byte
	language := "en"
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			s.writeError(w, r, tooLargeOr(err, "The upload could not be read."), 0)
			return
		}
		switch part.FormName() {
		case "audio":
			audio, err = io.ReadAll(io.LimitReader(part, int64(lim.MaxAudioBytes)+1))
			if err != nil {
				s.writeError(w, r, tooLargeOr(err, "The recording could not be read."), 0)
				return
			}
			if len(audio) > lim.MaxAudioBytes {
				s.writeError(w, r, &apierr.Error{Kind: apierr.KindTooLarge,
					Message: fmt.Sprintf("Recordings can be up to %d seconds. Try a shorter question.", lim.MaxRecordingSecs)}, 0)
				return
			}
		case "language":
			v, _ := io.ReadAll(io.LimitReader(part, 64))
			language = strings.TrimSpace(string(v))
		}
		part.Close()
	}
	if len(audio) == 0 {
		s.writeError(w, r, apierr.Invalid("No recording was received. Record your question again."), 0)
		return
	}
	filename, ok := sniffAudio(audio)
	if !ok {
		s.writeError(w, r, apierr.New(apierr.KindUnsupportedMedia), 0)
		return
	}
	code, ok := lang.Normalize(language)
	if !ok {
		s.writeError(w, r, apierr.New(apierr.KindLanguageUnavailable), 0)
		return
	}
	l, _ := lang.Get(code)
	ri := info(r)
	ri.fields = append(ri.fields, "language", code, "audio_bytes", len(audio))

	if listed := s.voices.TranscriptionListed(r.Context(), code); listed != nil && !*listed {
		s.writeError(w, r, &apierr.Error{Kind: apierr.KindLanguageUnavailable,
			Message: fmt.Sprintf("Spoken questions in %s are not available yet. You can type your question instead.", l.NativeName)}, 0)
		return
	}

	sum := sha256.Sum256(audio)
	key, ticket, ok := s.beginIdempotent(w, r, "transcribe", hex.EncodeToString(sum[:])+"|"+code)
	if !ok {
		return
	}
	if err := s.admit(r, "transcribe"); err != nil {
		ticket.Abort()
		s.writeError(w, r, err, 0)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.YarnTimeout)
	defer cancel()
	transcript, err := s.transcriber.Transcribe(ctx, key, audio, filename)
	if err != nil {
		ticket.Abort()
		s.writeError(w, r, err, 0)
		return
	}
	ri.fields = append(ri.fields, "transcript_chars", utf8.RuneCountInString(transcript))
	body, _ := json.Marshal(map[string]any{
		"transcript": transcript,
		"language":   code,
		"empty":      transcript == "",
	})
	ticket.Complete(&guard.Response{Status: http.StatusOK, ContentType: "application/json; charset=utf-8", Body: body})
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func tooLargeOr(err error, msg string) error {
	var mbe *http.MaxBytesError
	if errors.As(err, &mbe) {
		return apierr.New(apierr.KindTooLarge)
	}
	return apierr.Invalid(msg)
}

type speechRequest struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

// speech voices an answer. The app saves the audio so it can replay offline.
func (s *Server) speech(w http.ResponseWriter, r *http.Request) {
	if s.synthesizer == nil || s.voices == nil {
		s.writeError(w, r, &apierr.Error{Kind: apierr.KindNotConfigured,
			Message: "Spoken answers are not set up on this server yet. The written answer is still available."}, 0)
		return
	}
	var req speechRequest
	if err := decodeJSON(w, r, 64<<10, &req); err != nil {
		s.writeError(w, r, err, 0)
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	lim := s.cfg.Limits
	if req.Text == "" {
		s.writeError(w, r, apierr.Invalid("There is no text to read aloud."), 0)
		return
	}
	if n := utf8.RuneCountInString(req.Text); n > lim.MaxSpeechChars {
		s.writeError(w, r, &apierr.Error{Kind: apierr.KindTooLarge,
			Message: fmt.Sprintf("Spoken answers can be up to %d characters.", lim.MaxSpeechChars)}, 0)
		return
	}
	code, ok := lang.Normalize(req.Language)
	if !ok {
		s.writeError(w, r, apierr.New(apierr.KindLanguageUnavailable), 0)
		return
	}
	l, _ := lang.Get(code)
	voice, ok := s.voices.VoiceFor(r.Context(), code)
	if !ok {
		s.writeError(w, r, &apierr.Error{Kind: apierr.KindLanguageUnavailable,
			Message: fmt.Sprintf("Spoken answers in %s are not available yet. No other language was used. The written answer is still here.", l.NativeName)}, 0)
		return
	}
	ri := info(r)
	ri.fields = append(ri.fields, "language", code, "text_chars", utf8.RuneCountInString(req.Text))

	sum := sha256.Sum256([]byte(code + "|" + voice + "|" + req.Text))
	key, ticket, ok := s.beginIdempotent(w, r, "speech", hex.EncodeToString(sum[:]))
	if !ok {
		return
	}
	if err := s.admit(r, "speech"); err != nil {
		ticket.Abort()
		s.writeError(w, r, err, 0)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.YarnTimeout)
	defer cancel()
	audio, contentType, err := s.synthesizer.Synthesize(ctx, key, req.Text, voice)
	if err != nil {
		ticket.Abort()
		s.writeError(w, r, err, 0)
		return
	}
	headers := map[string]string{"X-Luma-Voice": voice, "X-Luma-Language": code}
	ticket.Complete(&guard.Response{Status: http.StatusOK, ContentType: contentType, Headers: headers, Body: audio})
	for k, v := range headers {
		w.Header().Set(k, v)
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(audio)
}

// mode is "preview-fixtures" when labelled fixtures stand in for providers.
func (s *Server) mode() string {
	if s.cfg.PreviewFixtures {
		return "preview-fixtures"
	}
	return "live"
}
