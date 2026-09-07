# Payment Subsystem (ระบบชำระเงิน) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้โค้ดรองรับ System Use Case UP1–UP5 ของระบบชำระเงินตามเอกสาร SA (อัปโหลดหลักฐาน → เจ้าหน้าที่ตรวจสอบ → ออกบัตรพร้อม QR Code → ติดตามสถานะ → ขอส่งบัตรซ้ำ) ต่อจากการจองที่จบไว้ที่สถานะ `pending_payment`

**Architecture:** ต่อยอดจาก `bookingStore.ts` ที่มีอยู่ (localStorage + `useSyncExternalStore`) ไม่แตะ Backend เพราะปัจจุบัน `Backend/` มีแค่ `cmd/server/main.go` โครงเปล่า และผู้ใช้ระบุให้ยังไม่ต้องทำ backend ในรอบนี้ mutation ทั้งหมดของการชำระเงินอยู่ใน store เดียว หน้าเพจเป็นแค่ตัวแสดงผลและเรียก mutation — **แผนนี้ไม่มีไฟล์เทสต์ตามคำขอของผู้ใช้** แต่ละ task จบด้วยการรัน `npm run build` เพื่อยืนยันว่าคอมไพล์ผ่านแทน

**Tech Stack:** React 19, TypeScript, MUI 9, react-router-dom 7, qrcode.react (เพิ่มใน Task 4)

**Spec:** เอกสาร SA ของทีม (System Use Case UP1–UP5 และ Activity Diagram ระบบชำระเงิน) — สรุปข้อกำหนดที่ผูกกับโค้ดไว้ในหัวข้อ Global Constraints และหัวข้อ "Use Case ที่แต่ละ Task ปิด" ด้านล่าง ยังไม่มีไฟล์ spec ในรีโป จึงยึดตามที่ตกลงในเอกสาร Word ของทีม

## Global Constraints

- พาเลตสี: ใช้ได้เฉพาะ 5 ค่าใน `brand` ของ `Frontend/src/theme.ts` (`navy #050C38`, `purple #6700A3`, `magenta #EE22FF`, `coral #FF5A57`, `white #FFFFFF`) — คอมเมนต์ในไฟล์ระบุว่า "ห้ามเพิ่มสีใหม่นอกห้าค่านี้" สีอื่นได้จากการใส่ alpha ให้ห้าค่านี้เท่านั้น
- ข้อความ UI ทั้งหมดเป็นภาษาไทย ให้ตรงกับคำที่ใช้ในเอกสาร SA (เช่น "รอตรวจสอบ", "ออกบัตรแล้ว", "ปฏิเสธการชำระเงิน")
- `verbatimModuleSyntax: true` — import ที่เป็น type ล้วนต้องใช้ `import type`
- `noUnusedLocals: true` และ `noUnusedParameters: true` — ห้ามมีตัวแปร/พารามิเตอร์ที่ไม่ได้ใช้
- `erasableSyntaxOnly: true` — ห้ามใช้ `enum` และ parameter property
- import ภายในโปรเจกต์ใช้ alias `@/` เสมอ (ตั้งไว้ที่ `vite.config.ts` และ `tsconfig.app.json`)
- คำสั่งตรวจสอบว่าคอมไพล์ผ่าน: `npm run build` จากโฟลเดอร์ `Frontend/`
- ทุกหน้าเพจใหม่ต้องมี `data-testid` ที่ element นอกสุด ตามแบบที่มีอยู่แล้วใน `ZoneSelectionPage.tsx` (`data-testid="zone-selection-page"`) — เพื่อความสม่ำเสมอของโค้ด แม้รอบนี้จะยังไม่มีไฟล์เทสต์มาใช้งานจริง
- คอมเมนต์เขียนเฉพาะตอนอธิบาย "ทำไม" ที่ไม่ชัดเจนจากโค้ด ตามสไตล์ที่มีอยู่ใน `bookingStore.ts` และ `useConcerts.ts`
- **ไม่ต้องสร้างไฟล์เทสต์ในแผนนี้** และ **ไม่ต้องแตะ `Backend/`** — ทั้งสองเป็นขอบเขตที่ผู้ใช้ระบุให้เว้นไว้ก่อน

## ขอบเขตที่ไม่รวมในแผนนี้

- ไฟล์เทสต์ทุกชนิด (unit/integration) — ระงับไว้ตามคำขอของผู้ใช้ ปัจจุบัน `vite.config.ts` ก็ยังไม่มีบล็อก `test` และไม่มีไฟล์ `*.test.*` ในรีโปอยู่แล้ว จึงไม่ต้องแก้อะไรเพิ่มเพื่อคง state นี้ไว้
- Backend Go API — คงไว้เป็นโครงเปล่าตามเดิม ไม่แก้ไฟล์ใดใน `Backend/`
- UB4 (ค้นหารายการจองของลูกค้าฝั่งเจ้าหน้าที่) และ UB5 (ใช้สิทธิ์โปรโมชั่น) — เป็นของระบบการจองบัตร ต้องทำเป็นแผนแยกอีกฉบับ
- เส้นทาง "ลูกค้าไม่ส่งหลักฐานใหม่ทันเวลา → ยกเลิกรายการจองอัตโนมัติ" ที่อยู่ใน Activity Diagram — ต้องมีตัวจับเวลาฝั่ง store แยกต่างหาก ไม่รวมในแผนนี้
- การเก็บไฟล์สลิปจริง — เก็บเฉพาะ "ชื่อไฟล์" ลง localStorage เพราะ base64 ของรูปจะทำให้เกินโควตา localStorage เร็วมาก

## Use Case ที่แต่ละ Task ปิด

| Task | Use Case |
|---|---|
| 1 | ตรรกะกลางของ UP1–UP5 ทั้งหมด |
| 2 | UB3 ติดตามสถานะการจอง + UP4 ติดตามสถานะการชำระเงิน |
| 3 | UP1 อัปโหลดหลักฐานการชำระเงิน |
| 4 | UP3 ออกบัตรเข้าชมพร้อม QR Code + UP5 ขอส่งบัตรซ้ำ |
| 5 | UP2 ตรวจสอบและอนุมัติการชำระเงิน |

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `Frontend/src/interface/IBookingInterface.ts` | เพิ่มสถานะใหม่ ชนิด `Ticket` และ `PaymentEvidence` |
| `Frontend/src/utils/ticketCode.ts` | สร้างรหัสบัตรและป้ายที่นั่งแบบ deterministic |
| `Frontend/src/utils/bookingStore.ts` | mutation ของการชำระเงินทั้งหมด (ส่งหลักฐาน/อนุมัติ/ปฏิเสธ/ส่งบัตรซ้ำ) |
| `Frontend/src/pages/bookings/MyBookingsPage.tsx` | รายการจองของลูกค้าพร้อมสถานะ |
| `Frontend/src/pages/bookings/PaymentUploadPage.tsx` | หน้าอัปโหลดหลักฐานการโอน |
| `Frontend/src/pages/bookings/TicketPage.tsx` | หน้าแสดงบัตรพร้อม QR Code และปุ่มขอส่งซ้ำ |
| `Frontend/src/pages/staff/PaymentReviewPage.tsx` | คิวตรวจสอบหลักฐานของเจ้าหน้าที่ |
| `Frontend/src/components/AdminRoute.tsx` | guard เฉพาะผู้ใช้ role `admin` |
| `Frontend/src/routes/index.tsx` | ลงทะเบียน route ใหม่ทั้ง 4 เส้นทาง |

---

### Task 1: ขยายโมเดลข้อมูลและเพิ่ม mutation ของการชำระเงิน

นี่คือหัวใจของแผน ตรรกะทั้งหมดของ UP1–UP5 อยู่ที่นี่ หน้าเพจใน task ถัดไปเป็นแค่ตัวเรียกใช้

**Files:**
- Modify: `Frontend/src/interface/IBookingInterface.ts`
- Create: `Frontend/src/utils/ticketCode.ts`
- Modify: `Frontend/src/utils/bookingStore.ts`

**Interfaces:**
- Consumes: `BookingRecord` ที่มีอยู่แล้วในรีโป (`Frontend/src/interface/IBookingInterface.ts`)
- Produces:
  - `type BookingStatus = 'pending_payment' | 'under_review' | 'rejected' | 'paid' | 'issued' | 'cancelled'`
  - `interface Ticket { code: string; seatLabel: string; issuedAt: string }`
  - `interface PaymentEvidence { evidenceFileName: string; submittedAt: string; verifiedBy?: string; verifiedAt?: string; rejectReason?: string }`
  - `BookingRecord` เพิ่มฟิลด์ `payment?: PaymentEvidence`, `tickets?: Ticket[]`, `resendLog?: string[]`
  - `buildSeatLabel(zoneId: string, index: number): string`
  - `buildTicketCode(bookingId: string, index: number): string`
  - `getBookingById(bookingId: string): BookingRecord | null`
  - `submitPaymentEvidence(bookingId: string, evidenceFileName: string): BookingRecord | null`
  - `approvePayment(bookingId: string, verifiedBy: string): BookingRecord | null`
  - `rejectPayment(bookingId: string, verifiedBy: string, rejectReason: string): BookingRecord | null`
  - `resendTicket(bookingId: string): BookingRecord | null`

- [ ] **Step 1: ขยาย interface**

แก้ `Frontend/src/interface/IBookingInterface.ts` ให้เป็น:

```ts
export type BookingStatus =
  | 'pending_payment'
  | 'under_review'
  | 'rejected'
  | 'paid'
  | 'issued'
  | 'cancelled'

export interface Ticket {
  code: string
  seatLabel: string
  /** ISO timestamp */
  issuedAt: string
}

export interface PaymentEvidence {
  evidenceFileName: string
  /** ISO timestamp */
  submittedAt: string
  verifiedBy?: string
  /** ISO timestamp */
  verifiedAt?: string
  rejectReason?: string
}

export interface BookingRecord {
  id: string
  concertId: string
  concertTitle: string
  zoneId: string
  tierName: string
  quantity: number
  totalPrice: number
  customerName: string
  status: BookingStatus
  /** ISO timestamp */
  createdAt: string
  payment?: PaymentEvidence
  tickets?: Ticket[]
  /** ISO timestamp ของทุกครั้งที่ลูกค้าขอให้ส่งบัตรซ้ำ */
  resendLog?: string[]
}
```

- [ ] **Step 2: สร้างตัวสร้างรหัสบัตร**

สร้าง `Frontend/src/utils/ticketCode.ts`:

```ts
export function buildSeatLabel(zoneId: string, index: number): string {
  return `${zoneId}-${index + 1}`
}

export function buildTicketCode(bookingId: string, index: number): string {
  return `TCK-${bookingId}-${String(index + 1).padStart(2, '0')}`
}
```

- [ ] **Step 3: เพิ่ม mutation ใน bookingStore**

เพิ่ม import สองบรรทัดนี้ต่อจาก import เดิมที่หัวไฟล์ `Frontend/src/utils/bookingStore.ts`:

```ts
import type { PaymentEvidence, Ticket } from '@/interface/IBookingInterface'
import { buildSeatLabel, buildTicketCode } from '@/utils/ticketCode'
```

แล้วเพิ่มโค้ดนี้ต่อท้ายไฟล์:

```ts
export function getBookingById(bookingId: string): BookingRecord | null {
  load()
  return cache.find((booking) => booking.id === bookingId) ?? null
}

function updateBooking(
  bookingId: string,
  mutate: (booking: BookingRecord) => BookingRecord,
): BookingRecord | null {
  load()
  const index = cache.findIndex((booking) => booking.id === bookingId)
  if (index === -1) return null

  const updated = mutate(cache[index])
  const next = [...cache]
  next[index] = updated
  writeToStorage(next)
  emit()
  return updated
}

export function submitPaymentEvidence(
  bookingId: string,
  evidenceFileName: string,
): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null) return null
  if (current.status !== 'pending_payment' && current.status !== 'rejected') return null

  return updateBooking(bookingId, (booking) => ({
    ...booking,
    status: 'under_review',
    payment: {
      evidenceFileName,
      submittedAt: new Date().toISOString(),
    },
  }))
}

// UP3 มีความสัมพันธ์แบบ include กับ UP2 ในเอกสาร คือทุกครั้งที่อนุมัติต้องออกบัตรเสมอ
// จึงรวมสองขั้นตอนไว้ในฟังก์ชันเดียว และจบที่สถานะ issued ไม่หยุดค้างไว้ที่ paid
export function approvePayment(bookingId: string, verifiedBy: string): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null || current.status !== 'under_review') return null

  return updateBooking(bookingId, (booking) => {
    const verifiedAt = new Date().toISOString()
    const payment: PaymentEvidence = {
      ...(booking.payment ?? { evidenceFileName: '', submittedAt: verifiedAt }),
      verifiedBy,
      verifiedAt,
      rejectReason: undefined,
    }
    const tickets: Ticket[] = Array.from({ length: booking.quantity }, (_, index) => ({
      code: buildTicketCode(booking.id, index),
      seatLabel: buildSeatLabel(booking.zoneId, index),
      issuedAt: verifiedAt,
    }))

    return { ...booking, status: 'issued', payment, tickets }
  })
}

export function rejectPayment(
  bookingId: string,
  verifiedBy: string,
  rejectReason: string,
): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null || current.status !== 'under_review') return null

  return updateBooking(bookingId, (booking) => {
    const verifiedAt = new Date().toISOString()
    const payment: PaymentEvidence = {
      ...(booking.payment ?? { evidenceFileName: '', submittedAt: verifiedAt }),
      verifiedBy,
      verifiedAt,
      rejectReason,
    }
    return { ...booking, status: 'rejected', payment }
  })
}

// ส่งบัตร "ใบเดิม" ซ้ำตามเอกสาร จึงไม่แตะ tickets เพื่อไม่ให้ QR Code เปลี่ยน
export function resendTicket(bookingId: string): BookingRecord | null {
  const current = getBookingById(bookingId)
  if (current === null || current.status !== 'issued') return null

  return updateBooking(bookingId, (booking) => ({
    ...booking,
    resendLog: [...(booking.resendLog ?? []), new Date().toISOString()],
  }))
}
```

- [ ] **Step 4: ยืนยันว่า build ผ่าน**

Run: `cd Frontend && npm run build`
Expected: สำเร็จ ไม่มี error จาก tsc (โค้ดใน task นี้ยังไม่มีใครเรียกใช้ แต่ต้องคอมไพล์ผ่านในตัวเอง)

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/interface/IBookingInterface.ts Frontend/src/utils/ticketCode.ts Frontend/src/utils/bookingStore.ts
git commit -m "feat: add payment verification and ticket issuing to booking store"
```

---

### Task 2: หน้ารายการจองของลูกค้า (UB3 + UP4)

**Files:**
- Create: `Frontend/src/pages/bookings/MyBookingsPage.tsx`
- Modify: `Frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: `useBookings()` จาก `@/hooks/useBookings`, `BookingStatus` จาก Task 1
- Produces:
  - `MyBookingsPage` component (named export)
  - `statusLabel(status: BookingStatus): string` (named export จาก `MyBookingsPage.tsx`)
  - route `/bookings`

- [ ] **Step 1: สร้างหน้าเพจ**

สร้าง `Frontend/src/pages/bookings/MyBookingsPage.tsx`:

```tsx
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { brand } from '@/theme'
import { useBookings } from '@/hooks/useBookings'
import type { BookingStatus } from '@/interface/IBookingInterface'

export function statusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending_payment':
      return 'รอชำระเงิน'
    case 'under_review':
      return 'รอตรวจสอบ'
    case 'rejected':
      return 'ปฏิเสธการชำระเงิน'
    case 'paid':
      return 'ชำระเงินแล้ว'
    case 'issued':
      return 'ออกบัตรแล้ว'
    case 'cancelled':
      return 'ยกเลิก'
  }
}

export function MyBookingsPage() {
  const { bookings, loadError } = useBookings()

  return (
    <Box data-testid="my-bookings-page" sx={{ bgcolor: 'background.paper', py: 4 }}>
      <Container maxWidth="sm">
        <Typography variant="h1" component="h1" sx={{ mb: 2, fontSize: '1.25rem' }}>
          รายการจองของฉัน
        </Typography>

        {loadError && (
          <Typography color={brand.coral} variant="body2" sx={{ mb: 2 }}>
            {loadError}
          </Typography>
        )}

        {bookings.length === 0 && (
          <Typography color="text.secondary">ยังไม่มีรายการจอง</Typography>
        )}

        <Stack spacing={2}>
          {bookings.map((booking) => (
            <Paper key={booking.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontWeight: 700 }}>{booking.id}</Typography>
                <Chip size="small" label={statusLabel(booking.status)} />
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {booking.concertTitle} · โซน {booking.zoneId} · {booking.quantity} ใบ
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                ยอดสุทธิ {booking.totalPrice.toLocaleString('en-US')} บาท
              </Typography>

              {(booking.status === 'pending_payment' || booking.status === 'rejected') && (
                <Button
                  component={RouterLink}
                  to={`/bookings/${booking.id}/payment`}
                  data-testid={`pay-link-${booking.id}`}
                  size="small"
                  variant="contained"
                >
                  แนบหลักฐานการชำระเงิน
                </Button>
              )}

              {booking.status === 'issued' && (
                <Button
                  component={RouterLink}
                  to={`/bookings/${booking.id}/ticket`}
                  data-testid={`ticket-link-${booking.id}`}
                  size="small"
                  variant="outlined"
                >
                  ดูบัตรเข้าชม
                </Button>
              )}
            </Paper>
          ))}
        </Stack>
      </Container>
    </Box>
  )
}
```

- [ ] **Step 2: ลงทะเบียน route**

แก้ `Frontend/src/routes/index.tsx` เพิ่ม import:

```tsx
import { MyBookingsPage } from '@/pages/bookings/MyBookingsPage'
```

และเพิ่ม route ต่อจากบรรทัด `{ path: 'shows/:concertId/zones', element: <ZoneSelectionPage /> },`:

```tsx
      { path: 'bookings', element: <MyBookingsPage /> },
```

- [ ] **Step 3: ยืนยันว่า build ผ่าน**

Run: `cd Frontend && npm run build`
Expected: สำเร็จ

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/bookings/MyBookingsPage.tsx Frontend/src/routes/index.tsx
git commit -m "feat: add my bookings page with payment status"
```

---

### Task 3: หน้าอัปโหลดหลักฐานการชำระเงิน (UP1)

**Files:**
- Create: `Frontend/src/pages/bookings/PaymentUploadPage.tsx`
- Modify: `Frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: `getBookingById`, `submitPaymentEvidence` จาก Task 1
- Produces: `PaymentUploadPage` component (named export), route `/bookings/:bookingId/payment`

- [ ] **Step 1: สร้างหน้าเพจ**

สร้าง `Frontend/src/pages/bookings/PaymentUploadPage.tsx`:

```tsx
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import { useState, type ChangeEvent } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getBookingById, submitPaymentEvidence } from '@/utils/bookingStore'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export function PaymentUploadPage() {
  const { bookingId } = useParams()
  const booking = bookingId ? getBookingById(bookingId) : null

  const [fileName, setFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (!booking) {
    return (
      <Box data-testid="payment-upload-page" sx={{ py: 8, textAlign: 'center' }}>
        <Typography color="text.secondary">ไม่พบรายการจองที่ต้องการ</Typography>
      </Box>
    )
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setFileName(null)
      setErrorMessage('รองรับเฉพาะไฟล์รูปภาพ กรุณาอัปโหลดใหม่')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileName(null)
      setErrorMessage('ไฟล์มีขนาดเกิน 5 MB กรุณาอัปโหลดใหม่')
      return
    }

    setErrorMessage(null)
    setFileName(file.name)
  }

  function handleSubmit() {
    if (fileName === null || bookingId === undefined) {
      setErrorMessage('กรุณาเลือกไฟล์หลักฐานก่อนส่ง')
      return
    }

    const updated = submitPaymentEvidence(bookingId, fileName)
    if (updated === null) {
      setErrorMessage('รายการนี้ส่งหลักฐานไปแล้ว หรือไม่อยู่ในสถานะที่ส่งได้')
      return
    }
    setSubmitted(true)
  }

  return (
    <Box data-testid="payment-upload-page" sx={{ bgcolor: 'background.paper', py: 4 }}>
      <Container maxWidth="sm">
        <Typography
          component={RouterLink}
          to="/bookings"
          variant="body2"
          sx={{ textDecoration: 'none', display: 'inline-block', mb: 2 }}
        >
          ← กลับไปรายการจอง
        </Typography>

        <Typography variant="h1" component="h1" sx={{ mb: 2, fontSize: '1.25rem' }}>
          แนบหลักฐานการชำระเงิน
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              ยอดสุทธิที่ต้องชำระ
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>
              {booking.totalPrice.toLocaleString('en-US')} บาท
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            โอนเข้าบัญชี ธนาคารกรุงเทพ 123-4-56789-0 ชื่อบัญชี Octavia Live Co., Ltd.
          </Typography>
        </Paper>

        {errorMessage && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="evidence-error">
            {errorMessage}
          </Alert>
        )}

        {submitted ? (
          <Alert severity="success" data-testid="submit-success">
            ส่งหลักฐานเรียบร้อย รายการเปลี่ยนเป็นสถานะ "รอตรวจสอบ" แล้ว
          </Alert>
        ) : (
          <Stack spacing={2}>
            <input
              type="file"
              accept="image/*"
              data-testid="evidence-input"
              onChange={handleFileChange}
            />
            {fileName && <Typography variant="body2">ไฟล์ที่เลือก: {fileName}</Typography>}
            <Button variant="contained" onClick={handleSubmit}>
              ส่งหลักฐาน
            </Button>
          </Stack>
        )}
      </Container>
    </Box>
  )
}
```

- [ ] **Step 2: ลงทะเบียน route**

แก้ `Frontend/src/routes/index.tsx` เพิ่ม import:

```tsx
import { PaymentUploadPage } from '@/pages/bookings/PaymentUploadPage'
```

และเพิ่ม route ต่อจาก `{ path: 'bookings', element: <MyBookingsPage /> },`:

```tsx
      { path: 'bookings/:bookingId/payment', element: <PaymentUploadPage /> },
```

- [ ] **Step 3: ยืนยันว่า build ผ่าน**

Run: `cd Frontend && npm run build`
Expected: สำเร็จ

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/bookings/PaymentUploadPage.tsx Frontend/src/routes/index.tsx
git commit -m "feat: add payment evidence upload page"
```

---

### Task 4: หน้าบัตรเข้าชมพร้อม QR Code และขอส่งซ้ำ (UP3 + UP5)

**Files:**
- Create: `Frontend/src/pages/bookings/TicketPage.tsx`
- Modify: `Frontend/src/routes/index.tsx`
- Modify: `Frontend/package.json` (เพิ่ม `qrcode.react`)

**Interfaces:**
- Consumes: `getBookingById`, `resendTicket` จาก Task 1
- Produces: `TicketPage` component (named export), route `/bookings/:bookingId/ticket`

- [ ] **Step 1: ติดตั้ง qrcode.react**

Run: `cd Frontend && npm install qrcode.react@4.2.0`
Expected: เพิ่ม `qrcode.react` ใน dependencies ของ `package.json`

- [ ] **Step 2: สร้างหน้าเพจ**

สร้าง `Frontend/src/pages/bookings/TicketPage.tsx`:

```tsx
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { brand } from '@/theme'
import { getBookingById, resendTicket } from '@/utils/bookingStore'

export function TicketPage() {
  const { bookingId } = useParams()
  const booking = bookingId ? getBookingById(bookingId) : null
  const [resent, setResent] = useState(false)

  if (!booking || booking.status !== 'issued' || !booking.tickets) {
    return (
      <Box data-testid="ticket-page" sx={{ py: 8, textAlign: 'center' }}>
        <Typography color="text.secondary">ยังไม่มีบัตรสำหรับรายการนี้</Typography>
      </Box>
    )
  }

  function handleResend() {
    if (bookingId === undefined) return
    if (resendTicket(bookingId) !== null) setResent(true)
  }

  return (
    <Box data-testid="ticket-page" sx={{ bgcolor: 'background.paper', py: 4 }}>
      <Container maxWidth="sm">
        <Typography
          component={RouterLink}
          to="/bookings"
          variant="body2"
          sx={{ textDecoration: 'none', display: 'inline-block', mb: 2 }}
        >
          ← กลับไปรายการจอง
        </Typography>

        <Typography variant="h1" component="h1" sx={{ mb: 0.5, fontSize: '1.25rem' }}>
          บัตรเข้าชม
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {booking.concertTitle} · โซน {booking.zoneId}
        </Typography>

        {resent && (
          <Alert severity="success" sx={{ mb: 2 }} data-testid="resend-success">
            ส่งบัตรใบเดิมซ้ำไปยังอีเมลของคุณแล้ว
          </Alert>
        )}

        <Stack spacing={2} sx={{ mb: 2 }}>
          {booking.tickets.map((ticket) => (
            <Paper key={ticket.code} variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Box data-testid="ticket-qr" sx={{ display: 'inline-block', mb: 1 }}>
                <QRCodeSVG value={ticket.code} size={140} fgColor={brand.navy} />
              </Box>
              <Typography sx={{ fontWeight: 700 }}>{ticket.code}</Typography>
              <Typography variant="body2" color="text.secondary">
                ที่นั่ง {ticket.seatLabel}
              </Typography>
            </Paper>
          ))}
        </Stack>

        <Button variant="outlined" onClick={handleResend}>
          ขอส่งบัตรซ้ำทางอีเมล
        </Button>
      </Container>
    </Box>
  )
}
```

- [ ] **Step 3: ลงทะเบียน route**

แก้ `Frontend/src/routes/index.tsx` เพิ่ม import:

```tsx
import { TicketPage } from '@/pages/bookings/TicketPage'
```

และเพิ่ม route ต่อจาก `{ path: 'bookings/:bookingId/payment', element: <PaymentUploadPage /> },`:

```tsx
      { path: 'bookings/:bookingId/ticket', element: <TicketPage /> },
```

- [ ] **Step 4: ยืนยันว่า build ผ่าน**

Run: `cd Frontend && npm run build`
Expected: สำเร็จ

- [ ] **Step 5: Commit**

```bash
git add Frontend/package.json Frontend/package-lock.json Frontend/src/pages/bookings/TicketPage.tsx Frontend/src/routes/index.tsx
git commit -m "feat: add ticket page with QR code and resend"
```

---

### Task 5: หน้าคิวตรวจสอบการชำระเงินของเจ้าหน้าที่ (UP2)

**Files:**
- Create: `Frontend/src/components/AdminRoute.tsx`
- Create: `Frontend/src/pages/staff/PaymentReviewPage.tsx`
- Modify: `Frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: `useBookings()` จาก `@/hooks/useBookings`, `approvePayment` และ `rejectPayment` จาก Task 1, `useAuth()` จาก `@/auth/useAuth`
- Produces: `AdminRoute` component (named export), `PaymentReviewPage` component (named export), route `/staff/payments`

- [ ] **Step 1: สร้าง guard สำหรับเจ้าหน้าที่**

สร้าง `Frontend/src/components/AdminRoute.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'

export function AdminRoute() {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (user?.role !== 'admin') {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}
```

- [ ] **Step 2: สร้างหน้าเพจ**

สร้าง `Frontend/src/pages/staff/PaymentReviewPage.tsx`:

```tsx
import { Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { useBookings } from '@/hooks/useBookings'
import { approvePayment, rejectPayment } from '@/utils/bookingStore'

export function PaymentReviewPage() {
  const { user } = useAuth()
  const { bookings } = useBookings()
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const pending = bookings.filter((booking) => booking.status === 'under_review')
  const verifierName = user?.name ?? 'เจ้าหน้าที่'

  return (
    <Box data-testid="payment-review-page" sx={{ bgcolor: 'background.paper', py: 4 }}>
      <Container maxWidth="sm">
        <Typography variant="h1" component="h1" sx={{ mb: 2, fontSize: '1.25rem' }}>
          รายการรอตรวจสอบการชำระเงิน
        </Typography>

        {pending.length === 0 && (
          <Typography color="text.secondary">ไม่มีรายการรอตรวจสอบ</Typography>
        )}

        <Stack spacing={2}>
          {pending.map((booking) => (
            <Paper key={booking.id} variant="outlined" sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{booking.id}</Typography>
              <Typography variant="body2" color="text.secondary">
                {booking.customerName} · โซน {booking.zoneId} · {booking.quantity} ใบ
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                ยอดสุทธิที่ต้องชำระ {booking.totalPrice.toLocaleString('en-US')} บาท · หลักฐาน:{' '}
                {booking.payment?.evidenceFileName}
              </Typography>

              <TextField
                size="small"
                fullWidth
                label="เหตุผลกรณีปฏิเสธ"
                value={reasons[booking.id] ?? ''}
                onChange={(event) =>
                  setReasons((prev) => ({ ...prev, [booking.id]: event.target.value }))
                }
                slotProps={{ htmlInput: { 'data-testid': `reject-reason-${booking.id}` } }}
                sx={{ mb: 1 }}
              />

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  data-testid={`approve-${booking.id}`}
                  onClick={() => approvePayment(booking.id, verifierName)}
                >
                  อนุมัติ
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  data-testid={`reject-${booking.id}`}
                  onClick={() =>
                    rejectPayment(booking.id, verifierName, reasons[booking.id] ?? 'ไม่ระบุเหตุผล')
                  }
                >
                  ปฏิเสธ
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Box>
  )
}
```

- [ ] **Step 3: ลงทะเบียน route**

แก้ `Frontend/src/routes/index.tsx` เพิ่ม import:

```tsx
import { AdminRoute } from '@/components/AdminRoute'
import { PaymentReviewPage } from '@/pages/staff/PaymentReviewPage'
```

และเพิ่ม route ต่อจากบล็อก `ProtectedRoute` เดิม (ยังอยู่ใน `children` ของ `FullLayout`):

```tsx
      {
        element: <AdminRoute />,
        children: [
          { path: 'staff/payments', element: <PaymentReviewPage /> },
        ]
      },
```

- [ ] **Step 4: ยืนยันว่า build ผ่าน**

Run: `cd Frontend && npm run build`
Expected: สำเร็จ

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/AdminRoute.tsx Frontend/src/pages/staff/PaymentReviewPage.tsx Frontend/src/routes/index.tsx
git commit -m "feat: add staff payment review queue"
```

---

## หมายเหตุสำหรับผู้ทำงานต่อ

- `git status` ตอนเริ่มแผนนี้มีไฟล์ค้างจำนวนมาก (การย้ายโครงสร้างจาก `src/app/` และ `src/components/concerts/` ไปโครงใหม่ ยังไม่ commit) ควร commit หรือ stash ให้เรียบร้อยก่อนเริ่ม Task 1 เพื่อให้ diff ของแต่ละ task อ่านง่าย
- **ไม่มีไฟล์เทสต์ในแผนนี้ตามคำขอ** — การยืนยันความถูกต้องระหว่างทางจึงมีแค่ `npm run build` (เช็คว่าคอมไพล์ผ่าน ไม่ได้เช็ค behavior จริง) แนะนำให้เปิดแอปด้วย `npm run dev` แล้วคลิกทดสอบ flow จริงด้วยตาหลังทำแต่ละ task เสร็จ
- `bookingStore.ts` ปัจจุบันยังไม่มีทางเปลี่ยนสถานะเป็น `cancelled` จากใน UI — สถานะนี้มีอยู่ในชนิดข้อมูลและ seed เท่านั้น ยังไม่ต้องทำในแผนนี้
- ถ้าภายหลังย้ายไป Backend Go ให้เปลี่ยนเฉพาะไส้ในของฟังก์ชันใน `bookingStore.ts` โดยคง signature เดิมไว้ หน้าเพจทั้งหมดจะไม่ต้องแก้ ตามแนวเดียวกับคอมเมนต์ใน `services/https/concerts.ts`
