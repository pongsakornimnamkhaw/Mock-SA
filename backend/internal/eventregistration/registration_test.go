package eventregistration

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
)

func TestRegistrationConcertViewUsesDatabasePosterAndSkipsMissingImages(t *testing.T) {
	concert := models.Concert{
		ConcertID: "CC0002", ConcertName: "Neon Nights Vol.3", Poster: []byte("png"),
		BaseModel: models.BaseModel{UpdatedAt: time.Unix(1789062000, 0)},
	}
	view, ok := registrationConcertView(concert)
	if !ok || view.Cover != "/api/concerts/CC0002/poster?v=1789062000" {
		t.Fatalf("registrationConcertView() = %+v, %v", view, ok)
	}
	concert.Poster = nil
	if _, ok := registrationConcertView(concert); ok {
		t.Fatal("concert without a poster must be hidden")
	}
}

func TestCheckInRequestAcceptsNumericAndDisplayTicketIDs(t *testing.T) {
	for _, payload := range []string{
		`{"ticketId":45,"gateId":1,"concertId":"CC1"}`,
		`{"ticketId":"TK-45","gateId":1,"concertId":"CC1"}`,
	} {
		var request checkInRequest
		if err := json.Unmarshal([]byte(payload), &request); err != nil {
			t.Fatalf("decode %s: %v", payload, err)
		}
		if uint(request.TicketID) != 45 {
			t.Fatalf("ticket ID from %s = %d, want 45", payload, request.TicketID)
		}
	}
}

func TestRegistrationRoutesExposeConcertSelection(t *testing.T) {
	app := fiber.New()
	RegisterRoutes(app, nil)
	for _, route := range app.GetRoutes() {
		if route.Method == fiber.MethodGet && route.Path == "/api/event-registration/concerts" {
			return
		}
	}
	t.Fatal("GET /api/event-registration/concerts route is missing")
}

func TestCanCheckInAcceptsIssuedTicketStatuses(t *testing.T) {
	for _, status := range []string{"READY", "active", "VALID", "พร้อมใช้งาน"} {
		if !CanCheckIn(status) {
			t.Fatalf("CanCheckIn(%q) = false, want true", status)
		}
	}
}

func TestCanCheckInRejectsUsedOrUnavailableStatuses(t *testing.T) {
	for _, status := range []string{"USED", "ยกเลิก", "PENDING", ""} {
		if CanCheckIn(status) {
			t.Fatalf("CanCheckIn(%q) = true, want false", status)
		}
	}
}

func TestTicketBelongsToSelectedConcert(t *testing.T) {
	zone := models.Zone{ConcertID: "concert-a"}
	if !ticketBelongsToConcert(zone, "concert-a") {
		t.Fatal("zone from the selected concert must be accepted")
	}
	if ticketBelongsToConcert(zone, "concert-b") {
		t.Fatal("zone from another concert must be rejected")
	}
}

func TestParseTicketIDAcceptsNumericAndDisplayCodes(t *testing.T) {
	for input, want := range map[string]uint{
		"45": 45, "TK-45": 45, "#TK-45": 45,
		"OCTAVIA|45|Neon Nights Vol.3|ZONE-A|A12|สมชาย ใจดี": 45,
	} {
		got, err := parseTicketID(input)
		if err != nil {
			t.Fatalf("parseTicketID(%q) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("parseTicketID(%q) = %d, want %d", input, got, want)
		}
	}
}

func TestTicketStatusErrorSeparatesUsedFromUnavailable(t *testing.T) {
	if !errors.Is(ticketStatusError("USED", false), errTicketUsed) {
		t.Fatal("USED ticket must return errTicketUsed")
	}
	if !errors.Is(ticketStatusError("READY", true), errTicketUsed) {
		t.Fatal("existing check-in must return errTicketUsed")
	}
	if !errors.Is(ticketStatusError("PENDING", false), errTicketUnavailable) {
		t.Fatal("non-ready ticket must return errTicketUnavailable")
	}
	if err := ticketStatusError("READY", false); err != nil {
		t.Fatalf("ready unused ticket rejected: %v", err)
	}
}

func TestParseTicketIDRejectsInvalidValues(t *testing.T) {
	for _, input := range []string{"", "TK-", "ABC", "0", "-1"} {
		if _, err := parseTicketID(input); err == nil {
			t.Fatalf("parseTicketID(%q) succeeded, want error", input)
		}
	}
}
