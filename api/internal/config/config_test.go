package config

import (
	"strings"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestDefaultsWorkWithoutAnyKeys(t *testing.T) {
	c, err := Load(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != "8080" || c.AnswersConfigured() || c.YarnConfigured() {
		t.Fatalf("config = %+v", c)
	}
	if c.OpenAIModel != "gpt-6-luna" || c.OpenAITimeout != 45*time.Second {
		t.Fatalf("model/timeout = %s %s", c.OpenAIModel, c.OpenAITimeout)
	}
}

func TestReadsPortKeysAndVoiceOverrides(t *testing.T) {
	c, err := Load(env(map[string]string{
		"PORT": "10000", "OPENAI_API_KEY": "sk", "YARNGPT_API_KEY": "yk",
		"YARNGPT_VOICE_YO": "idera", "YARNGPT_ASR_LANGUAGES": "en, yo ,pcm", "OPENAI_REASONING_EFFORT": "omit",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != "10000" || !c.AnswersConfigured() || !c.YarnConfigured() {
		t.Fatalf("config = %+v", c)
	}
	if c.YarnVoices["yo"] != "idera" || strings.Join(c.YarnASRLangs, ",") != "en,yo,pcm" || c.OpenAIReasoningEffort != "" {
		t.Fatalf("voices %v asr %v effort %q", c.YarnVoices, c.YarnASRLangs, c.OpenAIReasoningEffort)
	}
}

func TestRejectsInvalidNumbers(t *testing.T) {
	_, err := Load(env(map[string]string{"MAX_ANSWER_WORDS": "lots", "PORT": "http"}))
	if err == nil || !strings.Contains(err.Error(), "MAX_ANSWER_WORDS") || !strings.Contains(err.Error(), "PORT") {
		t.Fatalf("err = %v", err)
	}
}

func TestPreviewFixturesRefuseRealKeys(t *testing.T) {
	if _, err := Load(env(map[string]string{"LUMA_PREVIEW_FIXTURES": "true", "OPENAI_API_KEY": "sk"})); err == nil {
		t.Fatal("preview fixtures with a real key must be rejected")
	}
	c, err := Load(env(map[string]string{"LUMA_PREVIEW_FIXTURES": "true"}))
	if err != nil || !c.PreviewFixtures {
		t.Fatalf("preview fixtures alone should load: %v", err)
	}
}

func TestBindHostIgnoredOnRender(t *testing.T) {
	c, err := Load(env(map[string]string{"RENDER": "true", "BIND_HOST": "127.0.0.1", "PORT": "8080"}))
	if err != nil || c.BindHost != "" || !c.BindHostIgnored {
		t.Fatalf("on Render the service must listen on all interfaces: %+v %v", c.BindHost, err)
	}
	local, _ := Load(env(map[string]string{"BIND_HOST": "127.0.0.1"}))
	if local.BindHost != "127.0.0.1" || local.BindHostIgnored {
		t.Fatal("local runs must keep BIND_HOST")
	}
}
