package handlers

import "testing"

func TestTicketCanCheckInOnlyReadyStates(t *testing.T) {
	tests := []struct {
		status string
		want   bool
	}{
		{"READY", true},
		{"active", true},
		{" Valid ", true},
		{"USED", false},
		{"CANCELLED", false},
		{"", false},
	}
	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			if got := ticketCanCheckIn(tt.status); got != tt.want {
				t.Fatalf("ticketCanCheckIn(%q) = %v, want %v", tt.status, got, tt.want)
			}
		})
	}
}
