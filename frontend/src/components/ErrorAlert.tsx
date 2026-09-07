import { Alert, Box } from '@mui/material'

export function ErrorAlert({ message }: { message: string }) {
  return (
    <Box sx={{ p: 2 }}>
      <Alert severity="error">{message}</Alert>
    </Box>
  )
}
