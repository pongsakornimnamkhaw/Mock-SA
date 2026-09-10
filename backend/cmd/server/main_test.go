package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func TestEmployeePasswordResetCORSPreflight(t *testing.T) {
	app := fiber.New()
	app.Use(cors.New(serverCORSConfig()))
	req := httptest.NewRequest(http.MethodOptions, "/api/employee/auth/password-reset/status", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "GET")
	req.Header.Set("Access-Control-Request-Headers", "X-Employee-Reset-Token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent || resp.Header.Get("Access-Control-Allow-Origin") != "http://localhost:5173" || resp.Header.Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("preflight rejected: status=%d headers=%v", resp.StatusCode, resp.Header)
	}
	if !strings.Contains(strings.ToLower(resp.Header.Get("Access-Control-Allow-Headers")), "x-employee-reset-token") {
		t.Fatal("preflight does not permit the browser reset token header")
	}
}
