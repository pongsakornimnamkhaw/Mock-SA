# Booking Tracking with Real-Time Seat Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "ติดตามสถานะการจอง" use case — confirmed bookings are stored durably, staff can view/filter/search them on the dashboard, and remaining ticket counts update in real time both on the arena zone map and on the dashboard.

**Architecture:** Introduce a localStorage-backed booking store (`bookingStore.ts`) that is the single source of truth for confirmed bookings, exposed to React through `useSyncExternalStore` so every mounted view re-renders the moment a booking is added — including across browser tabs via the `storage` event. `useZoneBooking` stops holding its own booked counts and instead derives availability from the mock zone baseline plus this store, and its confirm step writes a `BookingRecord` (now including a customer name collected at confirm time). The dashboard becomes the tracking page: live seat totals, a status filter, a name/booking-code search, and a table of bookings.

**Tech Stack:** React 19 (`useSyncExternalStore`), TypeScript, MUI (Table, Chip, TextField/Select), localStorage, Vite. No test runner is wired up in this repo. Verification is `tsc -b` plus manual browser checks.

**Spec:** the "ติดตามสถานะการจอง" (Track Booking Status) use case table supplied by the user in-conversation — Actor: ลูกค้า/เจ้าหน้าที่ฝ่ายขาย; steps: (1) เลือกดูรายการจอง (2) ระบบดึงสถานะล่าสุด + ที่นั่งคงเหลือมาแสดง (3) กรอง/ค้นหาตามสถานะหรือชื่อลูกค้า; postcondition: ผู้ใช้เห็นสถานะที่เป็นปัจจุบันตรงกันทุกฝ่าย; abnormal path: ระบบขัดข้อง แจ้งเตือนพร้อมเวลาที่อัปเดตล่าสุด. Plus the follow-up request "เพิ่มแสดงจำนวนบัตร real-time". Scoping answers from AskUserQuestion: persist to localStorage, collect the customer name at confirm time, and show real-time counts in **both** places (zone map and dashboard).

## Global Constraints

- Bookings persist in `localStorage` under the key `octavia.bookings.v1` and survive a page reload. On first run (key absent) the store seeds three demo bookings so the dashboard's status filter has something to filter.
- Booking statuses are exactly `'pending_payment' | 'paid' | 'cancelled'`, displayed as "รอชำระเงิน" / "ชำระเงินแล้ว" / "ยกเลิก". A booking made through the app is always created as `pending_payment` — nothing in this plan changes a status afterwards; the other two exist on seeded records so the filter is demonstrable.
- Cancelled bookings do NOT consume seats — every seat count must ignore them.
- A zone's booked count is always `zone.booked` (the mock baseline in `mockZones.ts`) **plus** the store's non-cancelled bookings for that concert+zone. Neither number alone is correct.
- The confirm button stays enabled when the customer name is empty and answers the click with a message, rather than being `disabled` — same rule already applied to full zone shapes. (The quantity stepper's bound buttons remain `disabled`; that exception is unchanged.)
- Colors: unchanged rules. New UI uses `brand` tokens plus MUI's built-in semantic palette for `Alert`/`Chip` severity, exactly as the existing zone page already does for its warning/success alerts.
- `/dashboard` sits behind `ProtectedRoute`, which only checks `localStorage.token`. Verification steps therefore set a token first.

---

### Task 1: Booking record type, localStorage store, and the React binding

**Files:**
- Create: `src/interface/IBookingInterface.ts`
- Create: `src/utils/bookingStore.ts`
- Create: `src/hooks/useBookings.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (foundational layer).
- Produces:
  - `BookingStatus = 'pending_payment' | 'paid' | 'cancelled'` and `BookingRecord { id: string; concertId: string; concertTitle: string; zoneId: string; tierName: string; quantity: number; totalPrice: number; customerName: string; status: BookingStatus; createdAt: string }` from `IBookingInterface.ts`.
  - From `bookingStore.ts`: `subscribeBookings(listener: () => void): () => void`, `getBookingsSnapshot(): BookingRecord[]`, `getLastUpdatedAt(): string`, `getLoadError(): string | null`, `addBooking(input: Omit<BookingRecord, 'id' | 'createdAt' | 'status'>): BookingRecord`, `countSeatsForZone(bookings: BookingRecord[], concertId: string, zoneId: string): number`, `countSeatsForConcert(bookings: BookingRecord[], concertId: string): number`.
  - From `useBookings.ts`: `useBookings(): { bookings: BookingRecord[]; lastUpdatedAt: string; loadError: string | null }`.
  - Consumed by Task 2 (`useZoneBooking`) and Task 4 (dashboard).

- [ ] **Step 1: Create the booking record type**

Create `src/interface/IBookingInterface.ts`:

```ts
export type BookingStatus = 'pending_payment' | 'paid' | 'cancelled'

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
}
```

- [ ] **Step 2: Create the store**

Create `src/utils/bookingStore.ts`:

```ts
import type { BookingRecord } from '@/interface/IBookingInterface'

const STORAGE_KEY = 'octavia.bookings.v1'

const SEED_BOOKINGS: BookingRecord[] = [
  {
    id: 'BK-1001',
    concertId: 'neon-flux',
    concertTitle: 'Neon Flux Festival 2024',
    zoneId: 'B3',
    tierName: 'Standard',
    quantity: 2,
    totalPrice: 7000,
    customerName: 'สมชาย ใจดี',
    status: 'paid',
    createdAt: '2024-01-05T10:15:00.000Z',
  },
  {
    id: 'BK-1002',
    concertId: 'neon-flux',
    concertTitle: 'Neon Flux Festival 2024',
    zoneId: 'C6',
    tierName: 'Economy',
    quantity: 1,
    totalPrice: 2000,
    customerName: 'สุดา รักดี',
    status: 'pending_payment',
    createdAt: '2024-01-06T14:30:00.000Z',
  },
  {
    id: 'BK-1003',
    concertId: 'neon-flux',
    concertTitle: 'Neon Flux Festival 2024',
    zoneId: 'A1',
    tierName: 'VIP',
    quantity: 3,
    totalPrice: 15000,
    customerName: 'ปรีชา มั่นคง',
    status: 'cancelled',
    createdAt: '2024-01-07T09:05:00.000Z',
  },
]

let cache: BookingRecord[] = SEED_BOOKINGS
let loaded = false
let loadError: string | null = null
let lastUpdatedAt = new Date().toISOString()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function writeToStorage(next: BookingRecord[]) {
  cache = next
  lastUpdatedAt = new Date().toISOString()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    loadError = null
  } catch {
    loadError = 'บันทึกข้อมูลการจองลงเครื่องไม่สำเร็จ'
  }
}

// เรียกได้จากทั้งตอน render (ผ่าน getSnapshot) จึงห้าม emit ในนี้ ไม่งั้น React จะวนรอบ
function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      writeToStorage(SEED_BOOKINGS)
      return
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('unexpected shape')
    cache = parsed as BookingRecord[]
    loadError = null
  } catch {
    loadError = 'อ่านข้อมูลการจองล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลชุดก่อนหน้า'
  }
  lastUpdatedAt = new Date().toISOString()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    loaded = false
    load()
    emit()
  })
}

export function subscribeBookings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getBookingsSnapshot(): BookingRecord[] {
  load()
  return cache
}

export function getLastUpdatedAt(): string {
  load()
  return lastUpdatedAt
}

export function getLoadError(): string | null {
  load()
  return loadError
}

export function addBooking(
  input: Omit<BookingRecord, 'id' | 'createdAt' | 'status'>,
): BookingRecord {
  load()
  const record: BookingRecord = {
    ...input,
    id: `BK-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    status: 'pending_payment',
  }
  writeToStorage([...cache, record])
  emit()
  return record
}

export function countSeatsForZone(
  bookings: BookingRecord[],
  concertId: string,
  zoneId: string,
): number {
  return bookings
    .filter((b) => b.concertId === concertId && b.zoneId === zoneId && b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.quantity, 0)
}

export function countSeatsForConcert(bookings: BookingRecord[], concertId: string): number {
  return bookings
    .filter((b) => b.concertId === concertId && b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.quantity, 0)
}
```

Two details that matter for correctness: `getBookingsSnapshot` must keep returning the *same array reference* until something actually changes (React tears down with "The result of getSnapshot should be cached" otherwise) — that is why `cache` is only reassigned inside `writeToStorage`/`load`. And `load()` never calls `emit()`, because it runs during render.

- [ ] **Step 3: Create the React binding**

Create `src/hooks/useBookings.ts`:

```ts
import { useSyncExternalStore } from 'react'
import {
  getBookingsSnapshot,
  getLastUpdatedAt,
  getLoadError,
  subscribeBookings,
} from '@/utils/bookingStore'
import type { BookingRecord } from '@/interface/IBookingInterface'

export interface BookingsView {
  bookings: BookingRecord[]
  lastUpdatedAt: string
  loadError: string | null
}

export function useBookings(): BookingsView {
  const bookings = useSyncExternalStore(subscribeBookings, getBookingsSnapshot)
  return {
    bookings,
    lastUpdatedAt: getLastUpdatedAt(),
    loadError: getLoadError(),
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/interface/IBookingInterface.ts Frontend/src/utils/bookingStore.ts Frontend/src/hooks/useBookings.ts
git commit -m "feat: add localStorage-backed booking store"
```

---

### Task 2: Persist confirmed bookings and collect the customer name

**Files:**
- Modify: `src/hooks/useZoneBooking.ts` (full rewrite — shown below)
- Modify: `src/pages/concerts/ZoneSelectionPage.tsx` (targeted edits — shown below)

**Interfaces:**
- Consumes: `addBooking`, `countSeatsForZone` from Task 1's `bookingStore.ts`; `useBookings` from Task 1's `useBookings.ts`; `BookingRecord` from Task 1's `IBookingInterface.ts`.
- Produces (changed public surface of `useZoneBooking.ts`, consumed by Task 3's map edits and by the page):
  - **Signature change:** `useZoneBooking(concert: Concert | null)` — it now takes the loaded concert object instead of a `concertId` string, so it can resolve tier prices and the concert title itself.
  - `ZoneBookingState` gains `customerName: string`, `setCustomerName: (name: string) => void`, `unitPrice: number`, `totalPrice: number`, `lastBooking: BookingRecord | null`.
  - `ZoneBookingState` no longer needs the page to compute prices — `unitPrice`/`totalPrice` replace the page's local `selectedTier`/`totalPrice` calculation.
  - Unchanged: `zones`, `selectedZone`, `phase`, `remainingSeconds`, `errorMessage`, `quantity`, `maxQuantity`, `selectZone`, `setQuantity`, `confirmBooking`, `ZONE_LOCK_SECONDS`, `MAX_TICKETS_PER_BOOKING`, `BookingPhase`, `ZoneWithAvailability`.

- [ ] **Step 1: Rewrite the booking hook**

Replace the entire contents of `src/hooks/useZoneBooking.ts` with:

```ts
import { useEffect, useMemo, useState } from 'react'
import { getZoneMap } from '@/utils/mockZones'
import { addBooking, countSeatsForZone } from '@/utils/bookingStore'
import { useBookings } from '@/hooks/useBookings'
import type { Zone } from '@/interface/IZoneInterface'
import type { BookingRecord } from '@/interface/IBookingInterface'
import type { Concert } from '@/interface/IConcertInterface'

export const ZONE_LOCK_SECONDS = 60
export const MAX_TICKETS_PER_BOOKING = 4

export type BookingPhase = 'idle' | 'locked' | 'confirmed' | 'expired'

export interface ZoneWithAvailability extends Zone {
  remaining: number
}

export interface ZoneBookingState {
  zones: ZoneWithAvailability[]
  selectedZone: ZoneWithAvailability | null
  phase: BookingPhase
  remainingSeconds: number
  errorMessage: string | null
  quantity: number
  maxQuantity: number
  customerName: string
  unitPrice: number
  totalPrice: number
  lastBooking: BookingRecord | null
  selectZone: (zoneId: string) => void
  setQuantity: (next: number) => void
  setCustomerName: (name: string) => void
  confirmBooking: () => void
}

export function useZoneBooking(concert: Concert | null): ZoneBookingState {
  const concertId = concert?.id ?? ''
  const baseZones = useMemo(() => getZoneMap(concertId), [concertId])
  const { bookings } = useBookings()

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [phase, setPhase] = useState<BookingPhase>('idle')
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [quantity, setQuantityState] = useState(1)
  const [customerName, setCustomerName] = useState('')
  const [lastBooking, setLastBooking] = useState<BookingRecord | null>(null)

  useEffect(() => {
    if (phase !== 'locked' || lockExpiresAt === null) return
    const expiresAt = lockExpiresAt

    function tick() {
      const secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft === 0) {
        setSelectedZoneId(null)
        setLockExpiresAt(null)
        setQuantityState(1)
        setPhase('expired')
        setErrorMessage('หมดเวลา โซนที่เลือกถูกปล่อยคืนอัตโนมัติ กรุณาเลือกโซนใหม่')
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [phase, lockExpiresAt])

  const zones: ZoneWithAvailability[] = baseZones.map((zone) => {
    const booked = zone.booked + countSeatsForZone(bookings, concertId, zone.id)
    const heldByMe = zone.id === selectedZoneId && phase === 'locked' ? quantity : 0
    return { ...zone, booked, remaining: zone.capacity - booked - heldByMe }
  })

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null

  const maxQuantity = selectedZone
    ? Math.min(MAX_TICKETS_PER_BOOKING, selectedZone.capacity - selectedZone.booked)
    : MAX_TICKETS_PER_BOOKING

  const unitPrice = selectedZone
    ? (concert?.tiers.find((t) => t.name === selectedZone.tierName)?.price ?? 0)
    : 0
  const totalPrice = unitPrice * quantity

  function selectZone(zoneId: string) {
    if (phase === 'confirmed') return
    if (phase === 'locked' && zoneId === selectedZoneId) return

    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return

    const availableToMe = zone.capacity - zone.booked
    if (availableToMe <= 0) {
      setErrorMessage('โซนนี้เต็มแล้ว กรุณาเลือกโซนอื่น')
      return
    }

    // เปลี่ยนโซนระหว่างที่ยังจับจองอยู่ได้ ที่ที่กันไว้ของโซนเดิมถูกคืนเองอัตโนมัติ
    // เพราะ heldByMe ผูกกับ selectedZoneId ปัจจุบันเท่านั้น ไม่ได้เก็บแยกไว้
    setErrorMessage(null)
    setSelectedZoneId(zoneId)
    setQuantityState(1)
    setLockExpiresAt(Date.now() + ZONE_LOCK_SECONDS * 1000)
    setRemainingSeconds(ZONE_LOCK_SECONDS)
    setPhase('locked')
  }

  function setQuantity(next: number) {
    if (phase !== 'locked') return
    setQuantityState(Math.min(Math.max(1, next), maxQuantity))
  }

  function confirmBooking() {
    if (phase !== 'locked' || !selectedZone || !concert) return

    if (customerName.trim().length === 0) {
      setErrorMessage('กรุณากรอกชื่อผู้จองก่อนยืนยันรายการ')
      return
    }

    const record = addBooking({
      concertId: concert.id,
      concertTitle: concert.title,
      zoneId: selectedZone.id,
      tierName: selectedZone.tierName,
      quantity,
      totalPrice,
      customerName: customerName.trim(),
    })

    setLastBooking(record)
    setErrorMessage(null)
    setLockExpiresAt(null)
    setPhase('confirmed')
  }

  return {
    zones,
    selectedZone,
    phase,
    remainingSeconds,
    errorMessage,
    quantity,
    maxQuantity,
    customerName,
    unitPrice,
    totalPrice,
    lastBooking,
    selectZone,
    setQuantity,
    setCustomerName,
    confirmBooking,
  }
}
```

- [ ] **Step 2: Update the page to the new hook signature**

In `src/pages/concerts/ZoneSelectionPage.tsx`, change the hook call from:

```tsx
  const booking = useZoneBooking(concertId)
```

to:

```tsx
  const booking = useZoneBooking(concert)
```

Then delete these three lines (the hook now supplies the price):

```tsx
  const selectedTier = selectedZone
    ? concert.tiers.find((t) => t.name === selectedZone.tierName)
    : undefined
  const totalPrice = (selectedTier?.price ?? 0) * booking.quantity
```

so that the block below the `if (!concert)` guard reads:

```tsx
  const selectedZone = booking.selectedZone

  // SVG ไม่มี z-index — ลำดับใน DOM คือลำดับการวาด จึงต้องวาดโซนที่เลือกเป็นตัวสุดท้าย
  // ไม่อย่างนั้นเงาและส่วนที่ขยายออกมาจะถูกโซนข้าง ๆ วาดทับ
  const zonesInPaintOrder = [...booking.zones].sort(
    (a, b) => Number(a.id === selectedZone?.id) - Number(b.id === selectedZone?.id),
  )
```

- [ ] **Step 3: Add the customer-name field and use the hook's total**

Still in `src/pages/concerts/ZoneSelectionPage.tsx`, add `TextField` to the MUI import list so it reads:

```tsx
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
```

Then replace the price line:

```tsx
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ยอดที่ต้องชำระ: {totalPrice.toLocaleString('en-US')} บาท
                  {booking.quantity > 1 && selectedTier
                    ? ` (${selectedTier.price.toLocaleString('en-US')} × ${booking.quantity})`
                    : ''}
                </Typography>
```

with the name field plus the hook-supplied total:

```tsx
                <TextField
                  fullWidth
                  size="small"
                  label="ชื่อผู้จอง"
                  required
                  data-testid="customer-name-input"
                  value={booking.customerName}
                  onChange={(event) => booking.setCustomerName(event.target.value)}
                  sx={{ mb: 1.5 }}
                />

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ยอดที่ต้องชำระ: {booking.totalPrice.toLocaleString('en-US')} บาท
                  {booking.quantity > 1
                    ? ` (${booking.unitPrice.toLocaleString('en-US')} × ${booking.quantity})`
                    : ''}
                </Typography>
```

- [ ] **Step 4: Show the booking code in the success message**

Still in `src/pages/concerts/ZoneSelectionPage.tsx`, replace:

```tsx
          <Alert severity="success" data-testid="booking-confirmed">
            จองโซน {selectedZone.id} จำนวน {booking.quantity} ใบ สำเร็จ — สถานะ: รอชำระเงิน
          </Alert>
```

with:

```tsx
          <Alert severity="success" data-testid="booking-confirmed">
            จองโซน {selectedZone.id} จำนวน {booking.quantity} ใบ สำเร็จ — รหัสการจอง{' '}
            {booking.lastBooking?.id} สถานะ: รอชำระเงิน
          </Alert>
```

- [ ] **Step 5: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Verify persistence in the browser**

With the dev server running, open `http://localhost:5173/shows/neon-flux/zones` and:
- Click zone `B1`, press + once (quantity 2), leave "ชื่อผู้จอง" empty and click "ยืนยันรายการ". Confirm a warning appears: "กรุณากรอกชื่อผู้จองก่อนยืนยันรายการ", and the booking is NOT confirmed.
- Type `ทดสอบ ระบบ` into "ชื่อผู้จอง" and click "ยืนยันรายการ". Confirm the success alert appears and includes a booking code starting with `BK-`.
- Reload the page. Confirm zone `B1` now shows two fewer seats available than a freshly-seeded map would (the booking survived the reload) — the quickest check is to run this in the browser console and see your booking listed:
  `JSON.parse(localStorage.getItem('octavia.bookings.v1')).map(b => `${b.id} ${b.customerName} ${b.zoneId} x${b.quantity}`)`

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/hooks/useZoneBooking.ts Frontend/src/pages/concerts/ZoneSelectionPage.tsx
git commit -m "feat: persist confirmed bookings with customer name"
```

---

### Task 3: Real-time remaining count on the arena map

**Files:**
- Modify: `src/pages/concerts/ZoneSelectionPage.tsx` (the zone `<text>` label block)

**Interfaces:**
- Consumes: `ZoneWithAvailability.remaining` from Task 2's `useZoneBooking` (already reflects the store, so this number updates the moment a booking is added anywhere in the app).

- [ ] **Step 1: Split the zone label into id + remaining count**

In `src/pages/concerts/ZoneSelectionPage.tsx`, replace the single label element inside the zone `<g>`:

```tsx
                    <text
                      x={center.x}
                      y={center.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={isSelected ? 12 : 10}
                      fontWeight={isSelected ? 700 : 600}
                      fill={brand.white}
                      style={{ pointerEvents: 'none' }}
                    >
                      {zone.id}
                    </text>
```

with two stacked labels:

```tsx
                    <text
                      x={center.x}
                      y={center.y - 4}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={isSelected ? 12 : 10}
                      fontWeight={isSelected ? 700 : 600}
                      fill={brand.white}
                      style={{ pointerEvents: 'none' }}
                    >
                      {zone.id}
                    </text>
                    <text
                      x={center.x}
                      y={center.y + 7}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={7}
                      fontWeight={600}
                      fill={brand.white}
                      style={{ pointerEvents: 'none' }}
                    >
                      {zone.remaining > 0 ? `${zone.remaining} ใบ` : 'เต็ม'}
                    </text>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Verify the counts in the browser**

Open `http://localhost:5173/shows/neon-flux/zones` and confirm:
- Every zone shows its code on the first line and a remaining count on the second, e.g. `A1` above `20 ใบ`, `B1` above `15 ใบ`, `C1` above `10 ใบ`.
- The pre-full zones `A2`, `B4`, `C4` read `เต็ม` instead of a number.
- `C8` reads `2 ใบ` (it is seeded with 8 of 10 already booked).
- Select an available zone and press + twice: that zone's own count drops by the held quantity live (e.g. `B1` goes `15 ใบ` → `12 ใบ` at quantity 3) while the countdown runs, and returns to `15 ใบ` if you let the hold expire.
- Confirm a booking of 2 in `B2`, then reload: `B2`'s count is 2 lower than before and stays that way.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/concerts/ZoneSelectionPage.tsx
git commit -m "feat: show remaining ticket count on each arena zone"
```

---

### Task 4: Booking tracking dashboard

**Files:**
- Modify: `src/pages/dashboard/index.tsx` (full rewrite — shown below)

**Interfaces:**
- Consumes: `useBookings()` from Task 1; `countSeatsForConcert` from Task 1's `bookingStore.ts`; `BookingStatus` from Task 1's `IBookingInterface.ts`; `getZoneMap` from `src/utils/mockZones.ts`; `useConcerts()` from `src/hooks/useConcerts.ts`; `brand` from `src/theme.ts`.
- Produces: nothing consumed elsewhere — `Dashboard` stays the default export already wired to the `dashboard` route inside `ProtectedRoute`.

- [ ] **Step 1: Rewrite the dashboard**

Replace the entire contents of `src/pages/dashboard/index.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  Container,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { brand } from '@/theme'
import { useBookings } from '@/hooks/useBookings'
import { useConcerts } from '@/hooks/useConcerts'
import { countSeatsForConcert } from '@/utils/bookingStore'
import { getZoneMap } from '@/utils/mockZones'
import type { BookingStatus } from '@/interface/IBookingInterface'

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: 'รอชำระเงิน',
  paid: 'ชำระเงินแล้ว',
  cancelled: 'ยกเลิก',
}

const STATUS_COLORS: Record<BookingStatus, 'warning' | 'success' | 'default'> = {
  pending_payment: 'warning',
  paid: 'success',
  cancelled: 'default',
}

interface SeatSummary {
  id: string
  title: string
  capacity: number
  booked: number
  remaining: number
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

export default function Dashboard() {
  const { bookings, lastUpdatedAt, loadError } = useBookings()
  const concerts = useConcerts()
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const seatSummaries = useMemo<SeatSummary[]>(() => {
    return (concerts.data ?? [])
      .map((concert): SeatSummary | null => {
        const zones = getZoneMap(concert.id)
        if (zones.length === 0) return null
        const capacity = zones.reduce((sum, z) => sum + z.capacity, 0)
        const preBooked = zones.reduce((sum, z) => sum + z.booked, 0)
        const booked = preBooked + countSeatsForConcert(bookings, concert.id)
        return {
          id: concert.id,
          title: concert.title,
          capacity,
          booked,
          remaining: capacity - booked,
        }
      })
      .filter((summary): summary is SeatSummary => summary !== null)
  }, [concerts.data, bookings])

  const query = search.trim().toLowerCase()
  const visibleBookings = bookings
    .filter((b) => statusFilter === 'all' || b.status === statusFilter)
    .filter(
      (b) =>
        query === '' ||
        b.customerName.toLowerCase().includes(query) ||
        b.id.toLowerCase().includes(query),
    )
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} data-testid="booking-tracking-page">
      <Typography variant="h2" sx={{ mb: 0.5 }}>
        ติดตามสถานะการจอง
      </Typography>
      <Typography variant="caption" color="text.secondary" data-testid="last-updated">
        อัปเดตล่าสุด {formatDateTime(lastUpdatedAt)}
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mt: 2 }} data-testid="booking-load-error">
          {loadError} (อัปเดตล่าสุด {formatDateTime(lastUpdatedAt)})
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3, mb: 3, flexWrap: 'wrap' }}>
        {seatSummaries.map((summary) => (
          <Paper
            key={summary.id}
            elevation={0}
            data-testid="seat-summary"
            sx={{ p: 2, borderRadius: 2, border: `1px solid ${brand.border}`, minWidth: 260 }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1 }}>{summary.title}</Typography>
            <Stack direction="row" spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  ที่นั่งทั้งหมด
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{summary.capacity}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  จองแล้ว
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{summary.booked}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  คงเหลือ
                </Typography>
                <Typography sx={{ fontWeight: 700, color: brand.coral }}>
                  {summary.remaining}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="ค้นหาชื่อลูกค้า / รหัสการจอง"
          data-testid="booking-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ minWidth: 260 }}
        />
        <TextField
          select
          size="small"
          label="สถานะ"
          data-testid="status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as BookingStatus | 'all')}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">ทั้งหมด</MenuItem>
          <MenuItem value="pending_payment">รอชำระเงิน</MenuItem>
          <MenuItem value="paid">ชำระเงินแล้ว</MenuItem>
          <MenuItem value="cancelled">ยกเลิก</MenuItem>
        </TextField>
      </Stack>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ border: `1px solid ${brand.border}`, borderRadius: 2 }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>รหัสการจอง</TableCell>
              <TableCell>ลูกค้า</TableCell>
              <TableCell>คอนเสิร์ต</TableCell>
              <TableCell>โซน</TableCell>
              <TableCell align="right">จำนวน</TableCell>
              <TableCell align="right">ยอดรวม</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>เวลาจอง</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    ไม่พบรายการจองที่ตรงกับเงื่อนไข กรุณาตรวจสอบคำค้นหาใหม่
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleBookings.map((booking) => (
                <TableRow key={booking.id} data-testid="booking-row">
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>{booking.customerName}</TableCell>
                  <TableCell>{booking.concertTitle}</TableCell>
                  <TableCell>
                    {booking.zoneId} ({booking.tierName})
                  </TableCell>
                  <TableCell align="right">{booking.quantity}</TableCell>
                  <TableCell align="right">{booking.totalPrice.toLocaleString('en-US')}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={STATUS_LABELS[booking.status]}
                      color={STATUS_COLORS[booking.status]}
                    />
                  </TableCell>
                  <TableCell>{formatDateTime(booking.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Verify the dashboard in the browser**

`/dashboard` sits behind `ProtectedRoute`, which only checks for a `token` in localStorage. In the browser console run:

```js
localStorage.setItem('token', 'demo-token')
```

then open `http://localhost:5173/dashboard` and confirm:
- The heading reads "ติดตามสถานะการจอง" with an "อัปเดตล่าสุด …" line below it.
- A summary card for "Neon Flux Festival 2024" shows ที่นั่งทั้งหมด `210`, plus จองแล้ว and คงเหลือ that add up to it. (210 = 2 VIP zones × 20 + 6 Standard × 15 + 8 Economy × 10.)
- The table lists the three seeded bookings — `BK-1001` สมชาย ใจดี (ชำระเงินแล้ว), `BK-1002` สุดา รักดี (รอชำระเงิน), `BK-1003` ปรีชา มั่นคง (ยกเลิก) — plus any booking you made in Task 2/3, newest first.

- [ ] **Step 4: Verify filter and search**

Still on `/dashboard`:
- Set สถานะ to "ยกเลิก": only `BK-1003` remains.
- Set สถานะ back to "ทั้งหมด", type `สุดา` into the search box: only `BK-1002` remains.
- Type `BK-1001` into the search box: only that booking remains (search matches the code as well as the name).
- Type `ไม่มีคนนี้`: the table shows "ไม่พบรายการจองที่ตรงกับเงื่อนไข กรุณาตรวจสอบคำค้นหาใหม่".

- [ ] **Step 5: Verify the real-time cross-tab update**

This proves the postcondition "ผู้ใช้เห็นสถานะที่เป็นปัจจุบันตรงกันทุกฝ่าย":
- Keep `/dashboard` open in the current tab and note the "คงเหลือ" number.
- Open a second tab at `http://localhost:5173/shows/neon-flux/zones`, book a zone (pick zone, set quantity 2, enter a name, confirm).
- Switch back to the dashboard tab **without reloading it**. Confirm the new booking has appeared in the table, "คงเหลือ" has dropped by 2, and "อัปเดตล่าสุด" now shows the current time.

- [ ] **Step 6: Verify the abnormal path (corrupted data)**

The use case's abnormal path is "ระบบขัดข้อง แจ้งเตือนพร้อมเวลาที่อัปเดตล่าสุด". Simulate unreadable storage — in the console on the dashboard tab run:

```js
localStorage.setItem('octavia.bookings.v1', '{{{ not json')
```

then reload `/dashboard`. Confirm:
- A red alert appears reading "อ่านข้อมูลการจองล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลชุดก่อนหน้า (อัปเดตล่าสุด …)" with a timestamp.
- The page still renders (falling back to the seeded list) rather than crashing.

Then restore a clean state for the next person:

```js
localStorage.removeItem('octavia.bookings.v1')
```

and reload once to confirm the alert is gone and the three seeded bookings are back.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/pages/dashboard/index.tsx
git commit -m "feat: add booking tracking dashboard with live seat counts"
```
