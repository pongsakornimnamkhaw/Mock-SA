# Zone Selection Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking "ซื้อบัตร" on the concert detail page navigates to a new zone-selection page where the user can pick a ticket tier (VIP/Standard/Economy) and see a "ถัดไป" (Next) button enable once a zone is picked. Prototyped and manually verified against the Neon Flux Festival concert only.

**Architecture:** Add a new route `shows/:concertId/zones` and a new `ZoneSelectionPage` component that reuses the existing `useConcert(concertId)` hook and the `Concert.tiers` field already in the mock data (no new data model needed). Zone selection is local `useState` — no booking/cart state, no navigation past this page. Update `ConcertDetailPage`'s `BuyTicketButton` to point at the new route instead of linking to itself.

**Tech Stack:** React 19, TypeScript, MUI, react-router-dom, Vite. No test runner is wired up in this repo (no `vitest.config`, no test setup file). Verification is `tsc -b` (must stay clean) plus manual browser checks via the Browser pane — same approach used for the other recent changes in this repo.

**Spec:** none (small feature clarified via AskUserQuestion in-conversation — no separate spec doc)

## Global Constraints

- Color palette is locked to 5 brand tokens defined in `src/theme.ts:3-16` (`brand.navy`, `brand.purple`, `brand.magenta`, `brand.coral`, `brand.white`) plus their alpha derivatives (`brand.panelTint`, `brand.border`, `brand.navyFaded`, `brand.textMuted`). The comment at `src/theme.ts:4` explicitly forbids adding new colors — every new style in this plan must use only these tokens.
- This prototype targets the Neon Flux Festival card only (`id: 'neon-flux'`) for manual verification, but the route and component must be written generically against `concertId` / `Concert.tiers` (not hardcoded to that one concert) so it keeps working once other concerts get real tier data.
- The "ถัดไป" button only needs to enable/disable based on whether a zone is selected — it must NOT navigate anywhere or call any booking/payment logic (none exists yet).

---

### Task 1: Create the Zone Selection page and wire its route

**Files:**
- Create: `src/pages/concerts/ZoneSelectionPage.tsx`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `useConcert(concertId: string | undefined): AsyncState<Concert>` from `src/hooks/useConcerts.ts:49` (already exists, returns `{ data, loading, error }`); `Concert.tiers: TicketTier[]` and `TicketTier { name: string; price: number }` from `src/interface/IConcertInterface.ts:3-9` (already exist); `brand` tokens from `src/theme.ts:3`.
- Produces: exported component `ZoneSelectionPage` (no props — reads `concertId` from the URL via `useParams`), mounted at route path `shows/:concertId/zones`, consumed by Task 2's link in `ConcertDetailPage`.

- [ ] **Step 1: Create the page component**

Create `src/pages/concerts/ZoneSelectionPage.tsx`:

```tsx
import { Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { brand } from '@/theme'
import { useConcert } from '@/hooks/useConcerts'
import type { TicketTier } from '@/interface/IConcertInterface'

function ZoneOption({
  tier,
  selected,
  onSelect,
}: {
  tier: TicketTier
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Paper
      onClick={onSelect}
      elevation={0}
      data-testid="zone-option"
      sx={{
        p: 2,
        borderRadius: 2,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: `2px solid ${selected ? brand.coral : brand.border}`,
        bgcolor: selected ? brand.panelTint : 'transparent',
      }}
    >
      <Typography sx={{ fontWeight: 600 }}>{tier.name}</Typography>
      <Typography sx={{ fontWeight: 700, color: brand.coral }}>
        {tier.price.toLocaleString('en-US')} บาท
      </Typography>
    </Paper>
  )
}

export function ZoneSelectionPage() {
  const { concertId } = useParams()
  const { data: concert, loading } = useConcert(concertId)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)

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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          เลือกโซนที่นั่ง
        </Typography>

        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {concert.tiers.map((tier) => (
            <ZoneOption
              key={tier.name}
              tier={tier}
              selected={selectedZone === tier.name}
              onSelect={() => setSelectedZone(tier.name)}
            />
          ))}
        </Stack>

        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          disabled={!selectedZone}
          sx={{ py: 1.5, fontSize: '1rem' }}
        >
          ถัดไป
        </Button>
      </Container>
    </Box>
  )
}
```

- [ ] **Step 2: Wire the route**

In `src/routes/index.tsx`, add the import next to the other concert pages:

```tsx
import { ZoneSelectionPage } from '@/pages/concerts/ZoneSelectionPage'
```

Then add the new route entry right after the existing `shows/:concertId` route (inside the `/` route's `children` array):

```tsx
      { path: 'home', element: <HomePage /> },
      { path: 'shows', element: <AllShowsPage /> },
      { path: 'shows/:concertId', element: <ConcertDetailPage /> },
      { path: 'shows/:concertId/zones', element: <ZoneSelectionPage /> },
```

- [ ] **Step 3: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Verify in the browser**

With the dev server running, navigate to `http://localhost:5173/shows/neon-flux/zones` and confirm:
- Page shows "Neon Flux Festival 2024" as the heading and "เลือกโซนที่นั่ง" subheading.
- Three zone rows appear: VIP (5,000 บาท), Standard (3,500 บาท), Economy (2,000 บาท) — matching `tiers` in `src/utils/mockConcerts.ts` for `neon-flux`.
- The "ถัดไป" button is disabled (greyed out) initially.
- Clicking a zone row highlights it (coral border + tinted background) and enables the "ถัดไป" button.
- Clicking a different zone moves the highlight and keeps "ถัดไป" enabled.
- The "← กลับไปหน้ารายละเอียด" link navigates back to `/shows/neon-flux`.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/concerts/ZoneSelectionPage.tsx Frontend/src/routes/index.tsx
git commit -m "feat: add zone selection page"
```

---

### Task 2: Link the detail page's buy button to the zone selection page

**Files:**
- Modify: `src/pages/concerts/ConcertDetailPage.tsx:85-89`

**Interfaces:**
- Consumes: route path `shows/:concertId/zones` produced by Task 1.

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
                to={`/shows/${concert.id}/zones`}
                disabled={concert.saleStatus === 'coming_soon'}
                label={concert.saleStatus === 'coming_soon' ? 'เร็ว ๆ นี้' : 'ซื้อบัตร'}
              />
```

- [ ] **Step 2: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Verify the full click-through flow in the browser**

With the dev server running:
1. Go to `http://localhost:5173/home`.
2. Click the "Neon Flux Festival 2024" card's "ซื้อบัตร" button → lands on `/shows/neon-flux` (detail page).
3. Click "ซื้อบัตร" on the detail page → lands on `/shows/neon-flux/zones` (the new zone page from Task 1).
4. Confirm a "COMING SOON" card (e.g. Celestial Sounds) still shows its disabled "เร็ว ๆ นี้" button on its detail page and does not navigate anywhere when clicked (unchanged behavior — regression check).

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/concerts/ConcertDetailPage.tsx
git commit -m "feat: link buy ticket button to zone selection page"
```
