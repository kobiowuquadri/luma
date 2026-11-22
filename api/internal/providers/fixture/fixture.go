// Package fixture provides labelled stand-ins for OpenAI and YarnGPT, used
// only when LUMA_PREVIEW_FIXTURES=true. They let the team exercise the whole
// online flow (record, transcript, answer with source lines, audio, offline
// replay) on a device without provider keys or credits.
//
// Everything they return says it is a fixture: answers start with
// "PREVIEW FIXTURE", the transcript is fixed, and "speech" is a short chime,
// not a voice. The server reports mode "preview-fixtures" in
// /v1/capabilities and the app shows a banner. The server refuses to start
// in this mode when real provider keys are set.
package fixture

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"unicode"

	"luma/api/internal/ask"
)

// Prefix marks every fixture answer.
const Prefix = "PREVIEW FIXTURE, not an AI answer."

// Answerer quotes the page line that shares the most words with the question.
type Answerer struct{}

func (Answerer) Model() string { return "preview-fixture" }

func words(s string) map[string]bool {
	out := map[string]bool{}
	for _, f := range strings.FieldsFunc(strings.ToLower(s), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsNumber(r) }) {
		if len([]rune(f)) >= 3 {
			out[f] = true
		}
	}
	return out
}

func (Answerer) Answer(_ context.Context, req ask.Request, _ ask.Prompt) (ask.ModelAnswer, error) {
	if req.Mode == ask.ModeExplain {
		ids := req.FocusLineIDs
		if len(ids) == 0 && len(req.Lines) > 0 {
			ids = []string{req.Lines[0].ID}
		}
		return ask.ModelAnswer{
			Answer:        fmt.Sprintf("%s A real explanation in the chosen language would appear here, covering %d line(s).", Prefix, len(ids)),
			AnswerInPage:  true,
			SourceLineIDs: ids,
		}, nil
	}
	q := words(req.Question)
	best, bestScore := -1, 0
	for i, l := range req.Lines {
		score := 0
		for w := range words(l.Text) {
			if q[w] {
				score++
			}
		}
		if score > bestScore {
			best, bestScore = i, score
		}
	}
	if best < 0 {
		return ask.ModelAnswer{
			Answer:        Prefix + " No line on this page shares words with the question, so a real answer would say the page does not cover it.",
			AnswerInPage:  false,
			SourceLineIDs: []string{},
		}, nil
	}
	l := req.Lines[best]
	return ask.ModelAnswer{
		Answer:        fmt.Sprintf("%s The closest line on this page is line %s: \"%s\"", Prefix, strings.TrimPrefix(l.ID, "L"), l.Text),
		AnswerInPage:  true,
		SourceLineIDs: []string{l.ID},
	}, nil
}

// Speech returns a fixed transcript and a chime instead of a voice.
type Speech struct{}

// Transcript is returned for every recording in preview mode.
const Transcript = "Preview fixture transcript: when is the assignment due?"

func (Speech) Transcribe(_ context.Context, _ string, _ []byte, _ string) (string, error) {
	return Transcript, nil
}

func (Speech) Synthesize(_ context.Context, _, _, _ string) ([]byte, string, error) {
	return Chime(), "audio/wav", nil
}

// VoiceFor and TranscriptionListed report every language as supported.
func (Speech) VoiceFor(_ context.Context, _ string) (string, bool) { return "preview-chime", true }

func (Speech) TranscriptionListed(_ context.Context, _ string) *bool {
	v := true
	return &v
}

// Chime is a 1.2 second two-note tone as 16 kHz mono 16-bit WAV.
func Chime() []byte {
	const rate = 16000
	n := rate * 12 / 10
	samples := make([]int16, n)
	for i := range samples {
		t := float64(i) / rate
		f := 660.0
		if t > 0.55 {
			f = 880.0
		}
		env := math.Min(1, t*20) * math.Exp(-2.2*math.Mod(t, 0.55))
		samples[i] = int16(9000 * env * math.Sin(2*math.Pi*f*t))
	}
	var b bytes.Buffer
	data := len(samples) * 2
	b.WriteString("RIFF")
	_ = binary.Write(&b, binary.LittleEndian, uint32(36+data))
	b.WriteString("WAVEfmt ")
	_ = binary.Write(&b, binary.LittleEndian, uint32(16))
	_ = binary.Write(&b, binary.LittleEndian, uint16(1))
	_ = binary.Write(&b, binary.LittleEndian, uint16(1))
	_ = binary.Write(&b, binary.LittleEndian, uint32(rate))
	_ = binary.Write(&b, binary.LittleEndian, uint32(rate*2))
	_ = binary.Write(&b, binary.LittleEndian, uint16(2))
	_ = binary.Write(&b, binary.LittleEndian, uint16(16))
	b.WriteString("data")
	_ = binary.Write(&b, binary.LittleEndian, uint32(data))
	_ = binary.Write(&b, binary.LittleEndian, samples)
	return b.Bytes()
}
