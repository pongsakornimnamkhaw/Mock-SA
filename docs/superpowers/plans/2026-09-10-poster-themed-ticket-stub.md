# Poster-Themed Ticket Stub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ตั๋วในหน้า "บัตรของฉัน" มีรูปทรงแบบตั๋วจริง (มีรอยปรุ + ส่วน ADMIT ONE ที่มี QR Code) และใช้สีโทนเดียวกับโปสเตอร์ของคอนเสิร์ตงานนั้น

**Architecture:** เพิ่ม module `posterPalette.ts` ที่เก็บทั้งฟังก์ชันหา index ของโปสเตอร์ (ย้ายมาจาก `posterForConcert`) และชุดสี 4 ชุดที่เรียง index ตรงกับ `fallbackPosters` — การ์ดคอนเสิร์ตกับตั๋วจึงเลือกด้วยตัวเดียวกัน สีกับรูปไม่มีทางหลุดคู่ จากนั้นแยกการ์ดตั๋วออกเป็นคอมโพเนนต์ presentational `TicketStub` ที่รับ props ที่ format มาแล้ว แล้วให้หน้า Account เรียกใช้แทน JSX เดิม

**Tech Stack:** React 19 + TypeScript + MUI v9 (`sx` prop) + Vite 8 · Vitest 4 + @testing-library/react + @testing-library/user-event + jest-dom

**Spec:** `docs/superpowers/specs/2026-09-10-poster-themed-ticket-stub.md`

## Global Constraints

- ข้อความที่ผู้ใช้เห็นเป็นภาษาไทย ให้เข้ากับข้อความเดิมในไฟล์เดียวกัน (ยกเว้นคำบนตั๋วที่จงใจใช้อังกฤษ: `OCTAVIA E-TICKET`, `ADMIT ONE`)
- Import ฝั่ง frontend ใช้ alias `@/` (ตั้งไว้ที่ `frontend/vite.config.ts`)
- คำสั่งทั้งหมดรันจาก `D:\SA\Mock-test\Mock-SA\frontend` (`cd frontend`)
- เทสต์ต้องอยู่ใน `src/**/*.test.{ts,tsx}` (ตาม `vite.config.ts` → `test.include`)
- ห้ามเปลี่ยน shape ของ `BookingRecord` / `Ticket` ใน `frontend/src/types/booking.ts` — `bookingStore`, `bookingPaymentApi` และหน้า Management ใช้ร่วมกัน
- ห้ามแตะ `frontend/src/services/https/*` และ `frontend/src/hooks/useConcerts.ts` (dead code ที่ import `axios` ซึ่งไม่ได้ติดตั้ง เป็นต้นเหตุ error เดิมของ `tsc -b`)
- ห้ามเปลี่ยนอัลกอริทึม checksum ที่ใช้เลือกโปสเตอร์ (ย้ายที่อยู่ได้ แต่ผลลัพธ์ต้องเท่าเดิม) — เทสต์เดิมใน `customerConcertCard.test.ts` เป็นตัวคุม
- MUI v9: ใช้ `slotProps` ไม่ใช่ `componentsProps`, `Grid` ใช้ prop `size`
- ห้ามใส่บรรทัด attribution ใน commit message

## File Structure

**สร้างใหม่**
- `frontend/src/utils/posterPalette.ts` — `TicketTheme`, `POSTER_THEMES`, `posterIndexForConcertId()`, `ticketThemeForConcertId()` (แหล่งความจริงเดียวว่าคอนเสิร์ต id ไหนได้โปสเตอร์/สีชุดไหน)
- `frontend/src/utils/posterPalette.test.ts`
- `frontend/src/components/tickets/TicketStub.tsx` — การ์ดตั๋ว presentational ล้วน
- `frontend/src/components/tickets/TicketStub.test.tsx`

**แก้ไข**
- `frontend/src/utils/customerConcertCard.ts:11-18` — ให้ `posterForConcert` เรียก `posterIndexForConcertId` แทน loop ในตัวเอง
- `frontend/src/utils/customerConcertCard.test.ts` — เพิ่มเทสต์ invariant ว่าสีตั๋วยังคู่กับโปสเตอร์ของการ์ด
- `frontend/src/pages/Customer/Account/index.tsx` — บรรทัด 69 (state ของ dialog), 284-329 (grid + การ์ดตั๋ว), 490-536 (dialog ขยาย QR)

**ไม่แตะ:** `frontend/src/types/booking.ts`, `frontend/src/utils/bookingStore.ts`, `frontend/src/api/bookingPaymentApi.ts`

---

### Task 1: ชุดสีตั๋วที่ผูกกับโปสเตอร์

**Files:**
- Create: `frontend/src/utils/posterPalette.ts`
- Test: `frontend/src/utils/posterPalette.test.ts`
- Modify: `frontend/src/utils/customerConcertCard.ts:11-18`
- Modify: `frontend/src/utils/customerConcertCard.test.ts` (เพิ่ม describe block ท้ายไฟล์)

**Interfaces:**
- Consumes: `posterForConcert`, `CustomerPromotionConcert` (ของเดิม)
- Produces:
  - `interface TicketTheme { id: string; base: string; stub: string; accent: string }`
  - `const POSTER_THEMES: TicketTheme[]` (4 ชุด เรียงตรงกับ `fallbackPosters`)
  - `function posterIndexForConcertId(concertId: string): number`
  - `function ticketThemeForConcertId(concertId: string): TicketTheme`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/utils/posterPalette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { POSTER_THEMES, posterIndexForConcertId, ticketThemeForConcertId } from '@/utils/posterPalette';

describe('ticketThemeForConcertId', () => {
    it('always gives the same concert the same colours', () => {
        expect(ticketThemeForConcertId('CC0001')).toBe(ticketThemeForConcertId('CC0001'));
    });

    it('spreads different concerts across more than one colour set', () => {
        const accents = new Set(
            ['CC0001', 'CC0002', 'CC0003', 'CC0004', 'CC0005', 'CC0006'].map(
                (concertId) => ticketThemeForConcertId(concertId).accent,
            ),
        );
        expect(accents.size).toBeGreaterThan(1);
    });

    it('still returns a usable theme when the concert id is empty', () => {
        const theme = ticketThemeForConcertId('');
        expect(theme.base).toBeTruthy();
        expect(theme.accent).toBeTruthy();
    });

    it('gives every theme a dark base so the neon accent stays readable', () => {
        for (const theme of POSTER_THEMES) {
            // พื้นตั๋วต้องเข้มจริง ไม่งั้นตัวอักษรสีอ่อนบนตั๋วจะอ่านไม่ออก
            const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(theme.base.slice(offset, offset + 2), 16));
            expect(Math.max(red, green, blue)).toBeLessThan(80);
        }
    });

    it('uses a hex colour for every field so it can be composed with alpha suffixes', () => {
        for (const theme of POSTER_THEMES) {
            expect(theme.base).toMatch(/^#[0-9A-F]{6}$/i);
            expect(theme.stub).toMatch(/^#[0-9A-F]{6}$/i);
            expect(theme.accent).toMatch(/^#[0-9A-F]{6}$/i);
        }
    });
});

describe('posterIndexForConcertId', () => {
    it('stays inside the theme list', () => {
        for (const concertId of ['', 'CC0001', 'ยาวมากกกกกก', 'X']) {
            const index = posterIndexForConcertId(concertId);
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(POSTER_THEMES.length);
        }
    });

    it('keeps the checksum behaviour the concert cards already rely on', () => {
        // ผลรวม code point ของ "CC0001" = 67+67+48+48+48+49 = 327 → 327 % 4 = 3
        expect(posterIndexForConcertId('CC0001')).toBe(3);
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/utils/posterPalette.test.ts
```

Expected: FAIL — `Failed to resolve import "@/utils/posterPalette"`

- [ ] **Step 3: เขียน implementation**

สร้าง `frontend/src/utils/posterPalette.ts`:

```ts
// สีของตั๋วต้องเข้าชุดกับโปสเตอร์ที่การ์ดคอนเสิร์ตใบนั้นใช้ ทั้งสองที่จึงเลือกด้วย
// posterIndexForConcertId ตัวเดียวกัน — ถ้าแยกกันคำนวณ สีตั๋วกับรูปโปสเตอร์จะหลุดคู่กัน
// ทันทีที่มีคนแก้ข้างใดข้างหนึ่ง
export interface TicketTheme {
  id: string;
  base: string;
  stub: string;
  accent: string;
}

// เรียงตรงกับ fallbackPosters ใน customerConcertCard.ts: flux, pulse, celestial, starlight
// ค่าสีดูดโทนมาจากไฟล์โปสเตอร์จริงใน @/assets/poster
export const POSTER_THEMES: TicketTheme[] = [
  { id: 'flux', base: '#150F2E', stub: '#1F1547', accent: '#C084FC' },
  { id: 'pulse', base: '#1A0B18', stub: '#2B1020', accent: '#FF6B5A' },
  { id: 'celestial', base: '#0F1030', stub: '#191C4A', accent: '#818CF8' },
  { id: 'starlight', base: '#1B0D2B', stub: '#28133D', accent: '#FF4FA3' },
];

export function posterIndexForConcertId(concertId: string) {
  let checksum = 0;
  for (const character of concertId) {
    checksum += character.codePointAt(0) ?? 0;
  }
  return checksum % POSTER_THEMES.length;
}

export function ticketThemeForConcertId(concertId: string): TicketTheme {
  return POSTER_THEMES[posterIndexForConcertId(concertId)];
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/utils/posterPalette.test.ts
```

Expected: PASS ทั้ง 7 เคส

- [ ] **Step 5: ให้การ์ดคอนเสิร์ตใช้ฟังก์ชันเดียวกัน**

ใน `frontend/src/utils/customerConcertCard.ts` เพิ่ม import ต่อจาก import เดิม:

```ts
import { posterIndexForConcertId } from '@/utils/posterPalette';
```

แล้วแทน `posterForConcert` ทั้งฟังก์ชัน (บรรทัด 11-18) ด้วย:

```ts
export function posterForConcert(concert: CustomerPromotionConcert) {
  if (concert.poster_data) return concert.poster_data;
  return fallbackPosters[posterIndexForConcertId(concert.concert_id)];
}
```

หมายเหตุ: `POSTER_THEMES.length` เท่ากับ `fallbackPosters.length` (4) ผลลัพธ์จึงเท่าเดิมทุกกรณี

- [ ] **Step 6: เขียนเทสต์ invariant ว่าสีกับโปสเตอร์ยังคู่กัน**

เพิ่มท้ายไฟล์ `frontend/src/utils/customerConcertCard.test.ts` (ไฟล์นี้มี `makeConcert` helper อยู่แล้วที่หัวไฟล์):

```ts
describe('poster and ticket colour pairing', () => {
    it('gives concerts that share a ticket colour the same poster image', () => {
        const postersByTheme = new Map<string, string>();

        for (const concertId of ['CC0001', 'CC0002', 'CC0003', 'CC0004', 'CC0005', 'CC0006', 'CC0007', 'CC0008']) {
            const poster = posterForConcert(makeConcert({ concert_id: concertId }));
            const themeId = ticketThemeForConcertId(concertId).id;
            const alreadySeen = postersByTheme.get(themeId);
            if (alreadySeen === undefined) {
                postersByTheme.set(themeId, poster);
            } else {
                expect(poster).toBe(alreadySeen);
            }
        }

        expect(postersByTheme.size).toBeGreaterThan(1);
    });
});
```

และเพิ่ม import ที่หัวไฟล์เดียวกัน:

```ts
import { ticketThemeForConcertId } from '@/utils/posterPalette';
```

- [ ] **Step 7: รันเทสต์ของทั้งสองไฟล์**

```bash
cd frontend && npm test -- --run src/utils/posterPalette.test.ts src/utils/customerConcertCard.test.ts
```

Expected: PASS ทุกเคส (เทสต์เดิมของ `posterForConcert` ต้องไม่พัง — เป็นตัวยืนยันว่าย้าย logic แล้วผลเท่าเดิม)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/utils/posterPalette.ts frontend/src/utils/posterPalette.test.ts frontend/src/utils/customerConcertCard.ts frontend/src/utils/customerConcertCard.test.ts
git commit -m "feat(frontend): add poster-derived ticket colour themes"
```

---

### Task 2: คอมโพเนนต์ตั๋ว TicketStub

จบงานนี้แล้วยังไม่มีอะไรเปลี่ยนบนหน้าจอ — คอมโพเนนต์ยังไม่ถูกเรียกใช้

**Files:**
- Create: `frontend/src/components/tickets/TicketStub.tsx`
- Test: `frontend/src/components/tickets/TicketStub.test.tsx`

**Interfaces:**
- Consumes: `ticketThemeForConcertId` จาก `@/utils/posterPalette` (Task 1)
- Produces:
  - `interface TicketStubProps { concertId: string; concertTitle: string; eventDate: string; location: string; zoneLabel: string; code: string; seatLabel: string; qrCodeUrl: string; onOpenQr: () => void }`
  - `export default function TicketStub(props: TicketStubProps)` (จาก `@/components/tickets/TicketStub`)
  - DOM: element ราก `data-testid="ticket-stub"` และ `data-accent="<สี accent ของงานนั้น>"`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/components/tickets/TicketStub.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketStub from '@/components/tickets/TicketStub';
import { ticketThemeForConcertId } from '@/utils/posterPalette';

const ticketProps = {
    concertId: 'CC0001',
    concertTitle: 'Neon Flux Festival 2024',
    eventDate: '16 ตุลาคม 2569',
    location: 'ธันเดอร์โดม เมืองทองธานี',
    zoneLabel: 'โซน A1 (โซน A)',
    code: 'TCK-NEON-A1-01-4280',
    seatLabel: 'A1-01',
    qrCodeUrl: 'https://example.test/qr.png',
    onOpenQr: () => {},
};

describe('TicketStub', () => {
    it('shows everything the customer needs at the gate', () => {
        render(<TicketStub {...ticketProps} />);

        expect(screen.getByText('Neon Flux Festival 2024')).toBeInTheDocument();
        expect(screen.getByText('16 ตุลาคม 2569')).toBeInTheDocument();
        expect(screen.getByText('ธันเดอร์โดม เมืองทองธานี')).toBeInTheDocument();
        expect(screen.getByText('โซน A1 (โซน A)')).toBeInTheDocument();
        expect(screen.getByText('TCK-NEON-A1-01-4280')).toBeInTheDocument();
        // ต้องจับด้วยข้อความเต็ม ไม่ใช่ /A1-01/ เพราะรหัสตั๋วก็มี "A1-01" อยู่ข้างในจะชนกันสองที่
        expect(screen.getByText('ที่นั่ง A1-01')).toBeInTheDocument();
    });

    it('renders the QR code image of that ticket', () => {
        render(<TicketStub {...ticketProps} />);

        const qr = screen.getByRole('img', { name: /TCK-NEON-A1-01-4280/ });
        expect(qr).toHaveAttribute('src', 'https://example.test/qr.png');
    });

    it('marks the stub as admitting one person', () => {
        render(<TicketStub {...ticketProps} />);

        expect(screen.getByText('ADMIT ONE')).toBeInTheDocument();
    });

    it('paints the ticket with the accent colour of that concert poster', () => {
        render(<TicketStub {...ticketProps} />);

        expect(screen.getByTestId('ticket-stub')).toHaveAttribute(
            'data-accent',
            ticketThemeForConcertId('CC0001').accent,
        );
    });

    it('gives concerts with different posters different accent colours', () => {
        const { unmount } = render(<TicketStub {...ticketProps} concertId="CC0001" />);
        const first = screen.getByTestId('ticket-stub').getAttribute('data-accent');
        unmount();

        render(<TicketStub {...ticketProps} concertId="CC0002" />);
        const second = screen.getByTestId('ticket-stub').getAttribute('data-accent');

        expect(first).not.toBe(second);
    });

    it('opens the enlarged QR code when the customer clicks the ticket', async () => {
        const onOpenQr = vi.fn();
        render(<TicketStub {...ticketProps} onOpenQr={onOpenQr} />);

        await userEvent.click(screen.getByRole('button', { name: /TCK-NEON-A1-01-4280/ }));

        expect(onOpenQr).toHaveBeenCalledTimes(1);
    });
});
```

หมายเหตุ: เทสต์ `'gives concerts with different posters different accent colours'` อาศัยว่า
`CC0001` กับ `CC0002` ได้คนละ index (checksum ต่างกัน 1) จึงได้คนละสีแน่นอน

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/components/tickets/TicketStub.test.tsx
```

Expected: FAIL — `Failed to resolve import "@/components/tickets/TicketStub"`

- [ ] **Step 3: เขียนคอมโพเนนต์**

สร้าง `frontend/src/components/tickets/TicketStub.tsx`:

```tsx
import { Box, Typography } from '@mui/material';
import { ticketThemeForConcertId } from '@/utils/posterPalette';

export interface TicketStubProps {
  concertId: string;
  concertTitle: string;
  eventDate: string;
  location: string;
  zoneLabel: string;
  code: string;
  seatLabel: string;
  qrCodeUrl: string;
  onOpenQr: () => void;
}

// ความกว้างของส่วนหางตั๋ว (ฝั่ง QR) ใช้ทั้งวางรอยปรุและวางรอยบาก ต้องเป็นค่าเดียวกัน
const STUB_WIDTH = 152;
const INK = '#F1F5F9';
const INK_MUTED = 'rgba(241,245,249,0.72)';

export default function TicketStub({
  concertId, concertTitle, eventDate, location, zoneLabel, code, seatLabel, qrCodeUrl, onOpenQr,
}: TicketStubProps) {
  const theme = ticketThemeForConcertId(concertId);

  return (
    <Box
      data-testid="ticket-stub"
      data-accent={theme.accent}
      role="button"
      tabIndex={0}
      aria-label={`ขยาย QR Code ของตั๋ว ${code}`}
      onClick={onOpenQr}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenQr();
        }
      }}
      sx={{
        position: 'relative',
        display: 'flex',
        minHeight: 176,
        borderRadius: 3,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: theme.base,
        color: INK,
        border: `1px solid ${theme.accent}55`,
        boxShadow: `0 10px 26px ${theme.accent}26`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 14px 32px ${theme.accent}44` },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, p: 2.5 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '2px', color: theme.accent }}>
          OCTAVIA E-TICKET
        </Typography>
        <Typography sx={{ mt: 0.75, fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
          {concertTitle}
        </Typography>
        <Box sx={{ mt: 1.5, display: 'grid', gap: 0.4 }}>
          <Typography sx={{ fontSize: '0.82rem', color: INK_MUTED }}>{eventDate}</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: INK_MUTED, overflowWrap: 'anywhere' }}>{location}</Typography>
        </Box>
        <Box
          sx={{
            mt: 1.5, display: 'inline-flex', px: 1.25, py: 0.5, borderRadius: 99,
            bgcolor: `${theme.accent}22`, border: `1px solid ${theme.accent}66`,
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: theme.accent }}>{zoneLabel}</Typography>
        </Box>
      </Box>

      {/* รอยปรุ: เส้นประ + รอยบากครึ่งวงกลมบน-ล่าง (สีรอยบากต้องเท่าพื้นหลังของพื้นที่ที่วางการ์ด) */}
      <Box aria-hidden sx={{ position: 'absolute', top: 0, bottom: 0, right: STUB_WIDTH, borderLeft: `2px dashed ${theme.accent}66` }} />
      <Box aria-hidden sx={{ position: 'absolute', right: STUB_WIDTH - 11, top: -11, width: 22, height: 22, borderRadius: '50%', bgcolor: '#fff' }} />
      <Box aria-hidden sx={{ position: 'absolute', right: STUB_WIDTH - 11, bottom: -11, width: 22, height: 22, borderRadius: '50%', bgcolor: '#fff' }} />

      <Box
        sx={{
          width: STUB_WIDTH, flexShrink: 0, bgcolor: theme.stub, p: 1.5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75,
        }}
      >
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.5px', color: theme.accent }}>
          ADMIT ONE
        </Typography>
        <Box
          component="img"
          src={qrCodeUrl}
          alt={`QR Code ตั๋ว ${code}`}
          sx={{ width: 96, height: 96, p: 0.6, bgcolor: '#fff', borderRadius: 1.5 }}
        />
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, textAlign: 'center', overflowWrap: 'anywhere' }}>
          {code}
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', color: INK_MUTED }}>ที่นั่ง {seatLabel}</Typography>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/components/tickets/TicketStub.test.tsx
```

Expected: PASS ทั้ง 6 เคส

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tickets/TicketStub.tsx frontend/src/components/tickets/TicketStub.test.tsx
git commit -m "feat(frontend): add poster-themed ticket stub component"
```

---

### Task 3: ใช้ตั๋วใบใหม่ในหน้าบัตรของฉัน

จบงานนี้แล้วหน้า `/my-tickets` จะแสดงตั๋วทรงใหม่ สีตามโปสเตอร์ของแต่ละงาน

**Files:**
- Modify: `frontend/src/pages/Customer/Account/index.tsx` (บรรทัด 69, 284-329, 497-534)

**Interfaces:**
- Consumes: `TicketStub` + `TicketStubProps` (Task 2), `ticketThemeForConcertId` (Task 1), `formatDate` (helper เดิมในไฟล์เดียวกัน บรรทัด 41-49)
- Produces: ไม่มี export ใหม่ — `CustomerAccountPage` ยังเป็น default export รับ prop `mode` เหมือนเดิม

- [ ] **Step 1: เพิ่ม import**

ใน `frontend/src/pages/Customer/Account/index.tsx` เพิ่มต่อจากบรรทัด `import { bookingPaymentApi } from '@/api/bookingPaymentApi';`:

```tsx
import TicketStub from '@/components/tickets/TicketStub';
import { ticketThemeForConcertId } from '@/utils/posterPalette';
```

- [ ] **Step 2: ให้ state ของ dialog จำ concertId ไว้ด้วย**

แทนบรรทัด 69:

```tsx
  const [previewQrTicket, setPreviewQrTicket] = useState<{ code: string; qrCodeUrl: string; seatLabel: string; concertTitle: string } | null>(null);
```

ด้วย (เพิ่ม `concertId` เพื่อให้ dialog รู้ว่าต้องใช้สีชุดไหน):

```tsx
  const [previewQrTicket, setPreviewQrTicket] = useState<{ code: string; qrCodeUrl: string; seatLabel: string; concertTitle: string; concertId: string } | null>(null);
```

- [ ] **Step 3: เปลี่ยนการ์ดตั๋วมาใช้ TicketStub**

แทนบล็อกทั้งก้อนตั้งแต่ `<Box sx={{ display: 'grid', gridTemplateColumns: ... minmax(230px, 1fr) ...` จนถึง `</Box>` ที่ปิด grid (บรรทัด 284-329) ด้วย:

```tsx
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(340px, 1fr))' }, gap: 2.5 }}>
                                {ticketsToRender.map((ticket) => (
                                  <TicketStub
                                    key={ticket.code}
                                    concertId={booking.concertId}
                                    concertTitle={booking.concertTitle}
                                    eventDate={formatDate(booking.eventDate)}
                                    location={booking.location || 'ฮอลล์จัดแสดง'}
                                    zoneLabel={`โซน ${booking.zoneId} (${booking.tierName})`}
                                    code={ticket.code}
                                    seatLabel={ticket.seatLabel}
                                    qrCodeUrl={ticket.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ticket.code)}`}
                                    onOpenQr={() => setPreviewQrTicket({
                                      code: ticket.code,
                                      qrCodeUrl: ticket.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ticket.code)}`,
                                      seatLabel: ticket.seatLabel,
                                      concertTitle: booking.concertTitle,
                                      concertId: booking.concertId,
                                    })}
                                  />
                                ))}
                              </Box>
```

- [ ] **Step 4: ให้ dialog ขยาย QR ใช้สีชุดเดียวกับตั๋วใบนั้น**

แทนเนื้อใน `{previewQrTicket && ( ... )}` ของ Dialog ขยาย QR (บรรทัด 497-534) ด้วย:

```tsx
        {previewQrTicket && (() => {
          const ticketTheme = ticketThemeForConcertId(previewQrTicket.concertId);
          return (
            <Box sx={{ p: 3, textAlign: 'center', bgcolor: ticketTheme.base, color: '#F1F5F9', borderRadius: 3 }}>
              <Typography variant="caption" sx={{ color: ticketTheme.accent, fontWeight: 800, letterSpacing: '2px' }}>
                OCTAVIA E-TICKET
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5, mb: 0.5 }}>
                {previewQrTicket.concertTitle}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(241,245,249,0.72)', mb: 2 }}>
                ที่นั่ง: <strong>{previewQrTicket.seatLabel}</strong> · รหัสตั๋ว: <strong>{previewQrTicket.code}</strong>
              </Typography>
              <Box
                component="img"
                src={previewQrTicket.qrCodeUrl}
                alt="Enlarged QR Code"
                sx={{
                  width: 240, height: 240, mx: 'auto', p: 2, bgcolor: '#fff', borderRadius: 3,
                  border: `2px solid ${ticketTheme.accent}`, boxShadow: `0 8px 30px ${ticketTheme.accent}44`,
                }}
              />
              <Alert severity="success" sx={{ mt: 2.5, textAlign: 'left', borderRadius: 2 }}>
                แสดง QR Code นี้แก่เจ้าหน้าที่ ณ ประตูทางเข้างาน (Gate Check-In) เพื่อสแกนเข้าชม
              </Alert>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setPreviewQrTicket(null)}
                sx={{
                  mt: 2.5, bgcolor: ticketTheme.accent, color: '#141024', py: 1.2, borderRadius: 2,
                  textTransform: 'none', fontWeight: 800, fontSize: '1rem',
                  '&:hover': { bgcolor: ticketTheme.accent, filter: 'brightness(0.92)' },
                }}
              >
                ปิดหน้าต่าง
              </Button>
            </Box>
          );
        })()}
```

- [ ] **Step 5: ตรวจ type และรันเทสต์ทั้งชุด**

```bash
cd frontend && npx tsc -b && npm test -- --run
```

Expected: ไม่มี error ใหม่ในไฟล์ที่แก้ (error เดิมเรื่อง `axios` ใน `services/https/*` และตัวพิมพ์ใหญ่/เล็กของโฟลเดอร์ `Poster`/`LOGO` ยังอยู่ ไม่ต้องแก้), เทสต์ทั้งหมด PASS

- [ ] **Step 6: ตรวจ lint**

```bash
cd frontend && npm run lint
```

Expected: exit 0

- [ ] **Step 7: ตรวจของจริงในเบราว์เซอร์**

รัน backend และ frontend ให้ครบ แล้วล็อกอินด้วยบัญชีลูกค้าที่มีบัตรที่ออกแล้ว (สถานะ `issued`)
เปิด `http://localhost:5173/my-tickets`

ตรวจให้ครบ 5 ข้อ:
- ตั๋วเป็นทรงตั๋วจริง: มีเส้นประคั่น + รอยบากครึ่งวงกลมบน-ล่างตรงรอยต่อ และหางตั๋วฝั่งขวามี QR + `ADMIT ONE`
- พื้นตั๋วเป็นโทนมืด และสีเน้น (ขอบ, `OCTAVIA E-TICKET`, ป้ายโซน) เป็นสีนีออน
- ถ้ามีบัตรมากกว่า 1 งาน ตั๋วคนละงานต้องได้สีเน้นคนละสี
- กดที่ตั๋วแล้ว Dialog ขยาย QR เปิดขึ้นและใช้สีชุดเดียวกับตั๋วใบที่กด
- เช็ค `read_console_messages` ว่าไม่มี error

ถ้ายังไม่มีบัตรสถานะ `issued` ในบัญชีทดสอบ ให้จองบัตร → อัปโหลดสลิป → ให้ฝั่งเจ้าหน้าที่อนุมัติ
เพื่อให้บัตรถูกออกก่อน

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Customer/Account/index.tsx
git commit -m "feat(frontend): use poster-themed ticket stub on my tickets page"
```

---

## Notes for the executor

- **ทำไมรอยบากเป็นสีขาวตายตัว:** การ์ดตั๋ววางอยู่บน `<Box component="main">` ของหน้า Account
  ที่ตั้ง `bgcolor: '#fff'` (Account/index.tsx:219) รอยบากจึงต้องเป็น `#fff` เพื่อให้ดูเหมือน
  ถูกเจาะทะลุ ถ้าย้ายตั๋วไปวางบนพื้นสีอื่นเมื่อไหร่ ต้องส่งสีพื้นเข้ามาเป็น prop
- **ทำไม `data-accent` ถึงอยู่บน DOM:** MUI `sx` คอมไพล์เป็น class ของ emotion การยืนยันสีจาก
  computed style ใน jsdom จึงเปราะ — `data-accent` ทำให้เทสต์เรื่องสีตรงไปตรงมาและไม่ flake
- **`ticketsToRender` ไม่ต้องแก้:** logic สร้างตั๋วสำรองตอนที่ `booking.tickets` ว่าง
  (Account/index.tsx:266-277) ยังใช้เหมือนเดิม งานนี้เปลี่ยนแค่การแสดงผล
- **`booking.concertId` อาจว่าง** ในข้อมูลเก่าบางรายการ — `ticketThemeForConcertId('')` คืนชุดสี
  index 0 (flux) เสมอ ไม่ crash และมีเทสต์คุมไว้แล้ว
