# Booking Seat Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้การจองบัตรถูกบันทึกลงตาราง `Zone`, `Seat`, `TicketCategory`, `Ticket` ด้วยข้อมูลจริง (ที่นั่งที่ลูกค้าเลือกจริง ราคาจริง) แทนข้อมูลปลอมที่สังเคราะห์ขึ้นตอนอนุมัติสลิป

**Architecture:** ผังที่นั่งที่พนักงานวาดไว้ถูก project ลง `Zone`/`Seat`/`TicketCategory` ตอนบันทึกผัง หน้าเลือกโซน/เลือกที่นั่งอ่านจากตารางเหล่านี้ผ่าน endpoint ใหม่ และตอนลูกค้ากดจอง ระบบจะจองที่นั่งจริงด้วย conditional update (กันจองซ้ำ) แล้วสร้าง `Ticket` ผูกกับ `Seat` ใน transaction เดียวกัน

**Tech Stack:** Go 1.26 + Fiber v2 + GORM (PostgreSQL) ฝั่งหลังบ้าน · React 19 + TypeScript + MUI + Vite + Vitest ฝั่งหน้าเว็บ

**Spec:** `docs/superpowers/specs/2026-09-10-booking-seat-persistence.md`

## Global Constraints

- **แก้ได้แค่ 4 ตาราง:** `Zone`, `Seat`, `TicketCategory`, `Ticket` — ห้ามสร้างตารางใหม่ ห้ามเพิ่ม/ลดคอลัมน์ของ `Booking`/`Payment`
- **ห้ามแตะโครงสร้าง** `VenueSeatZone` / `VenueSeat` / `VenueLayoutObject` (ตารางของ editor ผังที่นั่ง)
- **PK/FK คงเป็น string (varchar)** ถึงแม้ไดอะแกรมจะเขียน `SeatID:int` / `TicketID:uint` — ทั้งระบบใช้ `models.GenerateID(prefix)` อยู่แล้ว
- **ข้อความที่ผู้ใช้เห็นทุกข้อความเป็นภาษาไทย** ตามที่โค้ดเดิมทำอยู่
- **สถานะที่นั่ง** ใช้ค่าคงที่สองค่าเท่านั้น: `"ว่าง"` / `"ไม่ว่าง"` (โค้ดเดิมเขียน `"ไม่ว่าง"` อยู่แล้ว)
- **สถานะตั๋ว:** `"รอตรวจสอบ"` (เพิ่งจอง) → `"พร้อมใช้งาน"` (อนุมัติแล้ว) → `"ยกเลิก"` (ถูกปฏิเสธ)
- **ห้ามรันแผนนี้ทับ** `docs/superpowers/plans/2026-09-10-seat-locking.md` โดยไม่ตัดสินใจก่อน — แผนนั้นเพิ่มตาราง `seat_holds` ซึ่งขัด constraint ของแผนนี้
- **เทสต์ที่ต้องใช้ฐานข้อมูล** รันด้วย `MANAGEMENT_INTEGRATION_TEST=1` และใช้ helper `managementTestDB(t)` ที่มีอยู่แล้ว (สร้าง schema แยกต่อเทสต์ แล้วลบทิ้งอัตโนมัติ)
- **คำสั่งทั้งหมดเป็น PowerShell** (โปรเจกต์นี้รันบน Windows)

---

### Task 1: ขยาย model ทั้งสี่ให้ตรงไดอะแกรม + เตรียมชนิดคอลัมน์

**Files:**
- Modify: `backend/internal/models/ticket.go:9-96`
- Modify: `backend/internal/models/migrate.go:5-16`
- Test: `backend/internal/models/ticket_test.go` (สร้างใหม่)

**Interfaces:**
- Consumes: `models.GenerateID` (มีอยู่แล้ว `base.go:19`)
- Produces:
  - `models.Zone` เพิ่มฟิลด์ `PositionX, PositionY, Width, Height, Rotation float64`, `Shape, Color string`, `LayerOrder int64`
  - `models.Seat` เปลี่ยน `SeatRow, SeatColumn` เป็น `string` และเพิ่ม `Flowchart []byte`, `PositionX, PositionY, Rotation float64`
  - `models.Seat.Label() string` คืนป้ายที่นั่ง เช่น `"A12"`
  - `models.Ticket` เพิ่ม `ImageTicket []byte`, `PriceTicket float64`, `CategoryID string`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/models/ticket_test.go`:

```go
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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd backend; go test ./internal/models/ -run TestSeatLabel -v
```

Expected: FAIL — `seat.Label undefined` และ `cannot use "A" (untyped string constant) as int value in struct literal`

- [ ] **Step 3: แก้ struct ทั้งสี่ใน `backend/internal/models/ticket.go`**

แทนที่ `Zone`, `Seat`, `TicketCategory`, `Ticket` ด้วยเวอร์ชันนี้ (ส่วน `BeforeCreate` ของแต่ละตัวคงไว้ตามเดิม ไม่ต้องแก้):

```go
// Zone - โซนในงานคอนเสิร์ต (ตำแหน่ง/รูปทรงมาจากผังที่นั่งที่พนักงานวาด)
type Zone struct {
	ZoneID     string  `gorm:"primaryKey;type:varchar(50);not null" json:"zone_id"`
	ZoneType   string  `gorm:"type:varchar(100);not null" json:"zone_type"`
	Capacity   int     `gorm:"type:int;not null" json:"capacity"`
	PositionX  float64 `gorm:"column:position_x;type:double precision;not null;default:0" json:"position_x"`
	PositionY  float64 `gorm:"column:position_y;type:double precision;not null;default:0" json:"position_y"`
	Width      float64 `gorm:"type:double precision;not null;default:0" json:"width"`
	Height     float64 `gorm:"type:double precision;not null;default:0" json:"height"`
	Rotation   float64 `gorm:"type:double precision;not null;default:0" json:"rotation"`
	Shape      string  `gorm:"type:varchar(50);not null;default:''" json:"shape"`
	Color      string  `gorm:"type:varchar(20);not null;default:''" json:"color"`
	LayerOrder int64   `gorm:"column:layer_order;type:bigint;not null;default:0" json:"layer_order"`

	// Relations
	Seats            []Seat           `gorm:"foreignKey:ZoneID" json:"seats,omitempty"`
	TicketCategories []TicketCategory `gorm:"foreignKey:ZoneID" json:"ticket_categories,omitempty"`
}
```

```go
// Seat - ที่นั่ง (status_seat เป็นตัวชี้ขาดว่าที่นั่งใบนี้ขายไปแล้วหรือยัง)
type Seat struct {
	SeatID     string  `gorm:"primaryKey;type:varchar(50);not null" json:"seat_id"`
	SeatColumn string  `gorm:"type:varchar(50);not null" json:"seat_column"`
	SeatRow    string  `gorm:"type:varchar(50);not null" json:"seat_row"`
	StatusSeat string  `gorm:"type:varchar(50);not null" json:"status_seat"`
	Flowchart  []byte  `gorm:"type:bytea" json:"flowchart,omitempty"`
	PositionX  float64 `gorm:"column:position_x;type:double precision;not null;default:0" json:"position_x"`
	PositionY  float64 `gorm:"column:position_y;type:double precision;not null;default:0" json:"position_y"`
	Rotation   float64 `gorm:"type:double precision;not null;default:0" json:"rotation"`
	ConcertID  string  `gorm:"type:varchar(50);not null;index" json:"concert_id"`
	ZoneID     string  `gorm:"type:varchar(50);not null;index" json:"zone_id"`

	// Relations
	Tickets []Ticket `gorm:"foreignKey:SeatID" json:"tickets,omitempty"`
}

// Label คืนป้ายที่นั่งที่หน้าเว็บใช้ เช่น "A12" (แถว A คอลัมน์ 12)
func (s *Seat) Label() string {
	return s.SeatRow + s.SeatColumn
}
```

`TicketCategory` คงเดิมทุกฟิลด์ (มีครบตามไดอะแกรมอยู่แล้ว) — **ไม่ต้องแก้**

```go
// Ticket - ตั๋ว (ผูกกับที่นั่งจริงและหมวดหมู่ราคาที่ซื้อ ณ ตอนจอง)
type Ticket struct {
	TicketID       string    `gorm:"primaryKey;type:varchar(50);not null" json:"ticket_id"`
	NameConcert    string    `gorm:"type:varchar(255);not null" json:"name_concert"`
	TicketDateTime time.Time `gorm:"type:timestamp;not null" json:"ticket_datetime"`
	ImageTicket    []byte    `gorm:"type:bytea" json:"image_ticket,omitempty"`
	PriceTicket    float64   `gorm:"type:double precision;not null;default:0" json:"price_ticket"`
	StatusTicket   string    `gorm:"type:varchar(50);not null" json:"status_ticket"`
	SeatID         string    `gorm:"type:varchar(50);not null;index" json:"seat_id"`
	SeatLabel      string    `gorm:"type:varchar(50)" json:"seat_label,omitempty"`
	CategoryID     string    `gorm:"type:varchar(50);index" json:"category_id,omitempty"`
	BookingID      string    `gorm:"type:varchar(50);not null;index" json:"booking_id"`
	QrCodeData     string    `gorm:"type:text" json:"qr_code_data,omitempty"`
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd backend; go test ./internal/models/ -run TestSeatLabel -v
```

Expected: PASS ทั้งสองเคส

- [ ] **Step 5: เพิ่มการแปลงชนิดคอลัมน์ก่อน AutoMigrate**

`seat_row` / `seat_column` เดิมเป็น `integer` PostgreSQL แปลงเป็น `varchar` เองไม่ได้ ต้องมี `USING`
และต้องรัน **ก่อน** `AutoMigrate` มิฉะนั้น AutoMigrate จะ error ก่อน

ใน `backend/internal/models/migrate.go` แก้หัวฟังก์ชัน `MigrateAllModels` จาก:

```go
func MigrateAllModels(db *gorm.DB) error {
	if err := db.AutoMigrate(
```

เป็น:

```go
func MigrateAllModels(db *gorm.DB) error {
	if err := prepareSeatColumnTypes(db); err != nil {
		return err
	}
	if err := db.AutoMigrate(
```

แล้วเพิ่มฟังก์ชันนี้ต่อท้ายไฟล์:

```go
// prepareSeatColumnTypes แปลง seats.seat_row / seat_column จาก integer เป็น varchar
// ต้องรันก่อน AutoMigrate เพราะ PostgreSQL แปลง integer → varchar ให้เองไม่ได้ ต้องระบุ USING
// ฟังก์ชันนี้ idempotent: ติดตั้งใหม่ (ยังไม่มีตาราง) หรือแปลงไปแล้ว จะไม่ทำอะไร
func prepareSeatColumnTypes(db *gorm.DB) error {
	var dataType string
	if err := db.Raw(
		`SELECT data_type FROM information_schema.columns
		 WHERE table_schema = current_schema() AND table_name = 'seats' AND column_name = 'seat_row'`,
	).Scan(&dataType).Error; err != nil {
		return err
	}
	if dataType == "" || dataType == "character varying" {
		return nil
	}
	return db.Exec(
		`ALTER TABLE seats
		   ALTER COLUMN seat_row TYPE varchar(50) USING seat_row::varchar,
		   ALTER COLUMN seat_column TYPE varchar(50) USING seat_column::varchar`,
	).Error
}
```

- [ ] **Step 6: ตรวจว่าคอมไพล์ผ่านทั้งโปรเจกต์**

โค้ดเดิมใน `booking_payment.go` ยังส่ง `SeatRow: 1, SeatColumn: i` (int) อยู่ — จะคอมไพล์ไม่ผ่าน
ให้แก้ชั่วคราวเป็น string ที่บรรทัด `internal/handlers/booking_payment.go:220` และ `:336`:
`SeatRow: "A", SeatColumn: fmt.Sprintf("%d", i)` (โค้ดทั้งบล็อกจะถูกลบทิ้งใน Task 5 และ 6 อยู่แล้ว)

```bash
cd backend; go build ./...
```

Expected: ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add backend/internal/models/ticket.go backend/internal/models/migrate.go backend/internal/models/ticket_test.go backend/internal/handlers/booking_payment.go
git commit -m "feat(models): ขยาย Zone/Seat/Ticket ให้ตรงไดอะแกรม ER"
```

---

### Task 2: ฟังก์ชันแปลงผังที่นั่งเป็นแถวตาราง (pure functions)

**Files:**
- Create: `backend/internal/handlers/seat_inventory.go`
- Test: `backend/internal/handlers/seat_inventory_test.go`

**Interfaces:**
- Consumes: `zoneDTO`, `seatDTO` (มีอยู่แล้วใน `venue_seat.go:48-72`, package เดียวกัน), `models.Zone/Seat/TicketCategory` จาก Task 1
- Produces:
  - `const seatStatusAvailable = "ว่าง"` / `seatStatusTaken = "ไม่ว่าง"`
  - `const ticketStatusPending = "รอตรวจสอบ"` / `ticketStatusIssued = "พร้อมใช้งาน"` / `ticketStatusCancelled = "ยกเลิก"`
  - `parseSeatLabel(label string) (row string, column string)`
  - `type ticketingProjection struct { Zones []models.Zone; Seats []models.Seat; Categories []models.TicketCategory }`
  - `projectLayoutToTicketing(concertID string, zones []zoneDTO) ticketingProjection`
  - `zoneIDsWithoutSeats(all []string, used []string) []string`
  - `missingSeatLabels(requested []string, found []models.Seat) []string`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/seat_inventory_test.go`:

```go
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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd backend; go test ./internal/handlers/ -run "TestParseSeatLabel|TestProjectLayout|TestZoneIDsWithoutSeats|TestMissingSeatLabels" -v
```

Expected: FAIL — `undefined: parseSeatLabel`

- [ ] **Step 3: เขียน implementation**

สร้าง `backend/internal/handlers/seat_inventory.go`:

```go
package handlers

import (
	"strings"

	"backend/internal/models"
)

// สถานะที่นั่ง — status_seat เป็นตัวชี้ขาดว่าที่นั่งใบนี้ขายไปแล้วหรือยัง
const (
	seatStatusAvailable = "ว่าง"
	seatStatusTaken     = "ไม่ว่าง"
)

// สถานะตั๋ว เดินตามวงจร: จอง → อนุมัติสลิป → (หรือ) ถูกปฏิเสธ
const (
	ticketStatusPending   = "รอตรวจสอบ"
	ticketStatusIssued    = "พร้อมใช้งาน"
	ticketStatusCancelled = "ยกเลิก"
)

// parseSeatLabel แยกป้ายที่นั่งเป็นแถวกับคอลัมน์ เช่น "A12" → ("A", "12")
// ป้ายที่ไม่มีตัวเลข (เช่น "VIP") ถือเป็นแถวล้วน ป้ายที่เป็นตัวเลขล้วนถือเป็นคอลัมน์ล้วน
func parseSeatLabel(label string) (string, string) {
	trimmed := strings.TrimSpace(label)
	index := strings.IndexFunc(trimmed, func(r rune) bool { return r >= '0' && r <= '9' })
	if index < 0 {
		return trimmed, ""
	}
	return trimmed[:index], trimmed[index:]
}

// ticketingProjection คือชุดแถวของตารางขายบัตรที่แปลงมาจากผังที่นั่งหนึ่งผัง
type ticketingProjection struct {
	Zones      []models.Zone
	Seats      []models.Seat
	Categories []models.TicketCategory
}

// projectLayoutToTicketing แปลงผังที่พนักงานวาด (zoneDTO) เป็นแถวของ Zone/Seat/TicketCategory
// ที่นั่งที่ถูกปิดใช้งาน (disabled) จะไม่ถูกสร้าง เพราะขายไม่ได้
func projectLayoutToTicketing(concertID string, zones []zoneDTO) ticketingProjection {
	projection := ticketingProjection{
		Zones:      make([]models.Zone, 0, len(zones)),
		Seats:      make([]models.Seat, 0),
		Categories: make([]models.TicketCategory, 0, len(zones)),
	}

	for _, zone := range zones {
		if zone.ID == "" {
			continue
		}

		capacity := len(zone.SeatItems)
		if capacity == 0 {
			capacity = zone.Seats
		}

		projection.Zones = append(projection.Zones, models.Zone{
			ZoneID:     zone.ID,
			ZoneType:   zone.Type,
			Capacity:   capacity,
			PositionX:  zone.X,
			PositionY:  zone.Y,
			Width:      zone.Width,
			Height:     zone.Height,
			Rotation:   zone.Rotation,
			Shape:      zone.Shape,
			Color:      zone.Color,
			LayerOrder: zone.Layer,
		})

		projection.Categories = append(projection.Categories, models.TicketCategory{
			CategoryID:   "TC-" + zone.ID,
			CategoryName: zone.Name,
			Price:        zone.Price,
			Quantity:     capacity,
			ZoneID:       zone.ID,
		})

		for _, item := range zone.SeatItems {
			if item.Disabled || item.ID == "" {
				continue
			}
			row, column := parseSeatLabel(item.Name)
			projection.Seats = append(projection.Seats, models.Seat{
				SeatID:     item.ID,
				SeatRow:    row,
				SeatColumn: column,
				StatusSeat: seatStatusAvailable,
				ConcertID:  concertID,
				ZoneID:     zone.ID,
				PositionX:  item.X,
				PositionY:  item.Y,
			})
		}
	}

	return projection
}

// zoneIDsWithoutSeats คืนโซนที่ไม่มีที่นั่งเหลืออยู่แล้ว (ลบทิ้งได้โดยไม่ทำให้บัตรกำพร้า)
func zoneIDsWithoutSeats(all []string, used []string) []string {
	usedSet := make(map[string]struct{}, len(used))
	for _, id := range used {
		usedSet[id] = struct{}{}
	}
	removable := make([]string, 0, len(all))
	for _, id := range all {
		if _, ok := usedSet[id]; !ok {
			removable = append(removable, id)
		}
	}
	return removable
}

// missingSeatLabels บอกว่าป้ายที่นั่งที่ขอมา ใบไหนหาไม่เจอในฐานข้อมูล
func missingSeatLabels(requested []string, found []models.Seat) []string {
	foundSet := make(map[string]struct{}, len(found))
	for i := range found {
		foundSet[found[i].Label()] = struct{}{}
	}
	missing := make([]string, 0)
	for _, label := range requested {
		if _, ok := foundSet[label]; !ok {
			missing = append(missing, label)
		}
	}
	return missing
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd backend; go test ./internal/handlers/ -run "TestParseSeatLabel|TestProjectLayout|TestZoneIDsWithoutSeats|TestMissingSeatLabels" -v
```

Expected: PASS ทั้ง 5 เทสต์

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/seat_inventory.go backend/internal/handlers/seat_inventory_test.go
git commit -m "feat(seats): เพิ่มฟังก์ชันแปลงผังที่นั่งเป็นแถว Zone/Seat/TicketCategory"
```

---

### Task 3: เขียนแถวตารางขายบัตรตอนพนักงานบันทึกผัง

**Files:**
- Modify: `backend/internal/handlers/seat_inventory.go` (เพิ่มฟังก์ชันที่แตะฐานข้อมูล)
- Modify: `backend/internal/handlers/venue_seat.go:290-345` (saveLayout), `:375-392` (clearLayoutRecords)
- Test: `backend/internal/handlers/seat_inventory_db_test.go` (สร้างใหม่)

**Interfaces:**
- Consumes: `projectLayoutToTicketing`, `zoneIDsWithoutSeats`, `seatStatusAvailable` (Task 2)
- Produces:
  - `applyTicketingProjection(tx *gorm.DB, concertID string, zones []zoneDTO) error`
  - `clearTicketingProjection(tx *gorm.DB, concertID string, zoneIDs []string) error`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/seat_inventory_db_test.go`:

```go
package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestSaveLayoutWritesTicketingTables(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterVenueSeatRoutes(app, db)

	if err := db.Create(&models.Concert{
		ConcertID: "CCPROJ", ConcertName: "งานทดสอบผัง", StartDate: "2026-11-01", EndDate: "2026-11-01",
		StartTime: "19:00:00", EndTime: "22:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว", MoreInfo: "-",
	}).Error; err != nil {
		t.Fatal(err)
	}

	payload := map[string]any{
		"zones": []map[string]any{{
			"id": "ZPROJ1", "name": "โซน A", "type": "นั่ง", "color": "#E53935", "price": 2500,
			"shape": "rectangle", "x": 5, "y": 6, "width": 80, "height": 40, "rotation": 0, "z": 1,
			"seatItems": []map[string]any{
				{"id": "SPROJ1", "name": "A1", "x": 1, "y": 1},
				{"id": "SPROJ2", "name": "A2", "x": 2, "y": 1},
			},
		}},
		"layoutObjects": []map[string]any{},
	}
	managementRequest(t, app, "PUT", "/api/venue-seat/concerts/CCPROJ/layout", payload, fiber.StatusOK)

	var zone models.Zone
	if err := db.First(&zone, "zone_id = ?", "ZPROJ1").Error; err != nil {
		t.Fatal("ต้องมีแถวใน zones:", err)
	}
	if zone.Capacity != 2 || zone.Color != "#E53935" {
		t.Fatalf("ข้อมูลโซนไม่ถูกคัดลอกมา: %+v", zone)
	}

	var seats []models.Seat
	if err := db.Where("concert_id = ?", "CCPROJ").Order("seat_column").Find(&seats).Error; err != nil {
		t.Fatal(err)
	}
	if len(seats) != 2 {
		t.Fatalf("ต้องมีที่นั่ง 2 ใบ แต่ได้ %d", len(seats))
	}
	if seats[0].Label() != "A1" || seats[0].StatusSeat != seatStatusAvailable {
		t.Fatalf("ที่นั่งใบแรกผิด: %+v", seats[0])
	}

	var category models.TicketCategory
	if err := db.First(&category, "zone_id = ?", "ZPROJ1").Error; err != nil {
		t.Fatal("ต้องมีแถวใน ticket_categories:", err)
	}
	if category.Price != 2500 || category.Quantity != 2 {
		t.Fatalf("หมวดหมู่ราคาผิด: %+v", category)
	}
}

func TestSaveLayoutKeepsSeatsThatAreAlreadySold(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterVenueSeatRoutes(app, db)

	if err := db.Create(&models.Concert{
		ConcertID: "CCKEEP", ConcertName: "งานทดสอบขายแล้ว", StartDate: "2026-11-01", EndDate: "2026-11-01",
		StartTime: "19:00:00", EndTime: "22:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว", MoreInfo: "-",
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Seat{
		SeatID: "SKEEP1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusTaken,
		ConcertID: "CCKEEP", ZoneID: "ZKEEP1",
	}).Error; err != nil {
		t.Fatal(err)
	}

	payload := map[string]any{
		"zones": []map[string]any{{
			"id": "ZKEEP1", "name": "โซน A", "type": "นั่ง", "price": 1000,
			"seatItems": []map[string]any{{"id": "SKEEP2", "name": "A2", "x": 2, "y": 1}},
		}},
		"layoutObjects": []map[string]any{},
	}
	managementRequest(t, app, "PUT", "/api/venue-seat/concerts/CCKEEP/layout", payload, fiber.StatusOK)

	var sold models.Seat
	if err := db.First(&sold, "seat_id = ?", "SKEEP1").Error; err != nil {
		t.Fatal("ที่นั่งที่ขายไปแล้วต้องไม่ถูกลบทิ้งตอนบันทึกผังใหม่:", err)
	}
	if sold.StatusSeat != seatStatusTaken {
		t.Fatalf("สถานะที่นั่งที่ขายแล้วต้องคงเดิม แต่ได้ %q", sold.StatusSeat)
	}
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run TestSaveLayout -v
```

Expected: FAIL — `ต้องมีแถวใน zones: record not found`

- [ ] **Step 3: เพิ่มฟังก์ชันเขียนฐานข้อมูลใน `seat_inventory.go`**

เพิ่ม import `"gorm.io/gorm"` และ `"gorm.io/gorm/clause"` แล้วต่อท้ายไฟล์:

```go
// applyTicketingProjection เขียนผังที่นั่งลงตารางขายบัตร
// ที่นั่งที่ถูกจองไปแล้วจะไม่ถูกแตะ (OnConflict DoNothing) เพื่อไม่ให้บัตรที่ขายแล้วกำพร้า
func applyTicketingProjection(tx *gorm.DB, concertID string, zones []zoneDTO) error {
	projection := projectLayoutToTicketing(concertID, zones)

	if len(projection.Zones) > 0 {
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "zone_id"}},
			UpdateAll: true,
		}).Create(&projection.Zones).Error; err != nil {
			return err
		}
	}
	if len(projection.Categories) > 0 {
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "category_id"}},
			UpdateAll: true,
		}).Create(&projection.Categories).Error; err != nil {
			return err
		}
	}
	if len(projection.Seats) > 0 {
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "seat_id"}},
			DoNothing: true,
		}).Create(&projection.Seats).Error; err != nil {
			return err
		}
	}
	return nil
}

// clearTicketingProjection ลบผังเดิมของคอนเสิร์ตออกจากตารางขายบัตร
// ลบเฉพาะที่นั่งที่ยังว่าง และลบโซน/หมวดหมู่เฉพาะโซนที่ไม่มีที่นั่งเหลือแล้ว
func clearTicketingProjection(tx *gorm.DB, concertID string, zoneIDs []string) error {
	if err := tx.Where("concert_id = ? AND status_seat = ?", concertID, seatStatusAvailable).
		Delete(&models.Seat{}).Error; err != nil {
		return err
	}
	if len(zoneIDs) == 0 {
		return nil
	}

	var stillUsed []string
	if err := tx.Model(&models.Seat{}).Where("zone_id IN ?", zoneIDs).
		Distinct().Pluck("zone_id", &stillUsed).Error; err != nil {
		return err
	}

	removable := zoneIDsWithoutSeats(zoneIDs, stillUsed)
	if len(removable) == 0 {
		return nil
	}
	if err := tx.Where("zone_id IN ?", removable).Delete(&models.TicketCategory{}).Error; err != nil {
		return err
	}
	return tx.Where("zone_id IN ?", removable).Delete(&models.Zone{}).Error
}
```

- [ ] **Step 4: เรียกใช้จาก `venue_seat.go`**

ใน `clearLayoutRecords` (`venue_seat.go:375`) เพิ่มการล้างตารางขายบัตรก่อน return บรรทัดสุดท้าย
เปลี่ยนจาก:

```go
	if err := tx.Where("concert_id = ?", concertID).Delete(&models.VenueSeatZone{}).Error; err != nil {
		return err
	}
	return tx.Where("concert_id = ?", concertID).Delete(&models.VenueLayoutObject{}).Error
}
```

เป็น:

```go
	if err := tx.Where("concert_id = ?", concertID).Delete(&models.VenueSeatZone{}).Error; err != nil {
		return err
	}
	if err := tx.Where("concert_id = ?", concertID).Delete(&models.VenueLayoutObject{}).Error; err != nil {
		return err
	}
	return clearTicketingProjection(tx, concertID, zoneIDs)
}
```

ใน `saveLayout` (`venue_seat.go:290`) เพิ่มการ project หลังลูปสร้าง `VenueLayoutObject` จบ
เปลี่ยนท้าย transaction จาก:

```go
			if err := tx.Create(&object).Error; err != nil {
				return err
			}
		}
		return nil
	})
```

เป็น:

```go
			if err := tx.Create(&object).Error; err != nil {
				return err
			}
		}
		return applyTicketingProjection(tx, concertID, payload.Zones)
	})
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run TestSaveLayout -v
```

Expected: PASS ทั้งสองเทสต์

- [ ] **Step 6: Commit**

```bash
git add backend/internal/handlers/seat_inventory.go backend/internal/handlers/seat_inventory_db_test.go backend/internal/handlers/venue_seat.go
git commit -m "feat(seats): บันทึกผังที่นั่งลงตาราง Zone/Seat/TicketCategory ตอนบันทึกผัง"
```

---

### Task 4: endpoint ให้หน้าเว็บอ่านโซนและที่นั่งจริง

**Files:**
- Create: `backend/internal/handlers/seat_inventory_handler.go`
- Modify: `backend/cmd/server/main.go:54` (เพิ่มการลงทะเบียน route)
- Test: `backend/internal/handlers/seat_inventory_handler_test.go`

**Interfaces:**
- Consumes: `seatStatusAvailable`, `parseSeatLabel` (Task 2), `models.Zone/Seat/TicketCategory` (Task 1)
- Produces:
  - `RegisterSeatInventoryRoutes(app *fiber.App, db *gorm.DB)`
  - `GET /api/concerts/:id/zones` → `{"data": [{zone_id, zone_type, category_name, price, capacity, available}]}`
  - `GET /api/concerts/:id/zones/:zoneId/seats` → `{"data": [{seat_id, label, seat_row, seat_column, status, position_x, position_y}]}`
  - `ensureZoneSeats(db *gorm.DB, concertID, zoneID string) error` — สร้างผังเริ่มต้น 5×8 ถ้ายังไม่มี

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/seat_inventory_handler_test.go`:

```go
package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestSeatsEndpointMaterialisesDefaultGridWhenLayoutMissing(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	body := managementRequest(t, app, "GET", "/api/concerts/CCGRID/zones/A1/seats", nil, fiber.StatusOK)
	rows, ok := body["data"].([]interface{})
	if !ok {
		t.Fatalf("ต้องได้ data เป็น array แต่ได้ %T", body["data"])
	}
	if len(rows) != 40 {
		t.Fatalf("ผังเริ่มต้นต้องมี 40 ที่ (5 แถว x 8) แต่ได้ %d", len(rows))
	}

	var stored int64
	db.Model(&models.Seat{}).Where("concert_id = ? AND zone_id = ?", "CCGRID", "A1").Count(&stored)
	if stored != 40 {
		t.Fatalf("ที่นั่งต้องถูกบันทึกลงฐานข้อมูลจริง แต่มี %d แถว", stored)
	}

	first := rows[0].(map[string]interface{})
	if first["label"] != "A1" || first["status"] != seatStatusAvailable {
		t.Fatalf("ที่นั่งใบแรกผิด: %+v", first)
	}
}

func TestSeatsEndpointReportsTakenSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	seats := []models.Seat{
		{SeatID: "SA1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusAvailable, ConcertID: "CCT", ZoneID: "Z1"},
		{SeatID: "SA2", SeatRow: "A", SeatColumn: "2", StatusSeat: seatStatusTaken, ConcertID: "CCT", ZoneID: "Z1"},
	}
	if err := db.Create(&seats).Error; err != nil {
		t.Fatal(err)
	}

	body := managementRequest(t, app, "GET", "/api/concerts/CCT/zones/Z1/seats", nil, fiber.StatusOK)
	rows := body["data"].([]interface{})
	if len(rows) != 2 {
		t.Fatalf("ต้องได้ 2 ใบ แต่ได้ %d", len(rows))
	}
	second := rows[1].(map[string]interface{})
	if second["label"] != "A2" || second["status"] != seatStatusTaken {
		t.Fatalf("ที่นั่งที่ถูกจองต้องรายงานว่าไม่ว่าง: %+v", second)
	}
}

func TestZonesEndpointReturnsPriceAndAvailability(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	if err := db.Create(&models.Zone{ZoneID: "Z9", ZoneType: "นั่ง", Capacity: 2, Color: "#E53935"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.TicketCategory{CategoryID: "TC-Z9", CategoryName: "โซน A", Price: 1800, Quantity: 2, ZoneID: "Z9"}).Error; err != nil {
		t.Fatal(err)
	}
	seats := []models.Seat{
		{SeatID: "SZ1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusAvailable, ConcertID: "CCZ", ZoneID: "Z9"},
		{SeatID: "SZ2", SeatRow: "A", SeatColumn: "2", StatusSeat: seatStatusTaken, ConcertID: "CCZ", ZoneID: "Z9"},
	}
	if err := db.Create(&seats).Error; err != nil {
		t.Fatal(err)
	}

	body := managementRequest(t, app, "GET", "/api/concerts/CCZ/zones", nil, fiber.StatusOK)
	rows := body["data"].([]interface{})
	if len(rows) != 1 {
		t.Fatalf("ต้องได้ 1 โซน แต่ได้ %d", len(rows))
	}
	zone := rows[0].(map[string]interface{})
	if zone["zone_id"] != "Z9" || zone["price"].(float64) != 1800 {
		t.Fatalf("ข้อมูลโซนผิด: %+v", zone)
	}
	if zone["available"].(float64) != 1 {
		t.Fatalf("ต้องเหลือที่นั่งว่าง 1 ใบ แต่ได้ %v", zone["available"])
	}
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run "TestSeatsEndpoint|TestZonesEndpoint" -v
```

Expected: FAIL — `undefined: RegisterSeatInventoryRoutes`

- [ ] **Step 3: เขียน handler**

สร้าง `backend/internal/handlers/seat_inventory_handler.go`:

```go
package handlers

import (
	"fmt"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type seatInventoryHandler struct {
	db *gorm.DB
}

// defaultZonePrices เป็นราคาตั้งต้นของคอนเสิร์ตสาธิตที่ยังไม่มีผังจริง
// ค่าตรงกับที่หน้าเว็บใช้มาก่อนหน้านี้ (frontend/src/components/SeatSelection/constants.ts)
var defaultZonePrices = map[byte]float64{'A': 2000, 'B': 1500, 'C': 1000}

const (
	defaultGridRows    = 5
	defaultGridColumns = 8
)

func RegisterSeatInventoryRoutes(app *fiber.App, db *gorm.DB) {
	h := &seatInventoryHandler{db: db}
	app.Get("/api/concerts/:id/zones", h.listZones)
	app.Get("/api/concerts/:id/zones/:zoneId/seats", h.listSeats)
}

type zoneInventoryDTO struct {
	ZoneID       string  `json:"zone_id"`
	ZoneType     string  `json:"zone_type"`
	CategoryName string  `json:"category_name"`
	Color        string  `json:"color"`
	Price        float64 `json:"price"`
	Capacity     int     `json:"capacity"`
	Available    int     `json:"available"`
}

type seatInventoryDTO struct {
	SeatID     string  `json:"seat_id"`
	Label      string  `json:"label"`
	SeatRow    string  `json:"seat_row"`
	SeatColumn string  `json:"seat_column"`
	Status     string  `json:"status"`
	PositionX  float64 `json:"position_x"`
	PositionY  float64 `json:"position_y"`
}

// listZones คืนโซนของคอนเสิร์ตนี้ — Zone ไม่มี concert_id (ตามไดอะแกรม)
// จึงหาโซนผ่านที่นั่งของคอนเสิร์ตแทน
func (h *seatInventoryHandler) listZones(c *fiber.Ctx) error {
	concertID := c.Params("id")

	var zoneIDs []string
	if err := h.db.Model(&models.Seat{}).Where("concert_id = ?", concertID).
		Distinct().Order("zone_id").Pluck("zone_id", &zoneIDs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดโซนได้"})
	}

	result := make([]zoneInventoryDTO, 0, len(zoneIDs))
	for _, zoneID := range zoneIDs {
		var zone models.Zone
		if err := h.db.First(&zone, "zone_id = ?", zoneID).Error; err != nil {
			zone = models.Zone{ZoneID: zoneID}
		}

		var category models.TicketCategory
		_ = h.db.Where("zone_id = ?", zoneID).First(&category).Error

		var available int64
		h.db.Model(&models.Seat{}).
			Where("concert_id = ? AND zone_id = ? AND status_seat = ?", concertID, zoneID, seatStatusAvailable).
			Count(&available)

		var capacity int64
		h.db.Model(&models.Seat{}).
			Where("concert_id = ? AND zone_id = ?", concertID, zoneID).
			Count(&capacity)

		result = append(result, zoneInventoryDTO{
			ZoneID:       zoneID,
			ZoneType:     zone.ZoneType,
			CategoryName: category.CategoryName,
			Color:        zone.Color,
			Price:        category.Price,
			Capacity:     int(capacity),
			Available:    int(available),
		})
	}

	return c.JSON(fiber.Map{"data": result})
}

// listSeats คืนที่นั่งทั้งหมดในโซนพร้อมสถานะ
// คอนเสิร์ต/โซนที่ยังไม่มีผังจริงจะถูกสร้างผังเริ่มต้น 5x8 ให้ก่อน
func (h *seatInventoryHandler) listSeats(c *fiber.Ctx) error {
	concertID := c.Params("id")
	zoneID := c.Params("zoneId")

	if err := ensureZoneSeats(h.db, concertID, zoneID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถเตรียมผังที่นั่งได้"})
	}

	var seats []models.Seat
	if err := h.db.Where("concert_id = ? AND zone_id = ?", concertID, zoneID).
		Order("seat_row, length(seat_column), seat_column").Find(&seats).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดที่นั่งได้"})
	}

	result := make([]seatInventoryDTO, 0, len(seats))
	for i := range seats {
		result = append(result, seatInventoryDTO{
			SeatID:     seats[i].SeatID,
			Label:      seats[i].Label(),
			SeatRow:    seats[i].SeatRow,
			SeatColumn: seats[i].SeatColumn,
			Status:     seats[i].StatusSeat,
			PositionX:  seats[i].PositionX,
			PositionY:  seats[i].PositionY,
		})
	}

	return c.JSON(fiber.Map{"data": result})
}

// ensureZoneSeats สร้างผังเริ่มต้น 5 แถว x 8 ที่ (A1–E8) พร้อมโซนและหมวดหมู่ราคา
// เมื่อคอนเสิร์ต/โซนนั้นยังไม่มีที่นั่งในฐานข้อมูล
func ensureZoneSeats(db *gorm.DB, concertID, zoneID string) error {
	if concertID == "" || zoneID == "" {
		return nil
	}

	var existing int64
	if err := db.Model(&models.Seat{}).
		Where("concert_id = ? AND zone_id = ?", concertID, zoneID).Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}

	price := defaultZonePrices[zoneID[0]]

	return db.Transaction(func(tx *gorm.DB) error {
		zone := models.Zone{ZoneID: zoneID, ZoneType: "ที่นั่ง", Capacity: defaultGridRows * defaultGridColumns}
		if err := tx.Where("zone_id = ?", zoneID).FirstOrCreate(&zone).Error; err != nil {
			return err
		}

		category := models.TicketCategory{
			CategoryID:   "TC-" + zoneID,
			CategoryName: "โซน " + zoneID,
			Price:        price,
			Quantity:     defaultGridRows * defaultGridColumns,
			ZoneID:       zoneID,
		}
		if err := tx.Where("category_id = ?", category.CategoryID).FirstOrCreate(&category).Error; err != nil {
			return err
		}

		seats := make([]models.Seat, 0, defaultGridRows*defaultGridColumns)
		for rowIndex := 0; rowIndex < defaultGridRows; rowIndex++ {
			row := string(rune('A' + rowIndex))
			for column := 1; column <= defaultGridColumns; column++ {
				label := fmt.Sprintf("%s%d", row, column)
				seats = append(seats, models.Seat{
					SeatID:     fmt.Sprintf("ST-%s-%s-%s", concertID, zoneID, label),
					SeatRow:    row,
					SeatColumn: fmt.Sprintf("%d", column),
					StatusSeat: seatStatusAvailable,
					ConcertID:  concertID,
					ZoneID:     zoneID,
				})
			}
		}
		return tx.Create(&seats).Error
	})
}
```

- [ ] **Step 4: ลงทะเบียน route ใน `backend/cmd/server/main.go`**

หลังบรรทัด `handlers.RegisterBookingPaymentRoutes(app, config.DB)` (บรรทัด 54) เพิ่ม:

```go
	handlers.RegisterSeatInventoryRoutes(app, config.DB)
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run "TestSeatsEndpoint|TestZonesEndpoint" -v
```

Expected: PASS ทั้งสามเทสต์

- [ ] **Step 6: Commit**

```bash
git add backend/internal/handlers/seat_inventory_handler.go backend/internal/handlers/seat_inventory_handler_test.go backend/cmd/server/main.go
git commit -m "feat(seats): เพิ่ม endpoint อ่านโซนและที่นั่งจากฐานข้อมูลจริง"
```

---

### Task 5: จองที่นั่งจริงตอนสร้าง booking

**Files:**
- Modify: `backend/internal/handlers/seat_inventory.go` (เพิ่ม `reserveSeats`)
- Modify: `backend/internal/handlers/booking_payment.go:77-177` (createBooking)
- Test: `backend/internal/handlers/booking_seats_test.go` (สร้างใหม่)

**Interfaces:**
- Consumes: `ensureZoneSeats` (Task 4), `missingSeatLabels`, `seatStatus*`, `ticketStatusPending` (Task 2)
- Produces:
  - `type seatConflictError struct{ Labels []string }` พร้อม `Error() string`
  - `reserveSeats(tx *gorm.DB, concertID, zoneID string, labels []string) ([]models.Seat, error)`
  - `POST /api/bookings` ตอบ 409 พร้อม `{"error": "...", "unavailable_seats": [...]}` เมื่อที่นั่งไม่ว่าง

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/booking_seats_test.go`:

```go
package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func bookingInput(seats []string) map[string]any {
	return map[string]any{
		"concert_id": "CCBOOK", "concert_title": "งานทดสอบจอง",
		"zone_id": "A1", "tier_name": "โซน A",
		"seats": seats, "quantity": len(seats),
		"unit_price": 2000, "discount_amount": 0, "total_price": float64(2000 * len(seats)),
		"customer_name": "ลูกค้าทดสอบ", "customer_email": "test@example.com", "customer_phone": "0800000000",
		"slip_file_name": "slip.jpg", "slip_data_url": "data:image/jpeg;base64,QUJD",
	}
}

func TestCreateBookingPersistsSelectedSeatsAsTickets(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}

	managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"A1", "B2"}), fiber.StatusCreated)

	var tickets []models.Ticket
	if err := db.Order("seat_label").Find(&tickets).Error; err != nil {
		t.Fatal(err)
	}
	if len(tickets) != 2 {
		t.Fatalf("ต้องได้ตั๋ว 2 ใบ แต่ได้ %d", len(tickets))
	}
	if tickets[0].SeatLabel != "A1" || tickets[1].SeatLabel != "B2" {
		t.Fatalf("เลขที่นั่งบนตั๋วต้องตรงกับที่ลูกค้าเลือก: %q, %q", tickets[0].SeatLabel, tickets[1].SeatLabel)
	}
	if tickets[0].PriceTicket != 2000 {
		t.Fatalf("ราคาบนตั๋วต้องเป็น 2000 แต่ได้ %v", tickets[0].PriceTicket)
	}
	if tickets[0].StatusTicket != ticketStatusPending {
		t.Fatalf("ตั๋วที่เพิ่งจองต้องเป็น %q แต่ได้ %q", ticketStatusPending, tickets[0].StatusTicket)
	}
	if tickets[0].SeatID == "" || tickets[0].CategoryID == "" {
		t.Fatalf("ตั๋วต้องผูกกับที่นั่งและหมวดหมู่จริง: %+v", tickets[0])
	}

	var taken int64
	db.Model(&models.Seat{}).Where("concert_id = ? AND status_seat = ?", "CCBOOK", seatStatusTaken).Count(&taken)
	if taken != 2 {
		t.Fatalf("ที่นั่งที่จองแล้วต้องเปลี่ยนเป็นไม่ว่าง 2 ใบ แต่ได้ %d", taken)
	}
}

func TestCreateBookingRejectsSeatsThatAreAlreadyTaken(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"A1"}), fiber.StatusCreated)

	body := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"A1", "A2"}), fiber.StatusConflict)
	if body["error"] == nil {
		t.Fatal("ต้องมีข้อความ error ภาษาไทยบอกว่าที่นั่งถูกจองไปแล้ว")
	}

	var bookings int64
	db.Model(&models.Booking{}).Count(&bookings)
	if bookings != 1 {
		t.Fatalf("การจองที่ชนกันต้อง rollback ทั้งก้อน — ต้องเหลือ 1 รายการ แต่มี %d", bookings)
	}
	var tickets int64
	db.Model(&models.Ticket{}).Count(&tickets)
	if tickets != 1 {
		t.Fatalf("ต้องไม่มีตั๋วค้างจากการจองที่ล้มเหลว — ต้องเหลือ 1 ใบ แต่มี %d", tickets)
	}
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run TestCreateBooking -v
```

Expected: FAIL — ตั๋วยังไม่ถูกสร้างตอนจอง (`ต้องได้ตั๋ว 2 ใบ แต่ได้ 0`)

- [ ] **Step 3: เพิ่ม `reserveSeats` ใน `seat_inventory.go`**

```go
// seatConflictError บอกว่าที่นั่งใบไหนจองไม่ได้ (ถูกคนอื่นชิงไปแล้ว หรือไม่มีอยู่จริง)
type seatConflictError struct {
	Labels []string
}

func (e seatConflictError) Error() string {
	return "ที่นั่งไม่ว่างแล้ว: " + strings.Join(e.Labels, ", ")
}

// reserveSeats เปลี่ยนที่นั่งที่ลูกค้าเลือกให้เป็นไม่ว่าง แล้วคืนแถวที่จองได้
// กันจองซ้ำด้วย conditional update: ถ้าจำนวนแถวที่อัปเดตได้ไม่ครบ แปลว่ามีคนชิงไประหว่างทาง
func reserveSeats(tx *gorm.DB, concertID, zoneID string, labels []string) ([]models.Seat, error) {
	if len(labels) == 0 {
		return nil, nil
	}

	var seats []models.Seat
	if err := tx.Where(
		"concert_id = ? AND zone_id = ? AND (seat_row || seat_column) IN ?",
		concertID, zoneID, labels,
	).Find(&seats).Error; err != nil {
		return nil, err
	}
	if len(seats) != len(labels) {
		return nil, seatConflictError{Labels: missingSeatLabels(labels, seats)}
	}

	seatIDs := make([]string, 0, len(seats))
	for i := range seats {
		seatIDs = append(seatIDs, seats[i].SeatID)
	}

	result := tx.Model(&models.Seat{}).
		Where("seat_id IN ? AND status_seat = ?", seatIDs, seatStatusAvailable).
		Update("status_seat", seatStatusTaken)
	if result.Error != nil {
		return nil, result.Error
	}
	if int(result.RowsAffected) != len(seatIDs) {
		return nil, seatConflictError{Labels: labels}
	}

	return seats, nil
}
```

- [ ] **Step 4: เขียน createBooking ใหม่ให้ทำงานใน transaction เดียว**

ใน `backend/internal/handlers/booking_payment.go` แทนที่ตั้งแต่บรรทัด
`booking := models.Booking{` จนถึงก่อน `// Log customer activity` ด้วยโค้ดนี้:

```go
	booking := models.Booking{
		BookingID:      bookingID,
		BookingDate:    now,
		Status:         status,
		UserID:         userIDPtr,
		CustomerName:   input.CustomerName,
		CustomerEmail:  input.CustomerEmail,
		CustomerPhone:  input.CustomerPhone,
		ConcertID:      input.ConcertID,
		ConcertTitle:   input.ConcertTitle,
		ZoneID:         input.ZoneID,
		TierName:       input.TierName,
		Quantity:       qty,
		UnitPrice:      input.UnitPrice,
		DiscountAmount: input.DiscountAmount,
		TotalPrice:     input.TotalPrice,
	}

	// การจองต้องระบุที่นั่งเสมอ — ไม่งั้นจะได้ booking ที่ไม่รู้ว่ากินที่นั่งใบไหน
	if len(input.Seats) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "กรุณาเลือกที่นั่งอย่างน้อย 1 ที่"})
	}

	// เตรียมผังที่นั่งไว้ก่อน (คอนเสิร์ตสาธิตที่ยังไม่มีผังจะได้ผังเริ่มต้น)
	if err := ensureZoneSeats(h.db, input.ConcertID, input.ZoneID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถเตรียมผังที่นั่งได้"})
	}

	var category models.TicketCategory
	_ = h.db.Where("zone_id = ?", input.ZoneID).First(&category).Error

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&booking).Error; err != nil {
			return err
		}

		seats, err := reserveSeats(tx, input.ConcertID, input.ZoneID, input.Seats)
		if err != nil {
			return err
		}

		tickets := make([]models.Ticket, 0, len(seats))
		for i := range seats {
			label := seats[i].Label()
			ticketID := fmt.Sprintf("TK-%s-%s", bookingID, label)
			tickets = append(tickets, models.Ticket{
				TicketID:       ticketID,
				NameConcert:    input.ConcertTitle,
				TicketDateTime: now,
				PriceTicket:    input.UnitPrice,
				StatusTicket:   ticketStatusPending,
				SeatID:         seats[i].SeatID,
				SeatLabel:      label,
				CategoryID:     category.CategoryID,
				BookingID:      bookingID,
				QrCodeData: fmt.Sprintf("OCTAVIA|%s|%s|%s|%s|%s",
					ticketID, input.ConcertTitle, input.ZoneID, label, input.CustomerName),
			})
		}
		if len(tickets) > 0 {
			if err := tx.Create(&tickets).Error; err != nil {
				return err
			}
			booking.Tickets = tickets
		}

		// บันทึกสลิปการโอนเงิน (Payment)
		if input.SlipFileName != "" || input.SlipDataURL != "" {
			paymentID := fmt.Sprintf("PY-%s-%s", dateStr, randomSuffix)
			var fileBytes []byte
			if strings.Contains(input.SlipDataURL, "base64,") {
				parts := strings.Split(input.SlipDataURL, "base64,")
				if len(parts) == 2 {
					decoded, _ := base64.StdEncoding.DecodeString(parts[1])
					fileBytes = decoded
				}
			}

			fileName := input.SlipFileName
			if fileName == "" {
				fileName = "payment_slip.jpg"
			}

			if err := tx.Create(&models.Payment{
				PaymentID:     paymentID,
				EvidenceFile:  fileBytes,
				FileName:      fileName,
				PaymentStatus: "รอตรวจสอบ",
				BookingID:     bookingID,
				CreatedAt:     now,
			}).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		var conflict seatConflictError
		if errors.As(err, &conflict) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":             conflict.Error(),
				"unavailable_seats": conflict.Labels,
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถบันทึกการจองได้: " + err.Error()})
	}
```

เพิ่ม `"errors"` เข้าไปใน import block ของไฟล์นี้

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run TestCreateBooking -v
```

Expected: PASS ทั้งสองเทสต์

- [ ] **Step 6: Commit**

```bash
git add backend/internal/handlers/seat_inventory.go backend/internal/handlers/booking_payment.go backend/internal/handlers/booking_seats_test.go
git commit -m "feat(booking): บันทึกที่นั่งที่ลูกค้าเลือกจริงเป็น Ticket พร้อมกันจองซ้ำ"
```

---

### Task 6: เลิกสร้างที่นั่งปลอมตอนอนุมัติ/ปฏิเสธ/โหลดรายการจอง

**Files:**
- Modify: `backend/internal/handlers/booking_payment.go` — `getCustomerBookings` (ลบบล็อก auto-repair `:196-237`), `approveBooking` (`:300-360`), `rejectBooking` (`:380-425`)
- Test: `backend/internal/handlers/booking_seats_test.go` (เพิ่มเทสต์)

**Interfaces:**
- Consumes: `ticketStatusIssued`, `ticketStatusCancelled`, `seatStatusAvailable` (Task 2), booking flow จาก Task 5
- Produces: ไม่มี API ใหม่ — เปลี่ยนพฤติกรรมของ endpoint เดิม

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มท้าย `backend/internal/handlers/booking_seats_test.go`:

```go
func TestApproveBookingIssuesExistingTicketsWithoutFabricatingSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	created := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"C3"}), fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)

	managementRequest(t, app, "POST", "/api/sales/bookings/"+bookingID+"/approve",
		map[string]any{"officer_name": "พนักงานทดสอบ"}, fiber.StatusOK)

	var tickets []models.Ticket
	if err := db.Where("booking_id = ?", bookingID).Find(&tickets).Error; err != nil {
		t.Fatal(err)
	}
	if len(tickets) != 1 {
		t.Fatalf("การอนุมัติต้องไม่สร้างตั๋วเพิ่ม — ต้องมี 1 ใบ แต่มี %d", len(tickets))
	}
	if tickets[0].SeatLabel != "C3" {
		t.Fatalf("เลขที่นั่งต้องคงเป็น C3 แต่ได้ %q", tickets[0].SeatLabel)
	}
	if tickets[0].StatusTicket != ticketStatusIssued {
		t.Fatalf("ตั๋วต้องเปลี่ยนเป็น %q แต่ได้ %q", ticketStatusIssued, tickets[0].StatusTicket)
	}

	var fabricated int64
	db.Model(&models.Zone{}).Where("zone_id = ?", "ZONE-A").Count(&fabricated)
	if fabricated != 0 {
		t.Fatal("ต้องไม่มีโซนปลอม ZONE-A ถูกสร้างขึ้นอีก")
	}
}

func TestRejectBookingReleasesSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	created := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"D4"}), fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)

	managementRequest(t, app, "POST", "/api/sales/bookings/"+bookingID+"/reject",
		map[string]any{"reason": "สลิปไม่ชัด", "officer_name": "พนักงานทดสอบ"}, fiber.StatusOK)

	var seat models.Seat
	if err := db.Where("concert_id = ? AND zone_id = ? AND (seat_row || seat_column) = ?", "CCBOOK", "A1", "D4").
		First(&seat).Error; err != nil {
		t.Fatal(err)
	}
	if seat.StatusSeat != seatStatusAvailable {
		t.Fatalf("ที่นั่งของการจองที่ถูกปฏิเสธต้องกลับมาว่าง แต่ได้ %q", seat.StatusSeat)
	}

	var ticket models.Ticket
	if err := db.Where("booking_id = ?", bookingID).First(&ticket).Error; err != nil {
		t.Fatal(err)
	}
	if ticket.StatusTicket != ticketStatusCancelled {
		t.Fatalf("ตั๋วต้องถูกยกเลิก แต่ได้ %q", ticket.StatusTicket)
	}
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run "TestApproveBooking|TestRejectBooking" -v
```

Expected: FAIL — ที่นั่งไม่ถูกคืน และตั๋วยังไม่เปลี่ยนสถานะ

- [ ] **Step 3: ลบบล็อก auto-repair ใน `getCustomerBookings`**

ลบตั้งแต่คอมเมนต์ `// Auto-repair: หากรายการจองอนุมัติแล้ว (issued) แต่ยังไม่มี tickets ให้สร้างทันที`
จนถึงวงเล็บปิดของลูป `for idx, b := range bookings { ... }` ทั้งบล็อก (ประมาณบรรทัด 196-237)
เหลือแค่:

```go
	var bookings []models.Booking
	if err := query.Find(&bookings).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดรายการจองได้"})
	}

	return c.JSON(fiber.Map{"data": bookings})
}
```

- [ ] **Step 4: เขียนส่วนออกบัตรใน `approveBooking` ใหม่**

แทนที่ตั้งแต่ `// UP3: สร้างตั๋ว E-Ticket พร้อม QR Code (หากยังไม่มี)` จนจบบล็อก
`if len(existingTickets) == 0 { ... }` ด้วย:

```go
	// UP3: ออกบัตร E-Ticket — ตั๋วถูกสร้างไว้ตั้งแต่ตอนจองแล้ว ที่นี่แค่เปลี่ยนสถานะ
	if err := h.db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).
		Updates(map[string]any{
			"status_ticket":   ticketStatusIssued,
			"ticket_datetime": now,
		}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถออกบัตรได้"})
	}
```

- [ ] **Step 5: คืนที่นั่งใน `rejectBooking`**

ใน `rejectBooking` หลังจากอัปเดตสถานะ booking เป็นถูกปฏิเสธแล้ว (ก่อนบันทึก `EmpActivityLogs`)
เพิ่ม:

```go
	// คืนที่นั่งให้ลูกค้าคนอื่นจองต่อได้ และยกเลิกตั๋วของการจองนี้
	var seatIDs []string
	if err := h.db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).
		Pluck("seat_id", &seatIDs).Error; err == nil && len(seatIDs) > 0 {
		_ = h.db.Model(&models.Seat{}).Where("seat_id IN ?", seatIDs).
			Update("status_seat", seatStatusAvailable).Error
	}
	_ = h.db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).
		Update("status_ticket", ticketStatusCancelled).Error
```

- [ ] **Step 6: รันเทสต์ทั้งหมดของ backend ให้ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./... -v
```

Expected: PASS ทั้งหมด (ไม่มีเทสต์เดิมพัง)

- [ ] **Step 7: Commit**

```bash
git add backend/internal/handlers/booking_payment.go backend/internal/handlers/booking_seats_test.go
git commit -m "refactor(booking): เลิกสร้างโซน/ที่นั่งปลอม ใช้ตั๋วที่ผูกที่นั่งจริงแทน"
```

---

### Task 7: หน้าเลือกโซนอ่านโซนจริงจากฐานข้อมูล

**Files:**
- Create: `frontend/src/api/seatInventoryApi.ts`
- Create: `frontend/src/api/seatInventoryApi.test.ts`
- Modify: `frontend/src/pages/Customer/ZoneSelection/index.tsx:19` (zonesData) และส่วน render `:220`

**Interfaces:**
- Consumes: `GET /api/concerts/:id/zones` (Task 4)
- Produces:
  - `type ZoneInventory = { zoneId, zoneType, categoryName, color, price, capacity, available }`
  - `type SeatInventory = { seatId, label, row, column, status, positionX, positionY }`
  - `seatInventoryApi.listZones(concertId): Promise<ZoneInventory[]>`
  - `seatInventoryApi.listSeats(concertId, zoneId): Promise<SeatInventory[]>`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/api/seatInventoryApi.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seatInventoryApi } from '@/api/seatInventoryApi';

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('seatInventoryApi', () => {
    it('แปลงโซนจาก snake_case ของ backend เป็น camelCase', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{ zone_id: 'A1', zone_type: 'นั่ง', category_name: 'โซน A', color: '#E53935', price: 2000, capacity: 40, available: 38 }],
        }));

        const zones = await seatInventoryApi.listZones('CC1');

        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/concerts/CC1/zones');
        expect(zones).toEqual([
            { zoneId: 'A1', zoneType: 'นั่ง', categoryName: 'โซน A', color: '#E53935', price: 2000, capacity: 40, available: 38 },
        ]);
    });

    it('แปลงที่นั่งและคงสถานะจาก backend ไว้', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{ seat_id: 'ST1', label: 'A1', seat_row: 'A', seat_column: '1', status: 'ไม่ว่าง', position_x: 1, position_y: 2 }],
        }));

        const seats = await seatInventoryApi.listSeats('CC1', 'A1');

        expect(seats).toEqual([
            { seatId: 'ST1', label: 'A1', row: 'A', column: '1', status: 'ไม่ว่าง', positionX: 1, positionY: 2 },
        ]);
    });

    it('โยน error พร้อมข้อความจาก backend เมื่อโหลดไม่สำเร็จ', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, { error: 'ไม่สามารถโหลดที่นั่งได้' }));

        await expect(seatInventoryApi.listSeats('CC1', 'A1')).rejects.toThrow('ไม่สามารถโหลดที่นั่งได้');
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd frontend; npm test -- --run src/api/seatInventoryApi.test.ts
```

Expected: FAIL — `Failed to resolve import "@/api/seatInventoryApi"`

- [ ] **Step 3: เขียน API client**

สร้าง `frontend/src/api/seatInventoryApi.ts`:

```typescript
export type ZoneInventory = {
    zoneId: string;
    zoneType: string;
    categoryName: string;
    color: string;
    price: number;
    capacity: number;
    available: number;
};

export type SeatInventory = {
    seatId: string;
    label: string;
    row: string;
    column: string;
    status: string;
    positionX: number;
    positionY: number;
};

type ZoneWire = {
    zone_id: string;
    zone_type: string;
    category_name: string;
    color: string;
    price: number;
    capacity: number;
    available: number;
};

type SeatWire = {
    seat_id: string;
    label: string;
    seat_row: string;
    seat_column: string;
    status: string;
    position_x: number;
    position_y: number;
};

const readJson = async (response: Response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body?.error || 'ไม่สามารถโหลดข้อมูลที่นั่งได้');
    }
    return body;
};

export const seatInventoryApi = {
    async listZones(concertId: string): Promise<ZoneInventory[]> {
        const response = await fetch(`/api/concerts/${encodeURIComponent(concertId)}/zones`);
        const body = await readJson(response);
        return (body.data as ZoneWire[] ?? []).map((zone) => ({
            zoneId: zone.zone_id,
            zoneType: zone.zone_type,
            categoryName: zone.category_name,
            color: zone.color,
            price: zone.price,
            capacity: zone.capacity,
            available: zone.available,
        }));
    },

    async listSeats(concertId: string, zoneId: string): Promise<SeatInventory[]> {
        const response = await fetch(
            `/api/concerts/${encodeURIComponent(concertId)}/zones/${encodeURIComponent(zoneId)}/seats`,
        );
        const body = await readJson(response);
        return (body.data as SeatWire[] ?? []).map((seat) => ({
            seatId: seat.seat_id,
            label: seat.label,
            row: seat.seat_row,
            column: seat.seat_column,
            status: seat.status,
            positionX: seat.position_x,
            positionY: seat.position_y,
        }));
    },
};
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend; npm test -- --run src/api/seatInventoryApi.test.ts
```

Expected: PASS ทั้ง 3 เคส

- [ ] **Step 5: ให้หน้าเลือกโซนใช้ราคาจริง**

ใน `frontend/src/pages/Customer/ZoneSelection/index.tsx` เพิ่ม state และโหลดโซนจริง
โดยคง `zonesData` เดิมไว้เป็นค่าตั้งต้น (กันหน้าเว็บว่างเมื่อ backend ล่ม)

เพิ่ม import:

```typescript
import { seatInventoryApi } from '@/api/seatInventoryApi';
```

เพิ่มใน component หลัง state เดิม:

```typescript
    const [zonePrices, setZonePrices] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!id) return;
        let active = true;
        seatInventoryApi.listZones(id)
            .then((zones) => {
                if (!active) return;
                setZonePrices(Object.fromEntries(zones.map((zone) => [zone.zoneId, zone.price])));
            })
            .catch(() => {
                // ใช้ราคาตั้งต้นในหน้าเว็บต่อไปเมื่อโหลดไม่ได้
            });
        return () => { active = false; };
    }, [id]);
```

ในส่วน render ที่วน `zonesData.map((zone) => ...)` (บรรทัด ~220) ให้ราคาที่แสดงอ่านจาก
`zonePrices` ก่อน แล้วค่อย fallback เป็น `zone.price` เดิมใน `zonesData`:

```typescript
const price = zonePrices[zone.id] ?? zone.price;
```

`zonesData` มีฟิลด์ `price` อยู่แล้ว (`ZoneSelection/index.tsx:20-29`) จึงไม่ต้องแก้โครงสร้างเดิม

- [ ] **Step 6: ตรวจว่า build ผ่าน**

```bash
cd frontend; npm run build
```

Expected: สำเร็จ ไม่มี type error

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/seatInventoryApi.ts frontend/src/api/seatInventoryApi.test.ts frontend/src/pages/Customer/ZoneSelection/index.tsx
git commit -m "feat(frontend): หน้าเลือกโซนอ่านราคาจากฐานข้อมูลจริง"
```

---

### Task 8: หน้าเลือกที่นั่งอ่านที่นั่งจริง และแสดง error เมื่อที่นั่งถูกชิง

**Files:**
- Modify: `frontend/src/pages/Customer/SeatSelection/index.tsx:31` (state `seats`), `:267-289` (ส่งจอง)
- Modify: `frontend/src/api/bookingPaymentApi.ts:153-179` (เลิกกลืน error จากเซิร์ฟเวอร์)
- Test: `frontend/src/api/bookingPaymentApi.test.ts` (สร้างใหม่)

**Interfaces:**
- Consumes: `seatInventoryApi.listSeats` (Task 7), `POST /api/bookings` ที่ตอบ 409 (Task 5)
- Produces:
  - `BookingRejectedError` (export จาก `bookingPaymentApi.ts`) — มี `message` ภาษาไทยจากเซิร์ฟเวอร์ และ `unavailableSeats: string[]`
  - `bookingPaymentApi.createBooking` โยน `BookingRejectedError` เมื่อเซิร์ฟเวอร์ตอบ 4xx และยัง fallback local store เมื่อต่อเซิร์ฟเวอร์ไม่ติด

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/api/bookingPaymentApi.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const bookingArgs = {
    concertId: 'CC1',
    concertTitle: 'งานทดสอบ',
    zoneId: 'A1',
    tierName: 'โซน A',
    seats: ['A1', 'A2'],
    quantity: 2,
    unitPrice: 2000,
    discountAmount: 0,
    totalPrice: 4000,
    customerName: 'ลูกค้า',
    customerEmail: 'test@example.com',
    customerPhone: '0800000000',
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('bookingPaymentApi.createBooking', () => {
    it('โยน error พร้อมข้อความจากเซิร์ฟเวอร์เมื่อที่นั่งถูกจองไปแล้ว (409)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(409, { error: 'ที่นั่งไม่ว่างแล้ว: A2', unavailable_seats: ['A2'] }),
        );

        await expect(bookingPaymentApi.createBooking(bookingArgs)).rejects.toThrow('ที่นั่งไม่ว่างแล้ว: A2');
    });

    it('ยังบันทึกลง local store ได้เมื่อต่อเซิร์ฟเวอร์ไม่ติด', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

        const record = await bookingPaymentApi.createBooking(bookingArgs);

        expect(record.id).toBeTruthy();
        expect(record.quantity).toBe(2);
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd frontend; npm test -- --run src/api/bookingPaymentApi.test.ts
```

Expected: FAIL เคสแรก — ตอนนี้ 409 ถูกกลืนแล้วไปสร้าง booking ใน local store จึง resolve แทนที่จะ reject

- [ ] **Step 3: แยก "เซิร์ฟเวอร์ปฏิเสธ" ออกจาก "ต่อไม่ติด"**

ใน `frontend/src/api/bookingPaymentApi.ts` เพิ่ม error class ไว้บนสุดของไฟล์ (ใต้ import):

```typescript
/** เซิร์ฟเวอร์ปฏิเสธการจอง (เช่น ที่นั่งถูกคนอื่นชิงไปแล้ว) — ต่างจาก "ต่อเซิร์ฟเวอร์ไม่ติด" */
export class BookingRejectedError extends Error {
  readonly unavailableSeats: string[];

  constructor(message: string, unavailableSeats: string[] = []) {
    super(message);
    this.name = 'BookingRejectedError';
    this.unavailableSeats = unavailableSeats;
  }
}
```

ในฟังก์ชัน `createBooking` เปลี่ยนการเช็ค response (บรรทัด 144-146) จาก:

```typescript
      if (!res.ok) {
        throw new Error('บันทึกการจองไม่สำเร็จ');
      }
```

เป็น:

```typescript
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new BookingRejectedError(
          body?.error || 'บันทึกการจองไม่สำเร็จ',
          body?.unavailable_seats ?? [],
        );
      }
```

แล้วเปลี่ยนหัว catch (บรรทัด 155) จาก `} catch {` เป็น:

```typescript
    } catch (error) {
      // เซิร์ฟเวอร์ตอบว่าไม่ผ่าน → ต้องให้ผู้ใช้เห็น ห้ามกลืนแล้วบอกว่าจองสำเร็จ
      if (error instanceof BookingRejectedError) {
        throw error;
      }
```

ส่วนที่เหลือของ catch (`return addLocalBooking({...})` ทั้งก้อน) คงไว้ตามเดิม —
กรณีต่อเซิร์ฟเวอร์ไม่ติดยังทำงานแบบออฟไลน์ได้เหมือนเดิม

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend; npm test -- --run src/api/bookingPaymentApi.test.ts
```

Expected: PASS ทั้งสองเคส

- [ ] **Step 5: ให้หน้าเลือกที่นั่งโหลดที่นั่งจริง**

ใน `frontend/src/pages/Customer/SeatSelection/index.tsx`:

เปลี่ยน state เริ่มต้นจาก `useState<SeatData[]>(generateSeats)` เป็น `useState<SeatData[]>([])`
ลบ `generateSeats` ออกจาก import แล้วเพิ่ม:

```typescript
import { seatInventoryApi } from '@/api/seatInventoryApi';
```

เพิ่ม effect โหลดที่นั่งจริง (สถานะ `"ไม่ว่าง"` จาก backend → `reserved` ในหน้าเว็บ):

```typescript
    useEffect(() => {
        if (!id || !zone) return;
        let active = true;
        seatInventoryApi.listSeats(id, zone)
            .then((rows) => {
                if (!active) return;
                setSeats(rows.map((seat) => ({
                    id: seat.label,
                    row: seat.row,
                    number: Number(seat.column) || 0,
                    status: seat.status === 'ว่าง' ? 'available' : 'reserved',
                })));
            })
            .catch(() => {
                if (active) setSeats([]);
            });
        return () => { active = false; };
    }, [id, zone]);
```

ในฟังก์ชันที่เรียก `bookingPaymentApi.createBooking` (บรรทัด ~268) ให้ครอบ try/catch
เพื่อแสดงข้อความจากเซิร์ฟเวอร์ และรีเฟรชผังที่นั่งเมื่อชนกัน:

```typescript
        try {
            const record = await bookingPaymentApi.createBooking({ /* ...อาร์กิวเมนต์เดิมทั้งหมด... */ });
            setLatestBookingId(record.id);
            setShowSuccessDialog(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึกการจองได้';
            setBookingError(message);
            // ที่นั่งอาจถูกคนอื่นชิงไป — ดึงผังล่าสุดมาแสดงใหม่
            if (id && zone) {
                const rows = await seatInventoryApi.listSeats(id, zone).catch(() => []);
                setSeats(rows.map((seat) => ({
                    id: seat.label,
                    row: seat.row,
                    number: Number(seat.column) || 0,
                    status: seat.status === 'ว่าง' ? 'available' : 'reserved',
                })));
            }
        }
```

เพิ่ม state `const [bookingError, setBookingError] = useState('');` เพิ่ม import
(`ErrorAlert` เป็น **named export** ไม่ใช่ default):

```typescript
import { ErrorAlert } from '@/components/ErrorAlert';
```

แล้วแสดงผลเหนือ `OrderSummary` ใน JSX:

```tsx
{bookingError && <ErrorAlert message={bookingError} />}
```

- [ ] **Step 6: ลบ `generateSeats` ที่ไม่ได้ใช้แล้ว**

ลบฟังก์ชัน `generateSeats` ออกจาก `frontend/src/components/SeatSelection/constants.ts:32-49`
แล้วตรวจว่าไม่มีที่อื่นเรียกใช้:

```bash
cd frontend; npm run lint
```

Expected: ไม่มี error เรื่อง unused / undefined

- [ ] **Step 7: รันเทสต์หน้าเว็บทั้งหมด + build**

```bash
cd frontend; npm test -- --run; npm run build
```

Expected: PASS ทั้งหมด และ build สำเร็จ

- [ ] **Step 8: ทดสอบด้วยตาบนเบราว์เซอร์**

เปิด dev server แล้วไล่ตามเส้นทางนี้:
1. เข้าหน้าพนักงาน → บันทึกผังที่นั่งของคอนเสิร์ตหนึ่ง → ตรวจว่ามีแถวใน `zones`, `seats`, `ticket_categories`
2. เข้าหน้าลูกค้า `/event/:id/zones` → เลือกโซน → `/event/:id/seats/:zone` ต้องเห็นที่นั่งจากฐานข้อมูล
3. จองที่นั่ง 2 ใบ → เปิดอีกแท็บด้วยผู้ใช้อื่น → ที่นั่งสองใบนั้นต้องขึ้นเป็น "ถูกจองแล้ว" กดไม่ได้
4. หน้า "บัตรของฉัน" ต้องแสดงเลขที่นั่งที่เลือกจริง

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Customer/SeatSelection/index.tsx frontend/src/components/SeatSelection/constants.ts frontend/src/api/bookingPaymentApi.ts frontend/src/api/bookingPaymentApi.test.ts
git commit -m "feat(frontend): หน้าเลือกที่นั่งอ่านที่นั่งจริงและแจ้งเตือนเมื่อที่นั่งถูกจองไปแล้ว"
```

---

## หมายเหตุสำหรับผู้นำแผนไปทำ

- **ลำดับสำคัญ:** Task 1 → 2 → 3 → 4 → 5 → 6 ต้องเรียงตามนี้ (แต่ละงานใช้ของจากงานก่อนหน้า)
  Task 7 กับ 8 ทำหลัง Task 4-5 เสร็จแล้ว จะสลับกันได้
- **ถ้าฐานข้อมูลเดิมมีข้อมูล `seats` ปลอมค้างอยู่** (จากโค้ดเดิมที่สร้าง `ZONE-A`) ให้ลบทิ้งก่อนทดสอบ:
  `DELETE FROM tickets WHERE seat_id LIKE 'ST-ZONE-%'; DELETE FROM seats WHERE zone_id = 'ZONE-A'; DELETE FROM zones WHERE zone_id = 'ZONE-A';`
- **เทสต์ที่ต้องใช้ PostgreSQL** จะถูก skip อัตโนมัติถ้าไม่ได้ตั้ง `MANAGEMENT_INTEGRATION_TEST=1`
  อย่าเข้าใจผิดว่า "ผ่าน" ทั้งที่ถูกข้าม — ดูบรรทัด SKIP ในผลลัพธ์ด้วย
