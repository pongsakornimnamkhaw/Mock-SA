package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEnvFallsBackToGgCleanExampleWhenDotEnvIsMissing(t *testing.T) {
	originalDirectory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(originalDirectory) }()
	t.Setenv("DB_PORT", "5432")

	temporaryDirectory := t.TempDir()
	if err := os.WriteFile(filepath.Join(temporaryDirectory, ".env.gg-clean.example"), []byte("DB_PORT=5434\nDB_NAME=backend_T01_gg_clean\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(temporaryDirectory); err != nil {
		t.Fatal(err)
	}

	LoadEnv()

	if got := os.Getenv("DB_PORT"); got != "5434" {
		t.Fatalf("DB_PORT = %q, want gg-clean fallback port 5434", got)
	}
	if got := os.Getenv("DB_NAME"); got != "backend_T01_gg_clean" {
		t.Fatalf("DB_NAME = %q, want gg-clean fallback database", got)
	}
}

func TestLoadEnvPrefersDotEnvOverGgCleanExample(t *testing.T) {
	originalDirectory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(originalDirectory) }()
	t.Setenv("DB_PORT", "5432")

	temporaryDirectory := t.TempDir()
	if err := os.WriteFile(filepath.Join(temporaryDirectory, ".env"), []byte("DB_PORT=5999\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(temporaryDirectory, ".env.gg-clean.example"), []byte("DB_PORT=5434\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(temporaryDirectory); err != nil {
		t.Fatal(err)
	}

	LoadEnv()

	if got := os.Getenv("DB_PORT"); got != "5999" {
		t.Fatalf("DB_PORT = %q, want explicit .env port 5999", got)
	}
}
