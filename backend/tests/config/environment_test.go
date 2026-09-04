package config_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/config"
)

func TestLoadEnvReadsValuesAndReferences(t *testing.T) {
	for _, key := range []string{"T20_TEST_ENV_VALUE", "T20_TEST_ENV_COPY"} {
		t.Setenv(key, "")
		if err := os.Unsetenv(key); err != nil {
			t.Fatal(err)
		}
	}
	path := writeEnvFile(t, "T20_TEST_ENV_VALUE=local-value\nT20_TEST_ENV_COPY=\"${T20_TEST_ENV_VALUE}\"\n")
	if err := config.LoadEnv(path); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("T20_TEST_ENV_VALUE") != "local-value" || os.Getenv("T20_TEST_ENV_COPY") != "local-value" {
		t.Fatal("expected values and variable references to be loaded from .env")
	}
}

func TestLoadEnvPreservesExportedValue(t *testing.T) {
	t.Setenv("T20_TEST_ENV_VALUE", "exported-value")
	if err := config.LoadEnv(writeEnvFile(t, "T20_TEST_ENV_VALUE=file-value\n")); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("T20_TEST_ENV_VALUE") != "exported-value" {
		t.Fatal(".env overwrote an exported environment variable")
	}
}

func TestLoadEnvAllowsMissingFile(t *testing.T) {
	if err := config.LoadEnv(filepath.Join(t.TempDir(), ".env")); err != nil {
		t.Fatal(err)
	}
}

func TestLoadEnvRejectsMalformedFileWithoutExposingValues(t *testing.T) {
	err := config.LoadEnv(writeEnvFile(t, "T20_TEST_ENV_VALUE=\"private-demo-value\n"))
	if err == nil {
		t.Fatal("expected malformed .env to fail")
	}
	if strings.Contains(err.Error(), "private-demo-value") {
		t.Fatal("parse error exposed the file contents")
	}
}

func writeEnvFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}
