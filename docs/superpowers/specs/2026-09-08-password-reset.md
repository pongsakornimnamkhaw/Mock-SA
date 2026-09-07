# Spec: ระบบลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่ (ลูกค้า)

## สถานะปัจจุบัน

หน้า `/forgot-password` ([ForgotPasswordPage](../../../frontend/src/pages/Login_page/ForgotPassword/index.tsx))
เป็น **mockup ล้วน** — [ForgotPasswordForm.tsx](../../../frontend/src/components/common/ForgotPasswordForm.tsx)
มีแค่

```tsx
const handleSumit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Reset Password:', email)
}
```

ไม่ยิง API ไม่ส่งอีเมล ไม่นำทางไปไหน และฝั่ง backend **ไม่มี endpoint เกี่ยวกับ
forgot/reset password เลยแม้แต่ตัวเดียว** (grep `backend/internal` แล้วไม่เจอ)

ลิงก์ "ลืมรหัสผ่าน" ปรากฏเฉพาะใน [LoginForm.tsx:86](../../../frontend/src/components/common/LoginForm.tsx)
ซึ่งใช้เฉพาะหน้า login ของ **ลูกค้า** — หน้า login พนักงานเป็นคนละหน้าและไม่มีลิงก์นี้

## สิ่งที่ต้องได้

1. กรอกอีเมลในหน้า `/forgot-password` แล้วกด "ยืนยันอีเมล" → ระบบสร้าง token
   รีเซ็ตที่มีอายุจำกัด และส่งลิงก์ไปทางอีเมล
2. ผู้ใช้เปิดลิงก์ `/reset-password?token=...` → กรอกรหัสผ่านใหม่ 2 ช่อง → ตั้งรหัสใหม่สำเร็จ
   → เด้งกลับไปหน้า login
3. token ใช้ได้ครั้งเดียว และหมดอายุใน 30 นาที
4. เมื่อรีเซ็ตสำเร็จ เซสชันเดิมทั้งหมดของบัญชีนั้นต้องถูกเตะออก
5. ข้อความที่ผู้ใช้เห็นทั้งหมดเป็นภาษาไทย

## การตัดสินใจ (จากการคุยกับเจ้าของงาน)

### การส่งอีเมล — "Token จริง + SMTP ถ้าตั้งค่า"

- สร้าง token สุ่มจริง เก็บเฉพาะ **hash** ลงฐานข้อมูล
- ถ้าตั้ง `SMTP_HOST` ใน `.env` → ส่งอีเมลจริงผ่าน `net/smtp` (stdlib ไม่เพิ่ม dependency)
- ถ้าไม่ตั้ง → `LogMailer` พิมพ์ลิงก์ออก console ให้ dev ทดสอบได้โดยไม่ต้องมี SMTP
- โครงสร้างถูกต้องตั้งแต่แรก ต่อ SMTP จริงทีหลังได้โดยไม่ต้องแก้ handler

### พฤติกรรมเมื่ออีเมลไม่มีในระบบ — "ตอบสำเร็จเสมอ"

- `POST /auth/forgot-password` คืน `204` เสมอ ไม่ว่าอีเมลนั้นจะมีบัญชีหรือไม่
- ป้องกัน account enumeration (คนนอกเดาไม่ได้ว่าอีเมลไหนสมัครไว้)
- ข้อยกเว้นเดียว: อีเมล**ผิดรูปแบบ** ตอบ `400` "รูปแบบอีเมลไม่ถูกต้อง" — เป็นการบอกว่า
  พิมพ์ผิด ไม่ได้เปิดเผยว่าใครมีบัญชี
- ฝั่ง UI ขึ้นข้อความกลางๆ ว่า "ถ้ามีบัญชีที่ใช้อีเมลนี้ เราส่งลิงก์ไปให้แล้ว"

### ที่เก็บ token — ใช้ตารางเดิม ไม่สร้างตารางใหม่

ระบบเซสชันที่มีอยู่แล้วใช้ `cus_activity_logs` เป็นที่เก็บ token อยู่แล้ว
(ดู `startSession` ที่ [customer_account.go:211](../../../backend/internal/handlers/customer_account.go)):

| คอลัมน์ | ความหมายในเซสชัน | ความหมายในการรีเซ็ตรหัสผ่าน |
|---|---|---|
| `action_type` | `AUTH_SESSION` | `AUTH_PASSWORD_RESET` |
| `target_id` | sha256 ของ token (base64 43 ตัว) | เหมือนกัน |
| `description` | unix timestamp วันหมดอายุ | เหมือนกัน |
| `user_id` | เจ้าของเซสชัน | เจ้าของบัญชี |

**ต้องไม่สร้างตารางใหม่** — เทสต์ [customer_account_test.go:79](../../../backend/internal/handlers/customer_account_test.go)
ยืนยันว่าจำนวนตารางต้องเท่ากับ 40 พอดี ถ้าเพิ่มตารางเทสต์นั้นจะพัง

## API ที่จะเพิ่ม

```
POST /api/customer/auth/forgot-password
Body: {"email": "someone@example.com"}
  204 — สำเร็จ (ไม่ว่าอีเมลจะมีบัญชีหรือไม่)
  400 — {"error": "รูปแบบอีเมลไม่ถูกต้อง"}

POST /api/customer/auth/reset-password
Body: {"token": "<64 hex>", "new_password": "อย่างน้อย 8 ตัว"}
  204 — ตั้งรหัสผ่านใหม่สำเร็จ
  400 — {"error": "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว"}
  400 — {"error": "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"}
```

## ตัวแปรสภาพแวดล้อมใหม่ (ทุกตัวไม่บังคับ)

| ตัวแปร | ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|
| `SMTP_HOST` | ว่าง | ว่าง = ไม่ส่งอีเมลจริง แต่ log ลิงก์ออก console |
| `SMTP_PORT` | `587` | |
| `SMTP_USERNAME` | ว่าง | |
| `SMTP_PASSWORD` | ว่าง | |
| `SMTP_FROM` | ค่าของ `SMTP_USERNAME` | อีเมลผู้ส่ง |
| `APP_BASE_URL` | `http://localhost:5173` | ใช้ประกอบลิงก์ในอีเมล |

## นอกขอบเขต

- **บัญชีพนักงาน** — หน้า login พนักงานไม่มีลิงก์ "ลืมรหัสผ่าน" งานนี้ทำเฉพาะฝั่งลูกค้า
- **จำกัดจำนวนครั้งที่ขอรีเซ็ต (rate limiting)** — ยังไม่มีโครงสร้าง middleware สำหรับเรื่องนี้
  ในโปรเจกต์ ควรทำเป็นงานแยก
- **เทมเพลตอีเมล HTML** — ส่งเป็น text/plain ก่อน
- **ยืนยันอีเมลตอนสมัครสมาชิก** — คนละเรื่องกัน
