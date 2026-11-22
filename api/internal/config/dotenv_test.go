package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvFillsOnlyUnsetVariables(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "# comment\n\nLUMA_TEST_A=from-file\nLUMA_TEST_B=\"quoted value\"\nexport LUMA_TEST_C=x\nLUMA_TEST_SET=from-file\nnot a pair\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("LUMA_TEST_SET", "from-env")
	for _, k := range []string{"LUMA_TEST_A", "LUMA_TEST_B", "LUMA_TEST_C"} {
		os.Unsetenv(k)
		t.Cleanup(func() { os.Unsetenv(k) })
	}

	n, err := LoadDotEnv(path)
	if err != nil || n != 3 {
		t.Fatalf("n=%d err=%v", n, err)
	}
	if os.Getenv("LUMA_TEST_A") != "from-file" || os.Getenv("LUMA_TEST_B") != "quoted value" || os.Getenv("LUMA_TEST_C") != "x" {
		t.Fatal("values not loaded")
	}
	if os.Getenv("LUMA_TEST_SET") != "from-env" {
		t.Fatal("existing environment must win over .env")
	}
}

func TestLoadDotEnvMissingFileIsFine(t *testing.T) {
	if n, err := LoadDotEnv(filepath.Join(t.TempDir(), "nope.env")); n != 0 || err != nil {
		t.Fatalf("n=%d err=%v", n, err)
	}
}
