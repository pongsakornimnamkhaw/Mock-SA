import { Box } from '@mui/material'
import { Outlet, useMatch } from 'react-router-dom'
import { brand } from '@/theme'
import { NavBar } from '@/components/NavBar'

export default function FullLayout() {
  const isLanding = useMatch('/') !== null
  const isDetail = useMatch('/shows/:concertId') !== null

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.white }}>
      <NavBar showActions={!isLanding} showBack={isDetail} showLogin={isDetail} />
      <Outlet />
    </Box>
  )
}
