package eventregistration

import "testing"

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
