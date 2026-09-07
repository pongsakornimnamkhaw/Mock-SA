# Concert Management Models

Entity/Model สำหรับระบบจัดการคอนเสิร์ต เขียนด้วย Go และ GORM จาก class diagram ที่กำหนด

## การใช้งาน

เรียก `model.AutoMigrate(db)` หลังจากเปิดการเชื่อมต่อฐานข้อมูลด้วย GORM แล้ว

โมเดลกำหนดชนิดคอลัมน์สำหรับ PostgreSQL โดยไฟล์ไบนารีใช้ `bytea` และข้อความขนาดใหญ่ใช้ `text` ส่วนฟิลด์เวลาใช้ `TimeOnly` เพื่อรับและส่ง JSON เป็น `HH:mm:ss`

ฟิลด์ foreign key ถูกเพิ่มในโมเดลที่เป็นฝั่งลูกเพื่อให้ GORM สร้างความสัมพันธ์ได้จริง และเพิ่ม `RequirementID` ให้ `ArtistRequirement` เนื่องจากใน diagram ไม่มี primary key ของคลาสนี้ ความสัมพันธ์ Concert–Artist และ Concert–Employee เป็น many-to-many ส่วน EmpActivityLog–ModifiedHistory เป็น one-to-one

## ข้อมูลทดสอบฝั่งลูกค้า

ดูวิธีติดตั้งบัญชี บัตร และประวัติการซื้อจำลองได้ที่ [CUSTOMER_DEMO.md](CUSTOMER_DEMO.md)
