import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import SearchIcon from '@mui/icons-material/Search'
import { AppBar, Box, IconButton, Stack, Toolbar, Typography } from '@mui/material'
import { Link as RouterLink} from 'react-router-dom'
import { brand } from '@/theme'
import logoImg from '@/assets/logo/logo2.png'



const NAV_LINKS = [
  { label: 'หน้าแรก', to: '/home' },
  { label: 'ทุกการแสดง', to: '/shows' },
  { label: 'ติดต่อเรา', to: '/contact' },
] as const

export interface NavBarProps {
  showActions: boolean
  showBack: boolean
  showLogin: boolean
}

export function NavBar({ showActions }: NavBarProps) {

  return (
    <AppBar position="static" elevation={0} sx={{ bgcolor: brand.navy }}>
      <Toolbar sx={{ gap: 2, minHeight: 64 }}>

        <Box
          component={RouterLink}
          to="/home"
          aria-label="Octavia หน้าแรก"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <Box
            component="img"
            src={logoImg}
            alt="Octavia"
            sx={{ height: 80 }}
          />
        </Box>

        <Stack direction="row" spacing={3} sx={{ ml: 3 }}>
          {NAV_LINKS.map((link) => (
            <Typography
              key={link.to}
              component={RouterLink}
              to={link.to}
              variant="body1"
              sx={{
                color: brand.white,
                textDecoration: 'none',
                fontSize: '1.1rem',
                fontWeight: 500,
                '&:hover': { color: brand.magenta },
              }}
            >
              {link.label}
            </Typography>
          ))}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        {showActions && (
          <>
            <IconButton aria-label="ค้นหา" sx={{ color: brand.white }}>
              <SearchIcon />
            </IconButton>
            <IconButton aria-label="การแจ้งเตือน" sx={{ color: brand.white }}>
              <NotificationsNoneIcon />
            </IconButton>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}
