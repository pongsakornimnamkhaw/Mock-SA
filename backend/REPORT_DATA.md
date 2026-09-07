# ข้อมูลจริงสำหรับทดสอบรายงานหลังจบคอนเสิร์ต

คำสั่งนี้เพิ่มข้อมูลแบบถาวรลง PostgreSQL ที่กำหนดใน `backend/.env`:

```powershell
cd backend
go run ./cmd/seed-reports --apply
```

รายการที่เพิ่ม:

- Neon Flux: 5,000 บัตร ยอดขาย 30,330,000 บาท
- Neon Pulse: 2,052 บัตร ยอดขาย 20,520,000 บาท
- Celestial Sounds: 4,000 บัตร ยอดขาย 14,000,000 บาท

ยอดบนหน้ารายงานคำนวณจาก `tickets` ที่เชื่อมกับ `seats`, `zones` และ `ticket_categories` จริง ไม่ใช่ค่าที่ฝังใน Frontend รวมทั้งมีโปสเตอร์ Booking, Payment, WorkPlan และ SponsorshipRequest ในฐานข้อมูล

คำสั่งรันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ และจะไม่แก้ไขหรือลบข้อมูลเดิม
