package config

import (
	"errors"
	"fmt"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/SA-1-69/T20/backend/internal/migrations"
)

var DB *gorm.DB

func ConnectDatabase() error {
	if err := LoadEnv(".env"); err != nil {
		return err
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("DATABASE_URL is required: configure backend/.env from .env.example or export DATABASE_URL")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		TranslateError: true,
	})
	if err != nil {
		return fmt.Errorf("connect to PostgreSQL: %w", err)
	}

	if err := migrations.Run(db); err != nil {
		return fmt.Errorf("auto migrate database: %w", err)
	}

	DB = db
	return nil
}
