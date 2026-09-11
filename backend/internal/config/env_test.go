package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEnvKeepsSystemEnvironmentWhenDotEnvIsMissing(t *testing.T) {
	originalDirectory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(originalDirectory) }()
	t.Setenv("DB_PORT", "5432")

	temporaryDirectory := t.TempDir()
	if err := os.Chdir(temporaryDirectory); err != nil {
		t.Fatal(err)
	}

	LoadEnv()

	if got := os.Getenv("DB_PORT"); got != "5432" {
		t.Fatalf("DB_PORT = %q, want existing system value 5432", got)
	}
}

func TestLoadEnvUsesDotEnv(t *testing.T) {
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
	if err := os.Chdir(temporaryDirectory); err != nil {
		t.Fatal(err)
	}

	LoadEnv()

	if got := os.Getenv("DB_PORT"); got != "5999" {
		t.Fatalf("DB_PORT = %q, want explicit .env port 5999", got)
	}
}
