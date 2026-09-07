# Temporary Seat Reservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "จองที่นั่งชั่วคราว" (Temporarily Reserve Seat) use case end-to-end for one concert: clicking "ซื้อบัตร" on the Neon Flux Festival detail page opens a seat map, picking an available seat locks it and starts a countdown, a payment summary appears with a confirm button, and both abnormal paths (seat already taken, countdown expires) behave as specified.

**Architecture:** Add a seat-level data model (`Seat`) alongside the existing `Concert`/`TicketTier` types, a mock seat map keyed by concert id (populated only for `neon-flux`), and a `useSeatBooking` hook that holds all booking state (seat statuses, selection, countdown, confirm) as in-memory React state — no backend, no persistence across reloads. A new `SeatSelectionPage` renders the seat map grouped by zone and the booking summary, replacing the plan's earlier `ZoneSelectionPage` draft (that draft was never implemented, so nothing needs to be rolled back). `ConcertDetailPage`'s buy button links to this new page.

**Tech Stack:** React 19, TypeScript, MUI, react-router-dom, Vite. No test runner is wired up in this repo. Verification is `tsc -b` for the data/hook layer and manual browser checks (via the Browser pane) for the UI and timing behavior.

**Spec:** the "จองที่นั่งชั่วคราว" (Temporarily Reserve Seat) use case table supplied by the user in-conversation (System Use Case / Actor / Preconditions / Step-by-step / Postconditions / Abnormal Paths). The "ตรวจสอบและใช้สิทธิ์โปรโมชั่น" (promotion) use case supplied alongside it is explicitly OUT of scope for this plan per the user's own scoping choice.

## Global Constraints

- Color palette is locked to the 5 brand tokens in `src/theme.ts:3-16` (`brand.navy`, `brand.purple`, `brand.magenta`, `brand.coral`, `brand.white`) plus their alpha derivatives (`brand.panelTint`, `brand.border`, `brand.navyFaded`, `brand.textMuted`). No new colors.
- Scope is the Neon Flux Festival concert only (`id: 'neon-flux'`). The seat map data function must be keyed by `concertId` (not hardcoded into the component) so other concerts can get real seat data later without changing the hook or page, but only `neon-flux` gets mock seats in this plan — every other concert id returns an empty seat list.
- Promotion codes (the separate "ตรวจสอบและใช้สิทธิ์โปรโมชั่น" use case) and any real payment/checkout step are explicitly out of scope. "ยืนยันรายการ" only needs to end in a "รอชำระเงิน" (pending payment) status display — it must not call or link to a payment page, since none exists.
- This is a single-browser-tab simulation: "someone else already locked this seat" (abnormal path 1) is simulated by seeding a few seats as already `'booked'` in the mock data, not by any real concurrency.
- The temporary lock duration is a named constant `SEAT_LOCK_SECONDS = 60` (one minute) — short enough to manually verify the expiry abnormal path in a plan step without an excessive wait, long enough to read as a believable "temporary hold" duration.

---

### Task 1: Seat data model, mock seat map, and booking state hook

**Files:**
- Create: `src/interface/ISeatInterface.ts`
- Create: `src/utils/mockSeats.ts`
- Create: `src/hooks/useSeatBooking.ts`

**Interfaces:**
- Consumes: nothing new (pure data/logic layer).
- Produces: `SeatStatus = 'available' | 'locked' | 'booked'` and `Seat { id: string; zoneName: string; row: string; number: number; status: SeatStatus }` from `ISeatInterface.ts`; `getSeatMap(concertId: string): Seat[]` from `mockSeats.ts`; `SEAT_LOCK_SECONDS: number`, `BookingPhase = 'idle' | 'locked' | 'confirmed' | 'expired'`, and `useSeatBooking(concertId: string | undefined): { seats: Seat[]; selectedSeat: Seat | null; phase: BookingPhase; remainingSeconds: number; errorMessage: string | null; selectSeat: (seatId: string) => void; confirmBooking: () => void }` from `useSeatBooking.ts` — all consumed by Task 2's `SeatSelectionPage`.

- [ ] **Step 1: Create the Seat interface**

Create `src/interface/ISeatInterface.ts`:

```ts
export type SeatStatus = 'available' | 'locked' | 'booked'

export interface Seat {
  id: string
  zoneName: string
  row: string
  number: number
  status: SeatStatus
}
```

- [ ] **Step 2: Create the mock seat map**

Create `src/utils/mockSeats.ts`:

```ts
import type { Seat } from '@/interface/ISeatInterface'

interface ZoneLayout {
  name: string
  rows: string[]
  seatsPerRow: number
}

const NEON_FLUX_ZONES: ZoneLayout[] = [
  { name: 'VIP', rows: ['A', 'B'], seatsPerRow: 5 },
  { name: 'Standard', rows: ['C', 'D'], seatsPerRow: 5 },
  { name: 'Economy', rows: ['E', 'F'], seatsPerRow: 5 },
]

const NEON_FLUX_PRE_BOOKED = new Set(['VIP-A3', 'Standard-C2', 'Economy-E5'])

function buildSeatMap(zones: ZoneLayout[], preBooked: Set<string>): Seat[] {
  const seats: Seat[] = []
  for (const zone of zones) {
    for (const row of zone.rows) {
      for (let n = 1; n <= zone.seatsPerRow; n++) {
        const id = `${zone.name}-${row}${n}`
        seats.push({
          id,
          zoneName: zone.name,
          row,
          number: n,
          status: preBooked.has(id) ? 'booked' : 'available',
        })
      }
    }
  }
  return seats
}

const SEAT_MAPS: Record<string, Seat[]> = {
  'neon-flux': buildSeatMap(NEON_FLUX_ZONES, NEON_FLUX_PRE_BOOKED),
}

export function getSeatMap(concertId: string): Seat[] {
  return SEAT_MAPS[concertId] ?? []
}
```

This produces 30 seats for `neon-flux` (10 per zone across VIP/Standard/Economy, matching the zone names in `mockConcerts.ts`'s `tiers` for that concert), with `VIP-A3`, `Standard-C2`, and `Economy-E5` pre-seeded as `'booked'` to exercise the "seat already taken" abnormal path.

- [ ] **Step 3: Create the booking state hook**

Create `src/hooks/useSeatBooking.ts`:

```ts
import { useEffect, useMemo, useState } from 'react'
import { getSeatMap } from '@/utils/mockSeats'
import type { Seat } from '@/interface/ISeatInterface'

export const SEAT_LOCK_SECONDS = 60

export type BookingPhase = 'idle' | 'locked' | 'confirmed' | 'expired'

export interface SeatBookingState {
  seats: Seat[]
  selectedSeat: Seat | null
  phase: BookingPhase
  remainingSeconds: number
  errorMessage: string | null
  selectSeat: (seatId: string) => void
  confirmBooking: () => void
}

export function useSeatBooking(concertId: string | undefined): SeatBookingState {
  const initialSeats = useMemo(() => getSeatMap(concertId ?? ''), [concertId])
  const [seats, setSeats] = useState<Seat[]>(initialSeats)
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [phase, setPhase] = useState<BookingPhase>('idle')
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'locked' || lockExpiresAt === null) return

    function tick() {
      const secondsLeft = Math.max(0, Math.round((lockExpiresAt - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft === 0) {
        setSeats((prev) =>
          prev.map((seat) =>
            seat.id === selectedSeatId ? { ...seat, status: 'available' } : seat,
          ),
        )
        setSelectedSeatId(null)
        setLockExpiresAt(null)
        setPhase('expired')
        setErrorMessage('หมดเวลา ที่นั่งถูกปล่อยคืนอัตโนมัติ กรุณาเลือกที่นั่งใหม่')
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [phase, lockExpiresAt, selectedSeatId])

  function selectSeat(seatId: string) {
    const seat = seats.find((s) => s.id === seatId)
    if (!seat) return

    if (seat.status !== 'available') {
      setErrorMessage('ที่นั่งนี้ถูกจองไปแล้ว กรุณาเลือกที่นั่งอื่น')
      return
    }

    setErrorMessage(null)
    setSeats((prev) => prev.map((s) => (s.id === seatId ? { ...s, status: 'locked' } : s)))
    setSelectedSeatId(seatId)
    setLockExpiresAt(Date.now() + SEAT_LOCK_SECONDS * 1000)
    setRemainingSeconds(SEAT_LOCK_SECONDS)
    setPhase('locked')
  }

  function confirmBooking() {
    if (phase !== 'locked' || !selectedSeatId) return
    setSeats((prev) => prev.map((s) => (s.id === selectedSeatId ? { ...s, status: 'booked' } : s)))
    setLockExpiresAt(null)
    setPhase('confirmed')
  }

  const selectedSeat = seats.find((s) => s.id === selectedSeatId) ?? null

  return { seats, selectedSeat, phase, remainingSeconds, errorMessage, selectSeat, confirmBooking }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/interface/ISeatInterface.ts Frontend/src/utils/mockSeats.ts Frontend/src/hooks/useSeatBooking.ts
git commit -m "feat: add seat data model and temporary seat lock hook"
```

---

### Task 2: Seat selection page and route

**Files:**
- Create: `src/pages/concerts/SeatSelectionPage.tsx`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `useConcert(concertId: string | undefined): AsyncState<Concert>` from `src/hooks/useConcerts.ts:49`; `useSeatBooking` and `SEAT_LOCK_SECONDS` from Task 1's `src/hooks/useSeatBooking.ts`; `brand` tokens from `src/theme.ts:3`.
- Produces: exported component `SeatSelectionPage`, mounted at route path `shows/:concertId/seats`, consumed by Task 3's link in `ConcertDetailPage`.

- [ ] **Step 1: Create the page**

Create `src/pages/concerts/SeatSelectionPage.tsx`:

```tsx
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { brand } from '@/theme'
import { useConcert } from '@/hooks/useConcerts'
import { useSeatBooking } from '@/hooks/useSeatBooking'

export function SeatSelectionPage() {
  const { concertId } = useParams()
  const { data: concert, loading } = useConcert(concertId)
  const booking = useSeatBooking(concertId)

  if (loading) {
    return (
      <Box
        data-testid="seat-selection-page"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!concert) {
    return (
      <Box data-testid="seat-selection-page" sx={{ py: 8, textAlign: 'center' }}>
        <Typography color="text.secondary">ไม่พบคอนเสิร์ตที่ต้องการ</Typography>
      </Box>
    )
  }

  const zoneNames = concert.tiers.map((tier) => tier.name)

  return (
    <Box data-testid="seat-selection-page" sx={{ bgcolor: 'background.paper', py: 4 }}>
      <Container maxWidth="md">
        <Typography
          component={RouterLink}
          to={`/shows/${concert.id}`}
          variant="body2"
          sx={{ color: brand.purple, textDecoration: 'none', display: 'inline-block', mb: 2 }}
        >
          ← กลับไปหน้ารายละเอียด
        </Typography>

        <Typography variant="h1" component="h1" sx={{ mb: 0.5, fontSize: '1.25rem' }}>
          {concert.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          เลือกโซนและที่นั่งจากผังที่นั่ง
        </Typography>

        {booking.errorMessage && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="seat-error-message">
            {booking.errorMessage}
          </Alert>
        )}

        {booking.phase === 'confirmed' && booking.selectedSeat ? (
          <Alert severity="success" data-testid="booking-confirmed">
            จองที่นั่ง {booking.selectedSeat.id} สำเร็จ — สถานะ: รอชำระเงิน
          </Alert>
        ) : (
          <>
            {zoneNames.map((zoneName) => {
              const tier = concert.tiers.find((t) => t.name === zoneName)
              const zoneSeats = booking.seats.filter((s) => s.zoneName === zoneName)
              return (
                <Box key={zoneName} sx={{ mb: 3 }}>
                  <Typography variant="h3" sx={{ mb: 1 }}>
                    {zoneName} — {tier?.price.toLocaleString('en-US')} บาท
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {zoneSeats.map((seat) => {
                      const isSelected = booking.selectedSeat?.id === seat.id
                      const takenByOther = seat.status !== 'available' && !isSelected
                      const disabled =
                        takenByOther ||
                        booking.phase === 'confirmed' ||
                        (booking.phase === 'locked' && !isSelected)
                      return (
                        <Box
                          key={seat.id}
                          component="button"
                          type="button"
                          data-testid="seat-button"
                          onClick={() => booking.selectSeat(seat.id)}
                          disabled={disabled}
                          sx={{
                            width: 40,
                            height: 40,
                            p: 0,
                            borderRadius: 1,
                            fontFamily: 'inherit',
                            border: `2px solid ${isSelected ? brand.coral : brand.border}`,
                            bgcolor: isSelected
                              ? brand.coral
                              : takenByOther
                                ? brand.navyFaded
                                : 'transparent',
                            color: isSelected ? brand.white : brand.navy,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {seat.row}
                          {seat.number}
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              )
            })}

            {booking.phase === 'locked' && booking.selectedSeat && (
              <Paper
                elevation={0}
                sx={{ p: 2, borderRadius: 2, border: `1px solid ${brand.border}` }}
              >
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    ที่นั่ง {booking.selectedSeat.id} ({booking.selectedSeat.zoneName})
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: brand.coral }}>
                    เหลือเวลา {Math.floor(booking.remainingSeconds / 60)}:
                    {String(booking.remainingSeconds % 60).padStart(2, '0')}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ยอดที่ต้องชำระ:{' '}
                  {concert.tiers
                    .find((t) => t.name === booking.selectedSeat!.zoneName)
                    ?.price.toLocaleString('en-US')}{' '}
                  บาท
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  onClick={booking.confirmBooking}
                >
                  ยืนยันรายการ
                </Button>
              </Paper>
            )}
          </>
        )}
      </Container>
    </Box>
  )
}
```

- [ ] **Step 2: Wire the route**

In `src/routes/index.tsx`, add the import next to the other concert pages:

```tsx
import { SeatSelectionPage } from '@/pages/concerts/SeatSelectionPage'
```

Then add the new route entry right after the existing `shows/:concertId` route (inside the `/` route's `children` array):

```tsx
      { path: 'home', element: <HomePage /> },
      { path: 'shows', element: <AllShowsPage /> },
      { path: 'shows/:concertId', element: <ConcertDetailPage /> },
      { path: 'shows/:concertId/seats', element: <SeatSelectionPage /> },
```

- [ ] **Step 3: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Verify the happy path in the browser**

With the dev server running, navigate to `http://localhost:5173/shows/neon-flux/seats` and confirm:
- Heading shows "Neon Flux Festival 2024" and "เลือกโซนและที่นั่งจากผังที่นั่ง".
- Three zone sections appear: "VIP — 5,000 บาท", "Standard — 3,500 บาท", "Economy — 2,000 บาท", each with a row of 10 small seat buttons labeled like `A1`, `A2`, ... `B5`.
- Seats `A3` (VIP), `C2` (Standard), `E5` (Economy) render in a visibly different, disabled/grey style (pre-booked).
- Clicking an available seat (e.g. VIP `A1`) highlights it in coral, disables all other seat buttons, and shows a summary panel below with the seat id, zone, a live countdown starting at "1:00" and counting down every second, the price ("5,000 บาท" for VIP), and a "ยืนยันรายการ" button.
- Clicking "ยืนยันรายการ" replaces the seat map with a green success alert: "จองที่นั่ง VIP-A1 สำเร็จ — สถานะ: รอชำระเงิน".

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/concerts/SeatSelectionPage.tsx Frontend/src/routes/index.tsx
git commit -m "feat: add seat selection page with temporary lock and countdown"
```

---

### Task 3: Link the buy button and verify the abnormal paths

**Files:**
- Modify: `src/pages/concerts/ConcertDetailPage.tsx:85-89`

**Interfaces:**
- Consumes: route path `shows/:concertId/seats` produced by Task 2.

- [ ] **Step 1: Change the button destination**

In `src/pages/concerts/ConcertDetailPage.tsx`, change:

```tsx
              <BuyTicketButton
                to={`/shows/${concert.id}`}
                disabled={concert.saleStatus === 'coming_soon'}
                label={concert.saleStatus === 'coming_soon' ? 'เร็ว ๆ นี้' : 'ซื้อบัตร'}
              />
```

to:

```tsx
              <BuyTicketButton
                to={`/shows/${concert.id}/seats`}
                disabled={concert.saleStatus === 'coming_soon'}
                label={concert.saleStatus === 'coming_soon' ? 'เร็ว ๆ นี้' : 'ซื้อบัตร'}
              />
```

- [ ] **Step 2: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Verify the full click-through flow**

With the dev server running:
1. Go to `http://localhost:5173/home`.
2. Click the "Neon Flux Festival 2024" card's "ซื้อบัตร" button → lands on `/shows/neon-flux` (detail page).
3. Click "ซื้อบัตร" on the detail page → lands on `/shows/neon-flux/seats` (Task 2's page).
4. Confirm a "COMING SOON" concert's detail page (e.g. Celestial Sounds) still shows a disabled "เร็ว ๆ นี้" button that does not navigate anywhere (unchanged regression check).

- [ ] **Step 4: Verify abnormal path 1 — seat already taken**

On `/shows/neon-flux/seats`, click the pre-booked VIP `A3` seat. Confirm:
- A warning alert appears: "ที่นั่งนี้ถูกจองไปแล้ว กรุณาเลือกที่นั่งอื่น".
- No seat becomes selected/highlighted, no countdown starts.

- [ ] **Step 5: Verify abnormal path 2 — lock expires**

On `/shows/neon-flux/seats`, click an available seat (e.g. Standard `C1`) to lock it, then wait ~60 seconds without clicking "ยืนยันรายการ". Confirm:
- The countdown in the summary panel reaches "0:00".
- The summary panel disappears, a warning alert appears: "หมดเวลา ที่นั่งถูกปล่อยคืนอัตโนมัติ กรุณาเลือกที่นั่งใหม่".
- The seat map re-enables and the previously locked seat (`C1`) is selectable again (back to its normal unselected style).

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/pages/concerts/ConcertDetailPage.tsx
git commit -m "feat: link buy ticket button to seat selection page"
```
