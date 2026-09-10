package eventregistration

import (
	"testing"

	"backend/internal/models"
)

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
	seat := models.Seat{ConcertID: "concert-a"}
	if !ticketBelongsToConcert(seat, "concert-a") {
		t.Fatal("seat from the selected concert must be accepted")
	}
	if ticketBelongsToConcert(seat, "concert-b") {
		t.Fatal("seat from another concert must be rejected")
	}
}
