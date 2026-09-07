package config

import (
	"log"

	"github.com/joho/godotenv"
)

// LoadEnv loads environment variables from .env file
func LoadEnv() {
	err := godotenv.Overload()
	if err != nil {
		log.Println("Warning: No .env file found or error loading it, using system environment variables")
	}
}
