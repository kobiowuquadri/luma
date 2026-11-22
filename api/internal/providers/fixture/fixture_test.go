package fixture

import (
	"context"
	"strings"
	"testing"

	"luma/api/internal/ask"
)

func TestAnswerQuotesClosestLineAndIsLabelled(t *testing.T) {
	req := ask.Request{Mode: ask.ModeQuestion, Question: "When is the assignment due?", Lines: []ask.Line{
		{ID: "L1", Text: "Topic: Photosynthesis"},
		{ID: "L9", Text: "Assignment: answer questions 1-5. Submit on Friday."},
	}}
	a, err := Answerer{}.Answer(context.Background(), req, ask.Prompt{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(a.Answer, Prefix) || len(a.SourceLineIDs) != 1 || a.SourceLineIDs[0] != "L9" {
		t.Fatalf("answer = %+v", a)
	}
}

func TestAnswerSaysNotOnPageWhenNothingMatches(t *testing.T) {
	req := ask.Request{Mode: ask.ModeQuestion, Question: "Who won the football match?", Lines: []ask.Line{{ID: "L1", Text: "Topic: Photosynthesis"}}}
	a, _ := Answerer{}.Answer(context.Background(), req, ask.Prompt{})
	if a.AnswerInPage || len(a.SourceLineIDs) != 0 || !strings.HasPrefix(a.Answer, Prefix) {
		t.Fatalf("answer = %+v", a)
	}
}

func TestChimeIsValidWav(t *testing.T) {
	w := Chime()
	if string(w[:4]) != "RIFF" || string(w[8:12]) != "WAVE" || len(w) < 30000 {
		t.Fatalf("not a WAV: %d bytes", len(w))
	}
}
