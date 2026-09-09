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
