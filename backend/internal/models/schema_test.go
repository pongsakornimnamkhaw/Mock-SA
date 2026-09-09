package models

import (
	"reflect"
	"strings"
	"sync"
	"testing"

	"gorm.io/gorm/schema"
)

type tableNamer interface {
	TableName() string
}

func TestConcertOwnsPlanningChildren(t *testing.T) {
	parsed, err := schema.Parse(Concert{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("parse Concert schema: %v", err)
	}
	want := map[string]schema.RelationshipType{
		"PerformanceSchedules": schema.HasMany,
		"Zones":                schema.HasMany,
		"Seats":                schema.HasMany,
		"Publication":          schema.HasOne,
		"LayoutObjects":        schema.HasMany,
	}
	for name, relationType := range want {
		relation := parsed.Relationships.Relations[name]
		if relation == nil {
			t.Fatalf("Concert is missing %s relationship", name)
		}
		if relation.Type != relationType {
			t.Fatalf("Concert.%s relationship = %s, want %s", name, relation.Type, relationType)
		}
	}
}

func TestParentModelsOwnOperationalChildren(t *testing.T) {
	tests := []struct {
		model any
		name  string
		kind  schema.RelationshipType
	}{
		{Artist{}, "Histories", schema.HasMany},
		{Zone{}, "Seats", schema.HasMany},
		{Seat{}, "Tickets", schema.HasMany},
		{Booking{}, "Tickets", schema.HasMany},
		{Ticket{}, "CheckIn", schema.HasOne},
	}
	for _, tt := range tests {
		parsed, err := schema.Parse(tt.model, &sync.Map{}, schema.NamingStrategy{})
		if err != nil {
			t.Fatalf("parse %T schema: %v", tt.model, err)
		}
		relation := parsed.Relationships.Relations[tt.name]
		if relation == nil || relation.Type != tt.kind {
			t.Fatalf("%T.%s relationship = %#v, want %s", tt.model, tt.name, relation, tt.kind)
		}
	}
}

func TestZoneHasManySeatsThroughSeatZoneID(t *testing.T) {
	zoneType := reflect.TypeOf(Zone{})
	if _, exists := zoneType.FieldByName("SeatID"); exists {
		t.Fatal("Zone must not contain SeatID; the foreign key belongs on Seat")
	}

	seatsField, ok := zoneType.FieldByName("Seats")
	if !ok {
		t.Fatal("Zone.Seats relationship is missing")
	}
	wantTagParts := []string{
		"foreignKey:ZoneID",
		"references:ZoneID",
		"constraint:OnUpdate:CASCADE,OnDelete:CASCADE",
	}
	for _, part := range wantTagParts {
		if !strings.Contains(seatsField.Tag.Get("gorm"), part) {
			t.Fatalf("Zone.Seats gorm tag = %q, want %q", seatsField.Tag.Get("gorm"), part)
		}
	}

	seatType := reflect.TypeOf(Seat{})
	zoneID, ok := seatType.FieldByName("ZoneID")
	if !ok {
		t.Fatal("Seat.ZoneID foreign key is missing")
	}
	if tag := zoneID.Tag.Get("gorm"); !strings.Contains(tag, "not null") || !strings.Contains(tag, "index") {
		t.Fatalf("Seat.ZoneID gorm tag = %q, want not null and index", tag)
	}

	parsed, err := schema.Parse(Zone{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("parse Zone schema: %v", err)
	}
	relation := parsed.Relationships.Relations["Seats"]
	if relation == nil || relation.Type != schema.HasMany {
		t.Fatalf("Zone.Seats relationship = %#v, want has_many", relation)
	}
	if len(relation.References) != 1 || relation.References[0].PrimaryKey.Name != "ZoneID" || relation.References[0].ForeignKey.Name != "ZoneID" {
		t.Fatalf("Zone.Seats must map Zone.ZoneID to Seat.ZoneID, got %#v", relation.References)
	}
}

func TestApprovedDrawIOTableNames(t *testing.T) {
	tests := []struct {
		name  string
		model tableNamer
		want  string
	}{
		{"Concert", Concert{}, "Concert"},
		{"PerformanceSchedule", PerformanceSchedule{}, "PerformanceSchedule"},
		{"Zone", Zone{}, "Zone"},
		{"Seat", Seat{}, "Seat"},
		{"Publication", Publication{}, "Publication"},
		{"LayoutObject", LayoutObject{}, "LayoutObject"},
		{"Ticket", Ticket{}, "Ticket"},
		{"GateCheckIn", GateCheckIn{}, "Gate-Check-in"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.model.TableName(); got != tt.want {
				t.Fatalf("TableName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSchemaKeepsNullableAndSingleUseContracts(t *testing.T) {
	gateType := reflect.TypeOf(GateCheckIn{})
	ticketID, ok := gateType.FieldByName("TicketID")
	if !ok {
		t.Fatal("GateCheckIn.TicketID is missing")
	}
	if !strings.Contains(ticketID.Tag.Get("gorm"), "uniqueIndex") || !strings.Contains(ticketID.Tag.Get("gorm"), "not null") {
		t.Fatalf("GateCheckIn.TicketID gorm tag = %q, want uniqueIndex and not null", ticketID.Tag.Get("gorm"))
	}
	for _, forbidden := range []string{"CheckedBy", "ReentryAuthorization", "ReentryAuthorizationID"} {
		if _, exists := gateType.FieldByName(forbidden); exists {
			t.Fatalf("GateCheckIn must not contain %s", forbidden)
		}
	}

	layoutType := reflect.TypeOf(LayoutObject{})
	parentID, ok := layoutType.FieldByName("ParentObjectID")
	if !ok || parentID.Type.Kind() != reflect.Pointer {
		t.Fatal("LayoutObject.ParentObjectID must be nullable")
	}
	for _, forbidden := range []string{"UserID", "CreatedBy", "ReferenceType", "ReferenceID", "ZoneID", "SeatID", "CategoryID"} {
		if _, exists := layoutType.FieldByName(forbidden); exists {
			t.Fatalf("LayoutObject must not contain %s", forbidden)
		}
	}
}

func TestBinaryImageColumnsMatchDrawIO(t *testing.T) {
	tests := []struct {
		model     any
		fieldName string
		column    string
		removed   string
	}{
		{Ticket{}, "ImageTicket", "image_ticket", "TicketImageURL"},
		{Concert{}, "SeatLayoutImage", "seat_layout_image", "SeatLayoutImageURL"},
	}

	for _, tt := range tests {
		t.Run(tt.fieldName, func(t *testing.T) {
			modelType := reflect.TypeOf(tt.model)
			field, ok := modelType.FieldByName(tt.fieldName)
			if !ok {
				t.Fatalf("%T.%s is missing", tt.model, tt.fieldName)
			}
			if field.Type != reflect.TypeOf([]byte{}) {
				t.Fatalf("%T.%s type = %s, want []byte", tt.model, tt.fieldName, field.Type)
			}
			tag := field.Tag.Get("gorm")
			if !strings.Contains(tag, "column:"+tt.column) || !strings.Contains(tag, "type:bytea") {
				t.Fatalf("%T.%s gorm tag = %q, want column %s with bytea", tt.model, tt.fieldName, tag, tt.column)
			}
			if _, exists := modelType.FieldByName(tt.removed); exists {
				t.Fatalf("%T must not retain removed URL field %s", tt.model, tt.removed)
			}
		})
	}
}
