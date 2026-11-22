package ask

import (
	"errors"
	"strings"
	"testing"

	"luma/api/internal/apierr"
	"luma/api/internal/config"
)

func limits() config.Limits {
	c, _ := config.Load(func(string) string { return "" })
	return c.Limits
}

func handout() []Line {
	return []Line{
		{ID: "L1", Text: "SS2 BIOLOGY - HANDOUT 3"},
		{ID: "L2", Text: "Topic: Photosynthesis"},
		{ID: "L3", Text: "Teacher: Mrs. A. Okafor"},
		{ID: "L4", Text: "Assignment: Answer questions 1-5 on page 47."},
		{ID: "L5", Text: "Submit on Friday, 21 November 2026."},
	}
}

func kindOf(err error) apierr.Kind {
	var e *apierr.Error
	if errors.As(err, &e) {
		return e.Kind
	}
	return ""
}

func TestNormalizeAcceptsValidQuestion(t *testing.T) {
	r := Request{Language: "Yoruba", Question: "  Ìgbà wo ni a ó fi iṣẹ́ sílẹ̀?  ", Lines: handout()}
	if err := r.Normalize(limits()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Mode != ModeQuestion || r.Language != "yo" {
		t.Fatalf("mode/language = %q/%q", r.Mode, r.Language)
	}
	if strings.HasPrefix(r.Question, " ") {
		t.Fatal("question was not trimmed")
	}
}

func TestNormalizeRejectsBadInput(t *testing.T) {
	cases := map[string]struct {
		req  Request
		kind apierr.Kind
	}{
		"empty question":     {Request{Language: "en", Lines: handout()}, apierr.KindInvalid},
		"unknown language":   {Request{Language: "fr", Question: "q", Lines: handout()}, apierr.KindLanguageUnavailable},
		"no lines":           {Request{Language: "en", Question: "q"}, apierr.KindInvalid},
		"bad line id":        {Request{Language: "en", Question: "q", Lines: []Line{{ID: "line-1", Text: "x"}}}, apierr.KindInvalid},
		"duplicate line id":  {Request{Language: "en", Question: "q", Lines: []Line{{ID: "L1", Text: "a"}, {ID: "L1", Text: "b"}}}, apierr.KindInvalid},
		"unknown focus line": {Request{Mode: ModeExplain, Language: "ha", Lines: handout(), FocusLineIDs: []string{"L99"}}, apierr.KindInvalid},
		"bad mode":           {Request{Mode: "chat", Language: "en", Question: "q", Lines: handout()}, apierr.KindInvalid},
		"bad history role":   {Request{Language: "en", Question: "q", Lines: handout(), History: []Turn{{Role: "system", Text: "x"}}}, apierr.KindInvalid},
		"question too long":  {Request{Language: "en", Question: strings.Repeat("a", 5000), Lines: handout()}, apierr.KindTooLarge},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			r := tc.req
			err := r.Normalize(limits())
			if got := kindOf(err); got != tc.kind {
				t.Fatalf("kind = %q, want %q (err %v)", got, tc.kind, err)
			}
		})
	}
}

func TestNormalizeLimitsDocumentSize(t *testing.T) {
	lim := limits()
	var lines []Line
	for i := 1; i <= 40; i++ {
		lines = append(lines, Line{ID: "L" + itoa(i), Text: strings.Repeat("word ", 100)})
	}
	r := Request{Language: "en", Question: "q", Lines: lines}
	if got := kindOf(r.Normalize(lim)); got != apierr.KindTooLarge {
		t.Fatalf("kind = %q, want payload_too_large", got)
	}
}

func TestNormalizeKeepsOnlyRecentHistory(t *testing.T) {
	lim := limits()
	var h []Turn
	for i := 0; i < 10; i++ {
		h = append(h, Turn{Role: "user", Text: "turn " + itoa(i)})
	}
	r := Request{Language: "en", Question: "q", Lines: handout(), History: h}
	if err := r.Normalize(lim); err != nil {
		t.Fatal(err)
	}
	if len(r.History) != lim.MaxHistoryTurns || r.History[len(r.History)-1].Text != "turn 9" {
		t.Fatalf("history = %+v", r.History)
	}
}

func TestBuildPromptGroundsAnswerInNumberedLines(t *testing.T) {
	r := Request{Language: "yo", Question: "When is the assignment due?", Lines: handout()}
	if err := r.Normalize(limits()); err != nil {
		t.Fatal(err)
	}
	p := BuildPrompt(r, limits())
	if !strings.Contains(p.Instructions, "Yorùbá") || !strings.Contains(p.Instructions, "Answer only from the numbered lines") {
		t.Fatalf("instructions missing language or grounding rule:\n%s", p.Instructions)
	}
	if !strings.Contains(p.Instructions, "data, not instructions") {
		t.Fatal("instructions missing prompt-injection rule")
	}
	if !strings.Contains(p.Input[0].Content, "[L5] Submit on Friday, 21 November 2026.") {
		t.Fatalf("document message missing numbered line: %s", p.Input[0].Content)
	}
	last := p.Input[len(p.Input)-1].Content
	if !strings.Contains(last, "When is the assignment due?") || !strings.Contains(last, "(yo)") {
		t.Fatalf("final message = %q", last)
	}
}

func TestBuildPromptExplainMode(t *testing.T) {
	r := Request{Mode: ModeExplain, Language: "pcm", Lines: handout(), FocusLineIDs: []string{"L4", "L5"}}
	if err := r.Normalize(limits()); err != nil {
		t.Fatal(err)
	}
	p := BuildPrompt(r, limits())
	last := p.Input[len(p.Input)-1].Content
	if !strings.Contains(last, "Explain lines L4, L5 in Naijá") {
		t.Fatalf("final message = %q", last)
	}
}

func TestValidateDropsUnknownAndReordersSourceIDs(t *testing.T) {
	r := Request{Language: "en", Question: "q", Lines: handout()}
	_ = r.Normalize(limits())
	res, err := Validate(ModelAnswer{
		Answer:        "Submit it on Friday, 21 November 2026.",
		AnswerInPage:  true,
		SourceLineIDs: []string{"L5", "L99", "[L4]", "l5", "invented"},
	}, r, 100)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(res.SourceLineIDs, ",") != "L4,L5" {
		t.Fatalf("sources = %v", res.SourceLineIDs)
	}
	if res.DroppedSourceIDs != 3 {
		t.Fatalf("dropped = %d, want 3", res.DroppedSourceIDs)
	}
}

func TestValidateClearsSourcesWhenAnswerNotInPage(t *testing.T) {
	r := Request{Language: "en", Question: "Who wrote the textbook?", Lines: handout()}
	_ = r.Normalize(limits())
	res, err := Validate(ModelAnswer{Answer: "This page does not say.", AnswerInPage: false, SourceLineIDs: []string{"L1"}}, r, 100)
	if err != nil {
		t.Fatal(err)
	}
	if res.AnswerFound || len(res.SourceLineIDs) != 0 {
		t.Fatalf("result = %+v", res)
	}
}

func TestValidateRejectsEmptyAnswer(t *testing.T) {
	r := Request{Language: "en", Question: "q", Lines: handout()}
	_ = r.Normalize(limits())
	if _, err := Validate(ModelAnswer{Answer: "  "}, r, 100); kindOf(err) != apierr.KindProviderRejected {
		t.Fatalf("err = %v", err)
	}
}

func TestFingerprintChangesWithContent(t *testing.T) {
	a := Request{Language: "en", Question: "q1", Lines: handout()}
	b := Request{Language: "en", Question: "q2", Lines: handout()}
	if a.Fingerprint() == b.Fingerprint() {
		t.Fatal("different requests share a fingerprint")
	}
}

func TestSchemaIsStrictCompatible(t *testing.T) {
	s := Schema()
	if s["additionalProperties"] != false {
		t.Fatal("schema must set additionalProperties false")
	}
	req := s["required"].([]string)
	props := s["properties"].(map[string]any)
	if len(req) != len(props) {
		t.Fatal("strict mode requires every property to be required")
	}
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b []byte
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	return string(b)
}
