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
  TextField,
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
  const booking = useZoneBooking(concert)

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
            จองโซน {selectedZone.id} จำนวน {booking.quantity} ใบ สำเร็จ — รหัสการจอง{' '}
            {booking.lastBooking?.id} สถานะ: รอชำระเงิน
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
