import { Box, Container, Typography } from '@mui/material'
import { brand } from '@/theme'
import { BuyTicketButton } from '@/components/BuyTicketButton'
import { PosterImage } from '@/components/PosterImage'

export function LandingPage() {
  return (
    <Box data-testid="landing-page" sx={{ bgcolor: 'background.paper', py: 4 }}>
      <Container maxWidth="md">
        <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
          <PosterImage
            src="/banners/landing-hero.png"
            alt="บรรยากาศคอนเสิร์ต"
            height={380}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 4,
              textAlign: 'center',
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.55) 100%)',
            }}
          >
            <Box sx={{ color: brand.white }}>
              <Typography variant="h2" sx={{ mb: 2 }}>
                ไม่พลาดทุกบีทสำคัญ จองบัตรคอนเสิร์ตที่คุณรักก่อนใคร
              </Typography>
              <Typography variant="body2">
                รวมทุกเทศกาลดนตรี คอนเสิร์ตใหญ่ และ Live House สุดมันส์ไว้ในที่เดียว
              </Typography>
              <Typography variant="body2">
                เตรียมตัวไปร้องเพลงให้สุดเสียงกับศิลปินคนโปรดของคุณ
              </Typography>
            </Box>

            <BuyTicketButton to="/shows" size="medium" />
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
