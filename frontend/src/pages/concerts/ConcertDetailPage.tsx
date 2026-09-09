import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import { Box, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { useParams } from 'react-router-dom'
import { brand } from '@/theme'
import { BuyTicketButton } from '@/components/BuyTicketButton'
import { PosterImage } from '@/components/PosterImage'
import {
  formatPriceTiers,
  formatSalePeriod,
  formatShowDateLong,
  formatVenue,
  saleStatusLabel,
} from '../../utils/format'
import { useConcert } from '@/hooks/useConcerts'

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: SvgIconComponent
  label: string
  value: string
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', minWidth: 200 }}>
      <Icon sx={{ fontSize: 18, color: brand.purple, mt: 0.25 }} />
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  )
}

export function ConcertDetailPage() {
  const { concertId } = useParams()
  const { data: concert, loading } = useConcert(concertId)

  if (loading) {
    return (
      <Box
        data-testid="concert-detail-page"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!concert) {
    return (
      <Box data-testid="concert-detail-page" sx={{ py: 8, textAlign: 'center' }}>
        <Typography color="text.secondary">ไม่พบคอนเสิร์ตที่ต้องการ</Typography>
      </Box>
    )
  }

  return (
    <Box data-testid="concert-detail-page" sx={{ bgcolor: 'background.paper' }}>
      <Box sx={{ bgcolor: brand.panelTint, py: 4 }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={4}
            sx={{ alignItems: 'flex-start' }}
          >
            <Stack spacing={2} sx={{ alignItems: 'center', width: { xs: '100%', md: 200 } }}>
              <PosterImage
                src={concert.posterUrl}
                alt={`โปสเตอร์ ${concert.title}`}
                height={240}
                comingSoon={concert.saleStatus === 'coming_soon'}
              />
              <BuyTicketButton
                to={`/shows/${concert.id}/zones`}
                disabled={concert.saleStatus === 'coming_soon'}
                label={concert.saleStatus === 'coming_soon' ? 'เร็ว ๆ นี้' : 'ซื้อบัตร'}
              />
            </Stack>

            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h1" component="h1" sx={{ mb: 2, fontSize: '1.25rem' }}>
                {concert.title}
              </Typography>

              <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
                <Box
                  sx={{
                    display: 'grid',
                    rowGap: 2.5,
                    columnGap: 4,
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  }}
                >
                  <InfoItem
                    icon={CalendarMonthOutlinedIcon}
                    label="วันที่แสดง"
                    value={formatShowDateLong(concert)}
                  />
                  <InfoItem
                    icon={EventAvailableOutlinedIcon}
                    label="วันที่เปิดจำหน่าย"
                    value={formatSalePeriod(concert)}
                  />
                  <InfoItem
                    icon={PlaceOutlinedIcon}
                    label="สถานที่จัดงาน"
                    value={formatVenue(concert)}
                  />
                  <InfoItem
                    icon={SellOutlinedIcon}
                    label="ราคา"
                    value={formatPriceTiers(concert.tiers)}
                  />
                  <InfoItem
                    icon={AccessTimeIcon}
                    label="เวลาเปิด"
                    value={concert.showTimeLabel}
                  />
                  <InfoItem
                    icon={ConfirmationNumberOutlinedIcon}
                    label="สถานะการขาย"
                    value={saleStatusLabel(concert.saleStatus)}
                  />
                </Box>
              </Paper>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h3" sx={{ mb: 1.5 }}>
          รายละเอียด
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="concert-description"
        >
          {concert.description}
        </Typography>
      </Container>
    </Box>
  )
}
