# Ticket Planning and Event Registration Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Replace the duplicate `VenueSeat*` persistence layer with the nine approved Draw.io tables, preserve the current venue-seat API contract, and add a one-time ticket check-in backend without changing the frontend.

**Architecture:** `Concert` is the aggregate root. `Showtime`, `Zone`, `Seat`, `TicketCategory`, `Publication`, and `LayoutObject` store planning data; `Ticket` and `Gate-Check-in` implement registration. GORM models explicitly return Draw.io table names. Startup migration preserves the shared `Concert` by renaming it, rebuilds only the five incompatible legacy ticket/registration tables, and drops the six duplicate `VenueSeat*` tables. Handlers map the existing DTOs onto the consolidated schema.

**Tech Stack:** Go 1.26.4, Fiber 2.52, GORM 1.31, PostgreSQL 16, Go `testing`, React/Vite (build verification only; no UI edits).

**Spec:** `docs/superpowers/specs/2026-09-07-ticket-planning-registration-database-design.md`

**Global constraints:** Do not modify UI files. Do not alter `TicketSalesInfo`. Do not add `ReentryAuthorization`, `CheckedBy`, or a `Gate` table. A ticket may be checked in successfully once only. Keep the existing `/api/venue-seat` JSON shapes and routes. Destructive migration statements may target only explicitly listed tables of these two systems; never use dynamic names or touch promotion, payment, artist, work, document, or report tables.

---

## Task 1: Lock the model and table-name contract

**Files:**
- Create: `backend/internal/models/schema_test.go`
- Modify: `backend/internal/models/concert.go`
- Modify: `backend/internal/models/ticket.go`
- Create: `backend/internal/models/showtime.go`
- Create: `backend/internal/models/publication.go`
- Create: `backend/internal/models/layout_object.go`
- Delete after references are migrated: `backend/internal/models/venue.go`

- [ ] **Step 1: Write a failing table-name test**

Create `schema_test.go`:

```go
package models

import "testing"

func TestApprovedDrawIOTableNames(t *testing.T) {
	tests := []struct{ name, got, want string }{
		{"Concert", (Concert{}).TableName(), "Concert"},
		{"Showtime", (Showtime{}).TableName(), "Showtime"},
		{"Zone", (Zone{}).TableName(), "Zone"},
		{"Seat", (Seat{}).TableName(), "Seat"},
		{"TicketCategory", (TicketCategory{}).TableName(), "TicketCategory"},
		{"Publication", (Publication{}).TableName(), "Publication"},
		{"LayoutObject", (LayoutObject{}).TableName(), "LayoutObject"},
		{"Ticket", (Ticket{}).TableName(), "Ticket"},
		{"GateCheckIn", (GateCheckIn{}).TableName(), "Gate-Check-in"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Fatalf("table name = %q, want %q", tt.got, tt.want)
			}
		})
	}
}
```

- [ ] **Step 2: Confirm the test fails**

From `backend` run:

```powershell
go test ./internal/models -run TestApprovedDrawIOTableNames -v
```

Expected: compile failure because the three new models and `TableName()` methods do not exist.

- [ ] **Step 3: Implement exact table names and approved fields**

Add:

```go
func (Concert) TableName() string        { return "Concert" }
func (Showtime) TableName() string       { return "Showtime" }
func (Zone) TableName() string           { return "Zone" }
func (Seat) TableName() string           { return "Seat" }
func (TicketCategory) TableName() string { return "TicketCategory" }
func (Publication) TableName() string    { return "Publication" }
func (LayoutObject) TableName() string   { return "LayoutObject" }
func (Ticket) TableName() string         { return "Ticket" }
func (GateCheckIn) TableName() string    { return "Gate-Check-in" }
```

Implement the new focused models:

```go
type Showtime struct {
	ShowID       string    `gorm:"column:show_id;primaryKey;type:varchar(50);not null"`
	RoundShow    int       `gorm:"column:round_show;not null;check:round_show > 0"`
	ShowDate     time.Time `gorm:"column:show_date;type:date;not null"`
	TimeOpenGate string    `gorm:"column:time_open_gate;type:time without time zone;not null"`
	StatusShow   string    `gorm:"column:status_show;type:varchar(50);not null"`
	ConcertID    string    `gorm:"column:concert_id;type:varchar(50);not null;index"`
}

type Publication struct {
	PublicationID        string     `gorm:"column:publication_id;primaryKey;type:varchar(50);not null"`
	ConcertID            string     `gorm:"column:concert_id;type:varchar(50);not null;uniqueIndex"`
	SaleOpenDate         *time.Time `gorm:"column:sale_open_date;type:timestamp"`
	BookingCloseDatetime *time.Time `gorm:"column:booking_close_datetime;type:timestamp"`
	OpenInWeb            *time.Time `gorm:"column:open_in_web;type:timestamp"`
	OutWeb               *time.Time `gorm:"column:out_web;type:timestamp"`
	Description          string     `gorm:"column:description;type:text"`
	PosterWeb            string     `gorm:"column:poster_web;type:varchar(1000)"`
	BaseModel
}

type LayoutObject struct {
	ObjectID       string  `gorm:"column:object_id;primaryKey;type:varchar(50);not null"`
	ConcertID      string  `gorm:"column:concert_id;type:varchar(50);not null;index"`
	ParentObjectID *string `gorm:"column:parent_object_id;type:varchar(50);index"`
	LayoutType     string  `gorm:"column:layout_type;type:varchar(20);not null;check:layout_type IN ('VENUE','TICKET')"`
	SideType       *string `gorm:"column:side_type;type:varchar(20);check:side_type IS NULL OR side_type IN ('FRONT','BACK')"`
	ObjectType     string  `gorm:"column:object_type;type:varchar(50);not null"`
	PositionX      float64 `gorm:"column:position_x;type:double precision;not null"`
	PositionY      float64 `gorm:"column:position_y;type:double precision;not null"`
	Width          float64 `gorm:"column:width;type:double precision;not null"`
	Height         float64 `gorm:"column:height;type:double precision;not null"`
	Rotation       float64 `gorm:"column:rotation;type:double precision;not null"`
	LayerOrder     int     `gorm:"column:layer_order;not null"`
	ObjectData     *string `gorm:"column:object_data;type:jsonb"`
	StyleJSON      *string `gorm:"column:style_json;type:jsonb"`
}
```

Apply the approved changes:

- `Concert`: add nullable `SeatLayoutImageURL` and `TimeOpenGate`.
- `Zone`: add `ConcertID`, position, size, rotation, shape, color, and layer fields.
- `Seat`: change row/column to strings; add `Flowchart []byte`, position, rotation, `ZoneID`, and `ConcertID`.
- `TicketCategory`: add `ConcertID`; make `ZoneID` and `PromotionName` nullable; remove `PromotionID`.
- `Ticket`: add nullable `TicketImageURL` and `PriceTicket`.
- `GateCheckIn`: use `CheckInID` PK, unique/non-null `TicketID`, integer `GateID`, date/time, and status.

Keep `TicketSalesInfo`, `Booking`, `Payment`, and `SalesReport` unchanged.

Add explicit relation fields (with `json:"-"`) so AutoMigrate creates real foreign keys:

```go
// Representative declarations; apply this constraint pattern to every relation.
Concert Concert `gorm:"foreignKey:ConcertID;references:ConcertID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
Zone    Zone    `gorm:"foreignKey:ZoneID;references:ZoneID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
Seat    Seat    `gorm:"foreignKey:SeatID;references:SeatID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
Booking Booking `gorm:"foreignKey:BookingID;references:BookingID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
Ticket  Ticket  `gorm:"foreignKey:TicketID;references:TicketID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
Parent  *LayoutObject `gorm:"foreignKey:ParentObjectID;references:ObjectID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
```

Required relations are: `Showtime.Concert`, `Zone.Concert`, `Seat.Zone`, `Seat.Concert`, `TicketCategory.Concert`, nullable `TicketCategory.Zone`, `Publication.Concert`, `LayoutObject.Concert`, nullable `LayoutObject.Parent`, `Ticket.Seat`, `Ticket.Booking`, and `GateCheckIn.Ticket`. Do not add a `LayoutObject` relation to `User`, `Zone`, or `Seat`.

- [ ] **Step 4: Add reflection tests**

Assert that:

- `GateCheckIn.TicketID` has `uniqueIndex` and `not null`.
- `TicketCategory.ZoneID` and `LayoutObject.ParentObjectID` are pointers.
- `LayoutObject` has no `UserID`, `CreatedBy`, `ReferenceType`, `ReferenceID`, `ZoneID`, `SeatID`, or `CategoryID`.
- `GateCheckIn` has no `CheckedBy` or re-entry field.

- [ ] **Step 5: Format, test, and commit**

```powershell
gofmt -w internal/models/concert.go internal/models/ticket.go internal/models/showtime.go internal/models/publication.go internal/models/layout_object.go internal/models/schema_test.go
go test ./internal/models -v
git add backend/internal/models
git commit -m "refactor: define approved ticket planning schema"
```

Expected: model tests pass.

---

## Task 2: Make startup migration converge safely

**Files:**
- Modify: `backend/internal/models/migrate.go`
- Create: `backend/internal/models/migrate_test.go`

- [ ] **Step 1: Write failing migration inventory tests**

Test the exact legacy deletion list:

```go
func TestLegacyTicketPlanningTablesAreExplicit(t *testing.T) {
	want := []string{
		"venue_seat_publications",
		"venue_layout_objects",
		"venue_seats",
		"venue_seat_zones",
		"venue_seat_rounds",
		"venue_seat_plans",
		"gate_check_ins",
		"tickets",
		"ticket_categories",
		"seats",
		"zones",
	}
	if !reflect.DeepEqual(legacyTicketPlanningTables(), want) {
		t.Fatalf("legacy tables = %#v", legacyTicketPlanningTables())
	}
}
```

Also test that the scoped table inventory is exactly:

```go
[]string{"Concert", "Showtime", "Zone", "Seat", "TicketCategory", "Publication", "LayoutObject", "Ticket", "Gate-Check-in"}
```

- [ ] **Step 2: Confirm inventory tests fail**

```powershell
go test ./internal/models -run 'TestLegacyTicketPlanningTablesAreExplicit|TestApprovedMigrationModels' -v
```

Expected: compile failure because the helpers do not exist.

- [ ] **Step 3: Implement ordered migration**

Refactor `MigrateAllModels` into four fail-fast phases:

1. Rename the compatible shared `concerts` table to `Concert` only when old exists and approved name does not.
2. Drop the five incompatible legacy ticket/registration tables and the six duplicate tables in child-to-parent order.
3. AutoMigrate shared models and the nine approved models.
4. Normalize date/time columns with quoted exact names.

Use only this fixed rename:

```go
var approvedTableRenames = []struct{ Old, New string }{
	{"concerts", "Concert"},
}
```

The five old plural tables are rebuilt because their previous required columns and primary keys conflict with the approved schema; AutoMigrate alone would leave obsolete constraints behind. Do not rename, drop, or alter `ticket_sales_infos`. Remove `MigrateVenueSeatModels`.

The only DROP statements allowed are these literals:

```sql
DROP TABLE IF EXISTS "venue_seat_publications" CASCADE;
DROP TABLE IF EXISTS "venue_layout_objects" CASCADE;
DROP TABLE IF EXISTS "venue_seats" CASCADE;
DROP TABLE IF EXISTS "venue_seat_zones" CASCADE;
DROP TABLE IF EXISTS "venue_seat_rounds" CASCADE;
DROP TABLE IF EXISTS "venue_seat_plans" CASCADE;
DROP TABLE IF EXISTS "gate_check_ins" CASCADE;
DROP TABLE IF EXISTS "tickets" CASCADE;
DROP TABLE IF EXISTS "ticket_categories" CASCADE;
DROP TABLE IF EXISTS "seats" CASCADE;
DROP TABLE IF EXISTS "zones" CASCADE;
```

Run the fixed drops and AutoMigrate inside one PostgreSQL transaction. The drops are idempotent: after the first successful run the old names no longer exist, while subsequent runs never target the new exact-name tables. Do not add a migration-marker table because the domain table count must remain exactly as approved.

- [ ] **Step 4: Add an isolated PostgreSQL migration test**

When PostgreSQL is available, create a unique temporary schema and set `search_path`. Create all eleven listed legacy tables, run the scoped migration, and verify:

- all nine approved tables resolve via `to_regclass`, including `to_regclass('"Gate-Check-in"')`;
- all eleven listed legacy tables are absent;
- `Gate-Check-in.ticket_id` has a unique index;
- running migration twice succeeds and does not delete data inserted into the new tables.

Drop only the generated temporary schema in `t.Cleanup`. If PostgreSQL is unavailable, skip with the connection error.

- [ ] **Step 5: Run tests and commit**

```powershell
gofmt -w internal/models/migrate.go internal/models/migrate_test.go
go test ./internal/models -run 'TestLegacy|TestApproved|TestMigration' -v
git add backend/internal/models/migrate.go backend/internal/models/migrate_test.go
git commit -m "refactor: migrate to consolidated ticket tables"
```

Expected: unit tests pass; integration test passes when PostgreSQL is running.

---

## Task 3: Preserve the venue-seat API on the consolidated schema

**Files:**
- Modify: `backend/internal/handlers/venue_seat.go`
- Modify: `backend/tests/api_test.go`

- [ ] **Step 1: Update integration tests first**

Replace every `VenueSeat*` cleanup/query with dependency-ordered use of `LayoutObject`, `Seat`, `TicketCategory`, `Zone`, `Showtime`, `Publication`, and `Concert`.

Extend `TestCreateAndGetConcertAPI` to assert one `Showtime` and one `Publication`. Extend `TestSaveLayoutAPI` to assert:

- one `Zone` belongs to the concert;
- two `Seat` rows belong to the zone;
- one `TicketCategory` preserves price/quota;
- one `LayoutObject` has `LayoutType == "VENUE"`;
- GET returns the same `zones` and `layoutObjects` JSON shape.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
go test ./tests -run 'TestCreateAndGetConcertAPI|TestSaveLayoutAPI' -v
```

Expected: compile or persistence failure until the handler stops using `VenueSeat*`.

- [ ] **Step 3: Replace concert/round/publication mapping**

Keep all current routes and DTOs. Map fields exactly:

| Existing DTO | New source |
|---|---|
| `roundDTO` | `Showtime`; array index + 1 becomes `RoundShow` |
| `SaleStart` | `Publication.SaleOpenDate` |
| `SaleEnd` | `Publication.BookingCloseDatetime` |
| `PublishAt` | `Publication.OpenInWeb` |
| `UnpublishAt` | `Publication.OutWeb` |
| `ScheduleImage` | `Concert.SeatLayoutImageURL` |
| `ScheduleFile` | compatibility-only; return empty and do not persist |
| `Artist` | existing `ConcertArtist`/`Artist` relation when available, else empty |
| `Category` | compatibility-only; return empty until the new UI defines its source |

Reject `EndDate < StartDate`, `SaleEnd < SaleStart`, and `UnpublishAt < PublishAt` with HTTP 400 before the transaction.

- [ ] **Step 4: Replace layout persistence transactionally**

In one transaction:

1. lock/check the `Concert`;
2. validate nonnegative zone capacity and price;
3. ensure seat-item count does not exceed capacity;
4. delete prior scoped `Seat`, `TicketCategory`, `Zone`, and `LayoutObject` rows;
5. insert zones and their geometry;
6. insert seats with both `ZoneID` and `ConcertID`;
7. insert one category per zone with submitted name, price, and quota;
8. insert generic objects as `LayoutObject{LayoutType: "VENUE", SideType: nil}`.

Serialize display-only fields into JSONB:

```go
type venueObjectData struct {
	Kind  string `json:"kind"`
	Shape string `json:"shape"`
	Name  string `json:"name"`
}
type venueObjectStyle struct {
	Color     string `json:"color"`
	TextColor string `json:"textColor"`
}
```

Split `A12` into row `A` and column `12`. If a seat name has no numeric boundary, keep the whole value in `SeatColumn` and leave `SeatRow` empty. GET reconstructs row + column.

`clearLayout` deletes layout rows for the selected concert only and never deletes `Concert`.

- [ ] **Step 5: Add rollback coverage**

Add `TestSaveLayoutRollsBackOnInvalidSeat`. Send one valid zone followed by a seat whose zone is not in the request. Expect HTTP 400 and zero new scoped rows.

- [ ] **Step 6: Run and commit**

```powershell
gofmt -w internal/handlers/venue_seat.go tests/api_test.go
go test ./tests -run 'TestCreateAndGetConcertAPI|TestSaveLayoutAPI|TestSaveLayoutRollsBackOnInvalidSeat' -v
git add backend/internal/handlers/venue_seat.go backend/tests/api_test.go
git commit -m "refactor: persist venue plans in shared schema"
```

Expected: all listed tests pass.

---

## Task 4: Add one-time registration APIs

**Files:**
- Create: `backend/internal/handlers/registration.go`
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/tests/api_test.go`

- [ ] **Step 1: Add failing API tests**

Test:

1. `GET /api/event-registration/tickets/:ticketID` returns ticket, seat, and zone without mutation.
2. Unknown ticket returns 404.
3. Cancelled ticket returns 409.
4. `POST /api/event-registration/check-ins` succeeds once, creates one check-in, and changes ticket status to `USED`.
5. A second POST for the same ticket returns 409 and still has one check-in.
6. Missing or non-positive `gateId` returns 400 and inserts nothing.

Request body:

```json
{"ticketId":"TK-2026-0459","gateId":1}
```

- [ ] **Step 2: Confirm route tests fail**

```powershell
go test ./tests -run 'TestLookupTicket|TestCheckIn' -v
```

Expected: 404 because routes are not registered.

- [ ] **Step 3: Implement routes**

```go
func RegisterRegistrationRoutes(app *fiber.App, db *gorm.DB) {
	h := &RegistrationHandler{db: db}
	g := app.Group("/api/event-registration")
	g.Get("/tickets/:ticketID", h.lookupTicket)
	g.Post("/check-ins", h.checkIn)
}
```

Lookup joins `Ticket → Seat → Zone` and returns ticket ID, concert name, date/time, image URL, status, seat row/column, zone ID/type, and whether a successful check-in exists. GET must not create any record.

- [ ] **Step 4: Implement atomic one-time check-in**

Inside a transaction:

1. validate body and `gateId > 0`;
2. lock the ticket row using `clause.Locking{Strength: "UPDATE"}`;
3. accept only `READY`, `ACTIVE`, or `VALID`;
4. reject an existing check-in;
5. create `GateCheckIn{CheckInStatus: "SUCCESS"}`;
6. update `Ticket.StatusTicket` to `USED`;
7. commit and return HTTP 201.

Map PostgreSQL unique conflicts to HTTP 409, which also protects against concurrent scans. Failed validation/checks must not create a row.

- [ ] **Step 5: Register and verify**

Add to `backend/cmd/server/main.go`:

```go
handlers.RegisterRegistrationRoutes(app, config.DB)
```

Then run:

```powershell
gofmt -w internal/handlers/registration.go cmd/server/main.go tests/api_test.go
go test ./tests -run 'TestLookupTicket|TestCheckIn' -v
git add backend/internal/handlers/registration.go backend/cmd/server/main.go backend/tests/api_test.go
git commit -m "feat: add single-use event check-in API"
```

Expected: all lookup/check-in cases pass.

---

## Task 5: Verify constraints, regressions, and scope

**Files:**
- Modify: `backend/internal/models/migrate_test.go`
- Modify: `backend/tests/api_test.go`
- No frontend source changes

- [ ] **Step 1: Assert final foreign keys and scoped table count**

In the temporary-schema test verify:

- `Showtime.concert_id → Concert`;
- `Zone.concert_id → Concert`;
- `Seat.zone_id → Zone` and `Seat.concert_id → Concert`;
- nullable `TicketCategory.zone_id → Zone`;
- unique `Publication.concert_id → Concert`;
- `LayoutObject.parent_object_id → LayoutObject`;
- `LayoutObject` has no FK to `User`, `Zone`, or `Seat`;
- `Ticket.seat_id → Seat` and `Ticket.booking_id → Booking`;
- unique `Gate-Check-in.ticket_id → Ticket`;
- exactly nine scoped approved tables exist and no `VenueSeat*` table exists.

- [ ] **Step 2: Run full backend verification**

```powershell
go test ./... -count=1
go vet ./...
```

Expected: all tests pass and vet exits 0. With the project PostgreSQL running, schema/API integration tests must not skip.

- [ ] **Step 3: Verify frontend compatibility without changing UI**

From `frontend`:

```powershell
npm run build
```

Expected: Vite build succeeds. Do not redesign or edit UI in this plan.

- [ ] **Step 4: Inspect scope**

```powershell
git status --short
git diff --name-only HEAD~4..HEAD
```

Expected: backend models, migration, handlers, route registration, tests, and planning documents only. No path under `frontend/src`.

- [ ] **Step 5: Commit verification-only fixes if any**

```powershell
git add backend
git commit -m "test: verify consolidated ticket registration schema"
```

Skip this commit if verification creates no changes.

---

## Completion criteria

- PostgreSQL uses exactly the nine approved Draw.io table names for these systems.
- The six duplicate `VenueSeat*` tables and structs are gone.
- `TicketSalesInfo` and unrelated systems are unchanged.
- Existing `/api/venue-seat` JSON contracts remain compatible.
- `LayoutObject` connects only to `Concert` and itself; zone/seat geometry stays in its own tables.
- Rendered seat-layout and ticket-image fields exist.
- A valid ticket can create one successful `Gate-Check-in` only; retry returns 409.
- No re-entry, checked-by, or gate table is introduced.
- `go test ./...`, `go vet ./...`, and `npm run build` pass.
- No UI source file is modified.
