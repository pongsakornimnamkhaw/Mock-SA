import { Box, Container, Typography } from '@mui/material'
import { ConcertGrid } from '@/components/ConcertGrid'
import { HeroCarousel } from '@/components/SlidePoster'
import { useConcerts, useFeaturedConcerts } from '@/hooks/useConcerts'

export function HomePage() {
  const all = useConcerts()
  const featured = useFeaturedConcerts()

  return (
    <Box data-testid="home-page">
      <Box
        sx={{
          background: 'linear-gradient(180deg, #18246e 0%, #11173d 60%, #58595f 100%)',
          py: 4,
        }}
      >
        <HeroCarousel concerts={featured.data ?? []} />
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 3 }}>
          <Typography variant="h2" data-testid="home-section-title" sx={{ mb: 3 }}>
            หน้าแรก
          </Typography>
          <ConcertGrid concerts={all.data} loading={all.loading} />
        </Box>
      </Container>
    </Box>
  )
}
