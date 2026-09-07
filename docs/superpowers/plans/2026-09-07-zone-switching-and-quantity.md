# Zone Switching and Ticket Quantity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the arena zone map, let the customer switch to a different zone while a hold is active, choose how many tickets to book (1–4, also capped by what the zone actually has left), and make the currently selected zone visually stand out on the map.

**Architecture:** All three changes live in the two files that already own this flow. `useZoneBooking` gains a `quantity`/`maxQuantity` pair and drops the "you must confirm or wait before picking another zone" rule — switching simply re-points `selectedZoneId`, which auto-releases the old hold because held seats are derived from the current selection rather than stored separately. `ZoneSelectionPage` gains a +/− quantity stepper with a running total, and paints the selected zone last with a scale-up, drop-shadow and heavier outline so it reads as the focused element.

**Tech Stack:** React 19, TypeScript, MUI (`IconButton` + `@mui/icons-material` Add/Remove), inline SVG (`<feDropShadow>` filter), Vite. No test runner is wired up in this repo. Verification is `tsc -b` for the hook/data layer and manual browser checks for the UI.

**Spec:** the in-conversation request "ให้สามารถเปลี่ยนโซนได้ และเพิ่มการเลือกจำนวนบัตร ตกแต่งในโซนเดียวให้โซนเดียว", scoped via AskUserQuestion to: (1) zone switching while a hold is active, (2) ticket quantity with a maximum of 4 per booking, (3) "ตกแต่ง" = restyle the selected zone so it stands out more. Builds on `docs/superpowers/plans/2026-09-07-arena-zone-map.md`, which is already implemented.

## Global Constraints

- Maximum 4 tickets per booking (`MAX_TICKETS_PER_BOOKING = 4`), further capped by the selected zone's real availability (`capacity - booked`), whichever is smaller.
- Switching zones resets the quantity to 1 and restarts the 60-second hold countdown from the top.
- Color rules are unchanged: `src/theme.ts`'s 5 brand tokens for everything except the zone tier/legend colors, which stay in `src/utils/zoneTierColors.ts`. Neither file needs editing in this plan — the selected-zone emphasis uses `brand.coral` and `brand.navy`, both already in the brand palette.
- Scope stays the Neon Flux Festival concert only (`id: 'neon-flux'`).
- The previous plan's rule — never let a native `disabled` attribute swallow a click that the spec says must produce a message — still holds for **zone shapes** (a full zone must stay clickable so `selectZone` can answer "โซนนี้เต็มแล้ว"). It does NOT apply to the quantity stepper: reaching 1 or the maximum is an ordinary bound, not a spec'd abnormal path, and the visible "สูงสุด N ใบ" caption plus the greyed-out button already communicate it. Disabling those two `IconButton`s is intentional.

---

### Task 1: Zone switching, ticket quantity, and a partially-booked zone to test the cap against

**Files:**
- Modify: `src/hooks/useZoneBooking.ts` (full rewrite — shown below)
- Modify: `src/utils/mockZones.ts`

**Interfaces:**
- Consumes: `getZoneMap(concertId: string): Zone[]` and `ARENA_CENTER` from `src/utils/mockZones.ts`; `Zone` from `src/interface/IZoneInterface.ts` — all already exist.
- Produces (changed public surface of `useZoneBooking.ts`, consumed by Task 2's page):
  - `MAX_TICKETS_PER_BOOKING: number` — new export, value `4`.
  - `ZoneBookingState` gains `quantity: number`, `maxQuantity: number`, and `setQuantity: (next: number) => void`.
  - `selectZone(zoneId)` now switches zones while `phase === 'locked'` instead of rejecting; it is a no-op when the clicked zone is already the selected one.
  - `confirmBooking()` now books `quantity` tickets, not 1.
  - Unchanged and still exported: `ZONE_LOCK_SECONDS`, `BookingPhase`, `ZoneWithAvailability`, `zones`, `selectedZone`, `phase`, `remainingSeconds`, `errorMessage`.

- [ ] **Step 1: Give one zone a partial booking so the availability cap is observable**

Every zone currently has `booked` set to either `0` or its full `capacity`, so `maxQuantity` would always be 4 and the "capped by real availability" branch could never be seen in the browser. Give `C8` (capacity 10) 8 existing bookings, leaving 2.

In `src/utils/mockZones.ts`, replace:

```ts
const NEON_FLUX_ZONES: Zone[] = [
  {
    id: 'A1',
    tierName: 'VIP',
    capacity: 20,
    booked: 0,
    shape: { kind: 'rect', x: 110, y: 60, width: 70, height: 55 },
  },
  {
    id: 'A2',
    tierName: 'VIP',
    capacity: 20,
    booked: 20,
    shape: { kind: 'rect', x: 220, y: 60, width: 70, height: 55 },
  },
  ...buildRing('B', 'Standard', 15, 6, 95, 145, [2]),
  ...buildRing('C', 'Economy', 10, 8, 150, 195, [4]),
]
```

with:

```ts
// C8 ถูกจองไปแล้วบางส่วน (เหลือ 2 ใบ) ไว้ทดสอบเพดานจำนวนบัตรที่ถูกจำกัดด้วยที่ว่างจริง
const PARTIALLY_BOOKED: Record<string, number> = { C8: 8 }

const NEON_FLUX_ZONES: Zone[] = [
  {
    id: 'A1',
    tierName: 'VIP',
    capacity: 20,
    booked: 0,
    shape: { kind: 'rect', x: 110, y: 60, width: 70, height: 55 },
  },
  {
    id: 'A2',
    tierName: 'VIP',
    capacity: 20,
    booked: 20,
    shape: { kind: 'rect', x: 220, y: 60, width: 70, height: 55 },
  },
  ...buildRing('B', 'Standard', 15, 6, 95, 145, [2]),
  ...buildRing('C', 'Economy', 10, 8, 150, 195, [4]),
].map((zone) => ({ ...zone, booked: PARTIALLY_BOOKED[zone.id] ?? zone.booked }))
```

Leave the rest of the file (`ARENA_CENTER`, `buildRing`, `ZONE_MAPS`, `getZoneMap`) exactly as it is. `A2`, `B4` and `C4` stay fully booked.

- [ ] **Step 2: Rewrite the booking hook**

Replace the entire contents of `src/hooks/useZoneBooking.ts` with:

```ts
import { useEffect, useMemo, useState } from 'react'
import { getZoneMap } from '@/utils/mockZones'
import type { Zone } from '@/interface/IZoneInterface'

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
  selectZone: (zoneId: string) => void
  setQuantity: (next: number) => void
  confirmBooking: () => void
}

export function useZoneBooking(concertId: string | undefined): ZoneBookingState {
  const baseZones = useMemo(() => getZoneMap(concertId ?? ''), [concertId])
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(baseZones.map((z) => [z.id, z.booked])),
  )
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [phase, setPhase] = useState<BookingPhase>('idle')
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [quantity, setQuantityState] = useState(1)

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
    const booked = bookedCounts[zone.id] ?? zone.booked
    const heldByMe = zone.id === selectedZoneId && phase === 'locked' ? quantity : 0
    return { ...zone, booked, remaining: zone.capacity - booked - heldByMe }
  })

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null

  const maxQuantity = selectedZone
    ? Math.min(MAX_TICKETS_PER_BOOKING, selectedZone.capacity - selectedZone.booked)
    : MAX_TICKETS_PER_BOOKING

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
    if (phase !== 'locked' || !selectedZoneId) return
    setBookedCounts((prev) => ({
      ...prev,
      [selectedZoneId]: (prev[selectedZoneId] ?? 0) + quantity,
    }))
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
    selectZone,
    setQuantity,
    confirmBooking,
  }
}
```

Three behavior changes to notice while reviewing this file:
1. The old `if (phase === 'locked' && zoneId !== selectedZoneId)` rejection branch (which set "กรุณายืนยันหรือรอ...") is gone — that message no longer exists anywhere in the app.
2. The availability check is `zone.capacity - zone.booked`, not `zone.remaining`. `remaining` already subtracts the caller's own hold, so using it here would wrongly report a zone as full once you held its last seats.
3. `heldByMe` is now `quantity` rather than `1`, so the map's "remaining" reflects the whole pending order.

- [ ] **Step 3: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: one error, in `src/pages/concerts/ZoneSelectionPage.tsx` — the page still renders the old single-ticket summary and does not yet pass `quantity`. That is expected at this point and is fixed in Task 2. There must be no errors in `useZoneBooking.ts` or `mockZones.ts` themselves.

If `tsc -b` reports **no** errors at all, that is also fine — it just means the page happened to still typecheck against the widened state object. Either outcome is acceptable; errors anywhere other than `ZoneSelectionPage.tsx` are not.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/hooks/useZoneBooking.ts Frontend/src/utils/mockZones.ts
git commit -m "feat: allow switching zones and booking multiple tickets"
```

---

### Task 2: Quantity stepper, running total, and selected-zone emphasis

**Files:**
- Modify: `src/pages/concerts/ZoneSelectionPage.tsx` (full rewrite — shown below)

**Interfaces:**
- Consumes: `useZoneBooking(concertId)` from Task 1, specifically the new `quantity`, `maxQuantity` and `setQuantity(next: number)` members plus the existing `zones`, `selectedZone`, `phase`, `remainingSeconds`, `errorMessage`, `selectZone`, `confirmBooking`; `zoneShapeToPath` / `zoneShapeCenter` from `src/utils/arenaShapes.ts`; `ARENA_CENTER` from `src/utils/mockZones.ts`; `ZONE_TIER_COLORS` / `ZONE_FULL_COLOR` from `src/utils/zoneTierColors.ts`; `brand` from `src/theme.ts`; `useConcert` from `src/hooks/useConcerts.ts`.
- Produces: nothing new for other files — `ZoneSelectionPage` stays the default export used by the `shows/:concertId/zones` route.

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `src/pages/concerts/ZoneSelectionPage.tsx` with:

```tsx
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { brand } from '@/theme'
import { useConcert } from '@/hooks/useConcerts'
import { useZoneBooking } from '@/hooks/useZoneBooking'
import { zoneShapeCenter, zoneShapeToPath } from '@/utils/arenaShapes'
import { ARENA_CENTER } from '@/utils/mockZones'
import { ZONE_FULL_COLOR, ZONE_TIER_COLORS } from '@/utils/zoneTierColors'

export function ZoneSelectionPage() {
  const { concertId } = useParams()
  const { data: concert, loading } = useConcert(concertId)
  const booking = useZoneBooking(concertId)

  if (loading) {
    return (
      <Box
        data-testid="zone-selection-page"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!concert) {
    return (
      <Box data-testid="zone-selection-page" sx={{ py: 8, textAlign: 'center' }}>
        <Typography color="text.secondary">ไม่พบคอนเสิร์ตที่ต้องการ</Typography>
      </Box>
    )
  }

  const selectedZone = booking.selectedZone
  const selectedTier = selectedZone
    ? concert.tiers.find((t) => t.name === selectedZone.tierName)
    : undefined
  const totalPrice = (selectedTier?.price ?? 0) * booking.quantity

  // SVG ไม่มี z-index — ลำดับใน DOM คือลำดับการวาด จึงต้องวาดโซนที่เลือกเป็นตัวสุดท้าย
  // ไม่อย่างนั้นเงาและส่วนที่ขยายออกมาจะถูกโซนข้าง ๆ วาดทับ
  const zonesInPaintOrder = [...booking.zones].sort(
    (a, b) => Number(a.id === selectedZone?.id) - Number(b.id === selectedZone?.id),
  )

  return (
    <Box data-testid="zone-selection-page" sx={{ bgcolor: 'background.paper', py: 4 }}>
      <Container maxWidth="sm">
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          แตะที่โซนบนผังเพื่อจองที่นั่ง (เปลี่ยนโซนได้ตลอดก่อนกดยืนยัน)
        </Typography>

        {booking.errorMessage && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="zone-error-message">
            {booking.errorMessage}
          </Alert>
        )}

        {booking.phase === 'confirmed' && selectedZone ? (
          <Alert severity="success" data-testid="booking-confirmed">
            จองโซน {selectedZone.id} จำนวน {booking.quantity} ใบ สำเร็จ — สถานะ: รอชำระเงิน
          </Alert>
        ) : (
          <>
            <Box component="svg" viewBox="0 0 400 335" sx={{ width: '100%', height: 'auto', mb: 2 }}>
              <defs>
                <filter id="zone-selected-glow" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="3.5"
                    floodColor={brand.navy}
                    floodOpacity="0.5"
                  />
                </filter>
              </defs>

              <rect x={140} y={15} width={120} height={35} rx={4} fill={brand.navy} />
              <text x={200} y={36} textAnchor="middle" fontSize={14} fontWeight={700} fill={brand.white}>
                STAGE
              </text>

              {zonesInPaintOrder.map((zone) => {
                const isSelected = selectedZone?.id === zone.id
                const isFull = zone.remaining <= 0 && !isSelected
                const fill = isSelected
                  ? brand.coral
                  : isFull
                    ? ZONE_FULL_COLOR
                    : ZONE_TIER_COLORS[zone.tierName]
                const center = zoneShapeCenter(zone.shape, ARENA_CENTER.x, ARENA_CENTER.y)
                const dimmed = booking.phase === 'locked' && !isSelected
                return (
                  <g
                    key={zone.id}
                    data-testid="zone-shape"
                    onClick={() => booking.selectZone(zone.id)}
                    style={{ cursor: 'pointer' }}
                    opacity={dimmed ? 0.45 : 1}
                    filter={isSelected ? 'url(#zone-selected-glow)' : undefined}
                    transform={
                      isSelected
                        ? `translate(${center.x} ${center.y}) scale(1.06) translate(${-center.x} ${-center.y})`
                        : undefined
                    }
                  >
                    <path
                      d={zoneShapeToPath(zone.shape, ARENA_CENTER.x, ARENA_CENTER.y)}
                      fill={fill}
                      stroke={isSelected ? brand.navy : brand.white}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
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
                  </g>
                )
              })}
            </Box>

            <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
              {concert.tiers.map((tier) => (
                <Stack key={tier.name} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: ZONE_TIER_COLORS[tier.name] }}
                  />
                  <Typography variant="caption">
                    {tier.name} ({tier.price.toLocaleString('en-US')} บาท)
                  </Typography>
                </Stack>
              ))}
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: ZONE_FULL_COLOR }} />
                <Typography variant="caption">เต็มแล้ว</Typography>
              </Stack>
            </Stack>

            {booking.phase === 'locked' && selectedZone && (
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${brand.border}` }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    โซน {selectedZone.id} ({selectedZone.tierName})
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: brand.coral }}>
                    เหลือเวลา {Math.floor(booking.remainingSeconds / 60)}:
                    {String(booking.remainingSeconds % 60).padStart(2, '0')}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
                >
                  <Typography variant="body2">จำนวนบัตร</Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <IconButton
                      size="small"
                      data-testid="quantity-decrease"
                      aria-label="ลดจำนวนบัตร"
                      disabled={booking.quantity <= 1}
                      onClick={() => booking.setQuantity(booking.quantity - 1)}
                      sx={{ border: `1px solid ${brand.border}` }}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography
                      data-testid="quantity-value"
                      sx={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}
                    >
                      {booking.quantity}
                    </Typography>
                    <IconButton
                      size="small"
                      data-testid="quantity-increase"
                      aria-label="เพิ่มจำนวนบัตร"
                      disabled={booking.quantity >= booking.maxQuantity}
                      onClick={() => booking.setQuantity(booking.quantity + 1)}
                      sx={{ border: `1px solid ${brand.border}` }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="caption" color="text.secondary">
                      สูงสุด {booking.maxQuantity} ใบ
                    </Typography>
                  </Stack>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ยอดที่ต้องชำระ: {totalPrice.toLocaleString('en-US')} บาท
                  {booking.quantity > 1 && selectedTier
                    ? ` (${selectedTier.price.toLocaleString('en-US')} × ${booking.quantity})`
                    : ''}
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

- [ ] **Step 2: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors anywhere.

- [ ] **Step 3: Verify quantity selection in the browser**

With the dev server running, open `http://localhost:5173/shows/neon-flux/zones` and confirm:
- Clicking `B1` opens the summary panel showing "โซน B1 (Standard)", a "จำนวนบัตร" row reading `1` between a − and a + button, the caption "สูงสุด 4 ใบ", and "ยอดที่ต้องชำระ: 3,500 บาท".
- The − button is greyed out at quantity 1.
- Clicking + twice makes the count read `3` and the total read "ยอดที่ต้องชำระ: 10,500 บาท (3,500 × 3)".
- Clicking + once more reads `4`, and the + button then greys out (the 4-per-booking cap).
- Clicking − once returns to `3` and the total to "10,500 บาท (3,500 × 3)".

- [ ] **Step 4: Verify the availability cap in the browser**

Still on the same page, click zone `C8` (outer green ring, right-hand end — it has 8 of 10 seats already booked). Confirm:
- The panel's caption reads "สูงสุด 2 ใบ" instead of 4.
- The + button greys out at `2`, not `4`.

- [ ] **Step 5: Verify zone switching in the browser**

Reload the page to reset state, then:
- Click `B1`, press + twice (quantity `3`), then click `C1` on the map.
- Confirm the panel switches to "โซน C1 (Economy)", the quantity resets to `1`, the total reads "2,000 บาท", and the countdown restarts near "1:00" rather than continuing from where `B1` left off.
- Confirm `B1` returns to its normal blue Standard color and `C1` is now the highlighted one — exactly one zone is highlighted at any time.
- Confirm the old "กรุณายืนยันหรือรอให้โซนที่เลือกไว้หมดเวลาก่อนเลือกโซนใหม่" warning does NOT appear.
- Click the already-full `A2` while `C1` is held: the warning "โซนนี้เต็มแล้ว กรุณาเลือกโซนอื่น" appears and the selection stays on `C1` (its quantity and countdown untouched).

- [ ] **Step 6: Verify the selected-zone emphasis in the browser**

With a zone selected, confirm visually that it stands out from the rest:
- The selected zone is drawn slightly larger than its neighbors and overlaps them rather than being overlapped.
- It has a dark navy outline (thicker than the thin white dividers on other zones) and a soft drop shadow.
- Its label is larger and bolder than the other zone labels.
- Every other zone is dimmed to roughly half opacity while a zone is held, and returns to full opacity once the hold ends (confirm a booking or let it expire).

- [ ] **Step 7: Verify a multi-ticket booking end to end**

Reload, click `B2`, press + twice (quantity `3`), then click "ยืนยันรายการ". Confirm:
- The map is replaced by the green success alert reading "จองโซน B2 จำนวน 3 ใบ สำเร็จ — สถานะ: รอชำระเงิน".

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/pages/concerts/ZoneSelectionPage.tsx
git commit -m "feat: add ticket quantity stepper and highlight the selected zone"
```
