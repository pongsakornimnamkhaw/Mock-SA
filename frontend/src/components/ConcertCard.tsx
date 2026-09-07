import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { Box, Card, Stack, Typography } from '@mui/material'
import { brand } from '@/theme'
import { formatShowDateShort } from '@/utils/format'
import type { Concert } from '@/interface/IConcertInterface'
import { BuyTicketButton } from '@/components/BuyTicketButton'
import { PosterImage } from '@/components/PosterImage'

export function ConcertCard({ concert }: { concert: Concert }) {
  return (
    <Card
      elevation={0}
      sx={{
        p: 1.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        border: `1px solid ${brand.border}`,
      }}
    >
      <PosterImage
        src={concert.posterUrl}
        alt={`โปสเตอร์ ${concert.title}`}
        height={200}
        comingSoon={concert.saleStatus === 'coming_soon'}
      />

      <Typography variant="h3" sx={{ fontSize: '0.9rem', mt: 1.5 }}>
        {concert.title}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
        {formatShowDateShort(concert)}
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: 'center' }}>
        <PlaceOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          {concert.province}
        </Typography>
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ mt: 1.5 }}>
        <BuyTicketButton
          to={`/shows/${concert.id}`}
          disabled={concert.saleStatus === 'coming_soon'}
          label={concert.saleStatus === 'coming_soon' ? 'เร็ว ๆ นี้' : 'ซื้อบัตร'}
        />
      </Box>
    </Card>
  )
}
