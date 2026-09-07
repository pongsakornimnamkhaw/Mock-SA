import { Box, Typography, Button } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function NotFound() {
  return (
    <Box sx={{ p: 4, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h1" gutterBottom sx={{ fontSize: '4rem' }}>404</Typography>
      <Typography variant="h3" gutterBottom>ไม่พบหน้าที่คุณต้องการ</Typography>
      <Button component={RouterLink} to="/home" variant="contained" sx={{ mt: 3 }}>
        กลับหน้าหลัก
      </Button>
    </Box>
  )
}
