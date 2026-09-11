# Expand Customer Seat Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the selected zone's real seats across the customer seat-selection canvas in a readable responsive grid, matching the supplied reference while preserving booking behavior.

**Architecture:** Keep the existing real inventory, hold, pricing, and booking data flow unchanged. Add a seat-mode-only grid renderer inside `CustomerLayoutCanvas`; zone mode continues to render saved `Zone` and `LayoutObject` coordinates exactly as it does now.

**Tech Stack:** React 19, TypeScript, Material UI, Vitest, Testing Library

**Spec:** `C:/Users/Chor/AppData/Local/Temp/codex-clipboard-e113ad98-807f-4da2-a672-0132fa5a9a6e.png`

## Global Constraints

- Change visible behavior only on `/event/:id/seats/:zone`.
- Do not change `/event/:id/zones`.
- Do not change Backend APIs, database models, migrations, seeders, pricing, promotions, seat holds, or booking/payment behavior.
- Render only seats returned by the real inventory API; do not generate fallback or mock seats.
- Preserve `available`, `selected`, `locked`, `held`, `reserved`, and `disabled` interactions and colors.
- Use the selected zone's `ZonePrice`; do not calculate price from seat position or label.
- Ignore stored `PositionX` and `PositionY` only for this expanded customer seat view; do not modify or overwrite their database values.

---

### Task 1: Add a seat-mode-only expanded grid

**Files:**
- Modify: `frontend/src/components/SeatSelection/CustomerLayoutCanvas.tsx`
- Test: `frontend/src/components/SeatSelection/CustomerLayoutCanvas.test.tsx`

**Interfaces:**
- Consumes: `SeatData[]`, `selectedZoneId`, `interactionLocked`, and `(seatId: string) => void` already supplied by `SeatSelectionPage`.
- Produces: `ExpandedSeatGrid`, a private component rendered only when `mode === 'seats'`; existing `mode === 'zones'` output remains unchanged.

- [ ] **Step 1: Write the failing grid-layout test**

Add `within` to the existing `@testing-library/react` import, then add a test that uses several seats with deliberately identical coordinates. This catches the current bug because absolute positioning stacks them, whereas the desired renderer places them in one grid container.

```tsx
it('ขยายที่นั่งของโซนที่เลือกเป็น grid โดยไม่ใช้พิกัดซ้อนกัน', () => {
    render(
        <CustomerLayoutCanvas
            layout={{ zones: [zone], layoutObjects: [] }}
            mode="seats"
            selectedZoneId="ZA"
            seats={[
                { seatId: 1, id: 'A1', row: '1', number: 1, status: 'available', x: 50, y: 50 },
                { seatId: 2, id: 'A2', row: '1', number: 2, status: 'available', x: 50, y: 50 },
                { seatId: 3, id: 'A3', row: '1', number: 3, status: 'available', x: 50, y: 50 },
            ]}
        />,
    );

    const grid = screen.getByTestId('expanded-seat-grid');
    expect(grid).toHaveStyle({ display: 'grid' });
    expect(within(grid).getAllByRole('button')).toHaveLength(3);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd D:\Desktop\v222\frontend
npm test -- --run src/components/SeatSelection/CustomerLayoutCanvas.test.tsx
```

Expected: FAIL because `expanded-seat-grid` does not exist and the current seat buttons are absolutely positioned inside the saved zone rectangle.

- [ ] **Step 3: Implement the private expanded grid renderer**

In `CustomerLayoutCanvas.tsx`, extract the existing button visuals into this reusable `SeatButton` so status colors, disabled rules, click propagation, and accessible labels stay identical:

```tsx
const SeatButton = ({ seat, zoneColor, interactionLocked, onSeatClick }: {
    seat: SeatData;
    zoneColor: string;
    interactionLocked?: boolean;
    onSeatClick?: Props['onSeatClick'];
}) => {
    const disabled = isSeatDisabled(seat.status, interactionLocked);
    return (
        <Box
            component="button"
            type="button"
            disabled={disabled}
            aria-label={`ที่นั่ง ${seat.id}`}
            onClick={() => onSeatClick?.(seat.id)}
            sx={{
                width: '100%', maxWidth: 56, minWidth: 42, height: 38, justifySelf: 'center',
                borderRadius: '6px', p: 0,
                border: seat.status === 'selected' ? '2px solid #fff' : '1px solid rgba(255,255,255,.65)',
                bgcolor: seatColor(seat.status, zoneColor), color: '#fff', fontSize: 11, fontWeight: 800,
                opacity: seat.status === 'held' || seat.status === 'reserved' || seat.status === 'disabled' ? .48 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
        >
            {seat.id}
        </Box>
    );
};
```

Then add this private grid component:

```tsx
const ExpandedSeatGrid = ({ zone, seats, interactionLocked, onSeatClick }: {
    zone: PlanningZone;
    seats: SeatData[];
    interactionLocked?: boolean;
    onSeatClick?: Props['onSeatClick'];
}) => (
    <Box
        data-testid="expanded-seat-grid"
        sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: {
                xs: 'repeat(5, minmax(42px, 1fr))',
                sm: 'repeat(8, minmax(42px, 1fr))',
                md: 'repeat(13, minmax(44px, 1fr))',
            },
            gridAutoRows: '38px',
            gap: { xs: 1.5, md: 2.25 },
            alignContent: 'center',
            justifyContent: 'center',
            p: { xs: 2, md: 4 },
            overflow: 'auto',
        }}
    >
        {seats.map((seat) => (
            <SeatButton
                key={seat.seatId}
                seat={seat}
                zoneColor={zone.color || '#e62573'}
                interactionLocked={interactionLocked}
                onSeatClick={onSeatClick}
            />
        ))}
    </Box>
);
```

Render this branch before building the coordinate-based `items` array:

```tsx
if (mode === 'seats') {
    const selectedZone = layout.zones.find((zone) => zone.id === selectedZoneId);
    return (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Box sx={{
                position: 'relative', width: '100%', minWidth: 700, aspectRatio: '16 / 9',
                border: '1px solid rgba(255,255,255,.14)', borderRadius: 3,
                bgcolor: 'rgba(5,12,56,.58)', overflow: 'hidden',
            }}>
                {selectedZone && seats.length > 0
                    ? <ExpandedSeatGrid zone={selectedZone} seats={seats} interactionLocked={interactionLocked} onSeatClick={onSeatClick} />
                    : <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#aaa' }}>ยังไม่มีที่นั่งในโซนนี้</Box>}
            </Box>
        </Box>
    );
}
```

Keep `mode === 'zones'` on the existing coordinate-based path. `ExpandedSeatGrid` must display the seats in the order supplied by the API (`seat_row`, then `seat_column`) and must not synthesize rows, labels, or seats.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- --run src/components/SeatSelection/CustomerLayoutCanvas.test.tsx
```

Expected: all tests in the file PASS, including the existing tests that verify the zones page and held-seat disabling.

- [ ] **Step 5: Commit the isolated renderer change**

Stage only these files; do not use `git add .` because the worktree contains other unfinished changes.

```powershell
git add frontend/src/components/SeatSelection/CustomerLayoutCanvas.tsx frontend/src/components/SeatSelection/CustomerLayoutCanvas.test.tsx
git commit -m "fix: expand customer seat grid"
```

### Task 2: Preserve interactions and verify the one-page scope

**Files:**
- Modify: `frontend/src/components/SeatSelection/CustomerLayoutCanvas.test.tsx`
- Verify unchanged: `frontend/src/pages/Customer/ZoneSelection/index.tsx`
- Verify unchanged: `frontend/src/pages/Customer/SeatSelection/index.tsx`

**Interfaces:**
- Consumes: the `ExpandedSeatGrid` behavior from Task 1.
- Produces: regression coverage proving that selection works, unavailable seats stay disabled, and zones mode still uses the saved layout.

- [ ] **Step 1: Add regression tests for preserved interactions**

After Task 1, add tests that independently lock down click behavior, disabled behavior, and zones-mode behavior. These behaviors already existed before the visual change, so the tests are expected to PASS and protect them from later regressions. Extend the imports with `userEvent` from `@testing-library/user-event`:

```tsx
it('ส่งรหัสที่นั่งเมื่อคลิกที่นั่งว่างใน expanded grid', async () => {
    const user = userEvent.setup();
    const onSeatClick = vi.fn();
    render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} mode="seats" selectedZoneId="ZA"
        seats={[{ seatId: 1, id: 'A1', row: '1', number: 1, status: 'available', x: 50, y: 50 }]}
        onSeatClick={onSeatClick} />);
    await user.click(screen.getByRole('button', { name: 'ที่นั่ง A1' }));
    expect(onSeatClick).toHaveBeenCalledOnce();
    expect(onSeatClick).toHaveBeenCalledWith('A1');
});

it.each(['held', 'reserved', 'disabled', 'locked'] as const)('ปิดการคลิกสถานะ %s', (status) => {
    render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} mode="seats" selectedZoneId="ZA"
        seats={[{ seatId: 1, id: 'A1', row: '1', number: 1, status, x: 50, y: 50 }]} />);
    expect(screen.getByRole('button', { name: 'ที่นั่ง A1' })).toBeDisabled();
});

it('ไม่ใช้ expanded grid ในหน้าเลือกโซน', () => {
    render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} mode="zones"
        inventories={[{ zoneId: 'ZA', zoneType: 'VIP', categoryName: 'VIP', color: '#f00', price: 2500, capacity: 1, available: 1 }]} />);
    expect(screen.queryByTestId('expanded-seat-grid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /VIP/ })).toBeEnabled();
});
```

- [ ] **Step 2: Run the focused tests**

Run:

```powershell
npm test -- --run src/components/SeatSelection/CustomerLayoutCanvas.test.tsx
```

Expected: PASS with no interaction regressions.

- [ ] **Step 3: Run all Frontend tests and production build**

Run:

```powershell
npm test -- --run
npm run build
```

Expected: all tests PASS and Vite exits with code `0`. A bundle-size warning is allowed; TypeScript or build errors are not.

- [ ] **Step 4: Manually verify the requested page**

Open `/event/CC0002/seats/A1` and verify:

1. The selected zone's 40 seats spread across the canvas instead of stacking in the center.
2. A 100-seat zone uses 13 columns on desktop and wraps into rows like the reference image.
3. Browser narrowing changes the column count to 8 and then 5 without overlapping buttons.
4. Clicking an available seat changes it to selected blue and updates the order summary.
5. Held, reserved, disabled, and locked seats remain unclickable.
6. Reloading `/event/CC0002/zones` shows the original saved zone/object layout unchanged.

- [ ] **Step 5: Verify the diff is limited to the requested page behavior**

Run:

```powershell
git diff --name-only HEAD~1
git diff -- frontend/src/pages/Customer/ZoneSelection/index.tsx backend
```

Expected: the commit contains only the shared canvas implementation and its test; the second command has no output attributable to this task.

- [ ] **Step 6: Commit the added interaction coverage**

```powershell
git add frontend/src/components/SeatSelection/CustomerLayoutCanvas.test.tsx
git commit -m "test: protect expanded seat interactions"
```
