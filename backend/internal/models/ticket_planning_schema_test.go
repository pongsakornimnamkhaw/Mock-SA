package models

import (
	"reflect"
	"strings"
	"sync"
	"testing"

	"gorm.io/gorm/schema"
)

func TestTicketPlanningSchemaExposesBinaryImagesAndTicketPrice(t *testing.T) {
	cases := []struct {
		model any
		field string
		kind  reflect.Kind
	}{
		{Concert{}, "SeatLayoutImage", reflect.Slice},
		{Ticket{}, "ImageTicket", reflect.Slice},
		{Ticket{}, "PriceTicket", reflect.Float64},
		{Zone{}, "ZonePrice", reflect.Float64},
		{Seat{}, "Flowchart", reflect.Slice},
	}
	for _, tc := range cases {
		field, ok := reflect.TypeOf(tc.model).FieldByName(tc.field)
		if !ok {
			t.Fatalf("%T must expose %s", tc.model, tc.field)
		}
		if field.Type.Kind() != tc.kind {
			t.Fatalf("%T.%s kind = %s, want %s", tc.model, tc.field, field.Type.Kind(), tc.kind)
		}
	}
}

func TestSeatAndTicketUseUnsignedNumericIDs(t *testing.T) {
	seatID, ok := reflect.TypeOf(Seat{}).FieldByName("SeatID")
	if !ok || seatID.Type.Kind() != reflect.Uint {
		t.Fatalf("Seat.SeatID must be uint, got %v", seatID.Type)
	}
	ticketID, ok := reflect.TypeOf(Ticket{}).FieldByName("TicketID")
	if !ok || ticketID.Type.Kind() != reflect.Uint {
		t.Fatalf("Ticket.TicketID must be uint, got %v", ticketID.Type)
	}
	ticketSeatID, ok := reflect.TypeOf(Ticket{}).FieldByName("SeatID")
	if !ok || ticketSeatID.Type.Kind() != reflect.Uint {
		t.Fatalf("Ticket.SeatID must be uint, got %v", ticketSeatID.Type)
	}
}

func TestZoneOwnsManySeatsAndLayoutObjectReferencesConcertOnly(t *testing.T) {
	zoneType := reflect.TypeOf(Zone{})
	concertID, ok := zoneType.FieldByName("ConcertID")
	if !ok || concertID.Type.Kind() != reflect.String {
		t.Fatal("Zone.ConcertID must be a required string foreign key")
	}
	seats, ok := zoneType.FieldByName("Seats")
	if !ok || seats.Type != reflect.TypeOf([]Seat{}) {
		t.Fatal("Zone must own []Seat")
	}
	seatZone, ok := reflect.TypeOf(Seat{}).FieldByName("ZoneID")
	if !ok || seatZone.Type.Kind() != reflect.String {
		t.Fatal("Seat must reference Zone with ZoneID")
	}
	if _, ok := reflect.TypeOf(Seat{}).FieldByName("ConcertID"); ok {
		t.Fatal("Seat must derive its concert through Zone instead of storing ConcertID")
	}

	layoutType := reflect.TypeOf(LayoutObject{})
	if _, ok := layoutType.FieldByName("ConcertID"); !ok {
		t.Fatal("LayoutObject must reference Concert")
	}
	if _, ok := layoutType.FieldByName("SeatID"); ok {
		t.Fatal("LayoutObject must not reference Seat directly")
	}
}

func TestZonePriceIsNonNegative(t *testing.T) {
	field, ok := reflect.TypeOf(Zone{}).FieldByName("ZonePrice")
	if !ok {
		t.Fatal("Zone must expose ZonePrice")
	}
	if got := field.Tag.Get("gorm"); !containsAll(got, "not null", "check:zone_price >= 0") {
		t.Fatalf("Zone.ZonePrice gorm tag = %q, want not null and non-negative check", got)
	}
}

func TestGateCheckInEnforcesOneRecordPerTicket(t *testing.T) {
	field, ok := reflect.TypeOf(GateCheckIn{}).FieldByName("TicketID")
	if !ok {
		t.Fatal("GateCheckIn must reference Ticket")
	}
	if got := field.Tag.Get("gorm"); got == "" || !containsAll(got, "uniqueIndex", "not null") {
		t.Fatalf("GateCheckIn.TicketID gorm tag = %q, want unique and not null", got)
	}
	parsed, err := schema.Parse(&GateCheckIn{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("parse GateCheckIn schema: %v", err)
	}
	if got := parsed.LookUpField("GateDateTime").DBName; got != "gate_date_time" {
		t.Fatalf("GateCheckIn.GateDateTime DB column = %q, want gate_date_time", got)
	}
}

func TestTicketSeatRelationshipRestrictsDeletingIssuedSeats(t *testing.T) {
	field, ok := reflect.TypeOf(Seat{}).FieldByName("Tickets")
	if !ok {
		t.Fatal("Seat must expose its issued tickets relationship")
	}
	if got := field.Tag.Get("gorm"); !containsAll(got, "foreignKey:SeatID", "OnDelete:RESTRICT") {
		t.Fatalf("Seat.Tickets gorm tag = %q, want an ON DELETE RESTRICT relationship", got)
	}
}

func TestPlanningChildrenDoNotGenerateReverseConcertForeignKeys(t *testing.T) {
	for _, model := range []any{&LayoutObject{}, &Publication{}} {
		parsed, err := schema.Parse(model, &sync.Map{}, schema.NamingStrategy{})
		if err != nil {
			t.Fatalf("parse %T schema: %v", model, err)
		}
		if relation := parsed.Relationships.Relations["Concert"]; relation != nil {
			t.Fatalf("%T generated reverse Concert relationship %s", model, relation.Type)
		}
	}
}

func TestTicketPlanningConstraintsIncludeZoneToConcert(t *testing.T) {
	joined := strings.Join(ticketPlanningConstraintStatements(), "\n")
	if !strings.Contains(joined, "fk_zones_concert") ||
		!strings.Contains(joined, "FOREIGN KEY (concert_id) REFERENCES concerts(concert_id)") {
		t.Fatal("ticket planning constraints must include zones.concert_id -> concerts.concert_id")
	}
}

func TestAutoMigrateModelSetExcludesLegacyVenueSeatTables(t *testing.T) {
	legacyTables := map[string]bool{
		"venue_seat_plans": true, "venue_seat_rounds": true, "venue_seat_zones": true,
		"venue_seats": true, "venue_layout_objects": true, "venue_seat_publications": true,
	}
	for _, model := range allModels() {
		parsed, err := schema.Parse(model, &sync.Map{}, schema.NamingStrategy{})
		if err != nil {
			t.Fatalf("parse %T: %v", model, err)
		}
		if legacyTables[parsed.Table] {
			t.Fatalf("legacy table %s remains in AutoMigrate", parsed.Table)
		}
	}
}

func containsAll(value string, parts ...string) bool {
	for _, part := range parts {
		found := false
		for i := 0; i+len(part) <= len(value); i++ {
			if value[i:i+len(part)] == part {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
