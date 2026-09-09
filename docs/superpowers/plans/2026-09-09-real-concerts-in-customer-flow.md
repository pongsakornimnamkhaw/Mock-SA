# Real Concerts in Customer Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้หน้ารวมคอนเสิร์ตและช่องค้นหาฝั่งลูกค้าดึงคอนเสิร์ตจริงจากฐานข้อมูล เพื่อให้ลูกค้ากดตามปกติแล้วไปถึงคอนเสิร์ตที่มีโปรโมชั่นและเลือกโปรโมชั่นได้

**Architecture:** เพิ่ม endpoint `GET /api/customer/concerts` ใน handler กลุ่มเดิม (`customerAccountHandler`) ที่คืนคอนเสิร์ตที่ยังไม่ถูกยกเลิก เรียงตามวันเริ่มงาน โดยใช้ DTO และตัวกรองสถานะตัวเดียวกับ `GET /api/customer/concerts/:id` ฝั่ง frontend เพิ่มเมธอดใน API client เดิม แปลงข้อมูลเป็น `CustomerEvent` (interface เดิม) ผ่าน mapper ที่เทสต์ได้ แล้วให้ `EventList` กับ `CustomerHeader` ดึงผ่าน hook ตัวเดียวกัน — JSX ของทั้งสองที่ไม่ต้องแก้เพราะรูปร่างข้อมูลเหมือนเดิม

**Tech Stack:** Go 1.26 + Fiber v2 + GORM (backend) · React 19 + TypeScript + MUI v9 + Vite 8 (frontend) · Vitest 4 + @testing-library/react (เทสต์ frontend)

**Spec:** `docs/superpowers/specs/2026-09-09-real-concerts-in-customer-flow.md`

## Global Constraints

- ข้อความที่ผู้ใช้เห็นทุกจุดเป็นภาษาไทย ให้เข้ากับข้อความเดิมในไฟล์เดียวกัน
- Backend ตอบ error ด้วย `customerError(c, status, message)` เท่านั้น (รูปแบบ `{"error": "..."}`) — ห้ามเปลี่ยนรูปแบบ
- ห้ามเปลี่ยน shape ของ `customerPromotionConcertDTO` / `CustomerPromotionConcert` — `GET /concerts/:id` และหน้า EventDetail/ZoneSelection/SeatSelection ใช้ร่วมกันอยู่
- ห้ามเปลี่ยน shape ของ `CustomerEvent` — `EventList`, `CustomerHeader`, `CustomerConcertNotifications` ใช้ร่วมกัน
- ห้ามแตะ `frontend/src/services/https/*` และ `frontend/src/hooks/useConcerts.ts` (dead code ที่ import `axios` ซึ่งไม่ได้ติดตั้ง เป็นต้นเหตุ error เดิมของ `tsc -b`)
- Import ฝั่ง frontend ใช้ alias `@/` (ตั้งไว้ที่ `frontend/vite.config.ts`)
- คำสั่งทั้งหมดรันจาก `D:\SA\Mock-test\Mock-SA` (backend: `cd backend`, frontend: `cd frontend`)
- เครื่องนี้มี Application Control policy ที่บล็อก test binary ของ Go เป็นครั้งคราว ถ้าเจอ `An Application Control policy has blocked this file` ให้ตั้ง `export GOTMPDIR=/d/gotmp` (สร้างโฟลเดอร์ก่อนถ้ายังไม่มี) แล้วรันซ้ำ — ไม่ใช่ความผิดของโค้ด
- เทสต์ integration ฝั่ง Go ต้องมี PostgreSQL รันอยู่ (`docker compose up -d postgres` ใน `backend/`) และตั้ง `MANAGEMENT_INTEGRATION_TEST=1`
- ห้ามใส่บรรทัด attribution ใน commit message

## File Structure

**Backend**
- `backend/internal/handlers/customer_concerts.go` (สร้าง) — ตัวกรอง/เรียงลำดับที่เทสต์ได้ + handler `listCustomerConcerts`
- `backend/internal/handlers/customer_concerts_test.go` (สร้าง) — เทสต์ unit ของตัวกรอง + เทสต์ integration ผ่าน HTTP จริง
- `backend/internal/handlers/customer_account.go` (แก้ บรรทัด 94) — ลงทะเบียน route ใหม่

**Frontend**
- `frontend/src/api/customerPromotionApi.ts` (แก้) — เพิ่ม `listConcerts()`
- `frontend/src/utils/customerPromotion.ts` (แก้) — เพิ่ม `formatThaiDateRange()`
- `frontend/src/utils/customerConcertCard.ts` (สร้าง) — แปลง `CustomerPromotionConcert` → `CustomerEvent` + เลือกรูปสำรอง
- `frontend/src/utils/customerConcertCard.test.ts` (สร้าง)
- `frontend/src/hooks/useCustomerConcerts.ts` (สร้าง) — โหลดรายการคอนเสิร์ตพร้อมสถานะ loading/error ใช้ร่วมกันสองที่
- `frontend/src/components/posterShow/posterShow.tsx` (แก้) — ดึงจาก hook แทน mock
- `frontend/src/components/posterShow/posterShow.test.tsx` (สร้าง)
- `frontend/src/components/common/CustomerHeader.tsx` (แก้ บรรทัด 13, 40–44) — ช่องค้นหาใช้ hook เดียวกัน
- `frontend/src/components/common/CustomerHeader.test.tsx` (สร้าง)

`frontend/src/data/customerEvents.ts` **ไม่ลบ** — กระดิ่งแจ้งเตือนยังใช้อยู่ (ดูหัวข้อนอกขอบเขตใน spec)

---

### Task 1: Backend — endpoint รายการคอนเสิร์ตฝั่งลูกค้า

**Files:**
- Create: `backend/internal/handlers/customer_concerts.go`
- Test: `backend/internal/handlers/customer_concerts_test.go`
- Modify: `backend/internal/handlers/customer_account.go:94`

**Interfaces:**
- Consumes: `customerPromotionConcertDTO`, `customerConcertView(concert models.Concert) customerPromotionConcertDTO`, `customerConcertCancelled(status string) bool` (ทั้งหมดอยู่ใน `customer_promotions.go`), `customerError(c *fiber.Ctx, status int, message string) error`, `customerAccountHandler{db, mailer, baseURL}`, `registerCustomerAccountRoutes(app *fiber.App, db *gorm.DB, sender mailer.Mailer, baseURL string)`, `managementTestDB(t *testing.T) *gorm.DB`, `customerTestRequest(t *testing.T, app *fiber.App, method, path string, payload any, cookie *http.Cookie, expectedStatus int) *http.Response`
- Produces:
  - `func bookableCustomerConcerts(rows []models.Concert) []customerPromotionConcertDTO` — ตัดคอนเสิร์ตที่ยกเลิกออก แล้วเรียงตาม `start_date` น้อยไปมาก
  - `func (h *customerAccountHandler) listCustomerConcerts(c *fiber.Ctx) error`
  - HTTP: `GET /api/customer/concerts` → `{"data": [...]}`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/customer_concerts_test.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"testing"

	"backend/internal/mailer"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestBookableCustomerConcertsHidesCancelledAndSortsByStartDate(t *testing.T) {
	rows := []models.Concert{
		{ConcertID: "CC_LATE", ConcertName: "งานปลายปี", StartDate: "2026-12-01", EndDate: "2026-12-02", StartTime: "18:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว"},
		{ConcertID: "CC_CANCELLED", ConcertName: "งานที่ยกเลิก", StartDate: "2026-01-01", EndDate: "2026-01-02", StartTime: "18:00:00", Location: "กรุงเทพฯ", Status: "ยกเลิกการจัด"},
		{ConcertID: "CC_EARLY", ConcertName: "งานต้นปี", StartDate: "2026-02-01", EndDate: "2026-02-02", StartTime: "18:00:00", Location: "เชียงใหม่", Status: "ยืนยันแล้ว"},
		{ConcertID: "CC_POSTPONED", ConcertName: "งานที่เลื่อน", StartDate: "2026-06-01", EndDate: "2026-06-02", StartTime: "18:00:00", Location: "ขอนแก่น", Status: "เลื่อนการจัด"},
	}

	got := bookableCustomerConcerts(rows)

	ids := make([]string, 0, len(got))
	for _, view := range got {
		ids = append(ids, view.ConcertID)
	}
	want := []string{"CC_EARLY", "CC_POSTPONED", "CC_LATE"}
	if len(ids) != len(want) {
		t.Fatalf("ได้ %v อยากได้ %v", ids, want)
	}
	for i := range want {
		if ids[i] != want[i] {
			t.Fatalf("ลำดับผิด: ได้ %v อยากได้ %v", ids, want)
		}
	}
}

func TestBookableCustomerConcertsReturnsEmptySliceNotNil(t *testing.T) {
	got := bookableCustomerConcerts(nil)
	if got == nil {
		t.Fatal("ต้องคืน slice ว่าง ไม่ใช่ nil มิฉะนั้น JSON จะกลายเป็น null")
	}
	if len(got) != 0 {
		t.Fatalf("ไม่มีข้อมูลเข้า ต้องได้ 0 รายการ แต่ได้ %d", len(got))
	}
}

func TestCustomerConcertListEndpointReturnsBookableConcerts(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	registerCustomerAccountRoutes(app, db, mailer.LogMailer{}, "http://localhost:5173")

	seed := []models.Concert{
		{ConcertID: "CCLIST_B", ConcertName: "คอนเสิร์ตลำดับสอง", StartDate: "2026-11-05", EndDate: "2026-11-06", StartTime: "19:00:00", EndTime: "22:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว", MoreInfo: "ข้อมูลเพิ่มเติม"},
		{ConcertID: "CCLIST_A", ConcertName: "คอนเสิร์ตลำดับแรก", StartDate: "2026-10-05", EndDate: "2026-10-06", StartTime: "19:00:00", EndTime: "22:00:00", Location: "เชียงใหม่", Status: "ยืนยันแล้ว", MoreInfo: "ข้อมูลเพิ่มเติม"},
		{ConcertID: "CCLIST_X", ConcertName: "คอนเสิร์ตที่ยกเลิก", StartDate: "2026-09-05", EndDate: "2026-09-06", StartTime: "19:00:00", EndTime: "22:00:00", Location: "ขอนแก่น", Status: "ยกเลิกการจัด", MoreInfo: "ข้อมูลเพิ่มเติม"},
	}
	if err := db.Create(&seed).Error; err != nil {
		t.Fatal(err)
	}

	response := customerTestRequest(t, app, http.MethodGet, "/api/customer/concerts", nil, nil, http.StatusOK)
	var payload struct {
		Data []customerPromotionConcertDTO `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}

	positions := map[string]int{}
	for index, view := range payload.Data {
		positions[view.ConcertID] = index
	}
	if _, listed := positions["CCLIST_X"]; listed {
		t.Fatal("คอนเสิร์ตที่ยกเลิกต้องไม่อยู่ในรายการ")
	}
	first, hasFirst := positions["CCLIST_A"]
	second, hasSecond := positions["CCLIST_B"]
	if !hasFirst || !hasSecond {
		t.Fatalf("ต้องเจอคอนเสิร์ตที่ seed ไว้ทั้งสองรายการ: %#v", positions)
	}
	if first >= second {
		t.Fatal("ต้องเรียงตามวันเริ่มงาน งานที่ใกล้ถึงขึ้นก่อน")
	}
	for _, view := range payload.Data {
		if view.ConcertID == "CCLIST_A" && view.Location != "เชียงใหม่" {
			t.Fatalf("ข้อมูลคอนเสิร์ตไม่ครบ: %#v", view)
		}
	}
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd backend && go test ./internal/handlers/ -run "CustomerConcert|BookableCustomerConcerts" -v
```

Expected: FAIL — compile error `undefined: bookableCustomerConcerts`

- [ ] **Step 3: เขียน implementation**

สร้าง `backend/internal/handlers/customer_concerts.go`:

```go
package handlers

import (
	"sort"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// bookableCustomerConcerts คัดเฉพาะคอนเสิร์ตที่ลูกค้ายังเข้าดู/จองได้
// (ตัดที่ยกเลิกการจัดออก ใช้กติกาเดียวกับ GET /concerts/:id) แล้วเรียงให้งานที่
// ใกล้ถึงขึ้นก่อน
func bookableCustomerConcerts(rows []models.Concert) []customerPromotionConcertDTO {
	views := make([]customerPromotionConcertDTO, 0, len(rows))
	for _, concert := range rows {
		if customerConcertCancelled(concert.Status) {
			continue
		}
		views = append(views, customerConcertView(concert))
	}
	sort.SliceStable(views, func(left, right int) bool {
		return views[left].StartDate < views[right].StartDate
	})
	return views
}

func (h *customerAccountHandler) listCustomerConcerts(c *fiber.Ctx) error {
	var rows []models.Concert
	if err := h.db.Find(&rows).Error; err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดคอนเสิร์ตได้")
	}
	return c.JSON(fiber.Map{"data": bookableCustomerConcerts(rows)})
}
```

หมายเหตุ: `StartDate` ใน DTO เป็นสตริงรูปแบบ `YYYY-MM-DD` (ผ่าน `dateOnly()` มาแล้ว)
จึงเรียงด้วยการเทียบสตริงตรงๆ ได้ถูกต้อง

- [ ] **Step 4: รันเทสต์ unit ให้ผ่าน**

```bash
cd backend && go test ./internal/handlers/ -run "BookableCustomerConcerts" -v
```

Expected: PASS ทั้ง 2 เคส (เคส integration จะขึ้น SKIP เพราะยังไม่ได้ตั้ง env)

- [ ] **Step 5: ลงทะเบียน route**

แก้ `backend/internal/handlers/customer_account.go` บรรทัด 94 จาก

```go
	group.Get("/concerts/:id", h.getCustomerConcert)
```

เป็น

```go
	group.Get("/concerts", h.listCustomerConcerts)
	group.Get("/concerts/:id", h.getCustomerConcert)
```

- [ ] **Step 6: รันเทสต์ integration กับ PostgreSQL จริง**

```bash
cd backend && docker compose up -d postgres && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -run "CustomerConcert" -v
```

Expected: PASS — `TestCustomerConcertListEndpointReturnsBookableConcerts` ไม่ SKIP แล้ว

- [ ] **Step 7: build + รันเทสต์ทั้ง package**

```bash
cd backend && go build ./... && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -count=1
```

Expected: build สำเร็จ, `ok  	backend/internal/handlers`

- [ ] **Step 8: ตรวจ endpoint ด้วยของจริง**

รัน backend (ถ้ายังไม่ได้รัน) แล้วยิง:

```bash
curl -s http://127.0.0.1:8080/api/customer/concerts
```

Expected: JSON `{"data":[...]}` มี `CC0001` (Riverside Sound Festival) และ `CC0002`
(Neon Nights Vol.3) แต่ **ไม่มี** `CC0003` (Acoustic Sessions: Bangkok — ยกเลิกการจัด)
และ `CC0001` มาก่อน `CC0002`

- [ ] **Step 9: Commit**

```bash
git add backend/internal/handlers/customer_concerts.go backend/internal/handlers/customer_concerts_test.go backend/internal/handlers/customer_account.go
git commit -m "feat(backend): add customer concert list endpoint"
```

---

### Task 2: Frontend — API client + ตัวแปลงคอนเสิร์ตเป็นการ์ด

งานนี้เป็นตรรกะล้วน ไม่แตะ UI — จบแล้วยังไม่มีอะไรเปลี่ยนบนหน้าจอ

**Files:**
- Modify: `frontend/src/api/customerPromotionApi.ts`
- Modify: `frontend/src/api/customerPromotionApi.test.ts` (เพิ่ม describe block ใหม่ท้ายไฟล์)
- Modify: `frontend/src/utils/customerPromotion.ts` (เพิ่ม `formatThaiDateRange`)
- Create: `frontend/src/utils/customerPromotion.test.ts`
- Create: `frontend/src/utils/customerConcertCard.ts`
- Test: `frontend/src/utils/customerConcertCard.test.ts`

**Interfaces:**
- Consumes: `GET /api/customer/concerts` (Task 1), `request<T>(path)` (private helper เดิมใน `customerPromotionApi.ts`), `CustomerPromotionConcert` จาก `@/types/customerPromotion`, `CustomerEvent` จาก `@/data/customerEvents`, `formatThaiDate` จาก `@/utils/customerPromotion`, รูปโปสเตอร์ `{ celestial, flux, pulse, starlight }` จาก `@/assets/Poster`
- Produces:
  - `customerPromotionApi.listConcerts(): Promise<{ data: CustomerPromotionConcert[] }>`
  - `formatThaiDateRange(startDate: string, endDate: string): string` (จาก `@/utils/customerPromotion`)
  - `posterForConcert(concert: CustomerPromotionConcert): string` (จาก `@/utils/customerConcertCard`)
  - `toCustomerEvent(concert: CustomerPromotionConcert): CustomerEvent` (จาก `@/utils/customerConcertCard`)

- [ ] **Step 1: เขียนเทสต์ของ API client ที่ยังไม่ผ่าน**

เพิ่มท้ายไฟล์ `frontend/src/api/customerPromotionApi.test.ts`:

```ts
describe('customerPromotionApi.listConcerts', () => {
    it('requests the customer concert list endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(200, { data: [{ concert_id: 'CC0001', concert_name: 'Riverside Sound Festival' }] }),
        );

        const result = await customerPromotionApi.listConcerts();

        expect(result.data).toHaveLength(1);
        expect(result.data[0].concert_id).toBe('CC0001');
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/customer/concerts');
    });

    it('surfaces a server failure as an Error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(500, { error: 'ไม่สามารถโหลดคอนเสิร์ตได้' }),
        );

        await expect(customerPromotionApi.listConcerts()).rejects.toThrow('ไม่สามารถโหลดคอนเสิร์ตได้');
    });
});
```

- [ ] **Step 2: เขียนเทสต์ของ `formatThaiDateRange` ที่ยังไม่ผ่าน**

สร้าง `frontend/src/utils/customerPromotion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatThaiDate, formatThaiDateRange } from '@/utils/customerPromotion';

describe('formatThaiDateRange', () => {
    it('shows a single date when the concert starts and ends on the same day', () => {
        expect(formatThaiDateRange('2026-10-16', '2026-10-16')).toBe(formatThaiDate('2026-10-16'));
    });

    it('shows a single date when there is no end date', () => {
        expect(formatThaiDateRange('2026-10-16', '')).toBe(formatThaiDate('2026-10-16'));
    });

    it('joins both dates with an en dash when they differ', () => {
        expect(formatThaiDateRange('2026-10-16', '2026-10-18'))
            .toBe(`${formatThaiDate('2026-10-16')} – ${formatThaiDate('2026-10-18')}`);
    });
});
```

- [ ] **Step 3: เขียนเทสต์ของตัวแปลงการ์ดที่ยังไม่ผ่าน**

สร้าง `frontend/src/utils/customerConcertCard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import { formatThaiDateRange } from '@/utils/customerPromotion';
import { posterForConcert, toCustomerEvent } from '@/utils/customerConcertCard';

const makeConcert = (overrides: Partial<CustomerPromotionConcert> = {}): CustomerPromotionConcert => ({
    concert_id: 'CC0001',
    concert_name: 'Riverside Sound Festival',
    start_date: '2026-10-16',
    end_date: '2026-10-18',
    start_time: '18:00:00',
    location: 'ธันเดอร์โดม เมืองทองธานี',
    status: 'ยืนยันแล้ว',
    more_info: 'เทศกาลดนตริมแม่น้ำ',
    ...overrides,
});

describe('posterForConcert', () => {
    it('uses the poster stored on the concert when there is one', () => {
        const concert = makeConcert({ poster_data: 'data:image/png;base64,AAAA' });
        expect(posterForConcert(concert)).toBe('data:image/png;base64,AAAA');
    });

    it('always gives the same fallback poster to the same concert', () => {
        const concert = makeConcert();
        expect(posterForConcert(concert)).toBe(posterForConcert(concert));
    });

    it('gives different concerts a spread of fallback posters', () => {
        const posters = new Set(
            ['CC0001', 'CC0002', 'CC0003', 'CC0004', 'CC0005', 'CC0006'].map(
                (concertId) => posterForConcert(makeConcert({ concert_id: concertId })),
            ),
        );
        expect(posters.size).toBeGreaterThan(1);
    });

    it('still returns a usable image when the concert id is empty', () => {
        expect(posterForConcert(makeConcert({ concert_id: '' }))).toBeTruthy();
    });
});

describe('toCustomerEvent', () => {
    it('maps a concert onto the card shape the listing already renders', () => {
        const event = toCustomerEvent(makeConcert());

        expect(event.id).toBe('CC0001');
        expect(event.title).toBe('Riverside Sound Festival');
        expect(event.location).toBe('ธันเดอร์โดม เมืองทองธานี');
        expect(event.date).toBe(formatThaiDateRange('2026-10-16', '2026-10-18'));
        expect(event.image).toBeTruthy();
    });

    it('carries the concert blurb into the announcement field', () => {
        expect(toCustomerEvent(makeConcert()).announcement).toBe('เทศกาลดนตริมแม่น้ำ');
    });

    it('falls back to a generic blurb when the concert has no extra info', () => {
        const event = toCustomerEvent(makeConcert({ more_info: undefined }));
        expect(event.announcement).not.toBe('');
    });

    it('never marks a database concert as new', () => {
        // ฟิลด์ isNew ใช้กับข้อมูลประกาศจำลองเท่านั้น ฐานข้อมูลไม่มีแนวคิดนี้
        expect(toCustomerEvent(makeConcert()).isNew).toBeUndefined();
    });
});
```

- [ ] **Step 4: รันเทสต์ทั้งสามไฟล์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/api/customerPromotionApi.test.ts src/utils/customerPromotion.test.ts src/utils/customerConcertCard.test.ts
```

Expected: FAIL — `customerPromotionApi.listConcerts is not a function`, และ
`Failed to resolve import "@/utils/customerConcertCard"`

- [ ] **Step 5: เพิ่ม `listConcerts` ใน API client**

ใน `frontend/src/api/customerPromotionApi.ts` เพิ่มเมธอดต่อจาก `getConcert`:

```ts
  listConcerts: () => request<{ data: CustomerPromotionConcert[] }>('/concerts'),
```

- [ ] **Step 6: เพิ่ม `formatThaiDateRange`**

ใน `frontend/src/utils/customerPromotion.ts` เพิ่มต่อจาก `formatThaiDate`:

```ts
/** ช่วงวันจัดงาน ถ้าจบวันเดียวกับที่เริ่ม (หรือไม่มีวันจบ) แสดงวันเดียว */
export function formatThaiDateRange(startDate: string, endDate: string) {
  if (!endDate || endDate === startDate) return formatThaiDate(startDate);
  return `${formatThaiDate(startDate)} – ${formatThaiDate(endDate)}`;
}
```

- [ ] **Step 7: เขียนตัวแปลงการ์ด**

สร้าง `frontend/src/utils/customerConcertCard.ts`:

```ts
import { celestial, flux, pulse, starlight } from '@/assets/Poster';
import type { CustomerEvent } from '@/data/customerEvents';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import { formatThaiDateRange } from '@/utils/customerPromotion';

// คอนเสิร์ตในฐานข้อมูลยังไม่มีรูปโปสเตอร์ ถ้าใช้รูปสำรองรูปเดียวทุกใบ การ์ดจะ
// เหมือนกันหมดจนดูเหมือนหน้าเว็บพัง จึงกระจายรูปตาม id แบบคงที่ (คอนเสิร์ตเดิม
// ได้รูปเดิมเสมอ ไม่สลับไปมาเวลารีเฟรช)
const fallbackPosters = [flux, pulse, celestial, starlight];

export function posterForConcert(concert: CustomerPromotionConcert) {
  if (concert.poster_data) return concert.poster_data;
  let checksum = 0;
  for (const character of concert.concert_id) {
    checksum += character.codePointAt(0) ?? 0;
  }
  return fallbackPosters[checksum % fallbackPosters.length];
}

export function toCustomerEvent(concert: CustomerPromotionConcert): CustomerEvent {
  return {
    id: concert.concert_id,
    image: posterForConcert(concert),
    title: concert.concert_name,
    date: formatThaiDateRange(concert.start_date, concert.end_date),
    location: concert.location,
    announcement: concert.more_info || 'ติดตามรายละเอียดเพิ่มเติมของคอนเสิร์ตนี้ได้ที่ Octavia',
  };
}
```

- [ ] **Step 8: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/api/customerPromotionApi.test.ts src/utils/customerPromotion.test.ts src/utils/customerConcertCard.test.ts
```

Expected: PASS ทุกเคส

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api/customerPromotionApi.ts frontend/src/api/customerPromotionApi.test.ts frontend/src/utils/customerPromotion.ts frontend/src/utils/customerPromotion.test.ts frontend/src/utils/customerConcertCard.ts frontend/src/utils/customerConcertCard.test.ts
git commit -m "feat(frontend): add customer concert list API and card mapper"
```

---

### Task 3: Frontend — hook โหลดคอนเสิร์ต + หน้ารวมคอนเสิร์ตใช้ข้อมูลจริง

จบงานนี้แล้วหน้า `/home` และ `/events` จะแสดงคอนเสิร์ตจากฐานข้อมูลแทนข้อมูลปลอม

**Files:**
- Create: `frontend/src/hooks/useCustomerConcerts.ts`
- Modify: `frontend/src/components/posterShow/posterShow.tsx` (เขียนใหม่ทั้งไฟล์)
- Test: `frontend/src/components/posterShow/posterShow.test.tsx`

**Interfaces:**
- Consumes: `customerPromotionApi.listConcerts()` และ `toCustomerEvent()` (Task 2), `CustomerEvent` จาก `@/data/customerEvents`
- Produces:
  - `interface CustomerConcertsState { concerts: CustomerEvent[]; loading: boolean; error: string }`
  - `useCustomerConcerts(): CustomerConcertsState` (จาก `@/hooks/useCustomerConcerts`)
  - `EventList` ยังรับ props เดิม `{ title?: string; query?: string }` ไม่เปลี่ยน

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/components/posterShow/posterShow.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import EventList from '@/components/posterShow/posterShow';

const concert = (id: string, name: string, location: string): CustomerPromotionConcert => ({
    concert_id: id,
    concert_name: name,
    start_date: '2026-10-16',
    end_date: '2026-10-18',
    start_time: '18:00:00',
    location,
    status: 'ยืนยันแล้ว',
});

const mockConcerts = (rows: CustomerPromotionConcert[]) => vi
    .spyOn(customerPromotionApi, 'listConcerts')
    .mockResolvedValue({ data: rows });

const renderList = (query = '') => render(
    <MemoryRouter>
        <EventList query={query} />
    </MemoryRouter>,
);

afterEach(() => {
    vi.restoreAllMocks();
});

describe('EventList', () => {
    it('renders concerts loaded from the database', async () => {
        mockConcerts([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        renderList();

        expect(await screen.findByText('Riverside Sound Festival')).toBeInTheDocument();
        expect(screen.getByText('Neon Nights Vol.3')).toBeInTheDocument();
    });

    it('links each card to that concert id so the booking flow keeps the real id', async () => {
        mockConcerts([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        renderList();

        const link = await screen.findByRole('link', { name: 'ดูรายละเอียด' });
        expect(link).toHaveAttribute('href', '/event/CC0001');
    });

    it('filters by concert name and location', async () => {
        mockConcerts([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        renderList('neon');

        expect(await screen.findByText('Neon Nights Vol.3')).toBeInTheDocument();
        expect(screen.queryByText('Riverside Sound Festival')).not.toBeInTheDocument();
    });

    it('tells the customer when a search matches nothing', async () => {
        mockConcerts([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        renderList('ไม่มีคอนเสิร์ตชื่อนี้');

        expect(await screen.findByText(/ไม่พบคอนเสิร์ต/)).toBeInTheDocument();
    });

    it('tells the customer when there is no concert on sale at all', async () => {
        mockConcerts([]);

        renderList();

        expect(await screen.findByText(/ยังไม่มีคอนเสิร์ตที่เปิดจำหน่าย/)).toBeInTheDocument();
    });

    it('shows the failure reason when the concert list cannot be loaded', async () => {
        vi.spyOn(customerPromotionApi, 'listConcerts').mockRejectedValue(
            new Error('เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบเซิร์ฟเวอร์แล้วลองใหม่'),
        );

        renderList();

        expect(await screen.findByText('เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบเซิร์ฟเวอร์แล้วลองใหม่')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/components/posterShow/posterShow.test.tsx
```

Expected: FAIL — `customerPromotionApi.listConcerts is not a function` หรือหาข้อความที่คาดไม่เจอ
(คอมโพเนนต์ยังอ่านจาก mock data อยู่)

- [ ] **Step 3: เขียน hook**

สร้าง `frontend/src/hooks/useCustomerConcerts.ts`:

```ts
import { useEffect, useState } from 'react';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerEvent } from '@/data/customerEvents';
import { toCustomerEvent } from '@/utils/customerConcertCard';

export interface CustomerConcertsState {
    concerts: CustomerEvent[];
    loading: boolean;
    error: string;
}

/** โหลดคอนเสิร์ตที่เปิดให้ลูกค้าจอง ใช้ร่วมกันระหว่างหน้ารวมงานกับช่องค้นหาบนหัวเว็บ */
export function useCustomerConcerts(): CustomerConcertsState {
    const [state, setState] = useState<CustomerConcertsState>({ concerts: [], loading: true, error: '' });

    useEffect(() => {
        let active = true;
        customerPromotionApi.listConcerts()
            .then(({ data }) => {
                if (active) setState({ concerts: data.map(toCustomerEvent), loading: false, error: '' });
            })
            .catch((reason) => {
                if (!active) return;
                setState({
                    concerts: [],
                    loading: false,
                    error: reason instanceof Error ? reason.message : 'ไม่สามารถโหลดคอนเสิร์ตได้',
                });
            });
        return () => { active = false; };
    }, []);

    return state;
}
```

- [ ] **Step 4: เขียน `posterShow.tsx` ใหม่**

แทนที่ `frontend/src/components/posterShow/posterShow.tsx` ทั้งไฟล์ด้วย:

```tsx
import { Alert, Box, Typography, Button, Chip, CircularProgress, Container, Grid } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { Link as RouterLink } from 'react-router-dom';
import { useCustomerConcerts } from '@/hooks/useCustomerConcerts';

export default function EventList({ title = 'ทุกงานแสดง', query = '' }: { title?: string; query?: string }) {
  const { concerts, loading, error } = useCustomerConcerts();
  const normalizedQuery = query.trim().toLocaleLowerCase('th-TH');
  const events = normalizedQuery
    ? concerts.filter((event) => `${event.title} ${event.location}`.toLocaleLowerCase('th-TH').includes(normalizedQuery))
    : concerts;

  return (
    <Container maxWidth="xl" sx={{ py: 5, px: { xs: 2, md: 6 } }}>
      <Typography variant="h5" sx={{ mb: 4, color: '#1a1a1a', fontWeight: 'bold' }}>
        {title}
      </Typography>
      {loading ? (
        <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}>
          <CircularProgress sx={{ color: '#FF5C58' }} />
        </Box>
      ) : error !== '' ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>
      ) : events.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center', bgcolor: '#f8f9fc', borderRadius: 4 }}>
          <SearchOffRoundedIcon sx={{ fontSize: 52, color: '#a7adbf', mb: 1 }} />
          {normalizedQuery ? (
            <>
              <Typography sx={{ fontWeight: 750, color: '#343a59' }}>ไม่พบคอนเสิร์ต “{query}”</Typography>
              <Typography variant="body2" color="text.secondary">ลองค้นหาด้วยชื่อคอนเสิร์ตหรือสถานที่อื่น</Typography>
            </>
          ) : (
            <>
              <Typography sx={{ fontWeight: 750, color: '#343a59' }}>ยังไม่มีคอนเสิร์ตที่เปิดจำหน่าย</Typography>
              <Typography variant="body2" color="text.secondary">กลับมาดูใหม่อีกครั้งเร็วๆ นี้</Typography>
            </>
          )}
        </Box>
      ) : <Grid container spacing={4}>
        {events.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.id}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'transform 0.3s ease', '&:hover': { transform: 'translateY(-6px)' } }}>
              <Box sx={{ position: 'relative', width: '100%', mb: 2 }}>
                <Box component="img" src={item.image} alt={item.title} sx={{ display: 'block', width: '100%', height: '320px', objectFit: 'cover', borderRadius: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }} />
                {item.isNew && <Chip label="คอนเสิร์ตใหม่" size="small" sx={{ position: 'absolute', top: 12, left: 12, bgcolor: '#FF5C58', color: '#fff', fontWeight: 800 }} />}
              </Box>
              <Typography sx={{ mb: 0.5, color: '#1a1a1a', fontWeight: 'bold', fontSize: '1.05rem' }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{item.date}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2, color: '#555' }}>
                <LocationOnIcon sx={{ fontSize: 18, color: '#000' }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.location}</Typography>
              </Box>
              <Button component={RouterLink} to={`/event/${item.id}`} variant="contained"
                sx={{ bgcolor: '#FF5C58', color: '#fff', borderRadius: '25px', px: 4, py: 0.8, fontWeight: 'bold', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(255,92,88,0.4)', '&:hover': { bgcolor: '#e04f4a' } }}>
                ดูรายละเอียด
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>}
    </Container>
  );
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/components/posterShow/posterShow.test.tsx
```

Expected: PASS ทั้ง 6 เคส

- [ ] **Step 6: ตรวจ type และเทสต์ทั้งชุด**

```bash
cd frontend && npx tsc -b && npm test -- --run
```

Expected: `tsc` ไม่มี error ใหม่ในไฟล์ที่แก้ (error เดิมเรื่อง `axios` กับตัวพิมพ์ใหญ่/เล็กของโฟลเดอร์ `Poster`/`LOGO` ยังอยู่ ไม่ต้องแก้), เทสต์ทั้งหมด PASS

- [ ] **Step 7: ตรวจของจริงในเบราว์เซอร์**

รัน backend และ frontend ให้ครบ แล้วเปิด `http://localhost:5173/home`

ตรวจให้ครบ 3 ข้อ:
- การ์ดคอนเสิร์ตแสดง **Riverside Sound Festival** และ **Neon Nights Vol.3** (ไม่ใช่ Neon Pulse / Celestial Sounds / Starlight Festival เดิม) และ **ไม่มี** Acoustic Sessions: Bangkok
- กด "ดูรายละเอียด" แล้ว URL เป็น `/event/CC0001` ไม่ใช่ `/event/1`
- เช็ค `read_console_messages` ว่าไม่มี error

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/useCustomerConcerts.ts frontend/src/components/posterShow/posterShow.tsx frontend/src/components/posterShow/posterShow.test.tsx
git commit -m "feat(frontend): list real concerts on the customer event listing"
```

---

### Task 4: Frontend — ช่องค้นหาบนหัวเว็บใช้คอนเสิร์ตจริง + ตรวจ flow ทั้งเส้น

**Files:**
- Modify: `frontend/src/components/common/CustomerHeader.tsx` (บรรทัด 13 และ 40–44)
- Test: `frontend/src/components/common/CustomerHeader.test.tsx`

**Interfaces:**
- Consumes: `useCustomerConcerts()` (Task 3), `customerAccountApi.getAccount()` (ของเดิม — คอมโพเนนต์เรียกตอน mount เพื่อตรวจเซสชัน เทสต์ต้อง mock)
- Produces: ไม่มี export ใหม่ — `CustomerHeader` ยังเป็น default export เหมือนเดิม

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/components/common/CustomerHeader.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { customerAccountApi, CustomerApiError } from '@/api/customerAccountApi';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerPromotionConcert } from '@/types/customerPromotion';
import CustomerHeader from '@/components/common/CustomerHeader';

const concert = (id: string, name: string, location: string): CustomerPromotionConcert => ({
    concert_id: id,
    concert_name: name,
    start_date: '2026-10-16',
    end_date: '2026-10-18',
    start_time: '18:00:00',
    location,
    status: 'ยืนยันแล้ว',
});

const renderHeader = (rows: CustomerPromotionConcert[]) => {
    // หัวเว็บตรวจเซสชันตอน mount ให้ตอบเหมือนยังไม่ได้ล็อกอิน จะได้ไม่ยิง fetch จริง
    vi.spyOn(customerAccountApi, 'getAccount').mockRejectedValue(new CustomerApiError('ยังไม่ได้เข้าสู่ระบบ', 401));
    vi.spyOn(customerPromotionApi, 'listConcerts').mockResolvedValue({ data: rows });
    render(
        <MemoryRouter>
            <CustomerHeader />
        </MemoryRouter>,
    );
};

const openSearch = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'ค้นหาคอนเสิร์ต' }));
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CustomerHeader search', () => {
    it('suggests concerts loaded from the database', async () => {
        renderHeader([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        await openSearch();

        expect(await screen.findByText('Riverside Sound Festival')).toBeInTheDocument();
        expect(screen.getByText('Neon Nights Vol.3')).toBeInTheDocument();
    });

    it('no longer suggests the retired mock concerts', async () => {
        renderHeader([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        await openSearch();

        await screen.findByText('Riverside Sound Festival');
        expect(screen.queryByText('Neon Pulse')).not.toBeInTheDocument();
        expect(screen.queryByText('Starlight Festival')).not.toBeInTheDocument();
    });

    it('narrows the suggestions as the customer types', async () => {
        renderHeader([
            concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี'),
            concert('CC0002', 'Neon Nights Vol.3', 'MCC Hall เดอะมอลล์บางกะปิ'),
        ]);

        await openSearch();
        await screen.findByText('Riverside Sound Festival');
        await userEvent.type(screen.getByLabelText('ชื่อคอนเสิร์ต หรือสถานที่'), 'neon');

        expect(screen.getByText('Neon Nights Vol.3')).toBeInTheDocument();
        expect(screen.queryByText('Riverside Sound Festival')).not.toBeInTheDocument();
    });

    it('says nothing matched when the query has no result', async () => {
        renderHeader([concert('CC0001', 'Riverside Sound Festival', 'ธันเดอร์โดม เมืองทองธานี')]);

        await openSearch();
        await screen.findByText('Riverside Sound Festival');
        await userEvent.type(screen.getByLabelText('ชื่อคอนเสิร์ต หรือสถานที่'), 'ไม่มีคอนเสิร์ตชื่อนี้');

        expect(screen.getByText('ไม่พบคอนเสิร์ตที่ค้นหา')).toBeInTheDocument();
    });
});
```

หมายเหตุ: ช่องค้นหาเป็น `TextField` ที่ตั้ง `slotProps.htmlInput['aria-label']` ไว้เป็น
`"ชื่อคอนเสิร์ต หรือสถานที่"` (ค่าเดียวกับ `placeholder`) เทสต์จึงหาด้วย `getByLabelText` ได้
ส่วนปุ่มเปิดช่องค้นหาใช้ `aria-label="ค้นหาคอนเสิร์ต"` — ถ้าตัวช่วยตัวไหนหาไม่เจอ ให้ดู props
จริงในคอมโพเนนต์แล้วปรับ *เทสต์* อย่าแก้คอมโพเนนต์เพื่อให้เทสต์ผ่าน

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/components/common/CustomerHeader.test.tsx
```

Expected: FAIL — เจอ `Neon Pulse` จากข้อมูลจำลอง และหา `Riverside Sound Festival` ไม่เจอ

- [ ] **Step 3: เปลี่ยนแหล่งข้อมูลของช่องค้นหา**

3.1 ใน `frontend/src/components/common/CustomerHeader.tsx` แทนบรรทัด 13

```tsx
import { customerEvents } from '@/data/customerEvents';
```

ด้วย

```tsx
import { useCustomerConcerts } from '@/hooks/useCustomerConcerts';
```

3.2 แทนก้อน `matches` (บรรทัด 40–44) จาก

```tsx
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    if (!normalized) return customerEvents;
    return customerEvents.filter((event) => `${event.title} ${event.location}`.toLocaleLowerCase('th-TH').includes(normalized));
  }, [query]);
```

เป็น

```tsx
  const { concerts } = useCustomerConcerts();
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    if (!normalized) return concerts;
    return concerts.filter((event) => `${event.title} ${event.location}`.toLocaleLowerCase('th-TH').includes(normalized));
  }, [concerts, query]);
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/components/common/CustomerHeader.test.tsx
```

Expected: PASS ทั้ง 4 เคส

- [ ] **Step 5: ตรวจ type, lint และเทสต์ทั้งชุด**

```bash
cd frontend && npx tsc -b && npm run lint && npm test -- --run
```

Expected: ไม่มี error ใหม่ในไฟล์ที่แก้, lint ผ่าน (exit 0), เทสต์ทั้งหมด PASS

- [ ] **Step 6: ตรวจ flow ทั้งเส้นในเบราว์เซอร์ — นี่คือข้อพิสูจน์ว่าโจทย์เดิมถูกแก้แล้ว**

รัน backend และ frontend ให้ครบ แล้วล็อกอินด้วยบัญชีลูกค้า จากนั้นเดินตามเส้นทางปกติ
(ห้ามพิมพ์ URL เอง — ต้องกดจากหน้าเว็บล้วนๆ):

1. `http://localhost:5173/home` → เห็นการ์ด **Riverside Sound Festival**
2. กด "ดูรายละเอียด" → URL เป็น `/event/CC0001`
3. กด "ซื้อบัตร" → URL เป็น `/event/CC0001/zones`
4. กดโซน **A1** → URL เป็น `/event/CC0001/seats/A1`
5. เลือกที่นั่งอย่างน้อย 1 ที่ (ยอดต้องถึง 1,000 บาท — โซน A1 ที่ละ 2,000 จึงพอ)
6. บล็อก "โปรโมชั่น" ต้องมีตัวเลือก **ลด 10% · TEST-MGMT-EARLY10** ถูกเลือกให้อัตโนมัติ
   และยอดชำระลดลง 200 บาท

เก็บ screenshot ของขั้นตอนที่ 6 ส่งให้เจ้าของงาน และเช็ค `read_console_messages`
ว่าไม่มี error

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/common/CustomerHeader.tsx frontend/src/components/common/CustomerHeader.test.tsx
git commit -m "feat(frontend): search real concerts from the customer header"
```

---

## Notes for the executor

- **ทำไมไม่ต้องแตะ `EventDetail`/`ZoneSelection`/`SeatSelection`:** ทั้งสามหน้ามี
  `eventsMap` ของข้อมูลจำลองอยู่ แต่โค้ดจะเข้า branch นั้นก็ต่อเมื่อ id เป็น `'1'`–`'4'`
  เท่านั้น พอหน้ารวมงานส่ง id จริง (`CC0001`) มาให้ ทั้งสามหน้าจะไปเรียก
  `customerPromotionApi.getConcert(id)` เองอยู่แล้ว — ยืนยันด้วยการทดสอบจริงมาแล้ว
  `eventsMap` ที่เหลือกลายเป็นทางสำรองที่ไม่มีใครเดินผ่าน ปล่อยไว้ก่อน อย่าลบในงานนี้
  เพราะยังมีลิงก์เก่า/บุ๊กมาร์กที่ชี้ `/event/2` อยู่ได้
- **โซนยังเป็นข้อมูล hardcode:** `DEMO_MGMT_V1_ZONE_A` ในฐานข้อมูลจับคู่กับโซน `A1`
  บนหน้าเว็บผ่านกติกา `_a` ใน `matchesZone()` ซึ่งทำงานได้อยู่แล้ว ไม่ต้องแก้ในงานนี้
- **ยอดขั้นต่ำ 1,000 บาท:** ถ้ายังไม่เลือกที่นั่ง ยอดเป็น 0 โปรโมชั่นจึงถูกกรองออกและ
  dropdown จะว่างตามเดิม — เป็นพฤติกรรมที่ถูกต้อง ไม่ใช่บั๊ก
- **ถ้าฐานข้อมูลว่าง** (ไม่มีคอนเสิร์ตที่ไม่ถูกยกเลิกเลย) หน้ารวมงานจะขึ้น
  "ยังไม่มีคอนเสิร์ตที่เปิดจำหน่าย" ถ้าเจอตอนทดสอบ ให้รัน seed:
  `cd backend && go run ./cmd/seed-management`
