package handlers

import (
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestZoneStartingPriceQueryReadsTicketThroughSeat(t *testing.T) {
	db, err := gorm.Open(postgres.Open("host=localhost user=test dbname=test sslmode=disable"), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
	})
	if err != nil {
		t.Fatalf("open dry-run database: %v", err)
	}

	var price float64
	statement := zoneStartingPriceQuery(db, "zone-a").Scan(&price).Statement
	sql := statement.SQL.String()
	for _, fragment := range []string{`FROM "Ticket" AS t`, `JOIN "Seat" AS s`, `MIN(t.price_ticket)`, `s.zone_id =`} {
		if !strings.Contains(sql, fragment) {
			t.Fatalf("zone price SQL %q does not contain %q", sql, fragment)
		}
	}
	if strings.Contains(strings.ToLower(sql), "ticketcategor") {
		t.Fatalf("zone price SQL must not use TicketCategory: %q", sql)
	}
}
