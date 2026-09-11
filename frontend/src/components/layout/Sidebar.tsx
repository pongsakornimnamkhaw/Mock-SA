// src/components/layout/Sidebar.tsx
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PersonIcon from '@mui/icons-material/Person';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import logoImage from '../../assets/octavia-logo.png';
import { getEmployeeSession, clearEmployeeSession, EMPLOYEE_SESSION_EVENT } from '@/utils/employeeSession';
import { effectiveModulePermissions, hasModuleAccess, type BackofficeModule } from '@/access/backofficeAccess';
import { employeeAccountApi } from '@/api/employeeAccountApi';

import { useLocation, useNavigate } from 'react-router-dom';

export const SIDEBAR_WIDTH = 240;

const SidebarRoot = styled(Box)({
  width: SIDEBAR_WIDTH,
  minWidth: SIDEBAR_WIDTH,
  height: '100vh',
  background: 'linear-gradient(180deg, #16213e 0%, #1a1a2e 100%)',
  display: 'flex',
  flexDirection: 'column',
  position: 'fixed',
  left: 0,
  top: 0,
  overflowY: 'auto',
  zIndex: 100,
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': {
    display: 'none',
  },
});

const Logo = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '22px 18px 18px',
  cursor: 'pointer',
});

const SectionLabel = styled(Typography)({
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#4a5568',
  padding: '14px 18px 5px',
  textTransform: 'uppercase',
});

const NavItem = styled(ListItemButton)<{ active?: number }>(({ active }) => ({
  borderRadius: 8,
  margin: '2px 10px',
  padding: '9px 12px',
  minHeight: 42,
  color: active ? '#ffffff' : '#94a3b8',
  background: active ? 'linear-gradient(135deg, #d63384, #b5206a)' : 'transparent',
  boxShadow: active ? '0 2px 8px rgba(214,51,132,0.35)' : 'none',
  '&:hover': {
    background: active
      ? 'linear-gradient(135deg, #d63384, #b5206a)'
      : 'rgba(214,51,132,0.1)',
    color: '#ffffff',
  },
  '& .MuiListItemText-primary': {
    fontSize: '0.9375rem',
  },
  transition: 'all 0.2s ease',
}));

const SubNavItem = styled(ListItemButton)<{ active?: number }>(({ active }) => ({
  borderRadius: 6,
  margin: '1px 10px 1px 24px',
  padding: '7px 12px',
  minHeight: 36,
  color: active ? '#d63384' : '#94a3b8',
  background: 'transparent',
  '&:hover': {
    background: 'rgba(214,51,132,0.1)',
    color: '#ffffff',
  },
  '& .MuiListItemText-primary': {
    fontSize: '0.875rem',
  },
  transition: 'all 0.2s ease',
}));

const DotIcon = styled(Box)<{ color?: string }>(({ color }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: color || '#94a3b8',
  marginRight: 8,
  flexShrink: 0,
}));

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const [employee, setEmployee] = useState(getEmployeeSession);
  const [pendingResetCount, setPendingResetCount] = useState(0);
  const effectivePermissions = employee
    ? effectiveModulePermissions(employee.role, employee.department, employee.modulePermissions, employee.jobRole)
    : undefined;
  const canView = (module: BackofficeModule) => !!effectivePermissions && hasModuleAccess(effectivePermissions, module, 'view');
  const lockProps = (module: BackofficeModule) => ({
    disabled: !canView(module),
    'aria-description': !canView(module) ? 'ไม่มีสิทธิ์ใช้งานเมนูนี้' : undefined,
  });
  const lockIcon = (module: BackofficeModule) => !canView(module)
    ? <LockOutlinedIcon aria-label="ล็อก" sx={{ ml: 'auto', fontSize: 15, color: '#64748b' }} />
    : null;

  useEffect(() => {
    const sync = () => setEmployee(getEmployeeSession());
    window.addEventListener('storage', sync);
    window.addEventListener(EMPLOYEE_SESSION_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EMPLOYEE_SESSION_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (employee?.role !== 'admin') {
      setPendingResetCount(0);
      return;
    }

    let active = true;
    const fetchCount = async () => {
      try {
        const count = await employeeAccountApi.getPendingResetCount();
        if (active) {
          setPendingResetCount(count);
        }
      } catch {
        // ignore errors silently
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [employee?.role]);

  const handleSignOut = () => {
    clearEmployeeSession();
    navigate('/employee/login', { replace: true });
  };

  // Expandable state
  const [concertOpen, setConcertOpen] = useState(false);
  const [artistOpen, setArtistOpen] = useState(
    ['/artist-dashboard', '/artist-info', '/invitation', '/performance-schedule', '/edit-performance', '/performance-detail', '/artist-requirements', '/artist-edit-history'].some(p => path.startsWith(p))
  );

  // Active checks
  const isPromo = path.startsWith('/promotions') && !path.startsWith('/approvals');
  const isApproval = path.startsWith('/approvals');
  const isHistory = path.startsWith('/history');
  const isEmployees = path.startsWith('/employees');
  const isReport = path.startsWith('/report');
  const isVenueSeats = path.startsWith('/venues-seats');
  const isEventRegistration = path.startsWith('/event-registration');

  const concertSubItems = [
    { label: 'เพิ่มข้อมูลคอนเสิร์ต', route: '/add-concert' },
    { label: 'แก้ไขข้อมูลคอนเสิร์ต', route: '/edit-concert' },
    { label: 'ผู้รับผิดชอบคอนเสิร์ต', route: '/responsibility' },
    { label: 'สถานะคอนเสิร์ต', route: '/concert-status' },
    { label: 'แบบเอกสาร', route: '/documents' },
    { label: 'ประวัติการแก้ไข', route: '/edit-history' },
  ];

  const artistSubItems = [
    { label: 'หน้าแรก', route: '/artist-dashboard' },
    { label: 'จัดการข้อมูลศิลปิน', route: '/artist-info' },
    { label: 'คำเชิญ', route: '/invitation' },
    { label: 'ตารางการแสดง', route: '/performance-schedule' },
    { label: 'แก้ไขกำหนดการแสดง', route: '/edit-performance' },
    { label: 'รายละเอียดการแสดง', route: '/performance-detail' },
    { label: 'ความต้องการของศิลปิน', route: '/artist-requirements' },
    { label: 'ประวัติการแก้ไข', route: '/artist-edit-history' },
  ];

  return (
    <SidebarRoot>
      {/* Logo */}
      <Logo onClick={() => navigate('/dashboard')}>
        <Box
          component="img"
          src={logoImage}
          alt="Octavia Logo"
          sx={{ height: 64, objectFit: 'contain' }}
        />
      </Logo>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 0.5 }} />

      {/* ภาพรวม */}
      <SectionLabel>ภาพรวม</SectionLabel>
      <List dense disablePadding>
        <ListItem disablePadding>
          <NavItem {...lockProps('dashboard')} active={path === '/dashboard' ? 1 : 0} onClick={() => navigate('/dashboard')}>
            <DotIcon color={path === '/dashboard' ? '#fff' : '#94a3b8'} />
            <ListItemText primary="ภาพรวมทั้งหมด" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
            {lockIcon('dashboard')}
          </NavItem>
        </ListItem>
      </List>

      {/* การจัดงาน */}
      <SectionLabel>การจัดงาน</SectionLabel>
      <List dense disablePadding>

        {/* งานคอนเสิร์ต - expandable */}
        <ListItem disablePadding>
          <NavItem
            {...lockProps('concerts')}
            active={concertOpen ? 1 : 0}
            onClick={() => setConcertOpen(!concertOpen)}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <MusicNoteIcon sx={{ fontSize: 16, mr: 1, color: concertOpen ? '#fff' : '#ef4444' }} />
              <ListItemText primary="งานคอนเสิร์ต" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 600 } } }} />
            </Box>
            {lockIcon('concerts') || (concertOpen
              ? <ExpandLessIcon sx={{ fontSize: 18 }} />
              : <ExpandMoreIcon sx={{ fontSize: 18 }} />)}
          </NavItem>
        </ListItem>
        <Collapse in={concertOpen && canView('concerts')} timeout="auto" unmountOnExit>
          <List dense disablePadding>
            {concertSubItems.map((item) => (
              <ListItem key={item.route} disablePadding>
                <SubNavItem
                  active={path === item.route ? 1 : 0}
                  onClick={() => navigate(item.route)}
                >
                  <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '0.75rem', fontWeight: 400 } } }} />
                </SubNavItem>
              </ListItem>
            ))}
          </List>
        </Collapse>

        {/* ศิลปินและการแสดง - expandable */}
        <ListItem disablePadding>
          <NavItem
            {...lockProps('artists')}
            active={artistOpen ? 1 : 0}
            onClick={() => setArtistOpen(!artistOpen)}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ fontSize: 16, mr: 1, color: artistOpen ? '#fff' : '#ef4444' }} />
              <ListItemText primary="ศิลปินและการแสดง" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 600 } } }} />
            </Box>
            {lockIcon('artists') || (artistOpen
              ? <ExpandLessIcon sx={{ fontSize: 18 }} />
              : <ExpandMoreIcon sx={{ fontSize: 18 }} />)}
          </NavItem>
        </ListItem>
        <Collapse in={artistOpen && canView('artists')} timeout="auto" unmountOnExit>
          <List dense disablePadding>
            {artistSubItems.map((item) => (
              <ListItem key={item.route} disablePadding>
                <SubNavItem
                  active={path === item.route ? 1 : 0}
                  onClick={() => navigate(item.route)}
                >
                  <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '0.75rem', fontWeight: 400 } } }} />
                </SubNavItem>
              </ListItem>
            ))}
          </List>
        </Collapse>

        {/* ห้องสถานที่และที่นั่ง */}
        <ListItem disablePadding>
          <NavItem {...lockProps('venues')} active={isVenueSeats ? 1 : 0} onClick={() => navigate('/venues-seats')}>
            <DotIcon color={isVenueSeats ? '#fff' : '#ef4444'} />
            <ListItemText primary="ห้องสถานที่และที่นั่ง" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
            {lockIcon('venues')}
          </NavItem>
        </ListItem>

        {/* ลงทะเบียนเข้างาน */}
        <ListItem disablePadding>
          <NavItem {...lockProps('registration')} active={isEventRegistration ? 1 : 0} onClick={() => navigate('/event-registration')}>
            <DotIcon color={isEventRegistration ? '#fff' : '#ef4444'} />
            <ListItemText primary="ลงทะเบียนเข้างาน" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
            {lockIcon('registration')}
          </NavItem>
        </ListItem>

      </List>

      {/* จัดการหน้าเว็บ */}
      <SectionLabel>จัดการหน้าเว็บ</SectionLabel>
      <List dense disablePadding>
        <ListItem disablePadding>
          <NavItem {...lockProps('concert_catalog')} active={path === '/search-concert' ? 1 : 0} onClick={() => navigate('/search-concert')}>
            <DotIcon color={path === '/search-concert' ? '#fff' : '#f59e0b'} />
            <ListItemText primary="จัดการรายการคอนเสิร์ต" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
            {lockIcon('concert_catalog')}
          </NavItem>
        </ListItem>
        <ListItem disablePadding>
          <NavItem {...lockProps('promotions')} active={isPromo ? 1 : 0} onClick={() => navigate('/promotions')}>
            <DotIcon color={isPromo ? '#fff' : '#f59e0b'} />
            <ListItemText primary="จัดการโปรโมชั่น" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 600 } } }} />
            {lockIcon('promotions')}
          </NavItem>
        </ListItem>
        <ListItem disablePadding>
          <NavItem {...lockProps('promotion_approvals')} active={isApproval ? 1 : 0} onClick={() => navigate('/approvals')}>
            <DotIcon color={isApproval ? '#fff' : '#f59e0b'} />
            <ListItemText primary="ตรวจสอบการอนุมัติ" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
            {lockIcon('promotion_approvals')}
          </NavItem>
        </ListItem>
      </List>

      {/* ฝ่ายขายและการชำระเงิน (B6728786: final document SA.docx) */}
      <SectionLabel sx={{ color: '#10b981' }}>ฝ่ายขายและการชำระเงิน</SectionLabel>
      <List dense disablePadding>
        <ListItem disablePadding>
          <NavItem {...lockProps('sales')} active={path.startsWith('/sales') || path === '/payment-verification' ? 1 : 0} onClick={() => navigate('/sales/bookings')}>
            <DotIcon color={path.startsWith('/sales') || path === '/payment-verification' ? '#fff' : '#10b981'} />
            <ListItemText primary="ตรวจสอบสลิปและออกบัตร" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 600 } } }} />
            {lockIcon('sales')}
          </NavItem>
        </ListItem>
      </List>

      {/* แอดมินดูแลระบบ */}
      <SectionLabel>แอดมินดูแลระบบ</SectionLabel>
      <List dense disablePadding>
        <ListItem disablePadding>
          <NavItem {...lockProps('audit')} active={isHistory ? 1 : 0} onClick={() => navigate('/history')}>
            <DotIcon color={isHistory ? '#fff' : '#94a3b8'} />
            <ListItemText primary="ตรวจสอบประวัติ" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
            {lockIcon('audit')}
          </NavItem>
        </ListItem>
        <ListItem disablePadding>
          <NavItem {...lockProps('employees')} active={isEmployees ? 1 : 0} onClick={() => navigate('/employees')}>
            <DotIcon color={isEmployees ? '#fff' : '#94a3b8'} />
            <ListItemText primary="จัดการสิทธิ์พนักงาน" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
            {pendingResetCount > 0 && (
              <Badge
                badgeContent={pendingResetCount}
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    height: 18,
                    minWidth: 18,
                  },
                }}
              />
            )}
            {lockIcon('employees')}
          </NavItem>
        </ListItem>
      </List>

      {/* สรุปรายงานหลังจบคอนเสิร์ต */}
      <SectionLabel sx={{ color: '#d63384' }}>สรุปรายงานหลังจบคอนเสิร์ต</SectionLabel>
      <List dense disablePadding>
        <ListItem disablePadding>
          <NavItem {...lockProps('reports')} active={isReport ? 1 : 0} onClick={() => navigate('/report')}>
            <DotIcon color={isReport ? '#fff' : '#d63384'} />
            <ListItemText primary="รายการคอนเสิร์ตที่เสร็จสิ้นแล้ว" slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 600 } } }} />
            {lockIcon('reports')}
          </NavItem>
        </ListItem>
      </List>

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* User */}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
      <Box sx={{ p: '14px 16px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ButtonBase
          onClick={() => navigate('/employee/account')}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderRadius: 2,
            p: '4px 6px',
            minWidth: 0,
            textAlign: 'left',
            '&:hover': { background: 'rgba(255,255,255,0.06)' },
            transition: 'background 0.2s',
          }}
          aria-label="บัญชีของฉัน"
        >
          <Avatar sx={{ width: 36, height: 36, background: 'linear-gradient(135deg,#10b981,#059669)', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {employee?.firstName?.charAt(0) || 'พ'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {employee ? employee.name : 'พงกรศกร (B6728786)'}
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
              {employee?.department || 'ฝ่ายขาย'} · {employee?.employeeCode || 'B6728786'}
            </Typography>
          </Box>
        </ButtonBase>
        <Tooltip title="ออกจากระบบพนักงาน">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
            sx={{ color: '#ef4444', p: 0.5, flexShrink: 0, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' } }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </SidebarRoot>
  );
}
