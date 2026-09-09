import { Box, Typography, Button } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function Login() {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h2" gutterBottom>เข้าสู่ระบบ</Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        (นี่คือหน้า Login จำลอง)
      </Typography>
      <Button component={RouterLink} to="/home" variant="contained">
        กลับหน้าหลัก
      </Button>
    </Box>
  )
}
