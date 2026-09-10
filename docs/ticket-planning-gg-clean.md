# Ticket Planning and Event Registration (`codex/gg-clean`)

โมดูลนี้ต่อระบบวางแผนจำหน่ายบัตรและลงทะเบียนเข้างานเข้ากับ `origin/main`
โดยไม่แทนที่ route หรือ handler ของระบบ Booking, Payment, Promotion และ Account เดิม

## ฐานข้อมูลแยกสำหรับพัฒนา

จากโฟลเดอร์ `backend`:

```powershell
docker compose -f compose.gg-clean.yml up -d postgres-gg-clean
Copy-Item .env.gg-clean.example .env
go run ./cmd/server
```

ฐานนี้ใช้ PostgreSQL ที่พอร์ต `5434` และ volume `gg_clean_postgres_data` จึงไม่แตะฐานเดิมพอร์ต `5432`
การเริ่ม API ใช้ `AutoMigrate` แบบเพิ่ม schema เท่านั้น ไม่มี `DROP TABLE` หรือ rename legacy

## ตารางที่ระบบใหม่อ่านและเขียน

| ตาราง | ใช้ในหน้า/งาน | หน้าที่ |
| --- | --- | --- |
| `concerts` | เลือกคอนเสิร์ต, ภาพรวม, Dashboard ลงทะเบียน | ข้อมูลคอนเสิร์ตและภาพผังสำเร็จใน `seat_layout_image` (`bytea`) |
| `performance_schedules` | แท็บภาพรวม | รอบการแสดงจากระบบศิลปิน ไม่มีปุ่มเพิ่มรอบในระบบวางแผน |
| `zones` | ออกแบบผัง, สรุปโควตา | รูปทรง สี ตำแหน่ง ความจุ และ FK แบบ nullable ไป `concerts` เพื่อเข้ากับข้อมูลเดิมของระบบเพื่อน |
| `seats` | รายละเอียดที่นั่ง, เช็กอิน | ที่นั่งภายใน Zone; ความสัมพันธ์ `Zone 1 -> 0..* Seat` |
| `layout_objects` | ออกแบบผังและออกแบบบัตร | JSON ของวัตถุแก้ไขได้ เช่น ข้อความ รูปภาพ รูปทรง ตำแหน่ง ขนาด หมุน และด้านหน้า/หลัง เชื่อม `concerts` จุดเดียว |
| `publications` | วางขายหน้าเว็บ | คำอธิบาย ภาพปก ช่วงแสดงหน้าเว็บ และช่วงจำหน่าย แบบหนึ่งรายการต่อคอนเสิร์ต |
| `tickets` | ราคา, ภาพบัตร, ค้นหา/สแกน | ราคาจริงใน `price_ticket`, ภาพบัตรใน `image_ticket` (`bytea`), สถานะ และ FK ไป Seat/Booking |
| `gate_check_ins` | Dashboard และหน้าสแกน | บันทึกการเข้างาน; `ticket_id` unique ทำให้บัตรหนึ่งใบเข้างานได้ครั้งเดียว |

ตาราง `venue_seat_*` และ API `/api/venue-seat` เดิมยังคงอยู่เพื่อไม่ให้หน้าเก่าของระบบเพื่อนเสีย
แต่สอง route ใหม่ไม่อ่านหรือเขียนตารางเหล่านั้น

## API ใหม่

- `/api/ticket-planning/*` สำหรับแผนจำหน่าย ผัง Publication แบบบัตร และภาพ `bytea`
- `/api/event-registration/*` สำหรับ Dashboard ค้นหาบัตร ภาพบัตร และเช็กอิน

Frontend ใช้:

- `/search-concert` สำหรับ flow วางแผนจำหน่ายบัตร
- `/event-registration` สำหรับเลือกคอนเสิร์ต, Dashboard, สแกน/ค้นหา และตัวอย่างสถานะ

สถานะตรวจบัตรที่ UI รองรับคือ ผ่านการตรวจสอบ, บัตรถูกใช้แล้ว, ไม่พบบัตร และบัตรยังใช้ไม่ได้
