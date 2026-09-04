package main

import (
	"log"

	"github.com/SA-1-69/T20/backend/internal/config"
	"github.com/SA-1-69/T20/backend/internal/seed"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	if err := config.ConnectDatabase(); err != nil {
		return err
	}
	pool, err := config.DB.DB()
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := seed.Run(config.DB); err != nil {
		return err
	}
	log.Println("demo data ready; existing records preserved")
	return nil
}
