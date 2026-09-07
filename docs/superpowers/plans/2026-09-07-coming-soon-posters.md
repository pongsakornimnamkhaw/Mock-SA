# Coming Soon Poster Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new concert cards to the mock concert list using the existing `come1.jpg`, `come2.jpg`, `come5.jpg` poster images, each showing a "Coming Soon" overlay badge on the poster, visible on both the Home page and All Shows page.

**Architecture:** Export the 3 unused poster images from `src/assets/posters/index.ts`, add 3 new `Concert` mock entries in `src/utils/mockConcerts.ts` with `saleStatus: 'coming_soon'`, and render a "Coming Soon" ribbon overlay in `PosterImage` when the card passes a `comingSoon` flag from `ConcertCard`. Both `HomePage` and `AllShowsPage` read from the same `mockConcerts` array via `useConcerts()`, so adding entries there makes them appear on both pages automatically — no page-level changes needed.

**Tech Stack:** React 19, TypeScript, MUI, Vite. No test runner is currently wired up in this repo (no `vitest.config`, no test setup file — the prior test suite was deleted as part of an in-progress restructure per `git status`). Verification for this plan is done by building with `tsc` and visually checking the running dev server in the browser, not automated tests.

**Spec:** none (small direct request, clarified via AskUserQuestion in-conversation — no separate spec doc)

## Global Constraints

- Badge text must read exactly "Coming Soon" (Latin text, not the existing Thai `saleStatusLabel` string) rendered as an overlay on top of the poster image.
- Only use images that already exist in `src/assets/posters/`: `come1.jpg`, `come2.jpg`, `come5.jpg`. Do not add or rename image files.
- New concerts must appear on both the Home page and the All Shows page (both consume the shared `mockConcerts` array).

---

### Task 1: Export the coming-soon poster images

**Files:**
- Modify: `src/assets/posters/index.ts`

**Interfaces:**
- Produces: named exports `come1`, `come2`, `come5` (string URLs), consumed by Task 2.

- [ ] **Step 1: Add the three exports**

Edit `src/assets/posters/index.ts` to add these lines (keep existing exports untouched):

```ts
export { default as come1 } from './come1.jpg';
export { default as come2 } from './come2.jpg';
export { default as come5 } from './come5.jpg';
```

Full resulting file:

```ts
export { default as celestial } from './celestial.png';
export { default as flux } from './flux.png';
export { default as pulse } from './pulse.png';
export { default as starlight } from './starlight.png';
export { default as come1 } from './come1.jpg';
export { default as come2 } from './come2.jpg';
export { default as come5 } from './come5.jpg';
```

- [ ] **Step 2: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/assets/posters/index.ts
git commit -m "feat: export coming-soon poster images"
```

---

### Task 2: Add 3 "coming soon" mock concerts

**Files:**
- Modify: `src/utils/mockConcerts.ts`

**Interfaces:**
- Consumes: `come1`, `come2`, `come5` from `@/assets/posters` (Task 1); `Concert` type and `SaleStatus` from `@/interface/IConcertInterface`.
- Produces: 3 new entries in the exported `mockConcerts: Concert[]` array, each with `saleStatus: 'coming_soon'`, consumed by Task 3's `ConcertCard` rendering and by `useConcerts()` / `useFeaturedConcerts()`.

- [ ] **Step 1: Update the import line**

In `src/utils/mockConcerts.ts`, change:

```ts
import { celestial, flux, pulse, starlight } from '@/assets/posters'
```

to:

```ts
import { celestial, flux, pulse, starlight, come1, come2, come5 } from '@/assets/posters'
```

- [ ] **Step 2: Append 3 new concert entries**

Add these 3 objects to the end of the `mockConcerts` array (right after the `starlight-festival` entry, before the closing `]`):

```ts
  {
    id: 'coming-soon-1',
    title: 'Coming Soon 1',
    posterUrl: come1,
    bannerUrl: '/banners/neonFlux.jpg',
    featured: false,
    showStartDate: '2024-06-01',
    showEndDate: '2024-06-01',
    showTimeLabel: 'รอประกาศ',
    saleStartDate: '2024-05-01',
    saleEndDate: '2024-05-31',
    venue: 'รอประกาศ',
    venueFloor: 'รอประกาศ',
    province: 'รอประกาศ',
    tiers: [],
    saleStatus: 'coming_soon',
    description: 'งานคอนเสิร์ตเร็ว ๆ นี้ รายละเอียดจะประกาศให้ทราบอีกครั้ง',
  },
  {
    id: 'coming-soon-2',
    title: 'Coming Soon 2',
    posterUrl: come2,
    bannerUrl: '/banners/neonPulse.png',
    featured: false,
    showStartDate: '2024-06-01',
    showEndDate: '2024-06-01',
    showTimeLabel: 'รอประกาศ',
    saleStartDate: '2024-05-01',
    saleEndDate: '2024-05-31',
    venue: 'รอประกาศ',
    venueFloor: 'รอประกาศ',
    province: 'รอประกาศ',
    tiers: [],
    saleStatus: 'coming_soon',
    description: 'งานคอนเสิร์ตเร็ว ๆ นี้ รายละเอียดจะประกาศให้ทราบอีกครั้ง',
  },
  {
    id: 'coming-soon-3',
    title: 'Coming Soon 3',
    posterUrl: come5,
    bannerUrl: '/banners/celestialSounds.jpg',
    featured: false,
    showStartDate: '2024-06-01',
    showEndDate: '2024-06-01',
    showTimeLabel: 'รอประกาศ',
    saleStartDate: '2024-05-01',
    saleEndDate: '2024-05-31',
    venue: 'รอประกาศ',
    venueFloor: 'รอประกาศ',
    province: 'รอประกาศ',
    tiers: [],
    saleStatus: 'coming_soon',
    description: 'งานคอนเสิร์ตเร็ว ๆ นี้ รายละเอียดจะประกาศให้ทราบอีกครั้ง',
  },
```

- [ ] **Step 3: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors (this also confirms the `Concert` shape is satisfied for all 3 new entries).

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/utils/mockConcerts.ts
git commit -m "feat: add 3 coming-soon mock concerts"
```

---

### Task 3: Render "Coming Soon" overlay on the poster

**Files:**
- Modify: `src/components/PosterImage.tsx`
- Modify: `src/components/ConcertCard.tsx`

**Interfaces:**
- Consumes: `concert.saleStatus` (`SaleStatus`) from the `Concert` passed into `ConcertCard` (Task 2 produces entries with `saleStatus: 'coming_soon'`).
- Produces: `PosterImage` accepts a new optional prop `comingSoon?: boolean`. No other component depends on this beyond `ConcertCard`.

- [ ] **Step 1: Add the `comingSoon` prop and overlay to `PosterImage`**

Replace the full contents of `src/components/PosterImage.tsx` with:

```tsx
import { Box } from '@mui/material'
import { useState } from 'react'

export function PosterImage({
  src,
  alt,
  height,
  comingSoon = false,
}: {
  src: string
  alt: string
  height: number | string | Record<string, number | string>
  comingSoon?: boolean
}) {
  const [failed, setFailed] = useState(false)

  const overlay = comingSoon ? (
    <Box
      data-testid="poster-coming-soon-badge"
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 2,
        color: '#fff',
        fontWeight: 700,
        fontSize: '1rem',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      Coming Soon
    </Box>
  ) : null

  if (failed) {
    return (
      <Box sx={{ position: 'relative', width: '100%', height }}>
        <Box
          data-testid="poster-fallback"
          role="img"
          aria-label={alt}
          sx={{
            height: '100%',
            width: '100%',
            borderRadius: 2,
            background: 'linear-gradient(160deg, #ff9900, #ff0000)',
          }}
        />
        {overlay}
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height }}>
      <Box
        component="img"
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        sx={{ height: '100%', width: '100%', objectFit: 'cover', borderRadius: 2, display: 'block' }}
      />
      {overlay}
    </Box>
  )
}
```

- [ ] **Step 2: Pass `comingSoon` from `ConcertCard`**

In `src/components/ConcertCard.tsx`, change:

```tsx
      <PosterImage
        src={concert.posterUrl}
        alt={`โปสเตอร์ ${concert.title}`}
        height={200}
      />
```

to:

```tsx
      <PosterImage
        src={concert.posterUrl}
        alt={`โปสเตอร์ ${concert.title}`}
        height={200}
        comingSoon={concert.saleStatus === 'coming_soon'}
      />
```

- [ ] **Step 3: Verify it compiles**

Run: `cd Frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Visually verify in the browser**

Run: `cd Frontend && npm run dev`
Open the printed local URL, and check:
- Home page grid shows 7 cards total, including "Coming Soon 1", "Coming Soon 2", "Coming Soon 3" using the `come1`/`come2`/`come5` artwork, each with a dark "Coming Soon" overlay centered on the poster.
- The existing "Celestial Sounds" card (also `coming_soon` status) now shows the same overlay — confirm this is expected (it is, since the overlay is driven by `saleStatus`, not the specific new entries).
- Navigate to the All Shows page and confirm the same 3 new cards appear there too.

Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/PosterImage.tsx Frontend/src/components/ConcertCard.tsx
git commit -m "feat: show Coming Soon overlay badge on upcoming concert posters"
```
