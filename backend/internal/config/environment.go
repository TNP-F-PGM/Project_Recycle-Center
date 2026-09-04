package config

import (
	"errors"
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// LoadEnv loads optional local configuration. Exported environment variables
// take precedence, so deployments can configure the app without an .env file.
func LoadEnv(path string) error {
	err := godotenv.Load(path)
	if err == nil || errors.Is(err, os.ErrNotExist) {
		return nil
	}
	// Parser errors can contain secret values from the file; do not log them.
	return fmt.Errorf("cannot load %s: check file permissions and KEY=value syntax", path)
}
