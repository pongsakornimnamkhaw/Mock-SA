package main

import (
	"log"
	"os"

	"backend/internal/config"
	"backend/internal/handlers"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// 1. Load Environment Variables
	config.LoadEnv()

	// 2. Connect to Database
	config.ConnectDB()
	if err := models.MigrateAllModels(config.DB); err != nil {
		log.Fatalf("Failed to auto-migrate models: %v\n", err)
	}

	// 3. Initialize Fiber App
	app := fiber.New(fiber.Config{BodyLimit: 20 * 1024 * 1024})

	// Middleware
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:3000",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	}))

	// Routes
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Welcome to Go Backend API",
			"status":  "success",
		})
	})
	handlers.RegisterVenueSeatRoutes(app, config.DB)
	handlers.RegisterRegistrationRoutes(app, config.DB)
	handlers.RegisterConcertRoutes(app, config.DB)
	handlers.RegisterArtistRoutes(app, config.DB)
	handlers.RegisterManagementRoutes(app, config.DB)

	// Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
