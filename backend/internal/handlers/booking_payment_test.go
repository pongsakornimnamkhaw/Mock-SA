package handlers

import (
	"testing"
	"time"

	"backend/internal/models"
)

func TestBuildIssuedTicketSnapshotsZonePrice(t *testing.T) {
	booking := models.Booking{BookingID: "BK-1", ConcertTitle: "Concert A", CustomerName: "Somchai"}
	seat := models.Seat{SeatID: 17, SeatLabel: "A-17", ZoneID: "A"}
	zone := models.Zone{ZoneID: "A", ZonePrice: 1250.50}
	issuedAt := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)

	ticket := buildIssuedTicket(booking, seat, zone, issuedAt)

	if ticket.TicketID != 0 {
		t.Fatalf("TicketID = %d, want database-generated zero value", ticket.TicketID)
	}
	if ticket.SeatID != 17 || ticket.PriceTicket != 1250.50 {
		t.Fatalf("ticket snapshot = seat %d price %.2f", ticket.SeatID, ticket.PriceTicket)
	}
	if ticket.QrCodeData != "" {
		t.Fatalf("QrCodeData must remain empty until the database assigns TicketID, got %q", ticket.QrCodeData)
	}
	if got := buildTicketQRCode(45, booking, seat, zone); got != "OCTAVIA|45|Concert A|A|A-17|Somchai" {
		t.Fatalf("buildTicketQRCode = %q", got)
	}
}

func TestAutomaticBookingZoneIDIsScopedByConcert(t *testing.T) {
	first := automaticBookingZoneID("CC1", "A1")
	second := automaticBookingZoneID("CC2", "A1")
	if first == second {
		t.Fatalf("automatic booking zones collide across concerts: %q", first)
	}
	if first != automaticBookingZoneID("CC1", "A1") {
		t.Fatal("automatic booking zone ID must be deterministic")
	}
	if len(first) > 50 {
		t.Fatalf("automatic booking zone ID exceeds database limit: %d", len(first))
	}
}
