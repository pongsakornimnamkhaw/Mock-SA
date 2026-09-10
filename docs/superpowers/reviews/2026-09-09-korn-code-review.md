# Code Review — branch `korn` (เตรียมสอบ Project SA)

> เอกสารนี้เป็น **รีวิวโค้ด + สรุปหัวข้อ** สำหรับเตรียมสอบ ไม่ใช่ implementation plan
> ผู้รีวิว: Claude · วันที่: 2026-09-09 · branch: `korn` (HEAD `4840835`)
> โมดูลที่ผู้สอบรับผิดชอบ: **B6728786 พงศกร อิ่มน้ำขาว — ระบบจองบัตร + ระบบชำระเงิน**

---

## สารบัญ (หัวข้อทั้งหมดที่ต้องรู้)

| # | หัวข้อ | ทำไมต้องรู้ |
|---|--------|-------------|
| 1 | [ภาพรวมระบบ & Tech Stack](#1-ภาพรวมระบบ--tech-stack) | คำถามเปิดเสมอ "ระบบนี้ทำอะไร ใช้อะไรเขียน" |
| 2 | [แผนที่โมดูล 12 ระบบ & เจ้าของ](#2-แผนที่โมดูล-12-ระบบ--เจ้าของ) | ต้องตอบได้ว่าตัวเองทำส่วนไหน ต่อกับใคร |
| 3 | [สถาปัตยกรรม Backend (Fiber + GORM)](#3-สถาปัตยกรรม-backend-fiber--gorm) | ชั้นของโค้ด, การไหลของ request |
| 4 | [Data Model & ER (46 ตาราง)](#4-data-model--er-46-ตาราง) | กรรมการชอบถาม FK / ความสัมพันธ์ |
| 5 | [Flow ระบบจองบัตร (UP1)](#5-flow-ระบบจองบัตร-up1) | โมดูลตัวเอง — ต้องเล่าได้ทีละ step |
| 6 | [Flow ระบบชำระเงิน & ตรวจสลิป (U4/UP2–UP5)](#6-flow-ระบบชำระเงิน--ตรวจสลิป-u4up2up5) | โมดูลตัวเอง |
| 7 | [ระบบ Authentication & Session](#7-ระบบ-authentication--session) | จุดอ่อนใหญ่ที่สุดของโปรเจกต์ |
| 8 | [สถานะ Build / Test (หลักฐานจริง)](#8-สถานะ-build--test-หลักฐานจริง) | ถ้ากรรมการสั่ง build ตอนนี้ = พัง |
| 9 | [ข้อบกพร่องระดับวิกฤต (P0)](#9-ข้อบกพร่องระดับวิกฤต-p0) | ต้องรู้ก่อนโดนถาม |
| 10 | [ข้อบกพร่องระดับสูง (P1)](#10-ข้อบกพร่องระดับสูง-p1) | |
| 11 | [ข้อบกพร่องระดับกลาง/คุณภาพโค้ด (P2)](#11-ข้อบกพร่องระดับกลางคุณภาพโค้ด-p2) | |
| 12 | [สิ่งที่ทำได้ดี (ใช้ตอบตอนสอบได้)](#12-สิ่งที่ทำได้ดี-ใช้ตอบตอนสอบได้) | อย่าลืมขายของ |
| 13 | [คำถามที่กรรมการน่าจะถาม + แนวตอบ](#13-คำถามที่กรรมการน่าจะถาม--แนวตอบ) | ซ้อมก่อนเข้าห้อง |
| 14 | [Checklist สิ่งที่ควรแก้ก่อนสอบ (เรียงตามคุ้มค่า)](#14-checklist-สิ่งที่ควรแก้ก่อนสอบ-เรียงตามคุ้มค่า) | |

---

## 1. ภาพรวมระบบ & Tech Stack

**Octavia** — ระบบจัดการคอนเสิร์ตครบวงจร (ฝั่งลูกค้า + ฝั่งพนักงาน)

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 + MUI 9 + React Router 7 |
| Backend | Go + Fiber v2 + GORM |
| Database | PostgreSQL (AutoMigrate + ALTER COLUMN ปรับ timezone) |
| Test | Go `testing` (backend), Vitest + Testing Library (frontend) |
| Auth | Session cookie (HttpOnly) + bcrypt |

Monorepo: `go.work` ครอบ `backend/`, frontend แยก `frontend/` และ proxy `/api` → `localhost:8080`

**จุดเริ่มต้นอ่านโค้ด:** [backend/cmd/server/main.go](backend/cmd/server/main.go) — โหลด env → connect DB → AutoMigrate → ลงทะเบียน 8 กลุ่ม route → listen `:8080`

---

## 2. แผนที่โมดูล 12 ระบบ & เจ้าของ

| รหัส นศ. | ชื่อ | ระบบที่รับผิดชอบ | ไฟล์หลัก |
|---|---|---|---|
| B6707651 | อุษณิษา แพงโสภา | 1. จัดการข้อมูลคอนเสิร์ต<br>2. จัดการศิลปินและการแสดง | `handlers/concert.go` (952 บรรทัด), `handlers/artist.go` |
| B6708856 | ชาญเศรษฐ์ สถิตโพธิ์ศรี | 3. ลงทะเบียนเข้างาน<br>4. วางแผนการจำหน่ายบัตร | `features/registration/`, `handlers/venue_seat.go` |
| B6717537 | ธันยพัต ปิยธรรมโรจน์ | 5. จัดการโปรโมชั่น<br>6. จัดการผู้ใช้และสิทธิ์ | `handlers/management_promotions.go` (842), `management_employees.go` |
| **B6728786** | **พงศกร อิ่มน้ำขาว** | **7. ระบบจองบัตร**<br>**8. ระบบชำระเงิน** | **`handlers/booking_payment.go` (520)** |
| B6733377 | ภูริชญา จันทร | 9. ประสานงานภายนอก (ติดต่อ-สอบถาม)<br>10. รายงานและสรุปผล | `handlers/report.go`, `pages/Customer/ContactHQ.tsx` |
| (ส่วนกลาง) | — | 11. บัญชีลูกค้า / รีเซ็ตรหัสผ่าน<br>12. ที่นั่งและสถานที่ (Venue Seat Plan) | `customer_account.go`, `customer_password_reset.go`, `venue_seat.go` |

**สิ่งที่ branch `korn` เพิ่มจาก `main`** (`git diff --stat main...korn` = 24 ไฟล์, +1630/−20):
- `GET /api/concerts` ฝั่งลูกค้า — ดึงคอนเสิร์ตจริงจาก DB ([customer_concerts.go](backend/internal/handlers/customer_concerts.go))
- หน้า Home แสดงโปสเตอร์คอนเสิร์ตจริง + poster fallback แบบ deterministic ([customerConcertCard.ts](frontend/src/utils/customerConcertCard.ts))
- ลบ `.env` ออกจาก repo + เพิ่ม `.env.example`

---

## 3. สถาปัตยกรรม Backend (Fiber + GORM)

```
main.go
  └─ config.LoadEnv()      → อ่าน .env (DB_HOST/PORT/NAME/USER/PASSWORD/SSLMODE, PORT)
  └─ config.ConnectDB()    → gorm.Open(postgres)
  └─ models.MigrateAllModels(db)
        ├─ AutoMigrate 46 struct
        └─ normalizeOperationalDateTimeColumns() → ALTER COLUMN เป็น timestamp/time/date without time zone
  └─ Middleware: logger, recover, CORS (whitelist localhost:5173-5175, 3000)
  └─ handlers.Register*Routes(app, db)   ← 8 กลุ่ม
```

**Pattern ที่ใช้ทั้งโปรเจกต์:** แต่ละไฟล์ handler มี struct `xxxHandler{db *gorm.DB}` + ฟังก์ชัน `RegisterXxxRoutes(app, db)` — **ไม่มี service layer / repository layer** logic ธุรกิจอยู่ใน handler ตรง ๆ

> ⚠️ ถ้ากรรมการถาม "ทำไมไม่แยก layer" — ตอบตรง ๆ ว่าเป็น 2-tier (handler → GORM) เพื่อความเร็วในการพัฒนา และยอมรับว่า logic ที่ควรอยู่ใน service (เช่น การคิดราคา) หลุดไปอยู่ฝั่ง frontend

---

## 4. Data Model & ER (46 ตาราง)

จัดกลุ่มตาม [models/migrate.go](backend/internal/models/migrate.go):

| กลุ่ม | ตาราง |
|---|---|
| User & Access | `User`, `CusActivityLogs`, `EmpActivityLogs`, `Permission`, `Inquiry` |
| Concert | `Concert`, `ConcertArtist`, `ConcertDocument`, `ModifiedHistory`, `SummaryReport` |
| Artist | `Artist`, `ArtistRequirement`, `ArtistHistory` |
| Promotion | `Promotion`, `PromotionApproval`, `PromoCondition`, `DiscountInfo`, `Quota`, `PromotionUsageLog` |
| **Ticket & Booking** | **`Booking`, `Payment`**, `Zone`, `Seat`, `TicketCategory`, `TicketSalesInfo`, `Ticket`, `GateCheckIn`, `SalesReport` |
| Performance | `PerformanceSchedule`, `PerformanceDetail` |
| Work | `WorkPlan`, `SponsorshipRequest`, `Task` |
| Venue Seat Plan | `VenueSeatPlan`, `VenueSeatRound`, `VenueSeatZone`, `VenueSeat`, `VenueLayoutObject`, `VenueSeatPublication` |

**ความสัมพันธ์ที่ต้องท่องได้ (โมดูลตัวเอง):**

```
User (1) ──< (N) Booking (1) ──< (N) Payment
                    │
                    └──< (N) Ticket ──> (1) Seat ──> (1) Zone
                                                       └──> (1) Concert
```

- `Booking.UserID` เป็น `*string` (nullable) → **จองแบบไม่ล็อกอินได้**
- `Payment.EvidenceFile` เป็น `bytea` → เก็บรูปสลิปลง DB โดยตรง
- `Ticket.QrCodeData` เก็บ payload รูปแบบ `OCTAVIA|ticketID|ชื่อคอน|zone|seat|ชื่อลูกค้า`

**Primary key ทั้งระบบเป็น `varchar` ที่ generate เอง** ([base.go](backend/internal/models/base.go)) — `GenerateID("BK")` = prefix 2 ตัว + เลขสุ่ม 6 หลัก ไม่มีการตรวจซ้ำ

---

## 5. Flow ระบบจองบัตร (UP1)

```
เลือกงาน → /event/:id/zones → เลือกโซน → /event/:id/seats/:zone  (CustomerRouteGuard)
   ↓
SeatSelectionPage  (frontend/src/pages/Customer/SeatSelection/index.tsx)
   ├─ generateSeats()          สร้างผังที่นั่งใน React state (ไม่ได้มาจาก DB)
   ├─ กดเลือกที่นั่ง → status 'locked' + ตั้งเวลา LOCK_DURATION (นับถอยหลังใน browser)
   ├─ เลือกโปรโมชั่น / กรอกโค้ด → calculateDiscount()
   ├─ totalPrice = จำนวนที่นั่ง × zonePriceMap[zone].price   ← ราคาจาก constants ฝั่ง frontend
   ├─ finalPrice = totalPrice − discountAmount
   └─ QRCodeDialog → อัปโหลดสลิป → handleSubmitPayment()
          ↓
bookingPaymentApi.createBooking()   (frontend/src/api/bookingPaymentApi.ts)
          ↓  POST /api/bookings
createBooking()   (backend/internal/handlers/booking_payment.go:77)
   ├─ ตรวจแค่ customer_name / customer_email ว่าไม่ว่าง
   ├─ bookingID = "BK-YYYYMMDD-" + rand 4 หลัก
   ├─ status = "under_review" (มีสลิป) หรือ "pending_payment" (ไม่มีสลิป)
   ├─ db.Create(&Booking)          ← เก็บ unit_price/discount/total ตามที่ client ส่งมา
   ├─ ถอด base64 สลิป → db.Create(&Payment) status "รอตรวจสอบ"
   └─ db.Create(&CusActivityLogs) "จองบัตร"
```

**สิ่งที่ต้องรู้ว่าไม่มี:** ไม่มีการจองที่นั่งฝั่ง server — `input.Seats` ถูกรับเข้ามาแต่ใช้แค่ `len()` เป็น fallback ของ quantity แล้วทิ้ง ที่นั่งที่ลูกค้าเลือกจริงไม่ถูกบันทึกที่ไหนเลย

---

## 6. Flow ระบบชำระเงิน & ตรวจสลิป (U4/UP2–UP5)

| Use case | Endpoint | ฟังก์ชัน | บรรทัด |
|---|---|---|---|
| U4 ค้นหา/กรองรายการจอง | `GET /api/sales/bookings?status=&q=` | `getSalesBookings` | :244 |
| UP2 อนุมัติ (include UP3) | `POST /api/sales/bookings/:id/approve` | `approveBooking` | :271 |
| UP3 ออก E-Ticket + QR | (อยู่ใน approve) | — | :330–360 |
| UP4 ปฏิเสธ + ส่งสลิปใหม่ | `POST /.../reject`, `POST /api/bookings/:id/reupload-slip` | `rejectBooking`, `reuploadSlip` | :380, :426 |
| UP5 ส่งบัตรซ้ำ | `POST /api/sales/bookings/:id/resend` | `resendTickets` | :476 |
| — ดูรูปสลิป | `GET /api/bookings/:id/slip` | `getSlipImage` | :503 |

**ขั้นตอนตอนอนุมัติ:**
1. `Booking.Status = "issued"`, `ReviewedBy`, `ReviewedAt`, ล้าง `RejectReason`
2. `Payment.PaymentStatus = "อนุมัติ"`
3. ถ้ายังไม่มี Ticket → `FirstOrCreate` Zone → `FirstOrCreate` Seat → สร้าง Ticket + QR payload ทีละใบ
4. เขียน `EmpActivityLogs` "อนุมัติการชำระเงิน" เป็น audit trail

---

## 7. ระบบ Authentication & Session

**มีกลไก session จริงอยู่แล้ว** และทำได้ค่อนข้างดี:
- token สุ่ม 32 bytes → เก็บ **SHA-256 hash** ลง DB (ไม่เก็บ token ดิบ) — [customer_account.go:224-252](backend/internal/handlers/customer_account.go)
- cookie `HTTPOnly`, มีวันหมดอายุ
- รหัสผ่าน hash ด้วย bcrypt

**ปัญหาคือมันถูกบังคับใช้แค่ 6 endpoint:**

```
customer_account.go:96-100   /account, /account/profile, /account/password,
                             /account/tickets, /account/purchases   → requireCustomer
employee_auth.go:53          /me                                    → requireEmployee
```

**ที่เหลือทั้งหมดเปิดโล่ง** รวมถึง `/api/sales/bookings/:id/approve`, `/api/promotions`, `/api/employees`, `/api/activity-logs`

Route guard ฝั่ง frontend (`EmployeeRouteGuard`, `CustomerRouteGuard` ใน [App.tsx](frontend/src/App.tsx)) เป็นการซ่อน UI เท่านั้น — `curl` ตรงไป backend ผ่านได้หมด

---

## 8. สถานะ Build / Test (หลักฐานจริง)

รันจริงเมื่อ 2026-09-09:

| คำสั่ง | ผล |
|---|---|
| `go build ./...` | ✅ ผ่าน |
| `go vet ./...` | ✅ สะอาด ไม่มี warning |
| `go test ./...` | ⚠️ ขึ้น `ok` ทุก package **แต่เทสต์ที่ต่อ PostgreSQL ทั้งหมด SKIP** (ไม่มี DB ใน environment) — เทสต์ที่รันจริงเป็น unit test ล้วน ๆ |
| `npx vitest run` | ✅ 10 ไฟล์ / 69 เทสต์ ผ่านหมด |
| `npx oxlint` | ⚠️ ผ่านแบบมี warning (ส่วนใหญ่ `react-hooks/exhaustive-deps`) |
| **`npm run build` (`tsc -b && vite build`)** | ❌ **ล้มเหลว exit 2 — 5 errors** |

**รายละเอียด build error (P0 — ดูข้อ 9.1):**
```
TS1261 ×2 / TS1149 ×1 : '@/assets/LOGO' vs 'src/assets/logo', '@/assets/Poster' vs 'src/assets/poster'
TS2307 ×1 : src/services/https/index.ts — Cannot find module 'axios'
TS7006 ×1 : src/services/https/index.ts:12 — implicit any
```

---

## 9. ข้อบกพร่องระดับวิกฤต (P0)

### 9.1 `npm run build` พัง — โปรเจกต์ build production ไม่ผ่าน และรันบน Linux/macOS ไม่ได้

โฟลเดอร์จริงชื่อ `src/assets/logo` และ `src/assets/poster` (ตัวเล็ก) แต่โค้ด import ว่า `@/assets/LOGO` และ `@/assets/Poster` กว่า 10 จุด

- บน Windows (ไฟล์ระบบ case-insensitive) → `npm run dev` รันได้ ทำให้ไม่มีใครเห็นปัญหา
- บน Linux/macOS case-sensitive → **resolve ไม่เจอไฟล์ แอปพังทั้งหน้า**
- `tsc -b` จับได้และ fail → `npm run build` ไม่มีวันผ่าน

`src/services/https/index.ts` import `axios` ที่ไม่มีใน `package.json` — ไฟล์นี้ถูกใช้จริงผ่าน `hooks/useConcerts.ts`

> **ถ้ากรรมการสั่ง `npm run build` ตรงหน้า = ตกทันที** นี่คือข้อที่ต้องแก้ก่อนอย่างอื่น (ดูข้อ 14)

### 9.2 ราคาถูกคำนวณและส่งมาจาก client ทั้งหมด — แก้ราคาเป็น 0 บาทได้

[SeatSelection/index.tsx:100,143-144](frontend/src/pages/Customer/SeatSelection/index.tsx) คิดราคาจาก `zonePriceMap` ที่ hardcode ไว้ใน `components/SeatSelection/constants.ts` แล้วส่ง `unit_price` / `discount_amount` / `total_price` ไปให้ backend

[booking_payment.go:124-126](backend/internal/handlers/booking_payment.go) เก็บลง DB ตรง ๆ **ไม่ตรวจสอบซ้ำเลย**

```bash
curl -X POST http://localhost:8080/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"customer_name":"x","customer_email":"x@x.com","quantity":10,"unit_price":0,"total_price":0}'
```
→ ได้บัตร 10 ใบ ราคา 0 บาท

ซ้ำร้าย ราคาใน `zonePriceMap` ไม่ตรงกับตาราง `TicketCategory` ใน DB — คือระบบมีตารางราคาจริงแต่ไม่ได้ใช้

### 9.3 ทุก endpoint ของระบบจองและชำระเงินไม่มี authentication

[booking_payment.go:26-38](backend/internal/handlers/booking_payment.go) ลงทะเบียน route ตรงกับ `app` โดยไม่ผ่าน `requireCustomer` / `requireEmployee` ที่มีอยู่แล้วในโปรเจกต์

ผลที่ตามมา:
- ใครก็ได้เรียก `POST /api/sales/bookings/BK-xxxx/approve` → **อนุมัติการจองของตัวเองแล้วรับ E-Ticket ฟรี**
- `GET /api/customer/account/bookings?email=<เมลคนอื่น>` → **อ่านประวัติการจองของคนอื่นได้** (IDOR)
- `GET /api/bookings/:id/slip` → **ดูรูปสลิปโอนเงินของคนอื่นได้** (ข้อมูลบัญชีธนาคาร = PII)

### 9.4 Login พนักงานมีช่องโหว่ 2 จุด

[employee_auth.go:110-121](backend/internal/handlers/employee_auth.go)
```go
if strings.EqualFold(username, "B6728786") || strings.EqualFold(username, "CD-1234") ||
   strings.Contains(strings.ToLower(username), "sales") {
    user = models.User{UserID: "EMP-B6728786", ...}   // ← สร้าง user ปลอมขึ้นมา
}
```
ถ้าหาบัญชีใน DB ไม่เจอ และ username มีคำว่า `sales` → **ล็อกอินผ่านโดยไม่ตรวจรหัสผ่านเลย** เช่น `username=sales, password=อะไรก็ได้`

[employee_auth.go:127](backend/internal/handlers/employee_auth.go)
```go
if bcrypt.CompareHashAndPassword(...) != nil && password != "Admin1234!" && password != "Demo1234!" {
```
→ **master password** `Admin1234!` / `Demo1234!` ใช้เข้าบัญชีพนักงานคนไหนก็ได้

### 9.5 ไม่มีการกันที่นั่งซ้ำ (double booking) เลยทั้งระบบ

- ผังที่นั่งสร้างจาก `generateSeats()` ใน browser ไม่ได้อ่านจาก DB
- การ "ล็อกที่นั่ง" เป็นแค่ React state + timer ในเครื่องลูกค้า — refresh หน้าก็หาย คนอื่นไม่รู้
- `input.Seats` ที่ส่งไป backend ถูกทิ้ง
- ตอนอนุมัติ backend **สร้าง seat ใหม่เองด้วยชื่อตายตัว** `ST-{zone}-01`, `ST-{zone}-02` ([:333](backend/internal/handlers/booking_payment.go))

ผลลัพธ์ที่พิสูจน์ได้ในการสอบ: ลูกค้าเลือกที่นั่ง **A1-15** แต่บัตรที่ออกมาเขียนว่า **A1-01** และ `seat_id` ไม่มี `concert_id` อยู่ในชื่อ → **คอนเสิร์ตคนละงานใช้ Seat แถวเดียวกันใน DB**

### 9.6 `.env` ที่มีรหัสผ่านฐานข้อมูลยังอยู่ใน git history

commit `4bd2597` ลบไฟล์ออกแล้ว แต่ `git show 4bd2597^:backend/.env` ยังดึงค่าเดิมออกมาได้ (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME) — การลบไฟล์ไม่ได้ลบประวัติ ต้อง rotate รหัสผ่าน DB จริง

---

## 10. ข้อบกพร่องระดับสูง (P1)

### 10.1 Frontend เงียบ ๆ fallback ไป localStorage เวลา backend ล่ม

[bookingPaymentApi.ts](frontend/src/api/bookingPaymentApi.ts) ทุกเมธอดหุ้มด้วย `try/catch` ที่ catch แล้วไปเรียก `bookingStore` (mock ใน localStorage) แทน — 8 จุด (บรรทัด 153, 192, 210, 243, 263, 282, 296)

- **หน้าจอดูเหมือนทำงานได้ปกติแม้ backend ตายสนิท** กด "อนุมัติ" แล้วขึ้นสำเร็จ แต่ไม่มีอะไรลง DB
- อันตรายมากในวันสอบ: ถ้ากรรมการถาม "ข้อมูลนี้อยู่ใน DB จริงไหม" แล้ว demo ดันวิ่งบน fallback อยู่ = ตอบไม่ได้
- **ควรเปิด DevTools → Network ตรวจว่าเรียก API จริงก่อนเริ่ม demo**

บั๊กเพิ่มเติมบรรทัด 196:
```ts
return local.filter((b) => (email && b.customerEmail === email) || true);
```
`|| true` ทำให้เงื่อนไขเป็นจริงเสมอ → คืนการจองของทุกคน เงื่อนไข filter ตายสนิท

### 10.2 `resendTickets` บอกว่าส่งอีเมลแล้ว แต่ไม่ได้ส่งจริง

[booking_payment.go:476-501](backend/internal/handlers/booking_payment.go) เขียน log แล้ว return ข้อความ `"ส่งบัตรเข้าชมซ้ำไปยังอีเมล ... สำเร็จ"` โดยไม่เรียก mailer เลย

ทั้งที่โปรเจกต์**มี** `internal/mailer/mailer.go` (SMTP + console fallback) ที่โมดูล reset password ใช้อยู่แล้ว — แค่ไม่ได้ต่อเข้ามา

### 10.3 ไม่มี transaction — ข้อมูลไม่สอดคล้องได้ง่าย

`createBooking` ทำ 3 insert แยกกัน (Booking → Payment → ActivityLog) และ **ละเลย error ด้วย `_ =`** ([:158](backend/internal/handlers/booking_payment.go), [:466](backend/internal/handlers/booking_payment.go))

→ ถ้าบันทึก `Payment` ล้มเหลว ลูกค้ายังเห็นข้อความ "บันทึกการจองและส่งหลักฐานสำเร็จ" แต่สลิปหายไป

`approveBooking` ก็เช่นกัน: update booking → update payment → สร้าง ticket ทีละใบ ทั้งหมดนอก transaction และไม่มี row lock → กด approve พร้อมกัน 2 ครั้งอาจได้ตั๋วซ้ำ

เทียบกับโมดูลโปรโมชั่นของ B6717537 ที่ใช้ transaction + row lock ครบ ([MANAGEMENT.md](backend/MANAGEMENT.md)) — **จุดนี้กรรมการเทียบกันได้ทันที**

### 10.4 GET endpoint เขียนข้อมูลลง DB

`getCustomerBookings` มี "auto-repair" ([:198-238](backend/internal/handlers/booking_payment.go)) ที่ถ้าเจอ booking สถานะ `issued` แต่ไม่มีตั๋ว จะ **สร้าง Zone/Seat/Ticket ขึ้นมาใหม่ระหว่าง GET**

ผิดหลัก HTTP (GET ต้อง idempotent/safe) และโค้ดสร้างตั๋วชุดนี้ **ซ้ำกับใน `approveBooking` เกือบบรรทัดต่อบรรทัด** (~40 บรรทัด × 2) — ละเมิด DRY ชัดเจน

ยิ่งกว่านั้น frontend ยังมี auto-repair รอบที่สามใน `mapWireToBooking` ([bookingPaymentApi.ts:52-67](frontend/src/api/bookingPaymentApi.ts)) ที่สร้างตั๋วปลอมในหน่วยความจำอีกชั้น → **logic เดียวกันกระจาย 3 ที่**

### 10.5 ไม่มี unit test สำหรับโมดูลจองบัตร/ชำระเงินเลยแม้แต่ไฟล์เดียว

```
handlers/customer_account_test.go        ✅
handlers/customer_promotions_test.go     ✅
handlers/management_test.go              ✅
handlers/report_test.go                  ✅
handlers/booking_payment_test.go         ❌ ไม่มี
```
ฝั่ง frontend ก็ไม่มีเทสต์ของ `SeatSelection` / `SalesBookingManagement` / `bookingPaymentApi`

โมดูลอื่นมีเทสต์ครบ **นี่คือช่องว่างที่มองเห็นชัดที่สุดเมื่อเทียบกับเพื่อนร่วมทีม**

### 10.6 ไฟล์ binary 25 MB ถูก commit เข้า repo

`backend/octavia-server.exe` (25,070,592 bytes) ถูก track ใน git และถูกเพิ่มบน branch `korn` — ไฟล์ compile ไม่ควรอยู่ใน version control

### 10.7 ไม่มีการตรวจสอบไฟล์สลิปที่อัปโหลด

- ไม่เช็ค MIME type / นามสกุล / magic bytes
- ไม่เช็คขนาด (มีแค่ `BodyLimit: 20MB` ระดับ Fiber)
- `base64.StdEncoding.DecodeString` ทิ้ง error ([:140](backend/internal/handlers/booking_payment.go), [:447](backend/internal/handlers/booking_payment.go)) → ไฟล์เสียกลายเป็น `[]byte` ว่างแบบเงียบ ๆ
- `getSlipImage` ส่ง `Content-Type: image/jpeg` ตายตัวไม่ว่าไฟล์จริงเป็นอะไร ([:518](backend/internal/handlers/booking_payment.go))
- ตอนไม่เจอสลิป คืน SVG placeholder พร้อม **HTTP 200** แทน 404 → error กลืนหาย

---

## 11. ข้อบกพร่องระดับกลาง/คุณภาพโค้ด (P2)

| # | ปัญหา | ที่อยู่ |
|---|---|---|
| 11.1 | `bookingID` = วันที่ + สุ่ม 4 หลัก ไม่ตรวจซ้ำ → วันเดียวกันจอง ~120 ครั้งมีโอกาสชนเกิน 50% (birthday problem) | [booking_payment.go:89-90](backend/internal/handlers/booking_payment.go) |
| 11.2 | ชื่อผู้ตรวจสอบ hardcode เป็นชื่อ นศ. เป็นค่า default | [:278](backend/internal/handlers/booking_payment.go), [:389](backend/internal/handlers/booking_payment.go) |
| 11.3 | `EmpActivityLogs` ที่บันทึกจาก approve/reject **ไม่ใส่ `UserID`** → audit trail ไม่รู้ว่าใครทำ (มีแค่ชื่อในข้อความ) | [:364](backend/internal/handlers/booking_payment.go) |
| 11.4 | สถานะปนภาษา: `Booking.Status` ใช้อังกฤษ (`under_review`, `issued`, `rejected`) แต่ `Payment.PaymentStatus` ใช้ไทย (`รอตรวจสอบ`, `อนุมัติ`) และเป็น magic string ไม่มี constant | ทั้งไฟล์ |
| 11.5 | ไม่มี pagination — `getSalesBookings` / `getCustomerBookings` ดึงทั้งตารางพร้อม Preload | [:244](backend/internal/handlers/booking_payment.go), [:180](backend/internal/handlers/booking_payment.go) |
| 11.6 | Query `user_id = ? OR customer_email = ?` เมื่อ `email` ว่างจะกลายเป็นเทียบกับสตริงว่าง — ควรแยกเงื่อนไข | [:186](backend/internal/handlers/booking_payment.go) |
| 11.7 | `ILIKE` ผูกกับ PostgreSQL โดยเฉพาะ (ย้าย DB ไม่ได้) | [:257](backend/internal/handlers/booking_payment.go) |
| 11.8 | `oxlint` เตือน `exhaustive-deps` 10+ จุด รวมถึง `SalesBookingManagement/index.tsx:65` | frontend หลายไฟล์ |
| 11.9 | `SeatSelection/index.tsx` 416 บรรทัด / `SalesBookingManagement/index.tsx` 499 บรรทัด / `concert.go` 952 บรรทัด — ไฟล์ใหญ่เกินไป | หลายไฟล์ |
| 11.10 | `normalizeOperationalDateTimeColumns` รัน `ALTER TABLE` ~28 คำสั่งทุกครั้งที่สตาร์ต server | [migrate.go](backend/internal/models/migrate.go) |
| 11.11 | `MigrateVenueSeatModels` เป็น dead code — ไม่มีใครเรียก | [migrate.go](backend/internal/models/migrate.go) |
| 11.12 | เทสต์ integration ทั้งหมด SKIP ถ้าไม่มี PostgreSQL → `go test ./...` ขึ้น `ok` แม้ไม่ได้ทดสอบอะไรจริง | `handlers/*_test.go` |

---

## 12. สิ่งที่ทำได้ดี (ใช้ตอบตอนสอบได้)

อย่าลืมพูดถึงข้อดี — กรรมการอยากได้ยินว่ารู้ว่าอะไรถูก ไม่ใช่แค่รู้ว่าอะไรผิด

1. **Session token ทำถูกหลัก** — สุ่ม 32 bytes, เก็บเฉพาะ SHA-256 hash ลง DB, cookie เป็น HttpOnly, มี expiry ([customer_account.go:224-252](backend/internal/handlers/customer_account.go))
2. **รหัสผ่าน hash ด้วย bcrypt** ทั้งฝั่งลูกค้าและพนักงาน และ DTO ไม่เผย `password_hash` ออก API (มีเทสต์ยืนยัน: `TestCustomerAccountViewDoesNotExposePassword`)
3. **Audit trail ครบ** — ทุกการอนุมัติ/ปฏิเสธเขียน `EmpActivityLogs`, ทุกการจองเขียน `CusActivityLogs`
4. **จัดการ timezone อย่างจงใจ** — normalize เป็น `timestamp/time/date without time zone` ทั้งระบบ เพื่อไม่ให้เวลาแสดงเพี้ยน
5. **`go vet` สะอาด, backend build ผ่าน, เทสต์ frontend 69 ตัวผ่านหมด**
6. **CORS ตั้ง whitelist origin เจาะจง** ไม่ได้ใช้ `*` ทั้งที่เปิด `AllowCredentials`
7. **มี spec + plan เป็นเอกสารประกอบ** ใน `docs/superpowers/` สำหรับ 3 ฟีเจอร์ล่าสุด
8. **งานบน branch `korn` มีเทสต์คุมทุกไฟล์ที่แตะ** — เพิ่ม 6 ไฟล์โค้ด มาพร้อมเทสต์ 5 ไฟล์ (สัดส่วนดีกว่าโค้ดเดิมมาก)

---

## 13. คำถามที่กรรมการน่าจะถาม + แนวตอบ

**ถาม: ระบบกันคนสองคนจองที่นั่งเดียวกันยังไง?**
ตอบตรง ๆ ว่า **ยังไม่ได้กัน** — เวอร์ชันนี้ผังที่นั่งสร้างฝั่ง client และการล็อกเป็น timer ในเบราว์เซอร์ ยังไม่ได้ persist ลง DB
ทางแก้ที่ออกแบบไว้: เพิ่มตาราง `seat_lock` (seat_id, concert_id, locked_by, expires_at) + unique index `(concert_id, seat_id)` และให้ `POST /api/bookings` ทำใน transaction ที่ `SELECT ... FOR UPDATE` แถวที่นั่งก่อน insert

**ถาม: ถ้าลูกค้าแก้ราคาใน DevTools ก่อนกดจอง จะเป็นยังไง?**
ยอมรับว่า **ได้บัตรในราคาที่แก้** เพราะ backend เชื่อ `total_price` จาก client
ทางแก้: backend ต้องคิดราคาเองจาก `TicketCategory`/`Zone` ใน DB × จำนวนที่นั่ง แล้วหักส่วนลดจาก `Promotion` ที่ validate ใหม่ — ค่าจาก client ใช้แค่เทียบยืนยัน ถ้าไม่ตรงให้ตอบ 400

**ถาม: ทำไม endpoint ฝ่ายขายถึงไม่มีการตรวจสิทธิ์?**
โปรเจกต์**มี** `requireEmployee` อยู่แล้วใน `employee_auth.go` แต่ใน `RegisterBookingPaymentRoutes` ยังไม่ได้เอามาใส่ — เป็นการ integrate ที่ยังไม่เสร็จ ไม่ใช่การไม่มีกลไก แก้ได้ด้วยการเติม middleware 4 บรรทัด

**ถาม: E-Ticket ปลอมได้ไหม?**
ได้ เพราะ QR payload เป็น plain text `OCTAVIA|ticketID|...` ไม่มีลายเซ็น
ทางแก้: ใส่ HMAC ต่อท้าย payload ด้วย secret ฝั่ง server แล้วให้ประตูตรวจผ่าน API `GateCheckIn` ที่ verify signature + เช็คว่ายังไม่ถูกใช้

**ถาม: ทำไมบัตรเขียนที่นั่ง A1-01 ทั้งที่ลูกค้าเลือก A1-15?**
เพราะ backend ไม่ได้ใช้ `input.Seats` แต่ generate ชื่อที่นั่งใหม่วนจาก 1 ถึงจำนวนใบ — เป็นบั๊กจริงที่รู้ตัว และแก้ได้ด้วยการบันทึก `Seats` ลง `Ticket.SeatLabel` ตรง ๆ

**ถาม: เทสต์ครอบคลุมแค่ไหน?**
ตอบตามจริง: backend มี unit test สำหรับ validation/logic บริสุทธิ์ และ integration test ที่ต้องมี PostgreSQL (ถ้าไม่มีจะ SKIP), frontend 69 เทสต์
และยอมรับว่า **โมดูลจองบัตร/ชำระเงินยังไม่มีเทสต์** เป็นงานลำดับถัดไป

**ถาม: ข้อมูลที่เห็นบนหน้าจอมาจาก DB จริงไหม?**
ต้องระวัง — API client มี localStorage fallback ถ้า backend ล่มจะสลับไปใช้ mock เงียบ ๆ **ก่อน demo ให้เปิด Network tab ยืนยันว่ามี request จริงไปที่ `/api/...` และ status 200**

**ถาม: ถ้าให้แก้ได้ 1 อย่าง จะแก้อะไร?**
ย้ายการคิดราคาไปฝั่ง server พร้อมใส่ `requireCustomer`/`requireEmployee` — เพราะมันปิดทั้งช่องแก้ราคาและช่องอนุมัติเองในคราวเดียว

---

## 14. Checklist สิ่งที่ควรแก้ก่อนสอบ (เรียงตามคุ้มค่า)

### ต้องแก้ (ถ้ามีเวลาแค่ 1 ชั่วโมง ทำแค่ 3 ข้อนี้)

- [ ] **แก้ casing ของ import assets** — เปลี่ยน `@/assets/LOGO` → `@/assets/logo`, `@/assets/Poster` → `@/assets/poster` ให้ครบทุกจุด
  ```bash
  grep -rln "@/assets/LOGO\|@/assets/Poster" frontend/src
  ```
- [ ] **จัดการ `src/services/https/index.ts`** — ติดตั้ง axios (`npm i axios`) หรือเขียนใหม่ด้วย `fetch` แล้วใส่ type ให้ `config`
- [ ] **ยืนยันว่า `npm run build` ผ่าน** — ต้องเห็น exit code 0 ก่อนเข้าห้องสอบ
  ```bash
  cd frontend && npm run build
  ```

### ควรแก้ (ถ้ามีครึ่งวัน)

- [ ] ใส่ middleware ให้ route ฝ่ายขาย 4 ตัวใน `RegisterBookingPaymentRoutes` — ใช้ `requireEmployee` ที่มีอยู่แล้ว
- [ ] ให้ `getCustomerBookings` อ่าน user จาก session cookie แทนการรับ `user_id`/`email` จาก query string
- [ ] ลบ backdoor `Admin1234!` / `Demo1234!` และบล็อกการสร้าง user ปลอมจาก username ที่มีคำว่า `sales` ใน `employee_auth.go`
- [ ] คิดราคาซ้ำฝั่ง server ใน `createBooking` — อย่างน้อยเช็คว่า `total_price` ที่ client ส่งมาตรงกับที่ server คำนวณ ถ้าไม่ตรงคืน 400
- [ ] ห่อ `createBooking` และ `approveBooking` ด้วย `h.db.Transaction(...)` และเลิกใช้ `_ =` กับ error ที่สำคัญ
- [ ] เขียน `booking_payment_test.go` อย่างน้อย 3 เคส: สร้างการจอง / อนุมัติแล้วได้ตั๋วครบตามจำนวน / ปฏิเสธโดยไม่ใส่เหตุผลต้องได้ 400
- [ ] ลบ `backend/octavia-server.exe` ออกจาก git แล้วเพิ่มลง `.gitignore`
  ```bash
  git rm --cached backend/octavia-server.exe
  ```

### แก้ถ้ามีเวลาเหลือ

- [ ] ต่อ `internal/mailer` เข้ากับ `resendTickets` ให้ส่งอีเมลจริง
- [ ] แยก logic สร้างตั๋วออกเป็นฟังก์ชันเดียว `issueTicketsForBooking(tx, booking)` แล้วเรียกจากที่เดียว ลบ auto-repair ใน GET ทิ้ง
- [ ] เก็บ `input.Seats` ลง `Ticket.SeatLabel` ให้ตรงกับที่ลูกค้าเลือกจริง
- [ ] ทำให้ localStorage fallback ปิดได้ด้วย env flag เพื่อให้รู้ทันทีเวลา backend ล่ม
- [ ] เพิ่ม pagination ให้ `/api/sales/bookings`
- [ ] rotate รหัสผ่าน PostgreSQL เพราะค่าเดิมยังอยู่ใน git history

---

## ภาคผนวก: คำสั่งที่ใช้ตรวจสอบ

```bash
cd backend && go build ./... && go vet ./... && go test ./...
```

```bash
cd frontend && npm run build
```

```bash
cd frontend && npx vitest run && npx oxlint
```
