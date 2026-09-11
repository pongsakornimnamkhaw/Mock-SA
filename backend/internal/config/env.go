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
	log.Println("Warning: No environment file found, using system environment variables")
}
