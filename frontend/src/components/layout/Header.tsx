import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, showBack = true }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const artistRoutes = [
    '/artist-dashboard',
    '/artist-info',
    '/invitation',
    '/performance-schedule',
    '/edit-performance',
    '/performance-detail',
    '/artist-requirements',
    '/artist-edit-history',
  ];
  const backDestination = pathname === '/artist-dashboard'
    ? '/dashboard'
    : artistRoutes.some((route) => pathname.startsWith(route))
    ? '/artist-dashboard'
    : '/dashboard';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, bgcolor: '#fff', borderBottom: '1px solid #e0e0e0', minHeight: 90 }}>
      {showBack ? (
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(backDestination)}
          sx={{
            bgcolor: '#e91e63',
            '&:hover': { bgcolor: '#c2185b' },
            borderRadius: '20px',
            textTransform: 'none',
            px: 2.5,
            fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
            fontWeight: 'bold',
            fontSize: '18px'
          }}
        >
          ย้อนกลับ
        </Button>
      ) : (
        <Box sx={{ width: 120 }} />
      )}

      <Box sx={{ textAlign: 'center', flex: 1, mx: 3 }}>
        <Typography sx={{ color: '#0d1b5e', fontWeight: 'bold', fontSize: '48px', lineHeight: 1.2, fontFamily: "'Noto Sans Thai', 'Inter', sans-serif" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ color: 'gray', fontSize: '14px', fontFamily: "'Noto Sans Thai'", mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* Spacer to keep title centered */}
      <Box sx={{ width: 120 }} />
    </Box>
  );
};

export default Header;
