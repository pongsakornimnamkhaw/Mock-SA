# Ticket Planning and Event Registration (`codex/gg-clean`)

โมดูลนี้ต่อระบบวางแผนจำหน่ายบัตรและลงทะเบียนเข้างานเข้ากับ `origin/main`
โดยไม่แทนที่ route หรือ handler ของระบบ Booking, Payment, Promotion และ Account เดิม

## ฐานข้อมูลสำหรับพัฒนา

จากโฟลเดอร์ `backend`:

```powershell
docker compose up -d postgres
go run ./cmd/server
```

ระบบใช้ `backend/compose.yml` เดิมและ PostgreSQL พอร์ต `5432` โดยอ่านค่าจาก `.env` หรือ environment variables
การเริ่ม API ใช้ `AutoMigrate` แบบเพิ่ม schema เท่านั้น ไม่มี `DROP TABLE` หรือ rename legacy
โครงสร้าง Ticket/Seat รุ่นนี้ต้องเริ่มจากฐานว่าง; การล้าง volume เดิมเป็นงานแยกที่ต้องยืนยันก่อน เพราะข้อมูลเดิมจะสูญหาย

## ตารางที่ระบบใหม่อ่านและเขียน

| ตาราง | ใช้ในหน้า/งาน | หน้าที่ |
| --- | --- | --- |
| `concerts` | เลือกคอนเสิร์ต, ภาพรวม, Dashboard ลงทะเบียน | ข้อมูลคอนเสิร์ตและภาพผังสำเร็จใน `seat_layout_image` (`bytea`) |
| `performance_schedules` | แท็บภาพรวม | รอบการแสดงจากระบบศิลปิน ไม่มีปุ่มเพิ่มรอบในระบบวางแผน |
| `zones` | ออกแบบผัง, สรุปโควตา | รูปทรง สี ตำแหน่ง ความจุ `zone_price` และ FK แบบบังคับไป `concerts` |
| `seats` | รายละเอียดที่นั่ง, เช็กอิน | ที่นั่งภายใน Zone; ความสัมพันธ์ `Zone 1 -> 0..* Seat` |
| `layout_objects` | ออกแบบผังและออกแบบบัตร | JSON ของวัตถุแก้ไขได้ เช่น ข้อความ รูปภาพ รูปทรง ตำแหน่ง ขนาด หมุน และด้านหน้า/หลัง เชื่อม `concerts` จุดเดียว |
| `publications` | วางขายหน้าเว็บ | คำอธิบาย ภาพปก ช่วงแสดงหน้าเว็บ และช่วงจำหน่าย แบบหนึ่งรายการต่อคอนเสิร์ต |
| `tickets` | ราคา, ภาพบัตร, ค้นหา/สแกน | ราคาจริงใน `price_ticket`, ภาพบัตรใน `image_ticket` (`bytea`), สถานะ และ FK ไป Seat/Booking |
| `gate_check_ins` | Dashboard และหน้าสแกน | บันทึกการเข้างาน; `ticket_id` unique ทำให้บัตรหนึ่งใบเข้างานได้ครั้งเดียว |

ตาราง `venue_seat_*`, Models และ API `/api/venue-seat` ถูกถอดออก โดยใช้ `/api/ticket-planning` เพียงชุดเดียว

## API ใหม่

- `/api/ticket-planning/*` สำหรับแผนจำหน่าย ผัง Publication แบบบัตร และภาพ `bytea`
- `/api/event-registration/*` สำหรับ Dashboard ค้นหาบัตร ภาพบัตร และเช็กอิน

Frontend ใช้:

- `/search-concert` สำหรับ flow วางแผนจำหน่ายบัตร
- `/event-registration` สำหรับเลือกคอนเสิร์ต, Dashboard, สแกน/ค้นหา และตัวอย่างสถานะ

สถานะตรวจบัตรที่ UI รองรับคือ ผ่านการตรวจสอบ, บัตรถูกใช้แล้ว, ไม่พบบัตร และบัตรยังใช้ไม่ได้
