import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { brand } from '@/theme'

export default function MiniLayout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.white, display: 'flex', flexDirection: 'column' }}>
      <Outlet />
    </Box>
  )
}
