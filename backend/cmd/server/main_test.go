package main

import (
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestRegisterRoutesIncludesCustomerPromotionAPI(t *testing.T) {
	app := fiber.New()
	registerCustomerRoutes(app, nil)

	found := false
	for _, route := range app.GetRoutes(true) {
		if route.Method == fiber.MethodGet && route.Path == "/api/customer/promotions" {
			found = true
			break
		}
	}

	if !found {
		t.Fatal("GET /api/customer/promotions is not registered")
	}
}
