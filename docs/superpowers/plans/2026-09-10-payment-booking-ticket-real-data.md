# Payment/Booking/Ticket Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ลบโค้ดปลอมตั๋วที่หลงเหลืออยู่ฝั่งหน้าเว็บ (2 จุด) ให้ทุกหน้าที่แสดงบัตร/ตั๋วใช้ข้อมูลจริงจากตาราง `tickets` เท่านั้น และทำให้ปุ่ม "ส่งบัตรซ้ำ" ส่งอีเมลจริงแทนการตอบสำเร็จปลอม ๆ

**Architecture:** `Payment`/`Booking`/`Ticket` มีโครงสร้างและถูกเขียนจริงจาก backend ครบแล้ว (งานก่อนหน้า) งานนี้จึงเป็นการ "เดินสาย" — แก้จุดแปลง response (`mapWireToBooking`) และจุด render (`Account/index.tsx`) ให้เชื่อถือข้อมูลจริงเพียงอย่างเดียว ไม่มี fallback ปั้นข้อมูล และเสริม `resendTickets` (backend) ให้เรียก `mailer.Mailer` จริงตามแพทเทิร์นเดิมของฟีเจอร์ลืมรหัสผ่าน

**Tech Stack:** Go 1.26 + Fiber v2 + GORM (PostgreSQL) ฝั่งหลังบ้าน · React 19 + TypeScript + MUI + Vitest + React Testing Library ฝั่งหน้าเว็บ

**Spec:** `docs/superpowers/specs/2026-09-10-payment-booking-ticket-real-data.md`

## Global Constraints

- **แก้ได้แค่ 3 ตาราง:** `Payment`, `Booking`, `Ticket` — ห้ามแก้ schema เพิ่ม ห้ามเพิ่ม/ลดคอลัมน์ ห้ามแตะ `Zone`/`Seat`/`TicketCategory`
- **ไม่ populate `Ticket.ImageTicket`** (ตาม spec เหตุผลข้อ "ไม่อยู่ในขอบเขต") — คงเป็นคอลัมน์ว่างที่ยังไม่ถูกใช้
- **ไม่แตะ `Booking.EventDate`/`Location`** — ไม่มีคอลัมน์นี้ในตาราง และไม่ใช่ปัญหาที่ผู้ใช้ระบุ
- **ข้อความที่ผู้ใช้เห็นทุกข้อความเป็นภาษาไทย** ตามที่โค้ดเดิมทำอยู่
- **ห้ามมี fallback ปั้น/ปลอมข้อมูลตั๋วที่จุดไหนอีก** — ไม่มีตั๋วจริงต้องโชว์ข้อความบอกตรง ๆ ไม่ใช่สร้างตั๋วปลอม
- **คำสั่งทั้งหมดเป็น PowerShell** (โปรเจกต์นี้รันบน Windows) ยกเว้นเทสต์ backend ที่ใช้ `$env:MANAGEMENT_INTEGRATION_TEST=1`

---

### Task 1: Backend — `resendTickets` ส่งอีเมลจริงผ่าน `mailer.Mailer`

**Files:**
- Modify: `backend/internal/handlers/booking_payment.go:19-38` (struct + Register func), `:450-474` (resendTickets)
- Test: `backend/internal/handlers/booking_resend_test.go` (สร้างใหม่)

**Interfaces:**
- Consumes: `mailer.Mailer` interface (`Send(to, subject, body string) error`, `backend/internal/mailer/mailer.go:17`), `captureMailer` test double (มีอยู่แล้วใน package เดียวกันที่ `internal/handlers/customer_password_reset_test.go:17-27` — ไม่ต้องสร้างใหม่)
- Produces:
  - `bookingPaymentHandler` เพิ่ม field `mailer mailer.Mailer`
  - `RegisterBookingPaymentRoutes(app *fiber.App, db *gorm.DB)` (public, signature เดิม ไม่เปลี่ยน — ใช้ `mailer.FromEnv()`)
  - `registerBookingPaymentRoutes(app *fiber.App, db *gorm.DB, sender mailer.Mailer)` (internal, ให้เทสต์ inject mailer ปลอมได้)
  - `buildTicketResendEmail(booking models.Booking) (subject string, body string)`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/booking_resend_test.go`:

```go
package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestResendTicketsSendsEmailWithRealBookingData(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerBookingPaymentRoutes(app, db, sender)

	booking := models.Booking{
		BookingID: "BKRESEND1", Status: "issued", CustomerEmail: "customer@example.com",
		ConcertTitle: "Riverside Sound Festival",
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	// Ticket.SeatID มี FK ไปยัง seats.seat_id (ผ่าน Seat.Tickets ใน ticket.go) ต้องมี Zone+Seat จริงก่อน
	if err := db.Create(&models.Zone{ZoneID: "ZRESEND1", ZoneType: "นั่ง", Capacity: 2}).Error; err != nil {
		t.Fatal(err)
	}
	seats := []models.Seat{
		{SeatID: "S1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusTaken, ConcertID: "CCRESEND1", ZoneID: "ZRESEND1"},
		{SeatID: "S2", SeatRow: "A", SeatColumn: "2", StatusSeat: seatStatusTaken, ConcertID: "CCRESEND1", ZoneID: "ZRESEND1"},
	}
	if err := db.Create(&seats).Error; err != nil {
		t.Fatal(err)
	}
	tickets := []models.Ticket{
		{TicketID: "TKRESEND1", NameConcert: "Riverside Sound Festival", StatusTicket: ticketStatusIssued, SeatID: "S1", SeatLabel: "A1", BookingID: "BKRESEND1"},
		{TicketID: "TKRESEND2", NameConcert: "Riverside Sound Festival", StatusTicket: ticketStatusIssued, SeatID: "S2", SeatLabel: "A2", BookingID: "BKRESEND1"},
	}
	if err := db.Create(&tickets).Error; err != nil {
		t.Fatal(err)
	}

	managementRequest(t, app, "POST", "/api/bookings/BKRESEND1/resend-tickets", nil, fiber.StatusOK)

	if sender.calls != 1 {
		t.Fatalf("ต้องเรียก mailer.Send 1 ครั้ง แต่เรียก %d ครั้ง", sender.calls)
	}
	if sender.to != "customer@example.com" {
		t.Fatalf("ต้องส่งถึง customer@example.com แต่ส่งถึง %q", sender.to)
	}
	if !strings.Contains(sender.body, "Riverside Sound Festival") {
		t.Fatalf("เนื้อหาอีเมลต้องมีชื่องาน: %q", sender.body)
	}
	if !strings.Contains(sender.body, "A1") || !strings.Contains(sender.body, "A2") {
		t.Fatalf("เนื้อหาอีเมลต้องมีเลขที่นั่งจริงของทุกใบ: %q", sender.body)
	}
}

func TestResendTicketsRejectsBookingNotYetIssued(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerBookingPaymentRoutes(app, db, sender)

	if err := db.Create(&models.Booking{BookingID: "BKRESEND2", Status: "under_review", CustomerEmail: "x@example.com"}).Error; err != nil {
		t.Fatal(err)
	}

	managementRequest(t, app, "POST", "/api/bookings/BKRESEND2/resend-tickets", nil, fiber.StatusBadRequest)

	if sender.calls != 0 {
		t.Fatalf("ห้ามส่งอีเมลถ้ายังไม่อนุมัติ แต่เรียก mailer.Send ไป %d ครั้ง", sender.calls)
	}
}
```

เพิ่ม `"strings"` ใน import ของไฟล์ทดสอบนี้ (ใช้ `strings.Contains`)

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run TestResendTickets -v
```

Expected: FAIL — `undefined: registerBookingPaymentRoutes`

- [ ] **Step 3: แก้ struct และ Register function ใน `booking_payment.go`**

เพิ่ม import `"backend/internal/mailer"` เข้าไปในกลุ่ม import ที่มี `"backend/internal/models"` อยู่แล้ว

แทนที่:

```go
type bookingPaymentHandler struct {
	db *gorm.DB
}

func RegisterBookingPaymentRoutes(app *fiber.App, db *gorm.DB) {
	h := &bookingPaymentHandler{db: db}

	// Customer Booking Endpoints
```

ด้วย:

```go
type bookingPaymentHandler struct {
	db     *gorm.DB
	mailer mailer.Mailer
}

// RegisterBookingPaymentRoutes ลงทะเบียน route สำหรับ production ใช้ mailer จริงจาก env
func RegisterBookingPaymentRoutes(app *fiber.App, db *gorm.DB) {
	registerBookingPaymentRoutes(app, db, mailer.FromEnv())
}

// registerBookingPaymentRoutes รับ mailer แยกต่างหากเพื่อให้เทสต์ inject ตัวปลอมได้
func registerBookingPaymentRoutes(app *fiber.App, db *gorm.DB, sender mailer.Mailer) {
	h := &bookingPaymentHandler{db: db, mailer: sender}

	// Customer Booking Endpoints
```

- [ ] **Step 4: เขียน `buildTicketResendEmail` และแก้ `resendTickets`**

เพิ่มฟังก์ชันนี้ต่อท้ายไฟล์ `booking_payment.go`:

```go
// buildTicketResendEmail สร้างหัวข้อ+เนื้อหาอีเมลส่งบัตรซ้ำ จากข้อมูลจริงใน Booking/Ticket
// ไม่แนบรูปภาพ/QR Code (ต้องมี library เพิ่มซึ่งนอกขอบเขต) — บอกให้เข้าเว็บไปดู QR ที่หน้า "บัตรของฉัน" แทน
func buildTicketResendEmail(booking models.Booking) (string, string) {
	subject := fmt.Sprintf("บัตรเข้าชม %s (ส่งซ้ำ)", booking.ConcertTitle)
	lines := []string{
		fmt.Sprintf("นี่คือบัตรเข้าชม %s ของคุณ (รหัสการจอง %s)", booking.ConcertTitle, booking.BookingID),
		"",
		"รายการบัตร:",
	}
	for _, ticket := range booking.Tickets {
		lines = append(lines, fmt.Sprintf("- ที่นั่ง %s (รหัสตั๋ว %s)", ticket.SeatLabel, ticket.TicketID))
	}
	lines = append(lines,
		"",
		"เข้าสู่ระบบแล้วไปที่หน้า \"บัตรของฉัน\" เพื่อดู QR Code สำหรับสแกนเข้างาน",
	)
	return subject, strings.Join(lines, "\r\n")
}
```

เพิ่ม `"strings"` เข้าไปใน import ของ `booking_payment.go` (ถ้ายังไม่มี — ไฟล์นี้มี `"strings"` อยู่แล้วจากฟังก์ชัน `createBooking`)

แทนที่:

```go
	// บันทึกกิจกรรมขอส่งบัตรซ้ำ
	_ = h.db.Create(&models.EmpActivityLogs{
		EmpLogID:    "EL" + uuid.NewString(),
		ActionType:  "ขอส่งบัตรซ้ำ",
		Description: fmt.Sprintf("ส่งบัตร E-Ticket ซ้ำทางอีเมล (%s) สำหรับการจอง %s", booking.CustomerEmail, bookingID),
		TargetID:    bookingID,
		CreatedAt:   time.Now().UTC(),
	}).Error

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("ส่งบัตรเข้าชมซ้ำไปยังอีเมล %s สำเร็จ (ใช้รหัสและ QR Code เดิม)", booking.CustomerEmail),
		"data":    booking.Tickets,
	})
}
```

ด้วย:

```go
	subject, body := buildTicketResendEmail(booking)
	if err := h.mailer.Send(booking.CustomerEmail, subject, body); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถส่งอีเมลได้"})
	}

	// บันทึกกิจกรรมขอส่งบัตรซ้ำ
	_ = h.db.Create(&models.EmpActivityLogs{
		EmpLogID:    "EL" + uuid.NewString(),
		ActionType:  "ขอส่งบัตรซ้ำ",
		Description: fmt.Sprintf("ส่งบัตร E-Ticket ซ้ำทางอีเมล (%s) สำหรับการจอง %s", booking.CustomerEmail, bookingID),
		TargetID:    bookingID,
		CreatedAt:   time.Now().UTC(),
	}).Error

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("ส่งบัตรเข้าชมซ้ำไปยังอีเมล %s สำเร็จ (ใช้รหัสและ QR Code เดิม)", booking.CustomerEmail),
		"data":    booking.Tickets,
	})
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run TestResendTickets -v
```

Expected: PASS ทั้งสองเทสต์

- [ ] **Step 6: รันเทสต์ทั้ง package ให้แน่ใจว่าไม่มีอะไรพัง**

```bash
cd backend; go build ./...; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./... -v
```

Expected: PASS ทั้งหมด (ไม่มีเทสต์เดิมพัง)

- [ ] **Step 7: Commit**

```bash
git add backend/internal/handlers/booking_payment.go backend/internal/handlers/booking_resend_test.go
git commit -m "feat(booking): ส่งบัตรซ้ำทางอีเมลจริงผ่าน mailer แทน stub"
```

---

### Task 2: Frontend — `mapWireToBooking` เลิกปลอมตั๋ว + เติม `seats` จริง

**Files:**
- Modify: `frontend/src/api/bookingPaymentApi.ts:57-108`
- Test: `frontend/src/api/bookingPaymentApi.test.ts` (เพิ่มเทสต์)

**Interfaces:**
- Consumes: `BackendBookingWire` (มีอยู่แล้ว, `bookingPaymentApi.ts:21-53`), `BookingRecord`/`Ticket` type (`@/types/booking`)
- Produces: `mapWireToBooking` คืน `tickets` เฉพาะจากข้อมูลจริง (ไม่มี fallback ปั้น) และคืน `seats: string[]` ที่มาจาก `tickets.map(t => t.seatLabel)`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มท้าย `frontend/src/api/bookingPaymentApi.test.ts` (ก่อนปิดไฟล์):

```typescript
describe('bookingPaymentApi.getCustomerBookings', () => {
    it('ไม่ปั้นตั๋วปลอมเมื่อ backend ไม่ส่ง tickets มา แม้สถานะเป็น issued', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{
                booking_id: 'BK-1', concert_id: 'CC1', concert_title: 'งานทดสอบ',
                zone_id: 'A1', tier_name: 'โซน A', quantity: 2, unit_price: 2000,
                discount_amount: 0, total_price: 4000, customer_name: 'ลูกค้า',
                customer_email: 'test@example.com', customer_phone: '0800000000',
                status: 'issued', booking_date: '2026-09-10', tickets: [],
            }],
        }));

        const [booking] = await bookingPaymentApi.getCustomerBookings('U1');

        expect(booking.tickets).toEqual([]);
    });

    it('แปลงตั๋วจริงจาก backend และเติม seats จาก seatLabel ของตั๋ว', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
            data: [{
                booking_id: 'BK-2', concert_id: 'CC1', concert_title: 'งานทดสอบ',
                zone_id: 'A1', tier_name: 'โซน A', quantity: 2, unit_price: 2000,
                discount_amount: 0, total_price: 4000, customer_name: 'ลูกค้า',
                customer_email: 'test@example.com', customer_phone: '0800000000',
                status: 'issued', booking_date: '2026-09-10',
                tickets: [
                    { ticket_id: 'TK-BK-2-A1', name_concert: 'งานทดสอบ', seat_label: 'A1', status_ticket: 'พร้อมใช้งาน', ticket_datetime: '2026-09-10T00:00:00Z' },
                    { ticket_id: 'TK-BK-2-A2', name_concert: 'งานทดสอบ', seat_label: 'A2', status_ticket: 'พร้อมใช้งาน', ticket_datetime: '2026-09-10T00:00:00Z' },
                ],
            }],
        }));

        const [booking] = await bookingPaymentApi.getCustomerBookings('U1');

        expect(booking.tickets?.map((t) => t.code)).toEqual(['TK-BK-2-A1', 'TK-BK-2-A2']);
        expect(booking.seats).toEqual(['A1', 'A2']);
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd frontend; npm test -- --run src/api/bookingPaymentApi.test.ts
```

Expected: FAIL เคสแรก — ตอนนี้ `status: 'issued'` + `tickets: []` ยังถูกปั้นเป็นตั๋วปลอม 2 ใบ (`TCK-CC1-A1-1-...`) ไม่ใช่ `[]`; เคสสองอาจ FAIL ที่ `booking.seats` เพราะยังไม่เคยถูกเซ็ตค่า (`undefined`)

- [ ] **Step 3: แก้ `mapWireToBooking`**

แทนที่ทั้งฟังก์ชัน (บรรทัด 57-108 ปัจจุบัน) ตั้งแต่:

```typescript
const mapWireToBooking = (b: BackendBookingWire): BookingRecord => {
  const latestPayment = b.payments && b.payments.length > 0 ? b.payments[b.payments.length - 1] : undefined;
  let tickets: Ticket[] | undefined = b.tickets?.map((t) => ({
    code: t.ticket_id,
    seatLabel: t.seat_label || 'A1',
    issuedAt: t.ticket_datetime,
    qrCodeUrl: t.qr_code_data ? buildQrCodeUrl(t.qr_code_data) : buildQrCodeUrl(t.ticket_id),
  }));

  // หากรายการจองออกบัตรแล้ว (issued) แต่ยังไม่มีรายการ tickets ให้สร้างตั๋วพร้อม QR Code ให้อัตโนมัติ
  if (b.status === 'issued' && (!tickets || tickets.length === 0)) {
    const qty = b.quantity || 1;
    tickets = Array.from({ length: qty }, (_, index) => {
      const seatLabel = `${b.zone_id || 'A'}-${String(index + 1).padStart(2, '0')}`;
      const code = `TCK-${(b.concert_id || 'CONCERT').toUpperCase()}-${b.zone_id || 'A'}-${index + 1}-${b.booking_id.replace(/[^0-9]/g, '').slice(-4) || '0001'}`;
      return {
        code,
        seatLabel,
        issuedAt: b.reviewed_at || b.booking_date || new Date().toISOString(),
        qrCodeUrl: buildQrCodeUrl(code),
      };
    });
  }

  return {
    id: b.booking_id,
```

เป็น:

```typescript
const mapWireToBooking = (b: BackendBookingWire): BookingRecord => {
  const latestPayment = b.payments && b.payments.length > 0 ? b.payments[b.payments.length - 1] : undefined;
  // ตั๋วต้องมาจากข้อมูลจริงในตาราง tickets เท่านั้น — ห้ามปั้นตั๋วปลอมเมื่อ backend ไม่ส่งมา
  // (ก่อนหน้านี้เคยมี fallback ปั้นตั๋วตอน status === 'issued' แต่ตั๋วไม่มา ถูกลบทิ้งแล้ว
  //  เพราะ backend สร้าง Ticket จริงตั้งแต่ตอนจองเสมอ — ดู docs/superpowers/specs/2026-09-10-booking-seat-persistence.md)
  const tickets: Ticket[] = (b.tickets ?? []).map((t) => ({
    code: t.ticket_id,
    seatLabel: t.seat_label || 'A1',
    issuedAt: t.ticket_datetime,
    qrCodeUrl: t.qr_code_data ? buildQrCodeUrl(t.qr_code_data) : buildQrCodeUrl(t.ticket_id),
  }));
  const seats = tickets.map((t) => t.seatLabel);

  return {
    id: b.booking_id,
```

จากนั้นในส่วน return object เดิม เปลี่ยนจาก:

```typescript
    createdAt: b.booking_date,
    tickets,
```

เป็น:

```typescript
    createdAt: b.booking_date,
    seats,
    tickets,
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend; npm test -- --run src/api/bookingPaymentApi.test.ts
```

Expected: PASS ทั้ง 4 เทสต์ (2 เดิม + 2 ใหม่)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/bookingPaymentApi.ts frontend/src/api/bookingPaymentApi.test.ts
git commit -m "fix(frontend): เลิกปั้นตั๋วปลอมใน mapWireToBooking เติม seats จาก seatLabel จริง"
```

---

### Task 3: Frontend — หน้า "บัตรของฉัน" เลิกปลอมตั๋วซ้ำชั้นที่สอง

**Files:**
- Modify: `frontend/src/pages/Customer/Account/index.tsx:266-310`
- Test: `frontend/src/pages/Customer/Account/index.test.tsx` (สร้างใหม่)

**Interfaces:**
- Consumes: `bookingPaymentApi.getCustomerBookings` (จาก Task 2 — คืน `tickets: []` เมื่อไม่มีตั๋วจริง แทนที่จะปั้น), `customerAccountApi.getAccount`, `customerPromotionApi.listConcerts` (เรียกจาก `CustomerHeader`/`useCustomerConcerts` ที่ page นี้ render อยู่ด้วย)
- Produces: การ์ดตั๋วแต่ละใบ render จาก `booking.tickets` จริงเท่านั้น ถ้าว่างให้โชว์ข้อความ "ไม่มีข้อมูลตั๋วสำหรับรายการนี้ กรุณาติดต่อเจ้าหน้าที่" แทนการ์ดปลอม

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/pages/Customer/Account/index.test.tsx`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { customerAccountApi } from '@/api/customerAccountApi';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';
import type { CustomerAccount } from '@/api/customerAccountApi';
import type { BookingRecord } from '@/types/booking';
import CustomerAccountPage from '@/pages/Customer/Account';

const account: CustomerAccount = {
    userId: 'U1', firstName: 'สมชาย', lastName: 'ใจดี', dateOfBirth: '1990-01-01',
    gender: 'ชาย', phone: '0800000000', address: '-', email: 'test@example.com',
};

const issuedBooking = (overrides: Partial<BookingRecord>): BookingRecord => ({
    id: 'BK-1', concertId: 'CC1', concertTitle: 'Riverside Sound Festival',
    zoneId: 'A1', tierName: 'โซน A', quantity: 1, unitPrice: 2000, totalPrice: 2000,
    customerName: 'สมชาย ใจดี', customerEmail: 'test@example.com',
    status: 'issued', createdAt: '2026-09-10T00:00:00Z',
    ...overrides,
});

const renderTicketsTab = (bookings: BookingRecord[]) => {
    vi.spyOn(customerAccountApi, 'getAccount').mockResolvedValue(account);
    vi.spyOn(customerPromotionApi, 'listConcerts').mockResolvedValue({ data: [] });
    vi.spyOn(bookingPaymentApi, 'getCustomerBookings').mockResolvedValue(bookings);
    render(
        <MemoryRouter>
            <CustomerAccountPage mode="tickets" />
        </MemoryRouter>,
    );
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CustomerAccountPage บัตรของฉัน', () => {
    it('ไม่โชว์ตั๋วปลอมเมื่อการจองไม่มีตั๋วจริงผูกอยู่', async () => {
        renderTicketsTab([issuedBooking({ tickets: [], seats: [] })]);

        await screen.findByText('Riverside Sound Festival');
        expect(screen.getByText(/ไม่มีข้อมูลตั๋วสำหรับรายการนี้/)).toBeInTheDocument();
        expect(screen.queryByText(/^TCK-/)).not.toBeInTheDocument();
    });

    it('แสดงเลขที่นั่งจริงจากตั๋วที่ backend ส่งมา', async () => {
        renderTicketsTab([issuedBooking({
            tickets: [{ code: 'TK-BK-1-A5', seatLabel: 'A5', issuedAt: '2026-09-10T00:00:00Z', qrCodeUrl: 'https://example.test/qr.png' }],
            seats: ['A5'],
        })]);

        await screen.findByText('ที่นั่ง A5');
        expect(screen.getByText('TK-BK-1-A5')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

```bash
cd frontend; npm test -- --run src/pages/Customer/Account/index.test.tsx
```

Expected: FAIL เคสแรก — ตอนนี้ตั๋วปลอมถูกปั้นแทนที่จะโชว์ข้อความ "ไม่มีข้อมูลตั๋ว..."

- [ ] **Step 3: แก้ block render ตั๋วใน `Account/index.tsx`**

แทนที่ทั้งบล็อกนี้ (บรรทัด 266-310 ปัจจุบัน) ตั้งแต่:

```tsx
                        {/* Tickets with QR Code */}
                        {(() => {
                          const ticketsToRender = (booking.tickets && booking.tickets.length > 0)
                            ? booking.tickets
                            : Array.from({ length: booking.quantity || 1 }, (_, index) => {
                                const seatLabel = booking.seats?.[index] || `${booking.zoneId}-${String(index + 1).padStart(2, '0')}`;
                                const code = `TCK-${(booking.concertId || 'CONCERT').toUpperCase()}-${booking.zoneId}-${index + 1}-${booking.id.replace(/[^0-9]/g, '').slice(-4) || '0001'}`;
                                return {
                                  code,
                                  seatLabel,
                                  issuedAt: booking.createdAt,
                                  qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`OCTAVIA|${code}|${booking.concertTitle}|${booking.zoneId}|${seatLabel}|${booking.customerName}`)}`,
                                };
                              });

                          return (
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#171d3b', mb: 1.5 }}>
                                ตั๋วเข้าชมคอนเสิร์ต ({ticketsToRender.length} ใบ):
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(340px, 1fr))' }, gap: 2.5 }}>
                                {ticketsToRender.map((ticket) => (
```

เป็น:

```tsx
                        {/* Tickets with QR Code — ต้องมาจาก booking.tickets จริงเท่านั้น ห้ามปั้นตั๋วปลอม */}
                        {(() => {
                          const ticketsToRender = booking.tickets ?? [];

                          if (ticketsToRender.length === 0) {
                            return (
                              <Typography sx={{ color: '#83889a', fontSize: '0.9rem' }}>
                                ไม่มีข้อมูลตั๋วสำหรับรายการนี้ กรุณาติดต่อเจ้าหน้าที่
                              </Typography>
                            );
                          }

                          return (
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#171d3b', mb: 1.5 }}>
                                ตั๋วเข้าชมคอนเสิร์ต ({ticketsToRender.length} ใบ):
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(340px, 1fr))' }, gap: 2.5 }}>
                                {ticketsToRender.map((ticket) => (
```

ส่วนที่เหลือของบล็อก (การ render `<TicketStub>` แต่ละใบ และปิดวงเล็บ) **คงเดิมทั้งหมด** — แก้แค่ส่วนคำนวณ `ticketsToRender` ที่ต้นบล็อกเท่านั้น

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend; npm test -- --run src/pages/Customer/Account/index.test.tsx
```

Expected: PASS ทั้งสองเทสต์

- [ ] **Step 5: รันเทสต์หน้าเว็บทั้งหมดให้แน่ใจว่าไม่มีอะไรพัง**

```bash
cd frontend; npm test -- --run
```

Expected: PASS ทั้งหมด (เทสต์เดิมทุกไฟล์ + ไฟล์ใหม่จาก Task 2, 3)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Customer/Account/index.tsx frontend/src/pages/Customer/Account/index.test.tsx
git commit -m "fix(frontend): หน้าบัตรของฉันเลิกปลอมตั๋วซ้ำ ใช้ข้อมูลจริงจาก booking.tickets เท่านั้น"
```

---

### Task 4: ทดสอบ end-to-end ว่า Payment/Booking/Ticket ทำงานจริงตลอดสาย

**Files:**
- Test: `backend/internal/handlers/booking_full_flow_test.go` (สร้างใหม่)

**Interfaces:**
- Consumes: `RegisterBookingPaymentRoutes`, `RegisterSeatInventoryRoutes`, `ensureZoneSeats` (มีอยู่แล้วจากงานก่อนหน้า), `managementTestDB`, `managementRequest`
- Produces: ไม่มี — เป็นเทสต์ยืนยัน (regression proof) ว่า chain การจอง→อนุมัติ→ดูรายการ ให้ข้อมูลจริงครบทุกจุดตามที่ Task 1-3 พึ่งพา

- [ ] **Step 1: เขียนเทสต์ end-to-end**

สร้าง `backend/internal/handlers/booking_full_flow_test.go`:

```go
package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// TestFullBookingFlowProducesRealPaymentBookingTicketData ยืนยันว่าตลอดสาย
// จอง -> แนบสลิป -> อนุมัติ -> ดูรายการ ได้ข้อมูลจริงในตาราง payments/bookings/tickets
// ครบทุกจุด ไม่ต้องพึ่ง fallback ปั้นข้อมูลใด ๆ ฝั่งหน้าเว็บอีกต่อไป (Task 1-3 ของแผนนี้ลบ fallback ทิ้งแล้ว)
func TestFullBookingFlowProducesRealPaymentBookingTicketData(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerBookingPaymentRoutes(app, db, sender)
	RegisterSeatInventoryRoutes(app, db)

	if err := ensureZoneSeats(db, "CCFLOW", "A1"); err != nil {
		t.Fatal(err)
	}

	created := managementRequest(t, app, "POST", "/api/bookings", map[string]any{
		"concert_id": "CCFLOW", "concert_title": "งานทดสอบสาย E2E",
		"zone_id": "A1", "tier_name": "โซน A",
		"seats": []string{"A1"}, "quantity": 1,
		"unit_price": 2000, "discount_amount": 0, "total_price": 2000,
		"customer_name": "ลูกค้าทดสอบ", "customer_email": "e2e@example.com", "customer_phone": "0800000000",
		"slip_file_name": "slip.jpg", "slip_data_url": "data:image/jpeg;base64,QUJD",
	}, fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)

	// 1) Payment ต้องถูกสร้างจริงตอนแนบสลิป
	var payment models.Payment
	if err := db.Where("booking_id = ?", bookingID).First(&payment).Error; err != nil {
		t.Fatal("ต้องมีแถวใน payments:", err)
	}
	if len(payment.EvidenceFile) == 0 {
		t.Fatal("Payment.EvidenceFile ต้องมีข้อมูลสลิปจริง ไม่ว่างเปล่า")
	}

	// 2) อนุมัติ
	managementRequest(t, app, "POST", "/api/sales/bookings/"+bookingID+"/approve",
		map[string]any{"officer_name": "พนักงานทดสอบ"}, fiber.StatusOK)

	// 3) ดูรายการผ่าน endpoint เดียวกับที่ frontend เรียก (getCustomerBookings)
	body := managementRequest(t, app, "GET", "/api/customer/account/bookings?email=e2e@example.com", nil, fiber.StatusOK)
	rows := body["data"].([]interface{})
	if len(rows) != 1 {
		t.Fatalf("ต้องเจอ 1 booking แต่เจอ %d", len(rows))
	}
	row := rows[0].(map[string]interface{})
	if row["status"] != "issued" {
		t.Fatalf("สถานะต้องเป็น issued แต่ได้ %v", row["status"])
	}
	ticketRows, ok := row["tickets"].([]interface{})
	if !ok || len(ticketRows) != 1 {
		t.Fatalf("ต้องมีตั๋วจริง 1 ใบติดมากับ response แต่ได้ %v", row["tickets"])
	}
	ticket := ticketRows[0].(map[string]interface{})
	if ticket["seat_label"] != "A1" {
		t.Fatalf("เลขที่นั่งบนตั๋วต้องเป็น A1 (ที่นั่งที่เลือกจริง) แต่ได้ %v", ticket["seat_label"])
	}
	if ticket["status_ticket"] != ticketStatusIssued {
		t.Fatalf("ตั๋วต้องเป็นสถานะ %q แต่ได้ %v", ticketStatusIssued, ticket["status_ticket"])
	}

	// 4) ส่งบัตรซ้ำ ต้องส่งอีเมลจริงโดยใช้ CustomerEmail จาก Booking
	managementRequest(t, app, "POST", "/api/bookings/"+bookingID+"/resend-tickets", nil, fiber.StatusOK)
	if sender.calls != 1 || sender.to != "e2e@example.com" {
		t.Fatalf("resend ต้องส่งอีเมลถึง e2e@example.com 1 ครั้ง แต่ได้ to=%q calls=%d", sender.to, sender.calls)
	}
}
```

- [ ] **Step 2: รันเทสต์**

```bash
cd backend; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./internal/handlers/ -run TestFullBookingFlow -v
```

Expected: PASS — ถ้า FAIL ที่จุดไหน แปลว่า Task 1-3 ยังไม่ครบ ให้กลับไปแก้ก่อน ห้ามข้าม

- [ ] **Step 3: รันชุดเทสต์ backend ทั้งหมดอีกรอบให้แน่ใจ**

```bash
cd backend; go build ./...; $env:MANAGEMENT_INTEGRATION_TEST=1; go test ./... -v
```

Expected: PASS ทั้งหมด

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/booking_full_flow_test.go
git commit -m "test(booking): ยืนยัน end-to-end ว่า payment/booking/ticket เป็นข้อมูลจริงตลอดสาย"
```

---

## หมายเหตุสำหรับผู้นำแผนไปทำ

- **Task 1 ทำก่อนหรือหลัง Task 2-3 ก็ได้** (ไม่พึ่งพากัน) แต่ **Task 4 ต้องทำหลังสุด** เพราะทดสอบผลลัพธ์รวมของ Task 1 (resend ส่งอีเมลจริง) และอาศัยว่า Task 2-3 ไม่ได้แก้ backend อะไรที่ Task 4 ต้องพึ่ง (Task 4 ทดสอบเฉพาะ backend endpoints ไม่เกี่ยวกับ React ใน Task 2-3 โดยตรง — ทำ Task 4 หลัง Task 1 เสร็จก็พอ)
- **ห้ามลืม**: `captureMailer` มีอยู่แล้วในไฟล์ `customer_password_reset_test.go` — ไม่ต้องนิยามซ้ำ (จะชนกัน "already declared" ตอน compile)
- ถ้ารันเทสต์ Task 4 แล้วเจอ FK error เกี่ยวกับ `promotion_id`/`promotion_name` ใน `ticket_categories` — เป็นสัญญาณว่า migration ของงานก่อนหน้า (`docs/superpowers/plans/2026-09-10-booking-seat-persistence.md` Task 1 Step 5) ยังไม่ได้รันบนฐานข้อมูลที่ใช้ทดสอบ ให้กลับไปดูงานนั้นก่อน
