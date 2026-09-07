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
