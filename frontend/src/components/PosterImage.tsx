import { Box } from '@mui/material'
import { useState } from 'react'

export function PosterImage({
  src,
  alt,
  height,
  comingSoon = false,
}: {
  src: string
  alt: string
  height: number | string | Record<string, number | string>
  comingSoon?: boolean
}) {
  const [failed, setFailed] = useState(false)

  const overlay = comingSoon ? (
    <Box
      data-testid="poster-coming-soon-badge"
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 2,
        color: '#fff',
        fontWeight: 700,
        fontSize: '1rem',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      Coming Soon
    </Box>
  ) : null

  if (failed) {
    return (
      <Box sx={{ position: 'relative', width: '100%', height }}>
        <Box
          data-testid="poster-fallback"
          role="img"
          aria-label={alt}
          sx={{
            height: '100%',
            width: '100%',
            borderRadius: 2,
            background: 'linear-gradient(160deg, #ff9900, #ff0000)',
          }}
        />
        {overlay}
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height }}>
      <Box
        component="img"
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        sx={{ height: '100%', width: '100%', objectFit: 'cover', borderRadius: 2, display: 'block' }}
      />
      {overlay}
    </Box>
  )
}
