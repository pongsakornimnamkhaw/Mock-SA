package models

import "testing"

func TestSeatLabelJoinsRowAndColumn(t *testing.T) {
	seat := Seat{SeatRow: "A", SeatColumn: "12"}
	if got := seat.Label(); got != "A12" {
		t.Fatalf("ป้ายที่นั่งต้องเป็น A12 แต่ได้ %q", got)
	}
}

func TestSeatLabelHandlesEmptyColumn(t *testing.T) {
	seat := Seat{SeatRow: "VIP", SeatColumn: ""}
	if got := seat.Label(); got != "VIP" {
		t.Fatalf("ที่นั่งที่ไม่มีคอลัมน์ต้องคืนแค่แถว แต่ได้ %q", got)
	}
}
