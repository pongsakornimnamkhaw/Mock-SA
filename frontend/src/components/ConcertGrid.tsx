import { Box, CircularProgress, Typography } from '@mui/material'
import type { Concert } from '@/interface/IConcertInterface'
import { ConcertCard } from '@/components/ConcertCard'

export function ConcertGrid({
  concerts,
  loading,
}: {
  concerts: Concert[] | null
  loading: boolean
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!concerts || concerts.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        ยังไม่มีการแสดงในขณะนี้
      </Typography>
    )
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2.5,
        gridTemplateColumns: {
          xs: 'repeat(1, 1fr)',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(4, 1fr)',
        },
      }}
    >
      {concerts.map((concert) => (
        <ConcertCard key={concert.id} concert={concert} />
      ))}
    </Box>
  )
}
