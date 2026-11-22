// Command server runs the LUMA API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"luma/api/internal/config"
	"luma/api/internal/providers/fixture"
	"luma/api/internal/providers/openai"
	"luma/api/internal/providers/yarngpt"
	"luma/api/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	// Local runs: read api/.env if present. Real environment variables win.
	if n, err := config.LoadDotEnv(".env"); err != nil {
		logger.Warn("could not read .env", "error", err.Error())
	} else if n > 0 {
		logger.Info("loaded .env", "variables", n)
	}

	cfg, err := config.Load(os.Getenv)
	if err != nil {
		logger.Error("invalid configuration", "error", err.Error())
		os.Exit(1)
	}

	deps := server.Deps{Config: cfg, Logger: logger}
	if cfg.AnswersConfigured() {
		deps.Answerer = openai.New(cfg.OpenAIBaseURL, cfg.OpenAIKey, cfg.OpenAIModel, cfg.OpenAIReasoningEffort,
			cfg.Limits.MaxOutputTokens, cfg.OpenAITimeout)
	}
	if cfg.YarnConfigured() {
		yc := yarngpt.New(cfg.YarnBaseURL, cfg.YarnKey)
		deps.Transcriber = yc
		deps.Synthesizer = yc
		deps.Voices = yarngpt.NewDirectory(yc, cfg.YarnVoices, cfg.YarnASRLangs)
	}
	if cfg.PreviewFixtures {
		// Labelled stand-ins for trying the online flow without keys.
		sp := fixture.Speech{}
		deps.Answerer, deps.Transcriber, deps.Synthesizer, deps.Voices = fixture.Answerer{}, sp, sp, sp
		logger.Warn("PREVIEW FIXTURES MODE: answers, transcripts and audio are labelled test fixtures, not AI output")
	}
	// Report only whether each provider is configured, never key values.
	logger.Info("starting",
		"port", cfg.Port, "version", cfg.Version, "preview_fixtures", cfg.PreviewFixtures,
		"answers_configured", cfg.AnswersConfigured(), "answer_model", cfg.OpenAIModel,
		"yarngpt_configured", cfg.YarnConfigured(), "client_token_required", cfg.ClientToken != "",
	)

	srv := &http.Server{
		Addr:              cfg.BindHost + ":" + cfg.Port,
		Handler:           server.New(deps),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      cfg.YarnTimeout + cfg.OpenAITimeout + 30*time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    32 << 10,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()

	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("server stopped", "error", err.Error())
		os.Exit(1)
	}
	logger.Info("stopped")
}
