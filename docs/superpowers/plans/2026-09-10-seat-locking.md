# Seat Locking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ที่นั่งที่ถูกล็อกหรือจองไปแล้วต้องกดเลือกไม่ได้สำหรับลูกค้าคนอื่น โดยเซิร์ฟเวอร์เป็นเจ้าของความจริงเรื่อง "ที่นั่งใบไหนว่าง"

**Architecture:** เพิ่มตาราง `seat_holds` ตารางเดียวที่เก็บทั้งล็อกชั่วคราว (มี `expires_at`) และที่นั่งที่จองถาวรแล้ว (มี `booking_id`) กันชนกันด้วย unique index บน `(concert_id, zone_id, seat_label)` เปิด 3 endpoint ให้อ่านสถานะ/ล็อก/ปล่อย แล้วให้ `createBooking` เปลี่ยนล็อกเป็นการจองใน transaction เดียวกัน ฝั่ง frontend เลิกใช้ชุดที่นั่งจองปลอม เปลี่ยนมาดึงสถานะจริงตอนเข้าหน้าและ poll ทุก 10 วินาที

**Tech Stack:** Go 1.26 + Fiber v2 + GORM + PostgreSQL (backend) · React 19 + TypeScript + MUI v9 + Vite 8 (frontend) · Vitest 4 + @testing-library/react (เทสต์ frontend)

**Spec:** `docs/superpowers/specs/2026-09-10-seat-locking.md`

## Global Constraints

- ข้อความที่ผู้ใช้เห็นทุกจุดเป็นภาษาไทย ให้เข้ากับข้อความเดิมในไฟล์เดียวกัน
- Backend ตอบ error ด้วยรูปแบบเดิมของไฟล์ `booking_payment.go` คือ `c.Status(...).JSON(fiber.Map{"error": "..."})` (ไฟล์นี้ **ไม่ได้** ใช้ `customerError` เหมือนไฟล์ customer_*)
- ห้ามเปลี่ยน shape ของ `BookingRecord` / `Ticket` ใน `frontend/src/types/booking.ts` — `bookingStore`, หน้าบัตรของฉัน และหน้าฝ่ายขายใช้ร่วมกัน
- ห้ามแตะ `frontend/src/services/https/*` และ `frontend/src/hooks/useConcerts.ts` (dead code ที่ import `axios` ซึ่งไม่ได้ติดตั้ง เป็นต้นเหตุ error เดิมของ `tsc -b`)
- Import ฝั่ง frontend ใช้ alias `@/` · เทสต์ต้องอยู่ใน `src/**/*.test.{ts,tsx}`
- เวลาใน backend ใช้ UTC เสมอ (`time.Now().UTC()`) และคอลัมน์เวลาเป็น `timestamp without time zone` ตามที่ `normalizeOperationalDateTimeColumns` ทำไว้
- เทสต์ integration ฝั่ง Go ต้องมี PostgreSQL รันอยู่ (`docker compose up -d postgres` ใน `backend/`) และตั้ง `MANAGEMENT_INTEGRATION_TEST=1` · เทสต์ unit ที่ไม่แตะ DB รันได้เลยไม่ต้องตั้ง env
- คำสั่ง backend รันจาก `backend/` · คำสั่ง frontend รันจาก `frontend/`
- ห้ามใส่บรรทัด attribution ใน commit message

## File Structure

**Backend — สร้างใหม่**
- `backend/internal/models/seat_hold.go` — model `SeatHold` ตัวเดียว
- `backend/internal/handlers/seat_holds.go` — ตัวคำนวณสถานะที่เทสต์ได้ + 3 handler (อ่าน/ล็อก/ปล่อย)
- `backend/internal/handlers/seat_holds_test.go` — unit test ของตัวคำนวณ + integration test ผ่าน HTTP จริง

**Backend — แก้ไข**
- `backend/internal/models/migrate.go:36-44` — เพิ่ม `&SeatHold{}` ในกลุ่ม Ticket & Booking
- `backend/internal/handlers/booking_payment.go` — บรรทัด 22-39 (ลงทะเบียน route), 42-60 (รับ `hold_token`), 129-131 (สร้าง booking + ยึดล็อกใน transaction เดียว)

**Frontend — สร้างใหม่**
- `frontend/src/utils/seatHoldToken.ts` — รหัสประจำแท็บว่าล็อกนี้เป็นของใคร
- `frontend/src/api/seatHoldApi.ts` — client ของ 3 endpoint + `SeatConflictError`
- `frontend/src/api/seatHoldApi.test.ts`
- `frontend/src/utils/seatAvailability.ts` — ตัวรวมสถานะจากเซิร์ฟเวอร์เข้ากับที่นั่งบนหน้าจอ (ฟังก์ชันบริสุทธิ์)
- `frontend/src/utils/seatAvailability.test.ts`
- `frontend/src/hooks/useSeatAvailability.ts` — โหลดตอนเข้าหน้า + poll ทุก 10 วินาที
- `frontend/src/api/bookingPaymentApi.test.ts` — เทสต์เฉพาะพฤติกรรมใหม่เรื่อง 409

**Frontend — แก้ไข**
- `frontend/src/components/SeatSelection/constants.ts:32-49` — เอาชุดที่นั่งจองปลอมออก
- `frontend/src/api/bookingPaymentApi.ts:100-180` — รับ `holdToken`, แยก 409 ออกจาก fallback
- `frontend/src/pages/Customer/SeatSelection/index.tsx` — ต่อทุกอย่างเข้าด้วยกัน

**ไม่แตะ:** `frontend/src/components/SeatSelection/SeatMap.tsx` (รองรับสถานะ `reserved`/`locked` และกันคลิกอยู่แล้ว), `frontend/src/utils/bookingStore.ts`, `backend/internal/models/venue.go`

---

### Task 1: ตาราง seat_holds + ตัวคำนวณสถานะที่นั่ง

**Files:**
- Create: `backend/internal/models/seat_hold.go`
- Create: `backend/internal/handlers/seat_holds.go`
- Test: `backend/internal/handlers/seat_holds_test.go`
- Modify: `backend/internal/models/migrate.go:36-44`

**Interfaces:**
- Consumes: `models.GenerateID(prefix string) string` (มีอยู่แล้วใน `backend/internal/models/`)
- Produces:
  - `models.SeatHold{HoldID, ConcertID, ZoneID, SeatLabel, HoldToken, BookingID string; ExpiresAt *time.Time; CreatedAt time.Time}`
  - `const seatHoldDuration = 15 * time.Minute`
  - `type seatAvailabilityDTO struct { Taken []string \`json:"taken"\`; Held []string \`json:"held"\` }`
  - `func seatAvailabilityFrom(rows []models.SeatHold, now time.Time, callerToken string) seatAvailabilityDTO`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/seat_holds_test.go`:

```go
package handlers

import (
	"testing"
	"time"

	"backend/internal/models"
)

func seatHoldAt(seatLabel, token string, expiresAt *time.Time, bookingID string) models.SeatHold {
	return models.SeatHold{
		ConcertID: "CC0001", ZoneID: "A1", SeatLabel: seatLabel,
		HoldToken: token, BookingID: bookingID, ExpiresAt: expiresAt,
	}
}

func TestSeatAvailabilitySeparatesBookedFromTemporaryHolds(t *testing.T) {
	now := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)
	future := now.Add(5 * time.Minute)
	past := now.Add(-1 * time.Minute)

	rows := []models.SeatHold{
		seatHoldAt("A1", "someone", nil, "BK-1"),      // จองสำเร็จแล้ว
		seatHoldAt("A2", "someone", &future, ""),      // คนอื่นล็อกอยู่
		seatHoldAt("A3", "someone", &past, ""),        // ล็อกหมดอายุ ต้องถือว่าว่าง
		seatHoldAt("A4", "me", &future, ""),           // ล็อกของผู้เรียกเอง ต้องไม่นับเป็นของคนอื่น
	}

	got := seatAvailabilityFrom(rows, now, "me")

	if len(got.Taken) != 1 || got.Taken[0] != "A1" {
		t.Fatalf("ที่นั่งที่จองแล้วต้องมีแค่ A1 แต่ได้ %v", got.Taken)
	}
	if len(got.Held) != 1 || got.Held[0] != "A2" {
		t.Fatalf("ที่นั่งที่คนอื่นล็อกต้องมีแค่ A2 แต่ได้ %v", got.Held)
	}
}

func TestSeatAvailabilityCountsBookedSeatEvenWhenItIsTheCallerOwn(t *testing.T) {
	now := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)

	// จองไปแล้วก็คือไม่ว่าง ต่อให้เป็นคนที่จองเอง ก็ต้องกดเลือกซ้ำไม่ได้
	got := seatAvailabilityFrom([]models.SeatHold{seatHoldAt("B2", "me", nil, "BK-9")}, now, "me")

	if len(got.Taken) != 1 || got.Taken[0] != "B2" {
		t.Fatalf("ต้องนับ B2 เป็นที่นั่งที่จองแล้ว แต่ได้ %v", got.Taken)
	}
}

func TestSeatAvailabilityTreatsHoldExpiringExactlyNowAsFree(t *testing.T) {
	now := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)
	exactlyNow := now

	got := seatAvailabilityFrom([]models.SeatHold{seatHoldAt("C3", "someone", &exactlyNow, "")}, now, "me")

	if len(got.Held) != 0 {
		t.Fatalf("ล็อกที่หมดอายุพอดีต้องถือว่าว่างแล้ว แต่ได้ %v", got.Held)
	}
}

func TestSeatAvailabilityReturnsEmptySlicesNotNil(t *testing.T) {
	got := seatAvailabilityFrom(nil, time.Now().UTC(), "me")

	if got.Taken == nil || got.Held == nil {
		t.Fatal("ต้องคืน slice ว่าง ไม่ใช่ nil มิฉะนั้น JSON จะกลายเป็น null")
	}
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd backend && go test ./internal/handlers/ -run "SeatAvailability" -v
```

Expected: FAIL — compile error `undefined: seatAvailabilityFrom` และ `undefined: models.SeatHold`

- [ ] **Step 3: เขียน model**

สร้าง `backend/internal/models/seat_hold.go`:

```go
package models

import (
	"time"

	"gorm.io/gorm"
)

// SeatHold บันทึกว่าที่นั่งใบไหนไม่ว่าง ใช้ตารางเดียวเก็บสองสถานะ:
// booking_id ว่าง + expires_at ในอนาคต = ล็อกชั่วคราวระหว่างลูกค้าชำระเงิน
// booking_id มีค่า + expires_at เป็น NULL = จองสำเร็จถาวรแล้ว
// unique index กันสองคนที่กดพร้อมกันได้จริง ต่างจากการเช็คก่อนเขียนเฉย ๆ
type SeatHold struct {
	HoldID    string     `gorm:"primaryKey;type:varchar(50);not null" json:"hold_id"`
	ConcertID string     `gorm:"type:varchar(50);not null;uniqueIndex:idx_seat_hold_slot" json:"concert_id"`
	ZoneID    string     `gorm:"type:varchar(50);not null;uniqueIndex:idx_seat_hold_slot" json:"zone_id"`
	SeatLabel string     `gorm:"type:varchar(50);not null;uniqueIndex:idx_seat_hold_slot" json:"seat_label"`
	HoldToken string     `gorm:"type:varchar(100);not null;index" json:"hold_token"`
	BookingID string     `gorm:"type:varchar(50);not null;default:''" json:"booking_id"`
	ExpiresAt *time.Time `gorm:"type:timestamp without time zone" json:"expires_at"`
	CreatedAt time.Time  `gorm:"type:timestamp without time zone;autoCreateTime" json:"created_at"`
}

func (s *SeatHold) BeforeCreate(tx *gorm.DB) (err error) {
	if s.HoldID == "" {
		s.HoldID = GenerateID("SH")
	}
	return
}
```

- [ ] **Step 4: ลงทะเบียน model กับ AutoMigrate**

ใน `backend/internal/models/migrate.go` เพิ่ม `&SeatHold{},` ต่อจาก `&Payment{},` ในกลุ่ม `// Ticket & Booking`:

```go
		// Ticket & Booking
		&Booking{},
		&Payment{},
		&SeatHold{},
		&Zone{},
```

- [ ] **Step 5: เขียนตัวคำนวณสถานะ**

สร้าง `backend/internal/handlers/seat_holds.go`:

```go
package handlers

import (
	"backend/internal/models"
	"time"
)

// อายุของล็อกชั่วคราว ต้องตรงกับที่ frontend แสดงนับถอยหลัง (LOCK_DURATION = 900 วินาที)
const seatHoldDuration = 15 * time.Minute

type seatAvailabilityDTO struct {
	Taken []string `json:"taken"`
	Held  []string `json:"held"`
}

// seatAvailabilityFrom แยกที่นั่งที่จองสำเร็จแล้ว (taken) ออกจากที่นั่งที่ลูกค้าคนอื่น
// กำลังล็อกชั่วคราวอยู่ (held) โดยข้ามล็อกที่หมดอายุแล้ว และข้ามล็อกของผู้เรียกเอง
// เพราะหน้าจอของเจ้าของล็อกมีสถานะตัวเองอยู่แล้ว ถ้าส่งกลับไปจะไปทับกัน
func seatAvailabilityFrom(rows []models.SeatHold, now time.Time, callerToken string) seatAvailabilityDTO {
	availability := seatAvailabilityDTO{Taken: []string{}, Held: []string{}}
	for _, row := range rows {
		if row.BookingID != "" {
			availability.Taken = append(availability.Taken, row.SeatLabel)
			continue
		}
		if row.ExpiresAt == nil || !row.ExpiresAt.After(now) {
			continue
		}
		if callerToken != "" && row.HoldToken == callerToken {
			continue
		}
		availability.Held = append(availability.Held, row.SeatLabel)
	}
	return availability
}
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

```bash
cd backend && go test ./internal/handlers/ -run "SeatAvailability" -v
```

Expected: PASS ทั้ง 4 เคส

- [ ] **Step 7: build ทั้งโปรเจกต์**

```bash
cd backend && go build ./...
```

Expected: build สำเร็จ ไม่มี output

- [ ] **Step 8: Commit**

```bash
git add backend/internal/models/seat_hold.go backend/internal/models/migrate.go backend/internal/handlers/seat_holds.go backend/internal/handlers/seat_holds_test.go
git commit -m "feat(backend): add seat hold model and availability calculation"
```

---

### Task 2: Endpoint อ่านสถานะ / ล็อก / ปล่อยที่นั่ง

**Files:**
- Modify: `backend/internal/handlers/seat_holds.go` (เพิ่ม handler ต่อท้ายไฟล์)
- Modify: `backend/internal/handlers/booking_payment.go:22-39` (ลงทะเบียน route)
- Test: `backend/internal/handlers/seat_holds_test.go` (เพิ่มเทสต์ต่อท้ายไฟล์)

**Interfaces:**
- Consumes: `seatAvailabilityFrom`, `seatHoldDuration`, `models.SeatHold` (Task 1), `bookingPaymentHandler{db *gorm.DB}` และ `RegisterBookingPaymentRoutes(app *fiber.App, db *gorm.DB)` (ของเดิมใน `booking_payment.go`), `managementTestDB(t *testing.T) *gorm.DB`, `customerTestRequest(t *testing.T, app *fiber.App, method, path string, payload any, cookie *http.Cookie, expectedStatus int) *http.Response`
- Produces:
  - `func (h *bookingPaymentHandler) getSeatAvailability(c *fiber.Ctx) error` → `GET /api/seat-availability`
  - `func (h *bookingPaymentHandler) holdSeats(c *fiber.Ctx) error` → `POST /api/seat-holds`
  - `func (h *bookingPaymentHandler) releaseSeatHolds(c *fiber.Ctx) error` → `DELETE /api/seat-holds`
  - `var errSeatTaken = errors.New("seat already taken")`
  - `func isDuplicateSeatHold(err error) bool`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มท้ายไฟล์ `backend/internal/handlers/seat_holds_test.go` (และเพิ่ม import `encoding/json`, `net/http`, `github.com/gofiber/fiber/v2` ที่หัวไฟล์):

```go
func seatHoldTestApp(t *testing.T) *fiber.App {
	t.Helper()
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)
	return app
}

func decodeSeatAvailability(t *testing.T, response *http.Response) seatAvailabilityDTO {
	t.Helper()
	var payload struct {
		Data seatAvailabilityDTO `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	return payload.Data
}

func TestHoldSeatsBlocksAnotherCustomerFromTheSameSeat(t *testing.T) {
	app := seatHoldTestApp(t)

	customerTestRequest(t, app, http.MethodPost, "/api/seat-holds", fiber.Map{
		"concert_id": "CCLOCK_1", "zone_id": "A1", "seats": []string{"A1", "A2"}, "hold_token": "first-customer",
	}, nil, http.StatusCreated)

	// คนที่สองขอที่นั่งทับ ต้องโดนปฏิเสธและได้รายชื่อที่นั่งที่ชนกลับไป
	response := customerTestRequest(t, app, http.MethodPost, "/api/seat-holds", fiber.Map{
		"concert_id": "CCLOCK_1", "zone_id": "A1", "seats": []string{"A2", "A3"}, "hold_token": "second-customer",
	}, nil, http.StatusConflict)

	var conflict struct {
		ConflictSeats []string `json:"conflict_seats"`
	}
	if err := json.NewDecoder(response.Body).Decode(&conflict); err != nil {
		t.Fatal(err)
	}
	if len(conflict.ConflictSeats) != 1 || conflict.ConflictSeats[0] != "A2" {
		t.Fatalf("ต้องบอกว่า A2 ชน แต่ได้ %v", conflict.ConflictSeats)
	}

	// และต้องไม่ไปแตะ A3 ที่ยังว่างอยู่ (ล็อกทั้งชุดต้อง rollback)
	availability := decodeSeatAvailability(t, customerTestRequest(t, app, http.MethodGet,
		"/api/seat-availability?concert_id=CCLOCK_1&zone_id=A1&hold_token=second-customer", nil, nil, http.StatusOK))
	for _, seat := range availability.Held {
		if seat == "A3" {
			t.Fatal("A3 ต้องยังว่างอยู่ เพราะการล็อกชุดที่ชนต้องไม่ถูกบันทึกเลย")
		}
	}
}

func TestSeatAvailabilityHidesTheCallerOwnHold(t *testing.T) {
	app := seatHoldTestApp(t)

	customerTestRequest(t, app, http.MethodPost, "/api/seat-holds", fiber.Map{
		"concert_id": "CCLOCK_2", "zone_id": "B1", "seats": []string{"B4"}, "hold_token": "owner",
	}, nil, http.StatusCreated)

	mine := decodeSeatAvailability(t, customerTestRequest(t, app, http.MethodGet,
		"/api/seat-availability?concert_id=CCLOCK_2&zone_id=B1&hold_token=owner", nil, nil, http.StatusOK))
	if len(mine.Held) != 0 {
		t.Fatalf("เจ้าของล็อกต้องไม่เห็นล็อกตัวเองเป็นของคนอื่น แต่ได้ %v", mine.Held)
	}

	others := decodeSeatAvailability(t, customerTestRequest(t, app, http.MethodGet,
		"/api/seat-availability?concert_id=CCLOCK_2&zone_id=B1&hold_token=another", nil, nil, http.StatusOK))
	if len(others.Held) != 1 || others.Held[0] != "B4" {
		t.Fatalf("ลูกค้าคนอื่นต้องเห็น B4 ถูกล็อก แต่ได้ %v", others.Held)
	}
}

func TestHoldSeatsLetsTheSameCustomerChangeTheirMind(t *testing.T) {
	app := seatHoldTestApp(t)

	customerTestRequest(t, app, http.MethodPost, "/api/seat-holds", fiber.Map{
		"concert_id": "CCLOCK_3", "zone_id": "C1", "seats": []string{"C1", "C2"}, "hold_token": "same-customer",
	}, nil, http.StatusCreated)

	// กดล็อกใหม่ด้วยชุดที่นั่งอื่น ต้องได้ ไม่ใช่ไปชนกับล็อกเดิมของตัวเอง
	customerTestRequest(t, app, http.MethodPost, "/api/seat-holds", fiber.Map{
		"concert_id": "CCLOCK_3", "zone_id": "C1", "seats": []string{"C5"}, "hold_token": "same-customer",
	}, nil, http.StatusCreated)

	availability := decodeSeatAvailability(t, customerTestRequest(t, app, http.MethodGet,
		"/api/seat-availability?concert_id=CCLOCK_3&zone_id=C1&hold_token=another", nil, nil, http.StatusOK))
	if len(availability.Held) != 1 || availability.Held[0] != "C5" {
		t.Fatalf("ที่นั่งเดิมต้องถูกปล่อยและเหลือแค่ C5 แต่ได้ %v", availability.Held)
	}
}

func TestReleaseSeatHoldsFreesTheSeatForEveryoneElse(t *testing.T) {
	app := seatHoldTestApp(t)

	customerTestRequest(t, app, http.MethodPost, "/api/seat-holds", fiber.Map{
		"concert_id": "CCLOCK_4", "zone_id": "A2", "seats": []string{"D1"}, "hold_token": "leaving-customer",
	}, nil, http.StatusCreated)

	customerTestRequest(t, app, http.MethodDelete, "/api/seat-holds?hold_token=leaving-customer", nil, nil, http.StatusOK)

	availability := decodeSeatAvailability(t, customerTestRequest(t, app, http.MethodGet,
		"/api/seat-availability?concert_id=CCLOCK_4&zone_id=A2&hold_token=another", nil, nil, http.StatusOK))
	if len(availability.Held) != 0 {
		t.Fatalf("ยกเลิกล็อกแล้วที่นั่งต้องว่าง แต่ได้ %v", availability.Held)
	}
}

func TestSeatAvailabilityRequiresConcertAndZone(t *testing.T) {
	app := seatHoldTestApp(t)

	customerTestRequest(t, app, http.MethodGet, "/api/seat-availability?concert_id=CCLOCK_5", nil, nil, http.StatusBadRequest)
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd backend && docker compose up -d postgres && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -run "SeatHolds|SeatAvailability" -v
```

Expected: FAIL — เทสต์ integration ตอบ 404 เพราะยังไม่มี route (`customerTestRequest` จะ fail ว่า status ไม่ตรง)

- [ ] **Step 3: เขียน handler**

เพิ่มท้ายไฟล์ `backend/internal/handlers/seat_holds.go` และแก้ import ที่หัวไฟล์เป็น:

```go
import (
	"errors"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)
```

แล้วเพิ่มโค้ดนี้ต่อท้ายไฟล์:

```go
var errSeatTaken = errors.New("seat already taken")

// สองคนที่กดล็อกพร้อมกันจะผ่านการเช็คก่อนเขียนทั้งคู่ (ต่าง transaction มองไม่เห็นแถวที่อีกฝั่ง
// ยังไม่ commit) unique index จึงเป็นด่านสุดท้าย และเราต้องแปลง error ของมันเป็น 409 ไม่ใช่ 500
func isDuplicateSeatHold(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key value violates unique constraint")
}

type seatHoldInput struct {
	ConcertID string   `json:"concert_id"`
	ZoneID    string   `json:"zone_id"`
	Seats     []string `json:"seats"`
	HoldToken string   `json:"hold_token"`
}

func (h *bookingPaymentHandler) getSeatAvailability(c *fiber.Ctx) error {
	concertID := strings.TrimSpace(c.Query("concert_id"))
	zoneID := strings.TrimSpace(c.Query("zone_id"))
	if concertID == "" || zoneID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ต้องระบุคอนเสิร์ตและโซนที่นั่ง"})
	}

	var rows []models.SeatHold
	if err := h.db.Where("concert_id = ? AND zone_id = ?", concertID, zoneID).Find(&rows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดสถานะที่นั่งได้"})
	}

	return c.JSON(fiber.Map{"data": seatAvailabilityFrom(rows, time.Now().UTC(), strings.TrimSpace(c.Query("hold_token")))})
}

func (h *bookingPaymentHandler) holdSeats(c *fiber.Ctx) error {
	var input seatHoldInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ข้อมูลการล็อกที่นั่งไม่ถูกต้อง"})
	}

	input.ConcertID = strings.TrimSpace(input.ConcertID)
	input.ZoneID = strings.TrimSpace(input.ZoneID)
	input.HoldToken = strings.TrimSpace(input.HoldToken)
	if input.ConcertID == "" || input.ZoneID == "" || input.HoldToken == "" || len(input.Seats) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ต้องระบุคอนเสิร์ต โซน ที่นั่ง และรหัสผู้จอง"})
	}

	seats := make([]string, 0, len(input.Seats))
	for _, seat := range input.Seats {
		trimmed := strings.TrimSpace(seat)
		if trimmed != "" {
			seats = append(seats, trimmed)
		}
	}
	if len(seats) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ต้องระบุที่นั่งอย่างน้อย 1 ที่"})
	}

	now := time.Now().UTC()
	expiresAt := now.Add(seatHoldDuration)
	conflicts := []string{}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		// ล้างล็อกที่หมดอายุ และล็อกเดิมของลูกค้าคนนี้เอง เพื่อให้เปลี่ยนใจเลือกที่นั่งใหม่ได้
		// booking_id = '' กันไม่ให้ไปลบที่นั่งที่จองสำเร็จแล้ว
		if err := tx.Where(
			"concert_id = ? AND zone_id = ? AND booking_id = '' AND (expires_at IS NULL OR expires_at <= ? OR hold_token = ?)",
			input.ConcertID, input.ZoneID, now, input.HoldToken,
		).Delete(&models.SeatHold{}).Error; err != nil {
			return err
		}

		var blocking []models.SeatHold
		if err := tx.Where("concert_id = ? AND zone_id = ? AND seat_label IN ?", input.ConcertID, input.ZoneID, seats).
			Find(&blocking).Error; err != nil {
			return err
		}
		if len(blocking) > 0 {
			for _, row := range blocking {
				conflicts = append(conflicts, row.SeatLabel)
			}
			return errSeatTaken
		}

		for _, seat := range seats {
			hold := models.SeatHold{
				ConcertID: input.ConcertID, ZoneID: input.ZoneID, SeatLabel: seat,
				HoldToken: input.HoldToken, ExpiresAt: &expiresAt,
			}
			if err := tx.Create(&hold).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if errors.Is(err, errSeatTaken) || isDuplicateSeatHold(err) {
		if len(conflicts) == 0 {
			conflicts = seats
		}
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":          "ที่นั่งบางที่ถูกลูกค้าคนอื่นเลือกไปแล้ว กรุณาเลือกที่นั่งใหม่",
			"conflict_seats": conflicts,
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถล็อกที่นั่งได้"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"data": fiber.Map{"expires_at": expiresAt, "seats": seats},
	})
}

func (h *bookingPaymentHandler) releaseSeatHolds(c *fiber.Ctx) error {
	holdToken := strings.TrimSpace(c.Query("hold_token"))
	if holdToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ต้องระบุรหัสผู้จอง"})
	}

	// booking_id = '' กันไม่ให้ปล่อยที่นั่งที่จ่ายเงินสำเร็จไปแล้ว
	if err := h.db.Where("hold_token = ? AND booking_id = ''", holdToken).Delete(&models.SeatHold{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถยกเลิกการล็อกที่นั่งได้"})
	}

	return c.JSON(fiber.Map{"message": "ยกเลิกการล็อกที่นั่งแล้ว"})
}
```

- [ ] **Step 4: ลงทะเบียน route**

ใน `backend/internal/handlers/booking_payment.go` เพิ่มสามบรรทัดนี้ต่อจาก `app.Post("/api/bookings", h.createBooking)`:

```go
	// Seat Locking
	app.Get("/api/seat-availability", h.getSeatAvailability)
	app.Post("/api/seat-holds", h.holdSeats)
	app.Delete("/api/seat-holds", h.releaseSeatHolds)
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
cd backend && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -run "SeatHolds|SeatAvailability|ReleaseSeatHolds" -v
```

Expected: PASS ทุกเคส

- [ ] **Step 6: Commit**

```bash
git add backend/internal/handlers/seat_holds.go backend/internal/handlers/seat_holds_test.go backend/internal/handlers/booking_payment.go
git commit -m "feat(backend): add seat availability, hold and release endpoints"
```

---

### Task 3: ตอนจองสำเร็จให้ยึดล็อกเป็นที่นั่งถาวร

**Files:**
- Modify: `backend/internal/handlers/booking_payment.go:42-60` (เพิ่ม `hold_token` ใน input), `:129-131` (สร้าง booking + ยึดล็อกใน transaction เดียว)
- Test: `backend/internal/handlers/seat_holds_test.go` (เพิ่มเทสต์ต่อท้ายไฟล์)

**Interfaces:**
- Consumes: `models.SeatHold`, `errSeatTaken` (Task 1-2), `createBookingInput` (ของเดิม)
- Produces: `var errSeatHoldLost = errors.New("seat hold lost")` และพฤติกรรมใหม่ของ `POST /api/bookings` (409 เมื่อล็อกหลุด)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มท้ายไฟล์ `backend/internal/handlers/seat_holds_test.go`:

```go
func TestCreateBookingTurnsHeldSeatsIntoPermanentlyTakenSeats(t *testing.T) {
	app := seatHoldTestApp(t)

	customerTestRequest(t, app, http.MethodPost, "/api/seat-holds", fiber.Map{
		"concert_id": "CCLOCK_6", "zone_id": "A1", "seats": []string{"E1"}, "hold_token": "paying-customer",
	}, nil, http.StatusCreated)

	customerTestRequest(t, app, http.MethodPost, "/api/bookings", fiber.Map{
		"concert_id": "CCLOCK_6", "zone_id": "A1", "seats": []string{"E1"}, "hold_token": "paying-customer",
		"customer_name": "ลูกค้าทดสอบ", "customer_email": "seatlock@example.test",
		"quantity": 1, "unit_price": 2000, "total_price": 2000, "slip_file_name": "slip.jpg",
	}, nil, http.StatusCreated)

	// จองแล้วต้องกลายเป็น taken ถาวร ไม่ใช่ held ที่หมดอายุได้
	availability := decodeSeatAvailability(t, customerTestRequest(t, app, http.MethodGet,
		"/api/seat-availability?concert_id=CCLOCK_6&zone_id=A1&hold_token=paying-customer", nil, nil, http.StatusOK))
	if len(availability.Taken) != 1 || availability.Taken[0] != "E1" {
		t.Fatalf("E1 ต้องกลายเป็นที่นั่งที่จองแล้ว แต่ได้ taken=%v held=%v", availability.Taken, availability.Held)
	}
}

func TestCreateBookingIsRejectedWhenTheHoldIsGone(t *testing.T) {
	app := seatHoldTestApp(t)

	// ไม่เคยล็อกที่นั่งไว้เลย (เช่น ล็อกหมดอายุไปแล้วระหว่างกรอกสลิป) ต้องจองไม่ได้
	customerTestRequest(t, app, http.MethodPost, "/api/bookings", fiber.Map{
		"concert_id": "CCLOCK_7", "zone_id": "A1", "seats": []string{"E2"}, "hold_token": "expired-customer",
		"customer_name": "ลูกค้าทดสอบ", "customer_email": "seatlock2@example.test",
		"quantity": 1, "unit_price": 2000, "total_price": 2000, "slip_file_name": "slip.jpg",
	}, nil, http.StatusConflict)

	// ต้องไม่มี booking ค้างในระบบจากคำขอที่ถูกปฏิเสธ
	availability := decodeSeatAvailability(t, customerTestRequest(t, app, http.MethodGet,
		"/api/seat-availability?concert_id=CCLOCK_7&zone_id=A1&hold_token=another", nil, nil, http.StatusOK))
	if len(availability.Taken) != 0 {
		t.Fatalf("คำขอที่ถูกปฏิเสธต้องไม่ทิ้งที่นั่งที่จองไว้ แต่ได้ %v", availability.Taken)
	}
}

func TestCreateBookingStillWorksWithoutHoldToken(t *testing.T) {
	app := seatHoldTestApp(t)

	// flow เดิม (เช่น หน้าฝ่ายขาย หรือ client เก่า) ที่ไม่ส่ง hold_token ต้องจองได้เหมือนเดิม
	customerTestRequest(t, app, http.MethodPost, "/api/bookings", fiber.Map{
		"concert_id": "CCLOCK_8", "zone_id": "A1", "seats": []string{"E3"},
		"customer_name": "ลูกค้าทดสอบ", "customer_email": "seatlock3@example.test",
		"quantity": 1, "unit_price": 2000, "total_price": 2000, "slip_file_name": "slip.jpg",
	}, nil, http.StatusCreated)
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd backend && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -run "CreateBooking" -v
```

Expected: FAIL — `TestCreateBookingTurnsHeldSeatsIntoPermanentlyTakenSeats` ได้ `taken=[]` เพราะยังไม่มีการยึดล็อก และ `TestCreateBookingIsRejectedWhenTheHoldIsGone` ได้ 201 แทน 409

- [ ] **Step 3: รับ hold_token ใน input**

ใน `backend/internal/handlers/booking_payment.go` เพิ่มบรรทัดนี้ใน struct `createBookingInput` ต่อจาก `Seats []string \`json:"seats"\``:

```go
	HoldToken      string   `json:"hold_token"`
```

- [ ] **Step 4: เพิ่ม sentinel error**

เพิ่มบรรทัดนี้ต่อจาก `var errSeatTaken = errors.New("seat already taken")` ใน `backend/internal/handlers/seat_holds.go`:

```go
var errSeatHoldLost = errors.New("seat hold lost")
```

- [ ] **Step 5: สร้าง booking พร้อมยึดล็อกใน transaction เดียว**

ใน `backend/internal/handlers/booking_payment.go` แทนบล็อกนี้ (บรรทัด 129-131)

```go
	if err := h.db.Create(&booking).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถบันทึกการจองได้: " + err.Error()})
	}
```

ด้วย

```go
	// ยึดล็อกที่นั่งให้เป็นของถาวรใน transaction เดียวกับการสร้าง booking
	// ถ้าล็อกหลุดไปแล้วต้อง rollback ทั้งก้อน ไม่งั้นจะได้ booking ที่ไม่มีที่นั่งค้างในระบบ
	bookingErr := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&booking).Error; err != nil {
			return err
		}
		if input.HoldToken == "" || len(input.Seats) == 0 {
			return nil
		}
		for _, seat := range input.Seats {
			trimmed := strings.TrimSpace(seat)
			if trimmed == "" {
				continue
			}
			outcome := tx.Model(&models.SeatHold{}).
				Where("concert_id = ? AND zone_id = ? AND seat_label = ? AND hold_token = ? AND booking_id = '' AND expires_at > ?",
					input.ConcertID, input.ZoneID, trimmed, strings.TrimSpace(input.HoldToken), now).
				Updates(map[string]any{"booking_id": bookingID, "expires_at": nil})
			if outcome.Error != nil {
				return outcome.Error
			}
			if outcome.RowsAffected != 1 {
				return errSeatHoldLost
			}
		}
		return nil
	})
	if errors.Is(bookingErr, errSeatHoldLost) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "การล็อกที่นั่งหมดอายุหรือถูกคนอื่นจองไปแล้ว กรุณาเลือกที่นั่งใหม่",
		})
	}
	if bookingErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถบันทึกการจองได้: " + bookingErr.Error()})
	}
```

แล้วเพิ่ม `"errors"` ในบล็อก import ที่หัวไฟล์ (บรรทัด 3-16) ให้เป็น:

```go
import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

```bash
cd backend && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -run "CreateBooking|SeatHolds|SeatAvailability" -v
```

Expected: PASS ทุกเคส

- [ ] **Step 7: build + รันเทสต์ทั้ง package**

```bash
cd backend && go build ./... && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -count=1
```

Expected: build สำเร็จ, `ok  	backend/internal/handlers`

- [ ] **Step 8: Commit**

```bash
git add backend/internal/handlers/booking_payment.go backend/internal/handlers/seat_holds.go backend/internal/handlers/seat_holds_test.go
git commit -m "feat(backend): claim seat holds when a booking is created"
```

---

### Task 4: ฝั่ง frontend — รหัสผู้จอง, API client, ตัวรวมสถานะ

งานนี้เป็นตรรกะล้วน ยังไม่แตะหน้าจอ — จบแล้วหน้าเว็บยังเหมือนเดิม

**Files:**
- Create: `frontend/src/utils/seatHoldToken.ts`
- Create: `frontend/src/api/seatHoldApi.ts`
- Test: `frontend/src/api/seatHoldApi.test.ts`
- Create: `frontend/src/utils/seatAvailability.ts`
- Test: `frontend/src/utils/seatAvailability.test.ts`
- Create: `frontend/src/hooks/useSeatAvailability.ts`

**Interfaces:**
- Consumes: `SeatData`, `SeatStatus` จาก `@/components/SeatSelection/types` (ของเดิม)
- Produces:
  - `getSeatHoldToken(): string` (จาก `@/utils/seatHoldToken`)
  - `interface SeatAvailability { taken: string[]; held: string[] }` (จาก `@/api/seatHoldApi`)
  - `class SeatConflictError extends Error { conflictSeats: string[] }` (จาก `@/api/seatHoldApi`)
  - `seatHoldApi.getAvailability(concertId: string, zoneId: string, holdToken: string): Promise<SeatAvailability>`
  - `seatHoldApi.holdSeats(params: { concertId: string; zoneId: string; seats: string[]; holdToken: string }): Promise<{ expiresAt: string }>`
  - `seatHoldApi.releaseSeats(holdToken: string): Promise<void>`
  - `applySeatAvailability(seats: SeatData[], availability: SeatAvailability): SeatData[]` (จาก `@/utils/seatAvailability`)
  - `useSeatAvailability(concertId: string, zoneId: string, holdToken: string, intervalMs?: number): { availability: SeatAvailability; refresh: () => Promise<void> }` (จาก `@/hooks/useSeatAvailability`)

- [ ] **Step 1: เขียนเทสต์ของตัวรวมสถานะที่ยังไม่ผ่าน**

สร้าง `frontend/src/utils/seatAvailability.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SeatData } from '@/components/SeatSelection/types';
import { applySeatAvailability } from '@/utils/seatAvailability';

const seat = (id: string, status: SeatData['status'] = 'available'): SeatData => ({
    id,
    row: id.slice(0, 1),
    number: Number(id.slice(1)),
    status,
});

describe('applySeatAvailability', () => {
    it('greys out seats other customers already booked', () => {
        const merged = applySeatAvailability([seat('A1')], { taken: ['A1'], held: [] });
        expect(merged[0].status).toBe('reserved');
    });

    it('locks seats another customer is holding right now', () => {
        const merged = applySeatAvailability([seat('A2')], { taken: [], held: ['A2'] });
        expect(merged[0].status).toBe('locked');
    });

    it('keeps the seats this customer picked but has not locked yet', () => {
        const merged = applySeatAvailability([seat('A3', 'selected')], { taken: [], held: [] });
        expect(merged[0].status).toBe('selected');
    });

    it('keeps this customer own locked seats even though the server does not list them', () => {
        // เซิร์ฟเวอร์ตัดล็อกของเจ้าของออกจาก held อยู่แล้ว ถ้าเผลอรีเซ็ตจะกลายเป็นว่างทั้งที่ล็อกอยู่
        const merged = applySeatAvailability([seat('A4', 'locked')], { taken: [], held: [] });
        expect(merged[0].status).toBe('locked');
    });

    it('takes a seat away from this customer when someone else booked it first', () => {
        const merged = applySeatAvailability([seat('A5', 'selected')], { taken: ['A5'], held: [] });
        expect(merged[0].status).toBe('reserved');
    });

    it('frees a seat again once the other customer hold has expired', () => {
        const merged = applySeatAvailability([seat('A6', 'reserved')], { taken: [], held: [] });
        expect(merged[0].status).toBe('available');
    });

    it('leaves untouched seats as the very same object so the seat map does not re-render everything', () => {
        const original = seat('A7');
        const merged = applySeatAvailability([original], { taken: [], held: [] });
        expect(merged[0]).toBe(original);
    });
});
```

- [ ] **Step 2: เขียนเทสต์ของ API client ที่ยังไม่ผ่าน**

สร้าง `frontend/src/api/seatHoldApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatConflictError, seatHoldApi } from '@/api/seatHoldApi';

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('seatHoldApi.getAvailability', () => {
    it('asks the server which seats are taken or held for this concert and zone', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(200, { data: { taken: ['A1'], held: ['B2'] } }),
        );

        const availability = await seatHoldApi.getAvailability('CC0001', 'A1', 'my-token');

        expect(availability).toEqual({ taken: ['A1'], held: ['B2'] });
        const requestedUrl = String(fetchMock.mock.calls[0][0]);
        expect(requestedUrl).toContain('/api/seat-availability');
        expect(requestedUrl).toContain('concert_id=CC0001');
        expect(requestedUrl).toContain('hold_token=my-token');
    });

    it('never returns undefined lists even if the server omits them', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { data: {} }));

        await expect(seatHoldApi.getAvailability('CC0001', 'A1', 'my-token')).resolves.toEqual({ taken: [], held: [] });
    });
});

describe('seatHoldApi.holdSeats', () => {
    it('returns the server expiry so the countdown does not rely on the local clock', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(201, { data: { expires_at: '2026-09-10T12:15:00Z', seats: ['A1'] } }),
        );

        await expect(seatHoldApi.holdSeats({ concertId: 'CC0001', zoneId: 'A1', seats: ['A1'], holdToken: 't' }))
            .resolves.toEqual({ expiresAt: '2026-09-10T12:15:00Z' });
    });

    it('raises a conflict carrying the seats that were lost', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(409, { error: 'ที่นั่งบางที่ถูกลูกค้าคนอื่นเลือกไปแล้ว กรุณาเลือกที่นั่งใหม่', conflict_seats: ['A2'] }),
        );

        await expect(seatHoldApi.holdSeats({ concertId: 'CC0001', zoneId: 'A1', seats: ['A2'], holdToken: 't' }))
            .rejects.toBeInstanceOf(SeatConflictError);
    });

    it('tells the customer which seats to re-pick', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(409, { error: 'ที่นั่งถูกเลือกไปแล้ว', conflict_seats: ['A2', 'A3'] }),
        );

        const failure = await seatHoldApi
            .holdSeats({ concertId: 'CC0001', zoneId: 'A1', seats: ['A2', 'A3'], holdToken: 't' })
            .catch((reason) => reason as SeatConflictError);

        expect(failure.conflictSeats).toEqual(['A2', 'A3']);
    });
});
```

- [ ] **Step 3: รันเทสต์ทั้งสองไฟล์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/utils/seatAvailability.test.ts src/api/seatHoldApi.test.ts
```

Expected: FAIL — `Failed to resolve import "@/utils/seatAvailability"` และ `"@/api/seatHoldApi"`

- [ ] **Step 4: เขียนตัวรวมสถานะ**

สร้าง `frontend/src/utils/seatAvailability.ts`:

```ts
import type { SeatData } from '@/components/SeatSelection/types';
import type { SeatAvailability } from '@/api/seatHoldApi';

// เซิร์ฟเวอร์บอกแค่ว่าที่นั่งใบไหน "คนอื่น" จองหรือล็อกไว้ ส่วนสถานะที่ลูกค้าคนนี้ทำเอง
// (เลือกไว้/ล็อกไว้) อยู่ในหน้าจอเท่านั้น การรวมจึงต้องไม่ไปรีเซ็ตของตัวเองทิ้ง
export function applySeatAvailability(seats: SeatData[], availability: SeatAvailability): SeatData[] {
  const taken = new Set(availability.taken);
  const held = new Set(availability.held);

  return seats.map((seat) => {
    if (taken.has(seat.id)) {
      return seat.status === 'reserved' ? seat : { ...seat, status: 'reserved' };
    }
    if (held.has(seat.id)) {
      return seat.status === 'locked' ? seat : { ...seat, status: 'locked' };
    }
    if (seat.status === 'selected' || seat.status === 'locked') {
      return seat;
    }
    return seat.status === 'available' ? seat : { ...seat, status: 'available' };
  });
}
```

- [ ] **Step 5: เขียน API client**

สร้าง `frontend/src/api/seatHoldApi.ts`:

```ts
export interface SeatAvailability {
  taken: string[];
  held: string[];
}

/** เซิร์ฟเวอร์ปฏิเสธเพราะที่นั่งถูกคนอื่นชิงไปแล้ว ต่างจากการต่อเซิร์ฟเวอร์ไม่ได้ */
export class SeatConflictError extends Error {
  readonly conflictSeats: string[];

  constructor(message: string, conflictSeats: string[]) {
    super(message);
    this.name = 'SeatConflictError';
    this.conflictSeats = conflictSeats;
  }
}

export const seatHoldApi = {
  async getAvailability(concertId: string, zoneId: string, holdToken: string): Promise<SeatAvailability> {
    const query = new URLSearchParams({ concert_id: concertId, zone_id: zoneId, hold_token: holdToken });
    const response = await fetch(`/api/seat-availability?${query.toString()}`);
    if (!response.ok) throw new Error('ไม่สามารถโหลดสถานะที่นั่งได้');
    const body = await response.json();
    return { taken: body?.data?.taken ?? [], held: body?.data?.held ?? [] };
  },

  async holdSeats(params: { concertId: string; zoneId: string; seats: string[]; holdToken: string }): Promise<{ expiresAt: string }> {
    const response = await fetch('/api/seat-holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concert_id: params.concertId,
        zone_id: params.zoneId,
        seats: params.seats,
        hold_token: params.holdToken,
      }),
    });
    if (response.status === 409) {
      const body = await response.json().catch(() => ({}));
      throw new SeatConflictError(
        body?.error || 'ที่นั่งบางที่ถูกลูกค้าคนอื่นเลือกไปแล้ว กรุณาเลือกที่นั่งใหม่',
        body?.conflict_seats ?? [],
      );
    }
    if (!response.ok) throw new Error('ไม่สามารถล็อกที่นั่งได้');
    const body = await response.json();
    return { expiresAt: body?.data?.expires_at ?? '' };
  },

  async releaseSeats(holdToken: string): Promise<void> {
    const query = new URLSearchParams({ hold_token: holdToken });
    await fetch(`/api/seat-holds?${query.toString()}`, { method: 'DELETE' });
  },
};
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/utils/seatAvailability.test.ts src/api/seatHoldApi.test.ts
```

Expected: PASS ทั้ง 10 เคส

- [ ] **Step 7: เขียนรหัสผู้จองประจำแท็บ**

สร้าง `frontend/src/utils/seatHoldToken.ts`:

```ts
const STORAGE_KEY = 'octavia.seatHoldToken';

// เก็บใน sessionStorage เพราะล็อกเป็นของ "การซื้อครั้งนี้ในแท็บนี้" ไม่ใช่ของบัญชี
// (ลูกค้าจองได้โดยยังไม่ล็อกอิน จะใช้ user id อย่างเดียวไม่ได้)
let fallbackToken = '';

export function getSeatHoldToken(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const token = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    // โหมดส่วนตัวบางเบราว์เซอร์เขียน sessionStorage ไม่ได้ ต้องไม่ให้ทุกคนใช้รหัสเดียวกัน
    // ไม่งั้นจะแย่งปลดล็อกที่นั่งของกันเอง
    if (!fallbackToken) {
      fallbackToken = `hold-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    }
    return fallbackToken;
  }
}
```

- [ ] **Step 8: เขียน hook โหลดสถานะ + poll**

สร้าง `frontend/src/hooks/useSeatAvailability.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { seatHoldApi, type SeatAvailability } from '@/api/seatHoldApi';

const POLL_INTERVAL_MS = 10000;

/** โหลดสถานะที่นั่งจากเซิร์ฟเวอร์ตอนเข้าหน้า แล้วถามซ้ำเรื่อย ๆ เพื่อให้เห็นที่นั่งที่คนอื่นเพิ่งจอง */
export function useSeatAvailability(concertId: string, zoneId: string, holdToken: string, intervalMs = POLL_INTERVAL_MS) {
  const [availability, setAvailability] = useState<SeatAvailability>({ taken: [], held: [] });

  const refresh = useCallback(async () => {
    if (!concertId || !zoneId) return;
    try {
      setAvailability(await seatHoldApi.getAvailability(concertId, zoneId, holdToken));
    } catch {
      // เน็ตสะดุดรอบเดียวไม่ควรเด้ง error ใส่หน้าจอ รอบถัดไปอีก 10 วินาทีค่อยลองใหม่
    }
  }, [concertId, zoneId, holdToken]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { availability, refresh };
}
```

- [ ] **Step 9: ตรวจ type และรันเทสต์ทั้งชุด**

```bash
cd frontend && npx tsc -b && npm test -- --run
```

Expected: ไม่มี error ใหม่ในไฟล์ที่เพิ่ม (error เดิมเรื่อง `axios` ใน `services/https/*` และตัวพิมพ์ใหญ่/เล็กของโฟลเดอร์ `Poster`/`LOGO` ยังอยู่ ไม่ต้องแก้), เทสต์ทั้งหมด PASS

- [ ] **Step 10: Commit**

```bash
git add frontend/src/utils/seatHoldToken.ts frontend/src/api/seatHoldApi.ts frontend/src/api/seatHoldApi.test.ts frontend/src/utils/seatAvailability.ts frontend/src/utils/seatAvailability.test.ts frontend/src/hooks/useSeatAvailability.ts
git commit -m "feat(frontend): add seat availability client, merge rule and polling hook"
```

---

### Task 5: ต่อหน้าเลือกที่นั่งเข้ากับล็อกจริง

จบงานนี้แล้วลูกค้าสองคนจะแย่งที่นั่งกันไม่ได้อีก

**Files:**
- Modify: `frontend/src/components/SeatSelection/constants.ts:32-49`
- Modify: `frontend/src/api/bookingPaymentApi.ts:100-180`
- Test: `frontend/src/api/bookingPaymentApi.test.ts` (สร้างใหม่)
- Modify: `frontend/src/pages/Customer/SeatSelection/index.tsx`

**Interfaces:**
- Consumes: `getSeatHoldToken()`, `seatHoldApi`, `SeatConflictError`, `applySeatAvailability`, `useSeatAvailability` (Task 4), `LOCK_DURATION` (ของเดิม)
- Produces: `class BookingConflictError extends Error` (จาก `@/api/bookingPaymentApi`) และ `createBooking` รับ field ใหม่ `holdToken?: string`

- [ ] **Step 1: เขียนเทสต์ของ createBooking ที่ยังไม่ผ่าน**

สร้าง `frontend/src/api/bookingPaymentApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingConflictError, bookingPaymentApi } from '@/api/bookingPaymentApi';

const bookingInput = {
    concertId: 'CC0001',
    concertTitle: 'Neon Flux Festival 2024',
    zoneId: 'A1',
    tierName: 'โซน A',
    seats: ['A1'],
    quantity: 1,
    unitPrice: 2000,
    discountAmount: 0,
    totalPrice: 2000,
    customerName: 'ลูกค้าทดสอบ',
    customerEmail: 'test@example.test',
    customerPhone: '0800000000',
    holdToken: 'my-token',
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('bookingPaymentApi.createBooking', () => {
    it('sends the hold token so the server can claim the seats it locked', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ data: { booking_id: 'BK-1', concert_id: 'CC0001', zone_id: 'A1', quantity: 1, status: 'under_review', booking_date: '2026-09-10' } }), { status: 201 }),
        );

        await bookingPaymentApi.createBooking(bookingInput);

        const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        expect(body.hold_token).toBe('my-token');
    });

    it('surfaces a seat conflict instead of pretending the booking succeeded offline', async () => {
        // ก่อนหน้านี้ catch ครอบทุก error แล้วไปสร้าง booking ใน local store
        // ลูกค้าจึงเห็นว่า "จองสำเร็จ" ทั้งที่ที่นั่งถูกคนอื่นเอาไปแล้ว
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ error: 'การล็อกที่นั่งหมดอายุหรือถูกคนอื่นจองไปแล้ว กรุณาเลือกที่นั่งใหม่' }), { status: 409 }),
        );

        await expect(bookingPaymentApi.createBooking(bookingInput)).rejects.toBeInstanceOf(BookingConflictError);
    });

    it('still falls back to the local store when the backend cannot be reached at all', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

        const record = await bookingPaymentApi.createBooking(bookingInput);

        expect(record.id).toBeTruthy();
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/api/bookingPaymentApi.test.ts
```

Expected: FAIL — `BookingConflictError` ยังไม่ถูก export และเคส 409 จะได้ booking จาก local fallback แทนที่จะ throw

- [ ] **Step 3: แก้ createBooking ให้แยก 409 ออกจาก fallback**

ใน `frontend/src/api/bookingPaymentApi.ts` เพิ่ม class นี้ต่อจากบล็อก import ที่หัวไฟล์:

```ts
/** เซิร์ฟเวอร์ปฏิเสธการจองเพราะที่นั่งถูกคนอื่นเอาไปแล้ว ห้ามตกไปสร้าง booking ใน local store */
export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingConflictError';
  }
}
```

เพิ่ม field ใน object ที่ `createBooking` รับ (ต่อจาก `slipDataUrl?: string;`):

```ts
    holdToken?: string;
```

เพิ่มบรรทัดนี้ใน `JSON.stringify({...})` ของ request body (ต่อจาก `slip_data_url: data.slipDataUrl,`):

```ts
          hold_token: data.holdToken,
```

แทนบล็อกเช็ค response เดิม

```ts
      if (!res.ok) {
        throw new Error('บันทึกการจองไม่สำเร็จ');
      }
```

ด้วย

```ts
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        throw new BookingConflictError(body?.error || 'ที่นั่งถูกลูกค้าคนอื่นจองไปแล้ว กรุณาเลือกที่นั่งใหม่');
      }
      if (!res.ok) {
        throw new Error('บันทึกการจองไม่สำเร็จ');
      }
```

และแก้บรรทัด `} catch {` ของ `createBooking` (บรรทัด 153) ให้เป็น

```ts
    } catch (error) {
      // เซิร์ฟเวอร์ปฏิเสธ ≠ ต่อเซิร์ฟเวอร์ไม่ได้ — อย่างแรกต้องเด้งให้ลูกค้าเห็น
      if (error instanceof BookingConflictError) throw error;
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/api/bookingPaymentApi.test.ts
```

Expected: PASS ทั้ง 3 เคส

- [ ] **Step 5: เอาชุดที่นั่งจองปลอมออก**

ใน `frontend/src/components/SeatSelection/constants.ts` แทน `generateSeats` ทั้งฟังก์ชัน (บรรทัด 31-49) ด้วย:

```ts
// สร้างที่นั่ง 5 แถว x 8 ที่นั่ง — ทุกใบเริ่มต้นว่าง
// ใบไหนไม่ว่างเซิร์ฟเวอร์เป็นคนบอกผ่าน /api/seat-availability
export const generateSeats = (): SeatData[] => {
    const rows = ['A', 'B', 'C', 'D', 'E'];
    const seats: SeatData[] = [];

    rows.forEach((row) => {
        for (let i = 1; i <= 8; i++) {
            seats.push({
                id: `${row}${i}`,
                row: row,
                number: i,
                status: 'available',
            });
        }
    });
    return seats;
};
```

- [ ] **Step 6: ต่อหน้าเลือกที่นั่งเข้ากับเซิร์ฟเวอร์**

6.1 ใน `frontend/src/pages/Customer/SeatSelection/index.tsx` เพิ่ม import ต่อจาก `import { pulse } from '@/assets/Poster';`:

```tsx
import { Alert } from '@mui/material';
import { getSeatHoldToken } from '@/utils/seatHoldToken';
import { seatHoldApi, SeatConflictError } from '@/api/seatHoldApi';
import { applySeatAvailability } from '@/utils/seatAvailability';
import { useSeatAvailability } from '@/hooks/useSeatAvailability';
import { BookingConflictError } from '@/api/bookingPaymentApi';
```

6.2 เพิ่ม state และการดึงสถานะ ต่อจากบรรทัด `const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);`:

```tsx
    const [seatError, setSeatError] = useState('');
    const holdToken = useMemo(() => getSeatHoldToken(), []);
    const { availability, refresh: refreshAvailability } = useSeatAvailability(id || '', zone || '', holdToken);

    useEffect(() => {
        setSeats((previous) => applySeatAvailability(previous, availability));
    }, [availability]);
```

6.3 แทน `handleLockSeats` ทั้งฟังก์ชันด้วยเวอร์ชันที่คุยกับเซิร์ฟเวอร์:

```tsx
    const handleLockSeats = async () => {
        if (selectedSeats.length === 0) {
            setSeatError('กรุณาเลือกที่นั่งอย่างน้อย 1 ที่นั่ง');
            return;
        }
        setSeatError('');
        try {
            const { expiresAt } = await seatHoldApi.holdSeats({
                concertId: id || '',
                zoneId: zone || '',
                seats: selectedSeats.map((seat) => seat.id),
                holdToken,
            });
            setSeats((previous) =>
                previous.map((seat) => ({
                    ...seat,
                    status: seat.status === 'selected' ? 'locked' : seat.status,
                }))
            );
            // ยึดเวลาหมดอายุจากเซิร์ฟเวอร์ กันนาฬิกาเครื่องลูกค้าเพี้ยน
            const secondsLeft = Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000);
            setTimeLeft(Number.isFinite(secondsLeft) && secondsLeft > 0 ? secondsLeft : LOCK_DURATION);
            setIsLocked(true);
            setActiveStep(2);
        } catch (reason) {
            if (reason instanceof SeatConflictError) {
                setSeatError(`${reason.message} (${reason.conflictSeats.join(', ')})`);
            } else {
                setSeatError('ล็อกที่นั่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
            }
            await refreshAvailability();
        }
    };
```

6.4 แทน `handleLockExpired` และ `handleCancelLock` ให้ปล่อยล็อกฝั่งเซิร์ฟเวอร์ด้วย:

```tsx
    const handleLockExpired = () => {
        void seatHoldApi.releaseSeats(holdToken);
        setSeats((prev) =>
            prev.map((seat) => ({
                ...seat,
                status: seat.status === 'locked' ? 'available' : seat.status,
            }))
        );
        setIsLocked(false);
        setActiveStep(1);
        setShowExpiredDialog(true);
    };

    const handleCancelLock = () => {
        clearTimer();
        void seatHoldApi.releaseSeats(holdToken);
        setSeats((prev) =>
            prev.map((seat) => ({
                ...seat,
                status: seat.status === 'locked' ? 'available' : seat.status,
            }))
        );
        setIsLocked(false);
        setTimeLeft(LOCK_DURATION);
        setActiveStep(1);
    };
```

6.5 ใน `handleSubmitPayment` ส่ง `holdToken` ไปด้วยและรับมือกรณีที่นั่งหลุด — แทนบล็อกตั้งแต่ `const record = await bookingPaymentApi.createBooking({` จนถึง `setShowSuccessDialog(true);` ด้วย:

```tsx
        try {
            const record = await bookingPaymentApi.createBooking({
                concertId: id || '2',
                concertTitle: event.title,
                eventDate: event.eventDate,
                location: event.location,
                zoneId: zone || 'A1',
                tierName: zoneInfo.label,
                seats: seatLabels,
                quantity: activeSeats.length,
                unitPrice: zoneInfo.price,
                discountAmount: discountAmount,
                totalPrice: finalPrice,
                customerName: paymentData.customerName,
                customerEmail: paymentData.customerEmail,
                customerPhone: paymentData.customerPhone,
                userId: session?.userId,
                slipFileName: paymentData.slipFileName,
                slipDataUrl: paymentData.slipDataUrl,
                holdToken,
            });
            setLatestBookingId(record.id);
            setShowSuccessDialog(true);
        } catch (reason) {
            setSeatError(reason instanceof BookingConflictError
                ? reason.message
                : 'บันทึกการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
            setActiveStep(1);
            // ที่นั่งของลูกค้าคนนี้ถูกตั้งเป็น 'reserved' ไปแล้วก่อนหน้านี้ในฟังก์ชันนี้ (ตอนส่งสลิป)
            // เพื่อกันคลิกซ้ำระหว่างรอผล — applySeatAvailability จะดึงสถานะจริงจากเซิร์ฟเวอร์กลับมา
            // แทนที่ 'reserved' นี้เอง (คืนเป็น available/locked/reserved ตามที่นั่งจริง) ไม่ต้องเซ็ตเอง
            await refreshAvailability();
        }
```

6.6 แสดงข้อความ error เหนือผังที่นั่ง — เพิ่มก่อน `<SeatMap` ในบล็อก JSX:

```tsx
                    {seatError !== '' && (
                        <Alert severity="warning" onClose={() => setSeatError('')} sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
                            {seatError}
                        </Alert>
                    )}
```

6.7 ปุ่มล็อกที่นั่งเป็น async แล้ว — แก้ prop ที่ส่งให้ `OrderSummary` จาก `handleLockSeats={handleLockSeats}` เป็น:

```tsx
                        handleLockSeats={() => { void handleLockSeats(); }}
```

- [ ] **Step 7: ตรวจ type, lint และเทสต์ทั้งชุด**

```bash
cd frontend && npx tsc -b && npm run lint && npm test -- --run
```

Expected: ไม่มี error ใหม่ในไฟล์ที่แก้, lint exit 0, เทสต์ทั้งหมด PASS

- [ ] **Step 8: ตรวจของจริงด้วยสองแท็บ — นี่คือข้อพิสูจน์ว่าโจทย์ถูกแก้แล้ว**

รัน backend (`cd backend && go run ./cmd/server`) และ frontend (`cd frontend && npm run dev`) ให้ครบ

1. เปิดแท็บที่ 1 ไปที่ `http://localhost:5173/event/CC0001/seats/A1` เลือกที่นั่ง `A1` แล้วกด "ล็อกที่นั่ง"
2. เปิดแท็บที่ 2 (แท็บใหม่ = `hold_token` คนละตัว) ไปหน้าเดียวกัน
   - ที่นั่ง `A1` ต้องขึ้นเป็นสีส้มมีรูปกุญแจ (ล็อคชั่วคราว) และกดไม่ได้ **ภายใน 10 วินาที** โดยไม่ต้องรีเฟรช
3. ในแท็บที่ 2 ลองเลือก `A1` — ต้องกดไม่ติด
4. กลับไปแท็บที่ 1 กด "ยกเลิก" → ภายใน 10 วินาที แท็บที่ 2 ต้องเห็น `A1` กลับมาว่าง
5. แท็บที่ 1 ล็อก `A1` ใหม่ แล้วส่งสลิปจนขึ้น "จองสำเร็จ" → แท็บที่ 2 ต้องเห็น `A1` เป็นสีเทา "ถูกจองแล้ว"
6. เช็ค `read_console_messages` ว่าไม่มี error

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/SeatSelection/constants.ts frontend/src/api/bookingPaymentApi.ts frontend/src/api/bookingPaymentApi.test.ts frontend/src/pages/Customer/SeatSelection/index.tsx
git commit -m "feat(frontend): lock seats other customers already took"
```

---

## Notes for the executor

- **ทำไมต้องมี `hold_token` ทั้งที่มีระบบล็อกอิน:** หน้าจองไม่บังคับล็อกอิน (`createBooking` รับ `user_id` เป็น optional) ถ้าผูกล็อกกับ user id อย่างเดียว ลูกค้าที่ยังไม่ล็อกอินจะแชร์ล็อกกันหมด
- **ชื่อโซนกับชื่อที่นั่งซ้ำกัน** — โซนใน URL คือ `A1`–`C4` และที่นั่งในผังก็ชื่อ `A1`–`E8` เหมือนกัน แต่ไม่ชนกันเพราะทุก query กรองด้วย `(concert_id, zone_id)` ก่อนเสมอ อย่าเผลอเทียบ `seat_label` ข้ามโซน
- **`LOCK_DURATION` (900 วินาที) กับ `seatHoldDuration` (15 นาที) ต้องตรงกัน** ถ้าจะเปลี่ยนต้องแก้ทั้งสองที่ ตัวเลขที่ลูกค้าเห็นนับถอยหลังยึดจาก `expires_at` ที่เซิร์ฟเวอร์ตอบกลับมาอยู่แล้ว
- **ที่นั่งของการจองที่ถูกฝ่ายขายปฏิเสธจะยังค้างเป็น taken** — เป็นข้อจำกัดที่ระบุไว้ในหัวข้อนอกขอบเขตของ spec ถ้าเจอตอนทดสอบแล้วรู้สึกว่าผิด ให้ยืนยันกับเจ้าของงานก่อน อย่าเพิ่งแก้เอง
- **เทสต์ integration ทั้งหมดใช้ schema แยกของตัวเอง** (`managementTestDB`) จึงไม่ไปแตะข้อมูลจริงในเครื่อง แต่ต้องมี PostgreSQL รันอยู่จริง
