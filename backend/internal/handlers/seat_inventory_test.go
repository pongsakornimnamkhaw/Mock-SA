package handlers

import (
	"testing"

	"backend/internal/models"
)

func TestParseSeatLabelSplitsLetterAndNumber(t *testing.T) {
	cases := []struct{ label, row, column string }{
		{"A1", "A", "1"},
		{"B12", "B", "12"},
		{"VIP", "VIP", ""},
		{"7", "", "7"},
		{" C3 ", "C", "3"},
	}
	for _, tc := range cases {
		row, column := parseSeatLabel(tc.label)
		if row != tc.row || column != tc.column {
			t.Fatalf("%q: ได้ (%q,%q) อยากได้ (%q,%q)", tc.label, row, column, tc.row, tc.column)
		}
	}
}

func TestProjectLayoutBuildsZoneSeatAndCategoryRows(t *testing.T) {
	zones := []zoneDTO{{
		ID: "VZ1", Name: "โซน A", Type: "ยืน", Color: "#E53935", Price: 2000,
		Shape: "rectangle", X: 10, Y: 20, Width: 100, Height: 50, Rotation: 15, Layer: 3,
		SeatItems: []seatDTO{
			{ID: "VS1", Name: "A1", X: 1, Y: 2},
			{ID: "VS2", Name: "A2", X: 3, Y: 4, Disabled: true},
		},
	}}

	got := projectLayoutToTicketing("CC1", zones)

	if len(got.Zones) != 1 {
		t.Fatalf("ต้องได้ 1 โซน แต่ได้ %d", len(got.Zones))
	}
	zone := got.Zones[0]
	if zone.ZoneID != "VZ1" || zone.ZoneType != "ยืน" || zone.Capacity != 2 {
		t.Fatalf("โซนผิด: %+v", zone)
	}
	if zone.PositionX != 10 || zone.PositionY != 20 || zone.Width != 100 || zone.Height != 50 || zone.Rotation != 15 || zone.LayerOrder != 3 {
		t.Fatalf("ตำแหน่ง/ขนาดโซนไม่ถูกคัดลอกมา: %+v", zone)
	}

	if len(got.Seats) != 1 {
		t.Fatalf("ที่นั่งที่ถูกปิด (disabled) ต้องไม่ถูกสร้าง — ได้ %d ใบ", len(got.Seats))
	}
	seat := got.Seats[0]
	if seat.SeatID != "VS1" || seat.SeatRow != "A" || seat.SeatColumn != "1" {
		t.Fatalf("ที่นั่งผิด: %+v", seat)
	}
	if seat.ConcertID != "CC1" || seat.ZoneID != "VZ1" || seat.StatusSeat != seatStatusAvailable {
		t.Fatalf("ที่นั่งต้องผูกกับคอนเสิร์ต/โซนและเริ่มต้นว่าง: %+v", seat)
	}

	if len(got.Categories) != 1 {
		t.Fatalf("ต้องได้ 1 หมวดหมู่ราคา แต่ได้ %d", len(got.Categories))
	}
	category := got.Categories[0]
	if category.CategoryName != "โซน A" || category.Price != 2000 || category.Quantity != 2 || category.ZoneID != "VZ1" {
		t.Fatalf("หมวดหมู่ราคาผิด: %+v", category)
	}
}

func TestProjectLayoutSkipsZonesWithoutID(t *testing.T) {
	got := projectLayoutToTicketing("CC1", []zoneDTO{{ID: "", Name: "ไม่มีรหัส"}})
	if len(got.Zones) != 0 || len(got.Categories) != 0 {
		t.Fatalf("โซนที่ไม่มีรหัสต้องถูกข้าม: %+v", got)
	}
}

func TestZoneIDsWithoutSeatsReturnsRemovableZones(t *testing.T) {
	got := zoneIDsWithoutSeats([]string{"Z1", "Z2", "Z3"}, []string{"Z2"})
	if len(got) != 2 || got[0] != "Z1" || got[1] != "Z3" {
		t.Fatalf("ต้องได้ [Z1 Z3] แต่ได้ %v", got)
	}
}

func TestMissingSeatLabelsListsWhatWasNotFound(t *testing.T) {
	found := []models.Seat{{SeatRow: "A", SeatColumn: "1"}}
	got := missingSeatLabels([]string{"A1", "A2", "B3"}, found)
	if len(got) != 2 || got[0] != "A2" || got[1] != "B3" {
		t.Fatalf("ต้องได้ [A2 B3] แต่ได้ %v", got)
	}
}
