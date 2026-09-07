import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Box, IconButton, Stack } from '@mui/material'
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { brand } from '@/theme'
import type { Concert } from '@/interface/IConcertInterface'
import { PosterImage } from '@/components/PosterImage'

export function HeroCarousel({ concerts }: { concerts: Concert[] }) {
  const [index, setIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (concerts.length <= 1 || isHovered) return

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % concerts.length)
    }, 2000)

    return () => clearInterval(timer)
  }, [concerts.length, isHovered])

  if (concerts.length === 0) return null

  const current = concerts[index]
  const goTo = (next: number) => setIndex((next + concerts.length) % concerts.length)

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{ position: 'relative', maxWidth: { xs: '100%', sm: 900, md: 1100, lg: 1200 }, mx: 'auto', px: { xs: 2, sm: 3 } }}
    >
      <Box
        component={RouterLink}
        to={`/shows/${current.id}`}
        data-testid="hero-slide"
        sx={{ display: 'block', textDecoration: 'none' }}
      >
        <PosterImage
          src={current.bannerUrl}
          alt={`แบนเนอร์ ${current.title}`}
          height={{ xs: 200, sm: 280, md: 350 }}
        />
      </Box>

      <IconButton
        aria-label="สไลด์ก่อนหน้า"
        onClick={() => goTo(index - 1)}
        sx={{
          position: 'absolute',
          top: '50%',
          left: { xs: 20, sm: 28 },
          transform: 'translateY(-50%)',
          color: brand.white,
          bgcolor: 'rgba(0,0,0,0.45)',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
        }}
      >
        <ChevronLeftIcon />
      </IconButton>

      <IconButton
        aria-label="สไลด์ถัดไป"
        onClick={() => goTo(index + 1)}
        sx={{
          position: 'absolute',
          top: '50%',
          right: { xs: 20, sm: 28 },
          transform: 'translateY(-50%)',
          color: brand.white,
          bgcolor: 'rgba(0,0,0,0.45)',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
        }}
      >
        <ChevronRightIcon />
      </IconButton>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'center' }}>
        {concerts.map((concert, slideIndex) => (
          <Box
            key={concert.id}
            component="button"
            type="button"
            aria-label={`ไปที่สไลด์ ${slideIndex + 1}`}
            onClick={() => goTo(slideIndex)}
            sx={{
              width: 8,
              height: 8,
              p: 0,
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              bgcolor: slideIndex === index ? brand.magenta : brand.navyFaded,
            }}
          />
        ))}
      </Stack>
    </Box>
  )
}
