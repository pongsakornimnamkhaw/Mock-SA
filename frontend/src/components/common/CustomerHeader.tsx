import { Box, Button, Link } from '@mui/material';
import Logo from '@/components/common/Logo';
import { Link as RouterLink, useLocation } from 'react-router-dom';

const navItems = [
  { label: 'หน้าแรก', path: '/home' },
  { label: 'ทุกงานแสดง', path: '/events' },
  { label: 'ติดต่อเรา', path: '/contact' },
];

export default function CustomerHeader() {
  const { pathname } = useLocation();

  return (
    <Box
      component="header"
      sx={{
        bgcolor: '#050C38',
        minHeight: 84,
        px: { xs: 2, md: 10 },
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      }}
    >
      <Link component={RouterLink} to="/home" sx={{ display: 'flex', alignItems: 'center' }}>
        <Logo variant="OC2" width={75} />
      </Link>

      <Box component="nav" sx={{ display: 'flex', gap: { xs: 1.5, md: 3.5 }, ml: { xs: 2, md: 5 } }}>
        {navItems.map((item) => {
          const active = item.path === '/contact'
            ? pathname.startsWith('/contact')
            : pathname === item.path;

          return (
            <Link
              key={item.path}
              component={RouterLink}
              to={item.path}
              underline="none"
              sx={{
                color: '#fff !important',
                fontSize: { xs: '0.9rem', md: '1.05rem' },
                fontWeight: active ? 700 : 500,
                whiteSpace: 'nowrap',
                borderBottom: active ? '3px solid #FF5C58' : '3px solid transparent',
                py: 0.75,
                '&:hover': { color: '#FF5C58 !important' },
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </Box>

      <Button
        component={RouterLink}
        to="/login"
        variant="contained"
        sx={{
          ml: 'auto',
          bgcolor: '#FF5C58',
          color: '#fff !important',
          borderRadius: '999px',
          px: { xs: 2, md: 3.5 },
          py: 1,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          boxShadow: 'none',
          textTransform: 'none',
          '&:hover': { bgcolor: '#e04f4a', boxShadow: 'none' },
        }}
      >
        เข้าสู่ระบบ
      </Button>
    </Box>
  );
}
