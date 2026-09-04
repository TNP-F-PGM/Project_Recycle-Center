package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SA-1-69/T20/backend/internal/config"
	"github.com/SA-1-69/T20/backend/internal/routes"
)

func main() {
	migrateOnly := flag.Bool("migrate-only", false, "update the database and exit without starting the API")
	flag.Parse()
	if err := run(*migrateOnly); err != nil {
		log.Fatal(err)
	}
}

func run(migrateOnly bool) error {
	if err := config.ConnectDatabase(); err != nil {
		return err
	}
	db, err := config.DB.DB()
	if err != nil {
		return err
	}
	defer db.Close()
	log.Println("database connected and migrated")
	if migrateOnly {
		return nil
	}

	address := os.Getenv("HTTP_ADDR")
	if address == "" {
		address = "127.0.0.1:8080"
	}
	server := &http.Server{
		Addr: address, Handler: routes.NewRouter(config.DB),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serveErrors := make(chan error, 1)
	go func() {
		log.Printf("API listening at http://%s (Ctrl+C to stop)", address)
		serveErrors <- server.ListenAndServe()
	}()
	select {
	case err := <-serveErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			_ = server.Close()
			return err
		}
		return nil
	}
}
