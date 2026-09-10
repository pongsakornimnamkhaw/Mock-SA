package config

import (
	"log"

	"github.com/joho/godotenv"
)

// LoadEnv loads environment variables from .env file
func LoadEnv() {
	if err := godotenv.Overload(".env"); err == nil {
		return
	}
	if err := godotenv.Overload(".env.gg-clean.example"); err == nil {
		log.Println("No .env found; using the gg-clean development database settings")
		return
	}
	log.Println("Warning: No environment file found, using system environment variables")
}
