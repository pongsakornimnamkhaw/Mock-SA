# Arena Zone Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat, individually-numbered seat grid with a curved, stage-centered arena map (like a real venue seating chart) where the customer books directly by tapping a colored zone — no individual seat number is chosen. Still prototyped against Neon Flux Festival only.

**Architecture:** Zones become the bookable unit (each zone has a `capacity` and a running `booked` count instead of per-seat statuses). A small polar-coordinate geometry helper turns zone definitions (a center rectangle for the two inner VIP blocks, a polar arc segment for every Standard/Economy seat) into SVG path data, so the map is drawn as native SVG shapes arranged in a horseshoe around a `<rect>` stage — no chart library needed. This fully replaces last plan's seat-level model (`Seat`, `mockSeats.ts`, `useSeatBooking`, `SeatSelectionPage`), which is deleted as part of this plan since it was only just built and is being superseded, not deprecated gradually.

**Tech Stack:** React 19, TypeScript, MUI, react-router-dom, inline SVG (no charting/mapping library), Vite. No test runner is wired up in this repo. Verification is `tsc -b` for the data/hook layer and manual browser checks for the map rendering and timing behavior.

**Spec:** the reference venue seat-map image supplied by the user in-conversation, plus the "จองที่นั่งชั่วคราว" (Temporarily Reserve Seat) use case from the previous plan — same lock/countdown/confirm mechanics, just applied to zones instead of seats. Scoping decisions below were confirmed via AskUserQuestion in-conversation: single-step zone-only booking (no seat picking), a dedicated color palette for the zone legend, and a true curved arc layout.

## Global Constraints

- Zone selection is one step: tapping an available zone locks it immediately (like the previous plan's seat lock) — there is no second "pick a seat number" step.
- The zone legend needs its own small color palette, kept in a new file separate from `src/theme.ts`, and used ONLY on the arena map — this is an explicit, scoped exception to `theme.ts`'s "no colors outside the 5 brand tokens" rule, not a relaxation of that rule elsewhere. `theme.ts` itself must not be touched.
- The map must be a true curved horseshoe (stage at top, arcs sweeping below/around it), built with SVG `path` elements using real polar-coordinate math — not a rectangular grid standing in for it.
- Scope stays the Neon Flux Festival concert only (`id: 'neon-flux'`); `getZoneMap(concertId)` must still be keyed generically by concert id (returns `[]` for anything else), matching the pattern already used for `getSeatMap` in the plan this one replaces.
- Lesson carried over from the previous plan: never rely on a native `disabled` attribute to block clicks on a "this zone is full" shape — that swallows the click before the code can show a warning. Zones must always be clickable (SVG `<g onClick>` has no native disabled state to misuse); `selectZone` alone decides whether the click is allowed and what message to show.
- Promotion codes and any real payment/checkout step remain out of scope, same as the previous plan — confirming a zone only needs to end in a "รอชำระเงิน" (pending payment) status display.

---

### Task 1: Zone data model, arena geometry helpers, tier colors, and booking hook

**Files:**
- Create: `src/interface/IZoneInterface.ts` (supersedes `src/interface/ISeatInterface.ts`, deleted in Task 2 together with its last remaining consumer so `tsc -b` never sees a dangling import in between)
- Create: `src/utils/arenaShapes.ts`
- Create: `src/utils/zoneTierColors.ts`
- Create: `src/utils/mockZones.ts`
- Create: `src/hooks/useZoneBooking.ts`

**Interfaces:**
- Consumes: nothing new (pure data/logic layer).
- Produces:
  - `ZoneShape = { kind: 'rect'; x: number; y: number; width: number; height: number } | { kind: 'arc'; startAngle: number; endAngle: number; innerRadius: number; outerRadius: number }` and `Zone { id: string; tierName: string; capacity: number; booked: number; shape: ZoneShape }` from `IZoneInterface.ts`.
  - `zoneShapeToPath(shape: ZoneShape, cx: number, cy: number): string` and `zoneShapeCenter(shape: ZoneShape, cx: number, cy: number): { x: number; y: number }` from `arenaShapes.ts`.
  - `ZONE_TIER_COLORS: Record<string, string>` and `ZONE_FULL_COLOR: string` from `zoneTierColors.ts`.
  - `getZoneMap(concertId: string): Zone[]` and `ARENA_CENTER: { x: number; y: number }` from `mockZones.ts`.
  - `ZONE_LOCK_SECONDS: number`, `BookingPhase = 'idle' | 'locked' | 'confirmed' | 'expired'`, `ZoneWithAvailability extends Zone { remaining: number }`, and `useZoneBooking(concertId: string | undefined): { zones: ZoneWithAvailability[]; selectedZone: ZoneWithAvailability | null; phase: BookingPhase; remainingSeconds: number; errorMessage: string | null; selectZone: (zoneId: string) => void; confirmBooking: () => void }` from `useZoneBooking.ts` — all consumed by Task 2's `ZoneSelectionPage`.

**Important — this task leaves `ISeatInterface.ts` in place for now** even though it is no longer needed by anything created in this task; it is deleted in Task 2 together with its last remaining consumer (`SeatSelectionPage.tsx`) so the build never breaks mid-task.

- [ ] **Step 1: Create the Zone interface**

Create `src/interface/IZoneInterface.ts`:

```ts
export type ZoneShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'arc'; startAngle: number; endAngle: number; innerRadius: number; outerRadius: number }

export interface Zone {
  id: string
  tierName: string
  capacity: number
  booked: number
  shape: ZoneShape
}
```

- [ ] **Step 2: Create the arena geometry helpers**

Create `src/utils/arenaShapes.ts`:

```ts
import type { ZoneShape } from '@/interface/IZoneInterface'

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180
  return { x: cx + radius * Math.cos(angleRad), y: cy + radius * Math.sin(angleRad) }
}

function arcPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle)
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

export function zoneShapeToPath(shape: ZoneShape, cx: number, cy: number): string {
  if (shape.kind === 'rect') {
    return `M ${shape.x} ${shape.y} h ${shape.width} v ${shape.height} h ${-shape.width} Z`
  }
  return arcPath(cx, cy, shape.innerRadius, shape.outerRadius, shape.startAngle, shape.endAngle)
}

export function zoneShapeCenter(
  shape: ZoneShape,
  cx: number,
  cy: number,
): { x: number; y: number } {
  if (shape.kind === 'rect') {
    return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
  }
  const midAngle = (shape.startAngle + shape.endAngle) / 2
  const midRadius = (shape.innerRadius + shape.outerRadius) / 2
  return polarToCartesian(cx, cy, midRadius, midAngle)
}
```

Angle convention used throughout this plan: `0°` points right of center, `90°` points straight down (screen y grows downward), `180°` points left. Sweeping a ring from `startAngle = 0` to `endAngle = 180` therefore traces right → down → left — a horseshoe that opens upward, toward the stage. This is why Task 1 Step 5's `buildRing` always sweeps `0` to `180`.

- [ ] **Step 3: Create the zone tier color palette**

Create `src/utils/zoneTierColors.ts`:

```ts
// เพิ่มชุดสีนี้เฉพาะสำหรับผังโซนที่นั่ง (arena map) เท่านั้น เป็นข้อยกเว้นเฉพาะจุด
// จากกฎ "ห้ามเพิ่มสีนอกเหนือ 5 สีแบรนด์" ใน theme.ts เนื่องจากผังต้องแยกภาพระหว่าง
// ระดับราคาหลายระดับด้วยสีที่ต่างกันชัดเจน ซึ่ง 5 สีแบรนด์ (ที่ส่วนใหญ่เป็นโทนม่วง-ชมพู)
// ไม่พอแยกแยะ ห้ามใช้ชุดสีนี้ที่อื่นในแอป
export const ZONE_TIER_COLORS: Record<string, string> = {
  VIP: '#D4A24C',
  Standard: '#4C7FD4',
  Economy: '#4CAF7A',
}

export const ZONE_FULL_COLOR = '#B0B0B8'
```

- [ ] **Step 4: Create the mock zone map**

Create `src/utils/mockZones.ts`:

```ts
import type { Zone } from '@/interface/IZoneInterface'

export const ARENA_CENTER = { x: 200, y: 130 }

function buildRing(
  prefix: string,
  tierName: string,
  capacity: number,
  count: number,
  innerRadius: number,
  outerRadius: number,
  fullIndices: number[],
): Zone[] {
  const step = 180 / count
  const zones: Zone[] = []
  for (let i = 0; i < count; i++) {
    const segmentNumber = count - i
    const startAngle = i * step
    const endAngle = startAngle + step
    zones.push({
      id: `${prefix}${segmentNumber}`,
      tierName,
      capacity,
      booked: fullIndices.includes(i) ? capacity : 0,
      shape: { kind: 'arc', startAngle, endAngle, innerRadius, outerRadius },
    })
  }
  return zones
}

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

const ZONE_MAPS: Record<string, Zone[]> = {
  'neon-flux': NEON_FLUX_ZONES,
}

export function getZoneMap(concertId: string): Zone[] {
  return ZONE_MAPS[concertId] ?? []
}
```

This produces 16 zones for `neon-flux`: `A1`/`A2` (VIP, rectangular, flanking the stage), `B1`–`B6` (Standard, inner arc ring), `C1`–`C8` (Economy, outer arc ring). `A2`, `B4`, and `C4` are pre-seeded as fully booked (`booked === capacity`) to exercise the "zone full" abnormal path — note these exact ids, they're needed for Task 3's verification.

- [ ] **Step 5: Create the zone booking hook**

Create `src/hooks/useZoneBooking.ts`:

```ts
import { useEffect, useMemo, useState } from 'react'
import { getZoneMap } from '@/utils/mockZones'
import type { Zone } from '@/interface/IZoneInterface'

export const ZONE_LOCK_SECONDS = 60

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
  selectZone: (zoneId: string) => void
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

  useEffect(() => {
    if (phase !== 'locked' || lockExpiresAt === null) return
    const expiresAt = lockExpiresAt

    function tick() {
      const secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft === 0) {
        setSelectedZoneId(null)
        setLockExpiresAt(null)
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
    const heldByMe = zone.id === selectedZoneId && phase === 'locked' ? 1 : 0
    return { ...zone, booked, remaining: zone.capacity - booked - heldByMe }
  })

  function selectZone(zoneId: string) {
    if (phase === 'confirmed') return

    if (phase === 'locked' && zoneId !== selectedZoneId) {
      setErrorMessage('กรุณายืนยันหรือรอให้โซนที่เลือกไว้หมดเวลาก่อนเลือกโซนใหม่')
      return
    }

    const zone = zones.find((z) => z.id === zoneId)
    if (!zone || zone.remaining <= 0) {
      setErrorMessage('โซนนี้เต็มแล้ว กรุณาเลือกโซนอื่น')
      return
    }

    setErrorMessage(null)
    setSelectedZoneId(zoneId)
    setLockExpiresAt(Date.now() + ZONE_LOCK_SECONDS * 1000)
    setRemainingSeconds(ZONE_LOCK_SECONDS)
    setPhase('locked')
  }

  function confirmBooking() {
    if (phase !== 'locked' || !selectedZoneId) return
    setBookedCounts((prev) => ({ ...prev, [selectedZoneId]: (prev[selectedZoneId] ?? 0) + 1 }))
    setLockExpiresAt(null)
    setPhase('confirmed')
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null

  return { zones, selectedZone, phase, remainingSeconds, errorMessage, selectZone, confirmBooking }
}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors. (`ISeatInterface.ts` still exists and is unreferenced by anything new here, so this stays clean; it gets deleted in Task 2.)

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/interface/IZoneInterface.ts Frontend/src/utils/arenaShapes.ts Frontend/src/utils/zoneTierColors.ts Frontend/src/utils/mockZones.ts Frontend/src/hooks/useZoneBooking.ts
git commit -m "feat: add zone data model, arena geometry helpers, and zone booking hook"
```

---

### Task 2: Arena zone map page, route swap, and seat-model cleanup

**Files:**
- Create: `src/pages/concerts/ZoneSelectionPage.tsx`
- Modify: `src/routes/index.tsx`
- Delete: `src/pages/concerts/SeatSelectionPage.tsx`
- Delete: `src/hooks/useSeatBooking.ts`
- Delete: `src/utils/mockSeats.ts`
- Delete: `src/interface/ISeatInterface.ts`

**Interfaces:**
- Consumes: `useConcert(concertId: string | undefined): AsyncState<Concert>` from `src/hooks/useConcerts.ts:49`; `useZoneBooking`, `ZONE_LOCK_SECONDS` from Task 1's `src/hooks/useZoneBooking.ts`; `zoneShapeToPath`, `zoneShapeCenter` from Task 1's `src/utils/arenaShapes.ts`; `ARENA_CENTER`, `getZoneMap` from Task 1's `src/utils/mockZones.ts`; `ZONE_TIER_COLORS`, `ZONE_FULL_COLOR` from Task 1's `src/utils/zoneTierColors.ts`; `brand` from `src/theme.ts:3`.
- Produces: exported component `ZoneSelectionPage`, mounted at route path `shows/:concertId/zones` (replacing the old `shows/:concertId/seats` route entirely), consumed by Task 3's link in `ConcertDetailPage`.

- [ ] **Step 1: Create the arena zone map page**

Create `src/pages/concerts/ZoneSelectionPage.tsx`:

```tsx
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material'
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
          แตะที่โซนบนผังเพื่อจองที่นั่ง
        </Typography>

        {booking.errorMessage && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="zone-error-message">
            {booking.errorMessage}
          </Alert>
        )}

        {booking.phase === 'confirmed' && booking.selectedZone ? (
          <Alert severity="success" data-testid="booking-confirmed">
            จองโซน {booking.selectedZone.id} สำเร็จ — สถานะ: รอชำระเงิน
          </Alert>
        ) : (
          <>
            <Box component="svg" viewBox="0 0 400 335" sx={{ width: '100%', height: 'auto', mb: 2 }}>
              <rect x={140} y={15} width={120} height={35} rx={4} fill={brand.navy} />
              <text x={200} y={36} textAnchor="middle" fontSize={14} fontWeight={700} fill={brand.white}>
                STAGE
              </text>

              {booking.zones.map((zone) => {
                const isSelected = booking.selectedZone?.id === zone.id
                const isFull = zone.remaining <= 0 && !isSelected
                const fill = isSelected
                  ? brand.coral
                  : isFull
                    ? ZONE_FULL_COLOR
                    : ZONE_TIER_COLORS[zone.tierName]
                const center = zoneShapeCenter(zone.shape, ARENA_CENTER.x, ARENA_CENTER.y)
                return (
                  <g
                    key={zone.id}
                    data-testid="zone-shape"
                    onClick={() => booking.selectZone(zone.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <path
                      d={zoneShapeToPath(zone.shape, ARENA_CENTER.x, ARENA_CENTER.y)}
                      fill={fill}
                      stroke={brand.white}
                      strokeWidth={1.5}
                    />
                    <text
                      x={center.x}
                      y={center.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight={600}
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

            {booking.phase === 'locked' && booking.selectedZone && (
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${brand.border}` }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    โซน {booking.selectedZone.id} ({booking.selectedZone.tierName})
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: brand.coral }}>
                    เหลือเวลา {Math.floor(booking.remainingSeconds / 60)}:
                    {String(booking.remainingSeconds % 60).padStart(2, '0')}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ยอดที่ต้องชำระ:{' '}
                  {concert.tiers
                    .find((t) => t.name === booking.selectedZone!.tierName)
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

- [ ] **Step 2: Swap the route**

In `src/routes/index.tsx`, change the import:

```tsx
import { SeatSelectionPage } from '@/pages/concerts/SeatSelectionPage'
```

to:

```tsx
import { ZoneSelectionPage } from '@/pages/concerts/ZoneSelectionPage'
```

And change the route entry:

```tsx
      { path: 'shows/:concertId/seats', element: <SeatSelectionPage /> },
```

to:

```tsx
      { path: 'shows/:concertId/zones', element: <ZoneSelectionPage /> },
```

- [ ] **Step 3: Delete the superseded seat-level files**

```bash
git rm Frontend/src/pages/concerts/SeatSelectionPage.tsx Frontend/src/hooks/useSeatBooking.ts Frontend/src/utils/mockSeats.ts Frontend/src/interface/ISeatInterface.ts
```

- [ ] **Step 4: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors — this confirms nothing else in the app still referenced the deleted seat-level files.

- [ ] **Step 5: Verify the happy path in the browser**

With the dev server running, navigate to `http://localhost:5173/shows/neon-flux/zones` and confirm:
- Heading shows "Neon Flux Festival 2024" and "แตะที่โซนบนผังเพื่อจองที่นั่ง".
- An SVG arena map renders: a dark "STAGE" rectangle at the top, two rectangular zones (`A1`, `A2`) flanking it, a ring of 6 arc-shaped zones (`B1`–`B6`) curving below, and an outer ring of 8 arc-shaped zones (`C1`–`C8`) curving further below — all together forming a horseshoe open at the top toward the stage.
- `A2`, `B4`, and `C4` render in the grey "full" color; every other zone renders in its tier color (gold-ish for VIP, blue for Standard, green for Economy), matching the legend row below the map.
- Clicking an available zone (e.g. `A1`) fills it coral and shows a summary panel below with "โซน A1 (VIP)", a live countdown starting at "1:00", the price ("5,000 บาท"), and a "ยืนยันรายการ" button.
- Clicking "ยืนยันรายการ" replaces the map with a green success alert: "จองโซน A1 สำเร็จ — สถานะ: รอชำระเงิน".

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/pages/concerts/ZoneSelectionPage.tsx Frontend/src/routes/index.tsx
git commit -m "feat: replace seat grid with curved arena zone map"
```

---

### Task 3: Link the buy button and verify the abnormal paths

**Files:**
- Modify: `src/pages/concerts/ConcertDetailPage.tsx:85-89`

**Interfaces:**
- Consumes: route path `shows/:concertId/zones` produced by Task 2.

- [ ] **Step 1: Change the button destination**

In `src/pages/concerts/ConcertDetailPage.tsx`, change:

```tsx
              <BuyTicketButton
                to={`/shows/${concert.id}/seats`}
                disabled={concert.saleStatus === 'coming_soon'}
                label={concert.saleStatus === 'coming_soon' ? 'เร็ว ๆ นี้' : 'ซื้อบัตร'}
              />
```

to:

```tsx
              <BuyTicketButton
                to={`/shows/${concert.id}/zones`}
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
3. Click "ซื้อบัตร" on the detail page → lands on `/shows/neon-flux/zones` (Task 2's arena map).
4. Confirm a "COMING SOON" concert's detail page (e.g. Coming Soon 1) still shows a disabled "เร็ว ๆ นี้" button that does not navigate anywhere (unchanged regression check).
5. Confirm `http://localhost:5173/shows/neon-flux/seats` (the old route) now 404s / renders the app's not-found route, since that route no longer exists.

- [ ] **Step 4: Verify abnormal path 1 — zone already full**

On `/shows/neon-flux/zones`, click the pre-booked `A2` zone. Confirm:
- A warning alert appears: "โซนนี้เต็มแล้ว กรุณาเลือกโซนอื่น".
- No zone becomes selected/highlighted, no countdown starts, `A2` stays in the grey "full" color.

- [ ] **Step 5: Verify abnormal path 2 — lock expires**

On `/shows/neon-flux/zones`, click an available zone (e.g. `B1`) to lock it, then wait ~60 seconds without clicking "ยืนยันรายการ". Confirm:
- The countdown in the summary panel reaches "0:00".
- The summary panel disappears, a warning alert appears: "หมดเวลา โซนที่เลือกถูกปล่อยคืนอัตโนมัติ กรุณาเลือกโซนใหม่".
- The map re-renders with `B1` back in its normal Standard tier color (selectable again, not stuck coral or grey).

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/pages/concerts/ConcertDetailPage.tsx
git commit -m "feat: link buy ticket button to arena zone map"
```
