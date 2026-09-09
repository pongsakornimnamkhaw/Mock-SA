# Spec: ต่อคอนเสิร์ตจริงเข้า flow ลูกค้า เพื่อให้เลือกโปรโมชั่นได้

## ปัญหาปัจจุบัน

ลูกค้าที่กดตามปกติ (หน้าแรก → ดูรายละเอียด → ซื้อบัตร → เลือกโซน → เลือกที่นั่ง)
**ไม่มีทางเจอโปรโมชั่นเลย** เพราะรายการคอนเสิร์ตที่ลูกค้าเห็นเป็นข้อมูลปลอมทั้งหมด

- `frontend/src/data/customerEvents.ts` hardcode คอนเสิร์ต 4 รายการ id `'1'`–`'4'`
  (Neon Flux Festival 2024, Neon Pulse, Celestial Sounds, Starlight Festival)
  ซึ่ง **ไม่มีอยู่ในตาราง `concerts`**
- โปรโมชั่นจริงในฐานข้อมูลผูกกับ `concert_id` จริง — ปัจจุบันคือ `CC0001`
  (Riverside Sound Festival) และ `CC0002` (Neon Nights Vol.3)
- `matchesConcert()` ใน `frontend/src/utils/seatPromotion.ts` จับคู่ด้วย `concert_id`
  ตรงตัว หรือชื่อคอนเสิร์ตแบบ fuzzy — "Neon Pulse" ไม่ตรงกับทั้ง
  "Riverside Sound Festival" และ "Neon Nights Vol.3" จึงไม่เหลือโปรโมชั่นให้เลือก

ทางเดียวที่จะเห็นโปรโมชั่นตอนนี้คือพิมพ์ URL `/event/CC0001/seats/A1` เอง

ปัญหารอง: ไม่มี endpoint สำหรับดึง **รายการ** คอนเสิร์ตฝั่งลูกค้า มีแค่
`GET /api/customer/concerts/:id` (ทีละรายการ)

## สิ่งที่ต้องได้

1. เพิ่ม `GET /api/customer/concerts` คืนรายการคอนเสิร์ตที่ลูกค้าจองได้
2. หน้ารวมคอนเสิร์ต (`EventList` ที่ใช้ในหน้า `/home` และ `/events`) แสดงคอนเสิร์ตจริงจากฐานข้อมูล
3. ช่องค้นหาบน `CustomerHeader` ค้นจากคอนเสิร์ตจริงชุดเดียวกัน
4. กดจากหน้ารวม → รายละเอียด → เลือกโซน → เลือกที่นั่ง แล้วเจอโปรโมชั่นของคอนเสิร์ตนั้น
   โดยจับคู่ด้วย `concert_id` ตรงตัว (ไม่ต้องพึ่ง fuzzy name matching อีก)
5. คอนเสิร์ตที่ยกเลิกการจัดต้องไม่โผล่ในรายการ

## การตัดสินใจ

- **กรองเฉพาะที่ยกเลิก** ใช้ `customerConcertCancelled()` ตัวเดิมที่
  `GET /api/customer/concerts/:id` ใช้อยู่ เพื่อให้ทั้งสอง endpoint เห็นตรงกัน
  (สถานะ "เลื่อนการจัด" ยังแสดง เพราะ `/concerts/:id` เดิมก็ยังเปิดให้เข้าดู)
- **เรียงตามวันเริ่มงาน** (`start_date` น้อยไปมาก) งานที่ใกล้ถึงขึ้นก่อน
- **คงรูปแบบข้อมูลเดิม** ใช้ `customerPromotionConcertDTO` ตัวเดียวกับ `/concerts/:id`
  และฝั่ง frontend map มาเป็น `CustomerEvent` (interface เดิม) เพื่อให้ JSX
  ของ `EventList`/`CustomerHeader` ไม่ต้องแก้
- **โปสเตอร์**: ตอนนี้ทุกคอนเสิร์ตใน DB ยังไม่มีรูป (`poster` เป็น NULL) ถ้าไม่มี
  `poster_data` ให้เลือกรูปสำรองจาก 4 รูปที่มีอยู่แบบคงที่ตาม `concert_id`
  (คอนเสิร์ตเดิมได้รูปเดิมเสมอ) จะได้ไม่เห็นการ์ดรูปเดียวกันหมดจนดูเหมือนพัง

## API ที่จะเพิ่ม

```
GET /api/customer/concerts
```

- `200` → `{"data": [ <customerPromotionConcertDTO>, ... ]}` เรียงตาม `start_date`
- `500` → `{"error": "ไม่สามารถโหลดคอนเสิร์ตได้"}`

`customerPromotionConcertDTO` (ของเดิม ไม่แก้): `concert_id`, `concert_name`,
`start_date`, `end_date`, `start_time`, `location`, `status`, `more_info`, `poster_data`

## นอกขอบเขต

- **กระดิ่งแจ้งเตือน** (`CustomerConcertNotifications`) ยังใช้ `customerEvents` ต่อไป
  เพราะอาศัยฟิลด์ `isNew` + `announcement` ที่ไม่มีในฐานข้อมูล การทำให้เป็นของจริง
  ต้องออกแบบเรื่อง "คอนเสิร์ตใหม่" ใหม่ทั้งหมด แยกเป็นงานของตัวเอง
- **โซนที่นั่ง** ยังเป็นข้อมูล hardcode (`A1`–`C4`) เหมือนเดิม — ตัวจับคู่โซนแบบ
  fuzzy ที่มีอยู่รองรับ `DEMO_MGMT_V1_ZONE_A` ↔ `A1` ได้แล้ว (ยืนยันด้วยการทดสอบจริง)
  การดึงโซน/ราคาจริงจากระบบจัดการสถานที่เป็นงานแยก
- **`frontend/src/services/https/*` และ `frontend/src/hooks/useConcerts.ts`**
  เป็นโค้ดที่ไม่มีใครเรียกใช้และ import `axios` ที่ไม่ได้ติดตั้ง (ต้นเหตุ error ของ
  `tsc -b` ที่ค้างมาแต่เดิม) — ไม่แตะ ไม่สร้างต่อยอดจากมัน
- ไม่แตะหน้า `EventDetail`, `ZoneSelection`, `SeatSelection` ซึ่งรองรับ
  `concert_id` จริงอยู่แล้ว (มี fallback เรียก `getConcert(id)` เมื่อ id ไม่ใช่ mock)
