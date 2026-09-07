import { Button } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export function BuyTicketButton({
  to,
  size = 'medium',
  fullWidth = false,
  sx,
  disabled = false,
  label = 'ซื้อบัตร',
}: {
  to: string
  size?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  sx?: SxProps<Theme>
  disabled?: boolean
  label?: string
}) {
  return (
    <Button
      component={RouterLink}
      to={to}
      variant="contained"
      color="primary"
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      sx={{
        px: 8,
        py: 1.5,
        fontSize: '1rem',
        fontWeight: 600,
        minWidth: 130,
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(255, 90, 87, 0.35)',
        },
        ...sx,
      }}
    >
      {label}
    </Button>
  )
}
