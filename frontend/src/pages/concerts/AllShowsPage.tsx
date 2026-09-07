import { Box, Breadcrumbs, Container, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { ConcertGrid } from '@/components/ConcertGrid'
import { useConcerts } from '@/hooks/useConcerts'

export function AllShowsPage() {
  const { data, loading } = useConcerts()

  return (
    <Box data-testid="all-shows-page" sx={{ py: 4 }}>
      <Container maxWidth="lg" sx={{ bgcolor: 'background.paper', py: 3, borderRadius: 2 }}>
        <Breadcrumbs separator=">" sx={{ mb: 3 }}>
          <Typography
            component={RouterLink}
            to="/home"
            data-testid="breadcrumb-home"
            variant="body2"
            sx={{ color: 'text.secondary', textDecoration: 'none' }}
          >
            หน้าแรก
          </Typography>
          <Typography variant="body2" color="text.primary">
            ทุกการแสดง
          </Typography>
        </Breadcrumbs>

        <ConcertGrid concerts={data} loading={loading} />
      </Container>
    </Box>
  )
}
