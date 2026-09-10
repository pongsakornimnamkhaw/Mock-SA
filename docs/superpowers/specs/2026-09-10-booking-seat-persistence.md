# Spec: บันทึกการจองลงตาราง Zone / Seat / TicketCategory / Ticket

## ปัญหาปัจจุบัน

struct ทั้งสี่ตัวมีอยู่แล้วใน `backend/internal/models/ticket.go` และถูก AutoMigrate อยู่แล้ว
แต่ **ข้อมูลที่เขียนลงไปเป็นข้อมูลปลอมทั้งหมด** และ `TicketCategory` ไม่เคยถูกเขียนเลย

- `createBooking` (`backend/internal/handlers/booking_payment.go:77-177`) รับ `input.Seats`
  (ที่นั่งที่ลูกค้าเลือกจริง ๆ) เข้ามา แต่ **ใช้แค่นับจำนวน** (บรรทัด 105-111) แล้วโยนทิ้ง
  ไม่มีการบันทึกว่าจองที่นั่งใบไหน
- ตอนอนุมัติสลิป (`approveBooking:320-359`) และตอนโหลดรายการจอง (`getCustomerBookings:205-236`)
  จะ "สร้างที่นั่งปลอม" ขึ้นมา: `Zone{ZoneID: "ZONE-A", Capacity: 1000}`,
  `Seat{SeatRow: 1, SeatColumn: i}` วนตามจำนวนใบ, `ConcertID` fallback เป็น `"C001"`
  ที่นั่งพวกนี้ไม่มีอยู่จริงบนผังงาน และเลขที่นั่งบนตั๋วจึงเป็น `ZONE-A-01`, `ZONE-A-02` เรียงไปเรื่อย ๆ
  ไม่ตรงกับที่ลูกค้าเลือก
- `TicketCategory` ไม่ถูกเขียนจากที่ไหนเลยในระบบ — ราคาบัตรอยู่ใน `VenueSeatZone.Price`
  กับ hardcode ใน `frontend/src/components/SeatSelection/constants.ts:14-25` แทน
- ฝั่งหน้าเว็บก็เป็นข้อมูลปลอมเช่นกัน: `generateSeats()`
  (`frontend/src/components/SeatSelection/constants.ts:32-49`) สร้างที่นั่ง A1–E8 ในเบราว์เซอร์
  พร้อม hardcode ที่นั่ง "ถูกจองแล้ว" 12 ใบเหมือนกันทุกคอนเสิร์ตทุกโซน และ `zonesData`
  ใน `frontend/src/pages/Customer/ZoneSelection/index.tsx:19` ก็เป็น list ตายตัว
- ผลคือ **ลูกค้าสองคนจองที่นั่งใบเดียวกันได้** และไม่มีใครรู้ว่าที่นั่งไหนขายไปแล้ว

## สิ่งที่ต้องได้

1. ผังที่นั่งที่พนักงานวาดไว้ (หน้า "ห้องสถานที่และที่นั่ง") ต้องกลายเป็นแถวจริงใน
   `Zone`, `Seat`, `TicketCategory`
2. หน้าเลือกโซน (`/event/:id/zones`) และหน้าเลือกที่นั่ง (`/event/:id/seats/:zone`)
   ต้องอ่านโซน/ที่นั่ง/ราคาจากตารางเหล่านี้ ไม่ใช่จาก mock ในเบราว์เซอร์
3. เมื่อลูกค้าจอง ต้องบันทึกลง `Ticket` ว่ากินที่นั่ง (`Seat`) ใบไหนจริง ๆ ในราคาเท่าไร
   และที่นั่งนั้นต้องเปลี่ยนสถานะเป็นไม่ว่างทันที
4. ที่นั่งที่ถูกจองไปแล้วต้องขึ้นเป็น "ไม่ว่าง" กับลูกค้าคนอื่นและกดเลือกไม่ได้
5. ถ้าที่นั่งถูกชิงไประหว่างที่กำลังกดจอง ต้องได้ error ภาษาไทยที่บอกว่าใบไหนหลุด ไม่ใช่จองซ้ำเงียบ ๆ
6. เลขที่นั่งบนบัตร (หน้า "บัตรของฉัน") ต้องเป็นเลขที่นั่งที่ลูกค้าเลือกจริง

## ขอบเขต (constraint จากผู้ใช้)

**ทำแค่ 4 ตารางที่กำหนดให้: `Zone`, `Seat`, `TicketCategory`, `Ticket`**

- ไม่สร้างตารางใหม่ (เช่น ตารางล็อกที่นั่งชั่วคราว) — สถานะว่าง/ไม่ว่างใช้ `Seat.status_seat` เท่านั้น
- `Booking` / `Payment` แก้ได้เฉพาะที่จำเป็นต่อการเชื่อม 4 ตารางนี้ (ไม่เพิ่ม/ลดคอลัมน์)
- `VenueSeatZone` / `VenueSeat` (ตารางของ editor ผังที่นั่ง) คงไว้ตามเดิม ไม่แตะโครงสร้าง

## การตัดสินใจ

### 1. เก็บ ID เป็น string ต่อไป (ไม่เปลี่ยนตาม `SeatID:int` / `TicketID:uint` ในไดอะแกรม)

ทั้งระบบใช้ ID เป็น `varchar` ที่สร้างด้วย `models.GenerateID(prefix)` (`base.go:19-22`)
และ `Ticket.SeatID`, `Ticket.BookingID` เป็น `varchar` FK อยู่แล้ว การเปลี่ยน PK เป็น int
จะลามไปทุก handler ทุก seeder และข้อมูลเดิม โดยไม่ได้อะไรกลับมาเชิงการใช้งาน
**ยึดตามไดอะแกรมทุกฟิลด์ ยกเว้นชนิดของ PK/FK ที่คงเป็น string**

### 2. `Seatrow` / `Seatcolumn` เปลี่ยนเป็น string ตามไดอะแกรม

ปัจจุบันเป็น `int` ซึ่งเก็บป้ายจริงอย่าง `"A"` ไม่ได้ หน้าเว็บใช้ป้ายแบบ `A1` (แถว `A` คอลัมน์ `1`)
อยู่แล้ว การเป็น string จึงตรงกับการใช้งานจริงและตรงไดอะแกรม
ป้ายที่นั่ง = `seat_row + seat_column` ไม่ต้องเพิ่มคอลัมน์ label

### 3. `Zone` ไม่มี `ConcertID` (ตามไดอะแกรม) — ความเป็นเจ้าของงานมาทาง `Seat`

ไดอะแกรมให้ `Seat` ถือ `ConcertID` ส่วน `Zone` ไม่มี ดังนั้น "โซนของคอนเสิร์ตนี้มีอะไรบ้าง"
ตอบด้วย `SELECT DISTINCT zone_id FROM seats WHERE concert_id = ?`
`ZoneID` ถูกสร้างต่อคอนเสิร์ต (มาจาก id ของโซนบนผัง ซึ่ง unique ต่องานอยู่แล้ว) จึงไม่ชนกันข้ามงาน

### 4. `Ticket` เพิ่ม `CategoryID` เพื่อทำเส้น TicketCategory —— 1..* Ticket ให้เป็นจริง

ไดอะแกรมลากเส้น 1 ต่อ 1..* ระหว่าง `TicketCategory` กับ `Ticket` ไว้ แต่ไม่ได้เขียนคอลัมน์ FK
ในกล่อง `Ticket` การเพิ่ม `CategoryID` คือการทำเส้นนั้นให้ใช้งานได้จริง
(ตอบคำถาม "บัตรประเภทนี้ขายไปกี่ใบ" ได้ตรง ๆ) และ `PriceTicket` ที่ไดอะแกรมระบุไว้
เก็บราคาที่จ่ายจริง ณ ตอนซื้อ (ถ้าราคาใน category เปลี่ยนทีหลัง บัตรเก่าไม่เพี้ยน)

### 5. `TicketCategory` หนึ่งแถวต่อหนึ่งโซน

ระบบจริงตั้งราคาต่อโซน (`VenueSeatZone.Price`, `zonePriceMap` ในหน้าเว็บ)
จึง project โซนละ 1 category: `CategoryName` = ชื่อโซน, `Price` = ราคาโซน,
`Quantity` = จำนวนที่นั่งในโซน, `ZoneID` ชี้กลับไปที่โซน
คอลัมน์ `PromotionName` / `PromotionID` ที่มีอยู่แล้วคงไว้ ปล่อยว่างได้ (โปรโมชั่นคิดที่ระดับ booking)

### 6. ผัง → ตารางตั๋ว เกิดตอนพนักงานบันทึกผัง (projection at save time)

`saveLayout` / `persistConcert` เขียน `VenueSeatZone`/`VenueSeat` อยู่แล้วใน transaction เดียว
เพิ่มการ project ลง `Zone`/`Seat`/`TicketCategory` ใน transaction เดียวกันนั้น
**ไม่ rewrite editor** (ความเสี่ยงสูง ไม่ได้อยู่ในขอบเขต) แต่ตารางทั้งสี่กลายเป็นแหล่งข้อมูลจริง
ของฝั่งขายบัตร

ที่นั่งที่ถูกจองไปแล้ว (`status_seat` ไม่ว่าง) จะ **ไม่ถูกลบทิ้งตอนบันทึกผังใหม่** —
projection จะ upsert เฉพาะที่นั่งว่าง เพื่อไม่ให้บัตรที่ขายไปแล้วกลายเป็นบัตรกำพร้า

### 7. คอนเสิร์ตที่ยังไม่มีผัง → สร้างผังเริ่มต้น 5×8 ให้อัตโนมัติเมื่อมีคนเปิดหน้าเลือกที่นั่ง

หน้าเว็บที่ทำไว้ใช้โซน `A1`–`C4` และที่นั่ง `A1`–`E8` (5 แถว × 8 ที่) เป็น mock
ถ้าตัดทิ้งเฉย ๆ หน้าเดิมจะว่างเปล่า จึงให้ endpoint ที่นั่ง **materialize ผังเริ่มต้นชุดเดียวกัน
ลงตารางจริง** เมื่อยังไม่มีแถวของ (คอนเสิร์ต, โซน) นั้น — หน้าเว็บเดิมทำงานต่อได้
โดยข้อมูลที่ได้เป็นข้อมูลจริงในฐานข้อมูลแล้ว ไม่ใช่ mock ในเบราว์เซอร์

### 8. ตั๋วถูกสร้างตั้งแต่ตอนจอง ไม่ใช่ตอนอนุมัติ

ต้องรู้ให้ได้ว่าที่นั่งใบไหนเป็นของ booking ไหน **ตั้งแต่วินาทีที่จอง** (ไม่งั้นกันจองซ้ำไม่ได้)
และ constraint ห้ามสร้างตารางใหม่มาเก็บความสัมพันธ์นี้ ดังนั้น `Ticket` ถูกสร้างตอนจองเลย
โดยใช้ `StatusTicket` เดินตามสถานะ:

| เหตุการณ์ | `Ticket.StatusTicket` | `Seat.StatusSeat` |
|---|---|---|
| ลูกค้ากดจอง + แนบสลิป | `รอตรวจสอบ` | `ไม่ว่าง` |
| พนักงานอนุมัติสลิป | `พร้อมใช้งาน` | `ไม่ว่าง` |
| พนักงานปฏิเสธสลิป | `ยกเลิก` | `ว่าง` (คืนที่นั่ง) |

### 9. กันจองซ้ำด้วย conditional update ไม่ใช่ check-then-write

สองคนกดจองพร้อมกันจะผ่านการ "เช็คว่าว่างไหม" ทั้งคู่ (คนละ transaction มองไม่เห็นกัน)
ด่านจริงคือ `UPDATE seats SET status_seat = 'ไม่ว่าง' WHERE seat_id IN (...) AND status_seat = 'ว่าง'`
แล้วเทียบ `RowsAffected` กับจำนวนที่ขอ ถ้าไม่เท่ากันแปลว่ามีคนชิงไป → rollback ทั้ง transaction
แล้วตอบ 409 พร้อมบอกว่าที่นั่งใบไหนหลุด

### 10. `bookingPaymentApi.createBooking` ต้องเลิกกลืน error

ตอนนี้ `catch` ครอบทุกอย่างแล้วไปสร้าง booking ใน local store แทน
(`frontend/src/api/bookingPaymentApi.ts:153-179`) ถ้าเซิร์ฟเวอร์ตอบ 409 ว่าที่นั่งถูกชิงไปแล้ว
ลูกค้าจะยังเห็นว่า "จองสำเร็จ" ต้องแยก **"เซิร์ฟเวอร์ปฏิเสธ" (โยน error ต่อ)** ออกจาก
**"ต่อเซิร์ฟเวอร์ไม่ได้" (fallback local ตามเดิม)**

## โครงสร้างตารางเป้าหมาย

```
Zone(zone_id PK, zone_type, capacity,
     position_x, position_y, width, height, rotation, shape, color, layer_order)

Seat(seat_id PK, seat_row, seat_column, status_seat, flowchart,
     position_x, position_y, rotation, concert_id FK, zone_id FK)

TicketCategory(category_id PK, category_name, price, quantity,
               promotion_name, promotion_id, zone_id FK)

Ticket(ticket_id PK, name_concert, ticket_datetime, image_ticket, price_ticket,
       status_ticket, seat_id FK, seat_label, category_id FK, booking_id FK, qr_code_data)
```

ฟิลด์ที่เพิ่มจากของเดิม: `Zone` เพิ่ม geometry 8 ฟิลด์ · `Seat` เพิ่ม `flowchart`,
`position_x`, `position_y`, `rotation` และเปลี่ยน `seat_row`/`seat_column` เป็น string ·
`Ticket` เพิ่ม `image_ticket`, `price_ticket`, `category_id`

`Ticket.seat_label`, `Ticket.qr_code_data` เป็นของเดิมที่หน้าเว็บใช้อยู่ (ticket stub / QR) — คงไว้

## API ที่จะเพิ่ม

```
GET /api/concerts/:id/zones                  → โซน + ราคา + จำนวนที่นั่งว่าง
GET /api/concerts/:id/zones/:zoneId/seats    → ที่นั่งทั้งหมดในโซน พร้อมสถานะ
```

`POST /api/bookings` เดิม เปลี่ยนพฤติกรรม: บันทึกที่นั่งจริง และตอบ 409 เมื่อที่นั่งไม่ว่าง

## ความทับซ้อนกับแผนอื่น

`docs/superpowers/plans/2026-09-10-seat-locking.md` (ยังไม่ commit) แก้ปัญหาเดียวกันบางส่วน
ด้วยการ **เพิ่มตารางใหม่ `seat_holds`** สำหรับล็อกชั่วคราว 15 นาที
แผนนี้ทำตาม constraint "ทำแค่ตามตารางที่กำหนดให้" จึง **ไม่มีล็อกชั่วคราว** —
ที่นั่งจะไม่ว่างก็ต่อเมื่อจองสำเร็จแล้วเท่านั้น (ตัวจับเวลา 15 นาทีบนหน้าจอยังเป็น state ในเบราว์เซอร์)

**ห้ามรันสองแผนนี้ทับกันโดยไม่ตัดสินใจก่อน** ว่าจะเอาแนวไหน ถ้าภายหลังต้องการล็อกชั่วคราวจริง ๆ
ให้ทำต่อยอดบนแผนนี้โดยเพิ่มสถานะ `กำลังชำระเงิน` + `hold_expires_at` ใน `Seat`
(ยังอยู่ใน 4 ตารางเดิม) แทนการสร้างตารางใหม่
