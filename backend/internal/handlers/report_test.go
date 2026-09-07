package handlers

import (
	"encoding/json"
	"testing"
	"time"

	"backend/internal/models"
)

func TestReportConcertBaseNormalizesDatesAndKeepsTimestamp(t *testing.T) {
	updatedAt := time.Date(2026, 9, 4, 14, 6, 52, 0, time.FixedZone("ICT", 7*60*60))
	row := reportConcertBase(models.Concert{
		ConcertID: "CC_TEST", ConcertName: "คอนเสิร์ตทดสอบ",
		StartDate: "2026-09-02T00:00:00Z", EndDate: "2026-09-03 00:00:00+00",
		Location: "กรุงเทพมหานคร", Status: "เสร็จสิ้น",
		BaseModel: models.BaseModel{UpdatedAt: updatedAt},
	})

	if row.StartDate != "2026-09-02" || row.EndDate != "2026-09-03" {
		t.Fatalf("report dates were not normalized: %q - %q", row.StartDate, row.EndDate)
	}
	if !row.LastUpdate.Equal(updatedAt) {
		t.Fatalf("last_update timestamp changed: got %s want %s", row.LastUpdate, updatedAt)
	}
	raw, err := json.Marshal(row)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["start_date"] != "2026-09-02" || payload["end_date"] != "2026-09-03" {
		t.Fatalf("unexpected JSON date fields: %s", raw)
	}
	if value, ok := payload["last_update"].(string); !ok {
		t.Fatalf("missing JSON timestamp: %s", raw)
	} else if parsed, err := time.Parse(time.RFC3339, value); err != nil || !parsed.Equal(updatedAt) {
		t.Fatalf("invalid JSON timestamp %q: %v", value, err)
	}
}
