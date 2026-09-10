# Spec: ทำให้ Payment / Booking / Ticket ใช้งานได้จริงทั้งสาย (ไม่มีข้อมูลปลอมฝั่งหน้าเว็บ)

## ภูมิหลัง

งานก่อนหน้า ([2026-09-10-booking-seat-persistence](2026-09-10-booking-seat-persistence.md)) ทำให้ backend
บันทึกที่นั่งจริงลง `Zone`/`Seat`/`TicketCategory`/`Ticket` ตอนลูกค้าจอง และเลิกสร้างที่นั่งปลอมตอนอนุมัติ/ปฏิเสธ
แล้ว — **แต่ฝั่งหน้าเว็บ (frontend) ยังมีโค้ดปลอมตั๋วหลงเหลืออยู่ 2 จุด** ที่เขียนไว้ตั้งแต่ก่อนมี backend
จริง (เพื่อโชว์ UI ตอน backend ยังไม่มา) และไม่เคยถูกลบออก งานนี้คือการไล่ลบให้หมด บวกทำให้
"ส่งบัตรซ้ำ" ที่ตอนนี้เป็น stub (ไม่ส่งอีเมลจริง) กลายเป็นของจริง

## ปัญหาที่พบ (วิเคราะห์จากโค้ดจริง)

### 1. `frontend/src/api/bookingPaymentApi.ts` — `mapWireToBooking` ปลอมตั๋วเมื่อ backend ไม่ส่งมา

```ts
if (b.status === 'issued' && (!tickets || tickets.length === 0)) {
  const qty = b.quantity || 1;
  tickets = Array.from({ length: qty }, (_, index) => {
    const seatLabel = `${b.zone_id || 'A'}-${String(index + 1).padStart(2, '0')}`;
    const code = `TCK-${...}-${...}`;
    ...
  });
}
```

ฟังก์ชันนี้เป็นจุดแปลง response จาก backend เป็น `BookingRecord` ที่ **ทุก endpoint ใช้ร่วมกัน**
(`getCustomerBookings`, `getSalesBookings`, `approveBooking`, `rejectBooking`) — ปลอมตั๋วที่นี่จุดเดียว
กระทบทุกหน้าที่แสดงตั๋ว หลังงานก่อนหน้า backend จะสร้าง `Ticket` จริงตั้งแต่ตอนจองเสมอ
เงื่อนไข `!tickets || tickets.length === 0` ตอนนี้ไม่ควรเกิดขึ้นกับการจองใหม่แล้ว — แต่โค้ดปลอมยังอยู่
เป็นระเบิดเวลา (ถ้าเกิดบั๊กฝั่ง backend ในอนาคตทำให้ตั๋วหาย ผู้ใช้จะเห็น "ตั๋ว" ที่เลขที่นั่ง/รหัสไม่ตรงความจริง
โดยไม่มีทางรู้ว่าเป็นของปลอม)

นอกจากนี้ `BookingRecord.seats` (รายการเลขที่นั่ง) **ไม่เคยถูกเซ็ตค่าเลยในฟังก์ชันนี้** ทั้งที่ backend
ส่ง `seat_label` มาในแต่ละ ticket อยู่แล้ว — หน้า "ประวัติการซื้อ" จึงโชว์ "(-)" แทนเลขที่นั่งจริงเสมอ

### 2. `frontend/src/pages/Customer/Account/index.tsx` — ปลอมตั๋วซ้ำอีกชั้นตอน render

```tsx
const ticketsToRender = (booking.tickets && booking.tickets.length > 0)
    ? booking.tickets
    : Array.from({ length: booking.quantity || 1 }, (_, index) => {
        const seatLabel = booking.seats?.[index] || `${booking.zoneId}-${...}`;
        const code = `TCK-${...}`;
        ...
      });
```

นี่คือ **"ส่วนของบัตร"** ที่ผู้ใช้เห็นจริงในหน้า "บัตรของฉัน" — มี fallback ปลอมตั๋วซ้ำอีกรอบ
เป็นชั้นที่สองซ้อนกับจุดที่ 1 ถ้าจุดที่ 1 หลุดผ่านมา (หรือแม้จุดที่ 1 ถูกแก้แล้ว โค้ดจุดนี้ก็ยังพร้อมปลอม
ตั๋วเองได้อยู่ดีถ้า `booking.tickets` ว่าง) การ์ดบัตรที่ render จากตรงนี้ต้อง **มาจาก `Ticket` ที่มาจริง
จากฐานข้อมูลเท่านั้น** ไม่มีทางเลือกอื่น

### 3. `resendTickets` (backend) เป็น stub — ไม่ส่งอีเมลจริง

```go
_ = h.db.Create(&models.EmpActivityLogs{... ActionType: "ขอส่งบัตรซ้ำ" ...}).Error
return c.JSON(fiber.Map{
    "message": fmt.Sprintf("ส่งบัตรเข้าชมซ้ำไปยังอีเมล %s สำเร็จ (ใช้รหัสและ QR Code เดิม)", booking.CustomerEmail),
    "data":    booking.Tickets,
})
```

ตอบ "สำเร็จ" เสมอโดยไม่ได้ส่งอะไรจริง ๆ ระบบมี `internal/mailer` (ใช้ส่งอีเมลลืมรหัสผ่านอยู่แล้ว) พร้อมใช้
แต่ handler นี้ไม่เคยเรียก `mailer.Send`

## สิ่งที่ต้องได้

1. หน้า "บัตรของฉัน" / "ประวัติการซื้อ" / ฝั่งพนักงาน "ตรวจสอบสลิปและออกบัตร" **แสดงเฉพาะข้อมูลที่มาจาก
   แถวจริงในตาราง `tickets`** — ไม่มี fallback ปลอมข้อมูลที่จุดไหนอีก ถ้าไม่มีตั๋วจริงให้โชว์ข้อความบอกตรง ๆ
   ว่ายังไม่มีตั๋ว ไม่ใช่ปั้นตั๋วปลอมมาโชว์แทน
2. เลขที่นั่งในหน้า "ประวัติการซื้อ" ต้องเป็นเลขที่นั่งจริงจากตั๋ว ไม่ใช่ "-"
3. ปุ่ม "ขอส่งบัตรซ้ำทางอีเมล" ต้องส่งอีเมลจริง (หรือ log ผ่าน `LogMailer` เมื่อยังไม่ตั้งค่า SMTP — พฤติกรรม
   เดียวกับฟีเจอร์ลืมรหัสผ่านที่มีอยู่แล้ว) เนื้อหาอีเมลต้องมาจากข้อมูลจริงใน `Booking`/`Ticket`
   (ชื่องาน, เลขที่นั่งแต่ละใบ, รหัสตั๋ว)

## ขอบเขต (constraint จากผู้ใช้)

**ทำแค่ 3 ตารางที่กำหนดให้: `Payment`, `Booking`, `Ticket`** — ตารางเหล่านี้มีโครงสร้าง "จริง" ครบอยู่แล้ว
จากงานก่อนหน้า งานนี้จึง**ไม่แก้ schema เพิ่ม** ไม่เพิ่มคอลัมน์ใหม่ ไม่แตะ `Zone`/`Seat`/`TicketCategory`
— เป็นงาน **เดินสายข้อมูลที่มีอยู่แล้วให้ถึงหน้าเว็บจริง ๆ** (ลบ fallback ปลอม + ทำให้ resend อีเมลทำงานจริง)

**ไม่อยู่ในขอบเขต:**
- `Ticket.ImageTicket` (BLOB) — ไม่ populate เพิ่ม เพราะหน้าเว็บ render "บัตร" เองแบบ dynamic อยู่แล้ว
  ด้วย `TicketStub` component (ธีมสีตามโปสเตอร์คอนเสิร์ต) การเก็บภาพนิ่งซ้ำในฐานข้อมูลไม่ได้ช่วยอะไร
  เพิ่มจากที่มีอยู่ (YAGNI) — เก็บไว้เป็นคอลัมน์ว่างที่ยังไม่ถูกใช้ต่อไป
- `Booking.EventDate`/`Location` — `createBookingInput` รับค่านี้จากหน้าเว็บแต่ backend ไม่เคยบันทึกลง
  `Booking` (ไม่มีคอลัมน์นี้ในตาราง) หน้าเว็บที่ต้องใช้ข้อมูลนี้ (เช่นตอนเลือกที่นั่ง) ดึงจาก `Concert`
  ผ่าน `ConcertID` ที่มีอยู่แล้วอยู่แล้ว ไม่ใช่ปัญหาที่เกี่ยวกับ "ส่วนของบัตร" ตามที่ผู้ใช้ระบุ จึงไม่แตะ
- Rate limiting / cooldown ของปุ่มส่งบัตรซ้ำ — ไม่ได้ร้องขอ

## การตัดสินใจ

### 1. แก้ที่ `mapWireToBooking` จุดเดียว ไม่ใช่แก้ทีละหน้า

ทุกหน้า (ลูกค้า/พนักงาน) ที่แสดงตั๋วเรียกผ่าน `bookingPaymentApi` ซึ่งทุก endpoint แปลง response ด้วย
`mapWireToBooking` ฟังก์ชันเดียว — ลบ fallback ปลอมตรงนี้จุดเดียว กระทบทุกหน้าไปพร้อมกัน ไม่ต้องไล่แก้
ทีละไฟล์

### 2. `BookingRecord.seats` มาจาก `tickets[].seatLabel` เสมอ ไม่ใช่ field แยก

Backend ไม่มี column เก็บ "seats" แยกจาก tickets (ที่นั่งแต่ละใบผูกกับ ticket แต่ละใบอยู่แล้วผ่าน
`Ticket.SeatID`) ฝั่งหน้าเว็บจึง derive `seats = tickets.map(t => t.seatLabel)` แทนที่จะพยายามหา field
อื่นมาเติม — ตรงกับข้อมูลจริงและไม่ต้องแก้ backend เพิ่ม

### 3. `resendTickets` ใช้ `mailer.Mailer` ตัวเดียวกับฟีเจอร์ลืมรหัสผ่าน (dependency injection แบบเดียวกัน)

`bookingPaymentHandler` เพิ่ม field `mailer mailer.Mailer` ตามแพทเทิร์นเดิมของ
`customerAccountHandler` (`internal/handlers/customer_account.go:29-33`) — แยก
`RegisterBookingPaymentRoutes(app, db)` (public, ใช้ `mailer.FromEnv()`) ออกจาก
`registerBookingPaymentRoutes(app, db, sender)` (internal, รับ mailer ปลอมได้ตอนเทสต์)
เทสต์ใช้ `captureMailer` ที่มีอยู่แล้วใน package (`customer_password_reset_test.go:17-27`) ไม่ต้องสร้างใหม่

### 4. เนื้อหาอีเมลเป็น plain text เรียงรายการที่นั่ง ไม่ต้องมีรูปภาพ/ไฟล์แนบ

เพื่อไม่ต้อง generate ภาพ QR ฝั่งเซิร์ฟเวอร์ (ต้องมี library เพิ่ม, นอกขอบเขต "3 ตารางที่กำหนดให้")
อีเมลจึงส่งข้อความ: ชื่องาน, รายการ (เลขที่นั่ง + รหัสตั๋ว) ต่อบรรทัด, และบอกให้เข้าเว็บไปดู QR Code
ที่หน้า "บัตรของฉัน" — ตรงกับที่ระบบมีอยู่แล้วจริง ๆ (ไม่โฆษณาฟีเจอร์ที่ไม่มี)

### 5. "ไม่มีตั๋วจริง" ต้องไม่เงียบ ไม่ใช่ fallback ปลอม

ถ้า booking สถานะ `issued` แต่ไม่มี ticket จริงผูกอยู่เลย (ไม่ควรเกิดกับการจองใหม่ตามงานก่อนหน้า
แต่ข้อมูลเก่าก่อนหน้านั้นอาจมีเคสนี้หลงเหลือ) หน้าเว็บต้องโชว์ข้อความสั้น ๆ ตรง ๆ ในจุดนั้น
(เช่น "ไม่มีข้อมูลตั๋วสำหรับรายการนี้ กรุณาติดต่อเจ้าหน้าที่") แทนที่จะปั้นตั๋วปลอม
