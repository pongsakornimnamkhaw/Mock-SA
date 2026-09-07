export type BookingStatus =
  | 'pending_payment' // รอชำระเงิน (ล็อกที่นั่งชั่วคราว)
  | 'under_review'    // รอตรวจสอบ (ลูกค้าอัปโหลดสลิปแล้ว)
  | 'paid'            // ชำระเงินแล้ว
  | 'issued'          // ออกบัตรเข้าชมพร้อม QR Code แล้ว
  | 'rejected'        // ปฏิเสธการชำระเงิน (ต้องแนบสลิปใหม่)
  | 'cancelled'       // ยกเลิกการจอง
  | 'expired'         // หมดเวลาการจอง/ล็อกที่นั่ง

export interface Ticket {
  code: string          // รหัสตั๋วเฉพาะใบ เช่น TKT-BK1001-01
  seatLabel: string     // เลขที่นั่ง/โซน เช่น A1-01
  issuedAt: string      // วันที่ออกบัตร
  qrCodeUrl?: string    // ลิงก์ QR Code สำหรับสแกนเข้างาน
}

export interface PaymentEvidence {
  evidenceFileName: string   // ชื่อไฟล์หลักฐานสลิป
  evidenceDataUrl?: string   // Base64 data URL สำหรับพรีวิวรูปสลิป
  submittedAt: string        // วันที่แนบสลิป
  verifiedBy?: string        // ชื่อเจ้าหน้าที่ผู้ตรวจสอบ
  verifiedAt?: string        // วันที่ตรวจสอบ
  rejectReason?: string      // เหตุผลกรณีถูกปฏิเสธ
}

export interface BookingRecord {
  id: string                 // รหัสการจอง เช่น BK-1001
  concertId: string          // รหัสคอนเสิร์ต
  concertTitle: string       // ชื่องานคอนเสิร์ต
  eventDate?: string         // วันแสดง
  location?: string          // สถานที่จัด
  zoneId: string             // โซน
  tierName: string           // ประเภทบัตร
  seats?: string[]           // รายการที่นั่งที่เลือก
  quantity: number           // จำนวนบัตร
  unitPrice: number          // ราคาต่อใบ
  discountAmount?: number    // ส่วนลดจากโปรโมชั่น
  totalPrice: number         // ยอดเงินสุทธิที่ต้องชำระ
  customerName: string       // ชื่อลูกค้า
  customerEmail: string      // อีเมลลูกค้าสำหรับจัดส่งบัตร
  customerPhone?: string     // เบอร์โทรศัพท์ลูกค้า
  status: BookingStatus      // สถานะรายการ
  createdAt: string          // วันที่สร้างรายการ
  payment?: PaymentEvidence  // ข้อมูลหลักฐานการชำระเงิน
  tickets?: Ticket[]         // บัตรเข้าชมที่ออกแล้ว
  resendLog?: string[]       // ประวัติการส่งบัตรซ้ำทางอีเมล
}
