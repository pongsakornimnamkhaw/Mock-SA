package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func customerTestRequest(t *testing.T, app *fiber.App, method, path string, payload any, cookie *http.Cookie, expectedStatus int) *http.Response {
	t.Helper()
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		body = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, path, body)
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		request.AddCookie(cookie)
	}
	response, err := app.Test(request, -1)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != expectedStatus {
		defer response.Body.Close()
		content, _ := io.ReadAll(response.Body)
		t.Fatalf("%s %s returned %d, expected %d: %s", method, path, response.StatusCode, expectedStatus, content)
	}
	return response
}
