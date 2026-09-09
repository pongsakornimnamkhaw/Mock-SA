# Ticket Planning Database Design (Revised)

## 1. ขอบเขต

เอกสารนี้กำหนดฐานข้อมูลสำหรับหน้าเลือกคอนเสิร์ต ภาพรวมแผน การเผยแพร่หน้าเว็บ ออกแบบผัง และออกแบบบัตร โดยใช้ตารางร่วมของระบบเดิมให้น้อยที่สุด

ระบบวางแผนใช้ `Concert`, `PerformanceSchedule`, `Zone`, `Seat`, `Publication`, `LayoutObject` และอ่านข้อมูลราคาจาก `Ticket`

`Showtime` ถูกยกเลิกทั้งหมด รอบการแสดงต้องอ่านและบันทึกผ่าน `PerformanceSchedule` เท่านั้น

`TicketCategory` เป็นตารางของระบบอื่น ต้องคงโครงสร้างเดิมไว้และห้ามระบบวางแผนใช้เป็นแหล่งราคา โควตา หรือความสัมพันธ์กับ Zone

`Booking` และ `Gate-Check-in` เป็นส่วนของการขาย/ลงทะเบียน ไม่อยู่ในขอบเขต UI วางแผนรอบนี้ และต้องไม่ถูกเพิ่มเป็น dependency ของ handler วางแผน

## 2. ความสัมพันธ์ที่ใช้

- `Concert 1:N PerformanceSchedule`
- `Concert 1:N Zone`
- `Zone 1:N Seat`
- `Seat 1:N Ticket`
- `Concert 1:0..1 Publication`
- `Concert 1:N LayoutObject`
- `LayoutObject 1:N LayoutObject` ผ่าน `ParentObjectID`

ไม่มีความสัมพันธ์จาก `LayoutObject` ไป `User`, `Zone`, `Seat`, `TicketCategory` หรือ `Booking`

## 3. ตารางและหน้าที่

### 3.1 Concert

เก็บข้อมูลหลักของคอนเสิร์ต และเป็น aggregate root ของแผนทั้งหมด ภาพผังที่ render เสร็จแล้วเก็บ URL ใน `SeatLayoutImageURL`

### 3.2 PerformanceSchedule

เก็บรอบการแสดงของคอนเสิร์ต:

| Attribute | หน้าที่ |
|---|---|
| ScheduleID | รหัสรอบการแสดง |
| PerformanceOrder | ลำดับรอบ |
| Details | ชื่อหรือรายละเอียดรอบ |
| ShowDate | วันที่แสดง |
| StartShow | เวลาเริ่มแสดง |
| EndShow | เวลาจบ |
| ConcertID | คอนเสิร์ตเจ้าของรอบ |
| ArtistID | ศิลปินของรอบ หากมี |

API เดิมที่ใช้ชื่อ `doorTime` จะได้รับค่า `StartShow` ชั่วคราวเพื่อรักษาความเข้ากันได้จนกว่าจะปรับ UI รอบใหม่

### 3.3 Zone

เก็บโซนและ geometry ของโซนบน canvas ได้แก่ `PositionX`, `PositionY`, `Width`, `Height`, `Rotation`, `Shape`, `Color`, `LayerOrder` และ `Capacity` เมื่อคลิก Zone หน้า UI จะโหลด `Seat` ด้วย `ZoneID`

### 3.4 Seat

เก็บที่นั่งแต่ละตัว ตำแหน่ง และสถานะ โดย `ZoneID` เป็น FK ไปยัง Zone ภาพรวมผังใช้ `Concert.SeatLayoutImageURL`; ไม่คัดลอกภาพเดียวลง `Seat.Flowchart` ทุกแถว

### 3.5 Publication

เก็บ `SaleOpenDate`, `BookingCloseDatetime`, `OpenInWeb`, `OutWeb`, `Description` และ `PosterWeb`

### 3.6 LayoutObject

เก็บวัตถุทั่วไปบน canvas ของผังและแบบบัตรในตารางเดียว `LayoutType` เป็น `VENUE` หรือ `TICKET`; `SideType` เป็น `FRONT`, `BACK` หรือ NULL; `ObjectData` เก็บเนื้อหา/binding/SVG และ `StyleJSON` เก็บรูปแบบ

ตำแหน่ง Zone และ Seat อยู่ในตารางของตัวเอง ส่วน `LayoutObject` ใช้กับวัตถุทั่วไป จึงไม่เกิด cycle ระหว่างสามตาราง

### 3.7 Ticket

ระบบวางแผนอ่าน `PriceTicket` ผ่าน `SeatID -> Seat.ZoneID` เพื่อแสดงราคาของแต่ละโซน และใช้ข้อมูลบัตรเป็น preview ในหน้าออกแบบบัตร ถ้าโซนเดียวมีหลายราคา API ใช้ราคาต่ำสุดเป็นราคาเริ่มต้น

### 3.8 TicketCategory

คงเป็นตารางของระบบเพื่อนตาม schema เดิม ระบบนี้ไม่ migrate แบบเปลี่ยนโครงสร้าง ไม่ลบ และไม่ query ตารางนี้

## 4. การแมปหน้า UI

| หน้า | ตารางที่ใช้ |
|---|---|
| เลือกคอนเสิร์ต | Concert และสถานะแผนที่ derive จาก Publication/Zone/LayoutObject |
| ภาพรวม | Concert, Zone, Seat, Ticket, Publication |
| กำหนดการวางขายหน้าเว็บ | Publication, Concert, PerformanceSchedule, Ticket ผ่าน Seat/Zone |
| ออกแบบผัง | Zone, Seat, LayoutObject (`VENUE`) |
| ออกแบบบัตร | LayoutObject (`TICKET`, `FRONT`/`BACK`) และ preview จาก Ticket |

## 5. Migration

- ลบเฉพาะตาราง legacy `VenueSeat*` และตารางชื่อพหูพจน์เก่าที่เป็นของระบบวางแผน
- ห้าม drop `ticket_categories` หรือ `TicketCategory`
- ห้ามสร้างหรือ AutoMigrate `Showtime`
- AutoMigrate `PerformanceSchedule`, `Zone`, `Seat`, `Publication`, `LayoutObject` และตารางระบบเดิมตามรายการหลัก
- Migration ต้องรันซ้ำได้

## 6. Handler

- เปลี่ยนการบันทึก/โหลดรอบจาก `Showtime` เป็น `PerformanceSchedule`
- แมป round เป็น `ScheduleID`, `PerformanceOrder`, `Details`, `ShowDate`, `StartShow`, `EndShow`, `ConcertID`
- Capacity มาจาก Zone; ราคาอ่านจาก Ticket ผ่าน Seat
- การบันทึกผังไม่สร้าง แก้ หรือลบ `TicketCategory`
- การบันทึกใหม่ไม่ลบ Ticket ของระบบขาย

## 7. การทดสอบ

- Schema test ยืนยันว่ารายการตารางวางแผนมี `PerformanceSchedule` และไม่มี `Showtime`/`TicketCategory`
- Migration test ยืนยันว่า `TicketCategory` ไม่อยู่ในรายการ drop
- API test ยืนยันว่ารอบถูกบันทึกใน `PerformanceSchedule`
- API test ยืนยันว่าการบันทึกผังไม่สร้างหรือแก้ `TicketCategory`
- Report test ยืนยันว่าราคาอ่านจาก `Ticket.PriceTicket`
- รัน `go test ./...` และ `go vet ./...`

## 8. นอกขอบเขต

- การแก้ UI จริง
- การแก้ schema ของ `TicketCategory`
- การแก้ flow `Booking -> Ticket -> Gate-Check-in`
- ระบบอนุญาตกลับเข้างาน
