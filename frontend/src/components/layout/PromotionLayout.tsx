import Box from '@mui/material/Box'
import Sidebar, { SIDEBAR_WIDTH } from './Sidebar'

export default function PromotionLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f5f7' }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          marginLeft: `${SIDEBAR_WIDTH}px`,
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          p: '24px 28px',
          maxWidth: `calc(100vw - ${SIDEBAR_WIDTH}px)`,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
