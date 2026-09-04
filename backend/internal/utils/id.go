package utils

import (
	"crypto/rand"
	"encoding/hex"
)

// GenerateID returns a prefixed random identifier.
func GenerateID(prefix string) (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return prefix + "-" + hex.EncodeToString(value[:]), nil
}
