import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { Avatar, Box, Button, Divider, IconButton, InputAdornment, Link, List, ListItemButton, Popover, TextField, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import Logo from '@/components/common/Logo';
import CustomerConcertNotifications from '@/components/common/CustomerConcertNotifications';
import { useCustomerConcerts } from '@/hooks/useCustomerConcerts';
import { clearCustomerSession, CUSTOMER_SESSION_EVENT, getCustomerSession, saveCustomerSession } from '@/utils/customerSession';
import { customerAccountApi, CustomerApiError } from '@/api/customerAccountApi';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'หน้าแรก', path: '/home' },
  { label: 'ทุกงานแสดง', path: '/events' },
  { label: 'โปรโมชั่น', path: '/offers' },
  { label: 'ติดต่อเรา', path: '/contact' },
];

const accountItems = [
  { label: 'บัตรของฉัน', path: '/my-tickets', icon: ConfirmationNumberOutlinedIcon },
  { label: 'ประวัติการซื้อ', path: '/purchase-history', icon: HistoryRoundedIcon },
  { label: 'แก้ไขโปรไฟล์', path: '/profile/edit', icon: EditOutlinedIcon },
  { label: 'เปลี่ยนรหัสผ่าน', path: '/change-password', icon: LockOutlinedIcon },
];

export default function CustomerHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [session, setSession] = useState(getCustomerSession);
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const { concerts } = useCustomerConcerts();
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    if (!normalized) return concerts;
    return concerts.filter((event) => `${event.title} ${event.location}`.toLocaleLowerCase('th-TH').includes(normalized));
  }, [concerts, query]);

  useEffect(() => {
    const syncSession = () => setSession(getCustomerSession());
    const verifySession = async () => {
      try {
        const account = await customerAccountApi.getAccount();
        const cached = getCustomerSession();
        if (!cached || cached.userId !== account.userId || cached.email !== account.email || cached.firstName !== account.firstName || cached.lastName !== account.lastName) {
          saveCustomerSession(account);
        }
      } catch (err) {
        if (err instanceof CustomerApiError && err.status === 401) {
          clearCustomerSession();
        }
      }
    };
    window.addEventListener('storage', syncSession);
    window.addEventListener(CUSTOMER_SESSION_EVENT, syncSession);
    void verifySession();
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener(CUSTOMER_SESSION_EVENT, syncSession);
    };
  }, []);

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = query.trim();
    setSearchAnchor(null);
    navigate(normalized ? `/events?q=${encodeURIComponent(normalized)}` : '/events');
  };

  const selectEvent = (id: string) => {
    setSearchAnchor(null);
    navigate(`/event/${id}`);
  };

  const signOut = async () => {
    try {
      await customerAccountApi.logout();
    } finally {
      clearCustomerSession();
      setProfileAnchor(null);
      navigate('/home');
    }
  };

  const avatarLabel = session?.name.trim().charAt(0).toLocaleUpperCase('th-TH') || 'O';

  return (
    <Box
      component="header"
      sx={{
        bgcolor: '#050C38',
        minHeight: 84,
        px: { xs: 1.5, sm: 3, md: 10 },
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
        <Logo variant="OC2" width={72} />
      </Link>

      <Box component="nav" sx={{ display: { xs: 'none', md: 'flex' }, gap: 3.5, ml: 5 }}>
        {navItems.map((item) => {
          const active = item.path === '/contact' || item.path === '/offers'
            ? pathname.startsWith(item.path)
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

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: { xs: 0.25, sm: 0.75 } }}>
        <IconButton
          aria-label="ค้นหาคอนเสิร์ต"
          onClick={(event: MouseEvent<HTMLElement>) => setSearchAnchor(event.currentTarget)}
          sx={{ color: '#fff', p: 1 }}
        >
          <SearchRoundedIcon />
        </IconButton>
        <CustomerConcertNotifications />
      </Box>

      {session ? (
        <IconButton
          aria-label="เปิดเมนูบัญชี"
          aria-controls={profileAnchor ? 'customer-account-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={profileAnchor ? 'true' : undefined}
          onClick={(event: MouseEvent<HTMLElement>) => setProfileAnchor(event.currentTarget)}
          sx={{ ml: { xs: 0.5, sm: 1.25 }, p: 0.5 }}
        >
          <Avatar sx={{ width: 44, height: 44, bgcolor: '#FF5C58', color: '#fff', fontWeight: 800, fontSize: '1.1rem', border: '2px solid rgba(255,255,255,0.75)' }}>
            {avatarLabel}
          </Avatar>
        </IconButton>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            component={RouterLink}
            to="/employee/login"
            variant="text"
            sx={{
              color: '#94a3b8',
              fontSize: '0.82rem',
              textTransform: 'none',
              display: { xs: 'none', md: 'inline-flex' },
              '&:hover': { color: '#10b981' },
            }}
          >
            สำหรับพนักงาน
          </Button>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            sx={{
              ml: { xs: 0.5, sm: 1 },
              bgcolor: '#FF5C58',
              color: '#fff !important',
              borderRadius: '999px',
              px: { xs: 2, md: 3 },
              py: 0.8,
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
      )}

      <Popover
        open={Boolean(searchAnchor)}
        anchorEl={searchAnchor}
        onClose={() => setSearchAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 24px)', sm: 430 }, mt: 1.25, borderRadius: 3, boxShadow: '0 18px 48px rgba(5,12,56,0.22)' } } }}
      >
        <Box component="form" onSubmit={submitSearch} sx={{ p: 2 }}>
          <Typography sx={{ mb: 1.25, fontWeight: 800, color: '#050C38' }}>ค้นหาคอนเสิร์ต</Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ชื่อคอนเสิร์ต หรือสถานที่"
            slotProps={{
              htmlInput: { 'aria-label': 'ชื่อคอนเสิร์ต หรือสถานที่' },
              input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon color="action" /></InputAdornment> },
            }}
          />
        </Box>
        <Divider />
        <List disablePadding sx={{ maxHeight: 310, overflowY: 'auto' }}>
          {matches.length === 0 ? (
            <Box sx={{ px: 2.5, py: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">ไม่พบคอนเสิร์ตที่ค้นหา</Typography>
            </Box>
          ) : matches.slice(0, 5).map((event) => (
            <ListItemButton key={event.id} onClick={() => selectEvent(event.id)} sx={{ gap: 1.25, px: 2, py: 1.25 }}>
              <Box component="img" src={event.image} alt="" sx={{ width: 42, height: 54, objectFit: 'cover', borderRadius: 1 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, color: '#151b3f', fontSize: '0.9rem' }}>{event.title}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, color: '#80869d' }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption">{event.location}</Typography>
                </Box>
              </Box>
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <Button fullWidth onClick={() => submitSearch()} sx={{ py: 1.2, color: '#FF5C58', fontWeight: 800 }}>
          ดูผลการค้นหาทั้งหมด
        </Button>
      </Popover>

      <Popover
        id="customer-account-menu"
        open={Boolean(profileAnchor)}
        anchorEl={profileAnchor}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: 'calc(100vw - 24px)', sm: 300 },
              mt: 1.25,
              overflow: 'visible',
              borderRadius: 2,
              border: '1px solid #e6e8f0',
              boxShadow: '0 14px 40px rgba(5,12,56,0.2)',
              '&::before': {
                content: '""',
                position: 'absolute',
                width: 14,
                height: 14,
                top: -7,
                right: 17,
                bgcolor: '#fff',
                transform: 'rotate(45deg)',
                borderTop: '1px solid #e6e8f0',
                borderLeft: '1px solid #e6e8f0',
              },
            },
          },
        }}
      >
        {session && (
          <>
            <Box sx={{ px: 2.5, py: 2 }}>
              <Typography noWrap sx={{ color: '#161b3d', fontWeight: 800, lineHeight: 1.35 }}>
                {session.name}
              </Typography>
              <Typography noWrap variant="body2" sx={{ color: '#8a8fa3', fontSize: '0.82rem', mt: 0.25 }}>
                {session.email}
              </Typography>
            </Box>
            <Divider />
            <List disablePadding sx={{ py: 0.5 }}>
              {accountItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <ListItemButton
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
                    selected={pathname === item.path}
                    onClick={() => setProfileAnchor(null)}
                    sx={{
                      minHeight: 46,
                      px: 2.5,
                      gap: 1.5,
                      color: '#41465b',
                      '&.Mui-selected': { bgcolor: '#eef0f5', color: '#050C38' },
                      '&.Mui-selected:hover': { bgcolor: '#e6e8ee' },
                    }}
                  >
                    <ItemIcon sx={{ fontSize: 20, color: '#74798a' }} />
                    <Typography sx={{ fontSize: '0.94rem' }}>{item.label}</Typography>
                  </ListItemButton>
                );
              })}
              <Divider sx={{ my: 0.5 }} />
              <ListItemButton onClick={signOut} sx={{ minHeight: 46, px: 2.5, gap: 1.5, color: '#41465b' }}>
                <LogoutRoundedIcon sx={{ fontSize: 20, color: '#74798a' }} />
                <Typography sx={{ fontSize: '0.94rem' }}>ออกจากระบบ</Typography>
              </ListItemButton>
            </List>
          </>
        )}
      </Popover>
    </Box>
  );
}
