import { useState } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { styled } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';

const contactGroups = [
  { path: '/contact/sponsor', label: 'ประสานงานผู้สนับสนุน', color: '#ef4444', children: [
    { path: '/contact/sponsor', label: 'คำขอลงโฆษณา' },
    { path: '/contact/sponsor/status', label: 'สถานะคำขอลงโฆษณา' },
  ] },
  { path: '/contact/planning', label: 'ประสานงานแผนงาน', color: '#f59e0b', children: [
    { path: '/contact/planning', label: 'รายละเอียด' },
    { path: '/contact/planning/status', label: 'สถานะการขออนุมัติ' },
  ] },
  { path: '/contact/ticketing', label: 'ประสานงานจำหน่ายบัตร', color: '#d63384', children: [
    { path: '/contact/ticketing', label: 'คำขอนำไปจำหน่าย' },
    { path: '/contact/ticketing/summary', label: 'สรุปผลการจำหน่าย' },
  ] },
];

const SidebarRoot = styled(Box)({
  minWidth: 270,
  background: '#f1f3f7',
  color: '#1e293b',
  padding: '26px 0',
  overflowY: 'auto',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
});

const SectionLabel = styled(Typography)({
  fontSize: '14px', fontWeight: 700, letterSpacing: '1px',
  color: '#64748b', padding: '12px 18px 6px',
});

const NavItem = styled(ListItemButton)<{ active?: number }>(({ active }) => ({
  borderRadius: 8, margin: '2px 10px', padding: '9px 12px', minHeight: 42,
  color: active ? '#fff' : '#334155',
  background: active ? 'linear-gradient(135deg, #d63384, #b5206a)' : 'transparent',
  boxShadow: active ? '0 2px 8px rgba(214,51,132,0.35)' : 'none',
  transition: 'all 0.2s ease',
  '&:hover': {
    background: active ? 'linear-gradient(135deg, #d63384, #b5206a)' : 'rgba(214,51,132,0.08)',
    color: active ? '#fff' : '#b5206a',
  },
}));

const SubNavItem = styled(ListItemButton)<{ active?: number }>(({ active }) => ({
  borderRadius: 6, margin: '1px 10px 1px 24px', padding: '7px 12px', minHeight: 36,
  color: active ? '#b5206a' : '#64748b',
  background: active ? 'rgba(214,51,132,0.12)' : 'transparent',
  transition: 'all 0.2s ease',
  '&:hover': { background: 'rgba(214,51,132,0.08)', color: '#b5206a' },
}));

const DotIcon = styled(Box)<{ dotcolor?: string }>(({ dotcolor }) => ({
  width: 8, height: 8, borderRadius: '50%', backgroundColor: dotcolor || '#94a3b8',
  marginRight: 8, flexShrink: 0,
}));

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(contactGroups.map((group) => [
      group.path,
      pathname === group.path || pathname.startsWith(`${group.path}/`),
    ])),
  );

  return (
    <SidebarRoot className="sidebar" role="navigation" aria-label="เมนูติดต่อภายนอก">
      <SectionLabel sx={{ color: '#d63384' }}>ติดต่อเรา</SectionLabel>
      <List dense disablePadding>
        <ListItem disablePadding>
          <NavItem active={pathname === '/contact' ? 1 : 0} onClick={() => navigate('/contact')}>
            <DotIcon dotcolor={pathname === '/contact' ? '#fff' : '#d63384'} />
            <ListItemText primary="ติดต่อเรา" slotProps={{ primary: { sx: { fontSize: '15px', fontWeight: 600 } } }} />
          </NavItem>
        </ListItem>

        <SectionLabel>การประสานงาน</SectionLabel>
        {contactGroups.map((group) => {
          const active = pathname === group.path || pathname.startsWith(`${group.path}/`);
          const open = Boolean(openGroups[group.path]);
          return (
            <Box key={group.path}>
              <ListItem disablePadding>
                <NavItem active={active ? 1 : 0} onClick={() => setOpenGroups((prev) => ({ ...prev, [group.path]: !open }))} sx={{ justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <DotIcon dotcolor={active ? '#fff' : group.color} />
                    <ListItemText primary={group.label} slotProps={{ primary: { sx: { fontSize: '15px', fontWeight: 600 } } }} />
                  </Box>
                  {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                </NavItem>
              </ListItem>
              <Collapse in={open} timeout="auto" unmountOnExit>
                <List dense disablePadding>
                  {group.children.map((item) => (
                    <ListItem key={item.path} disablePadding>
                      <SubNavItem active={pathname === item.path ? 1 : 0} onClick={() => navigate(item.path)}>
                        <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '14px' } } }} />
                      </SubNavItem>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}

        <SectionLabel>สอบถาม</SectionLabel>
        <ListItem disablePadding>
          <NavItem active={pathname === '/contact/general' ? 1 : 0} onClick={() => navigate('/contact/general')}>
            <DotIcon dotcolor={pathname === '/contact/general' ? '#fff' : '#94a3b8'} />
            <ListItemText primary="สอบถามทั่วไป" slotProps={{ primary: { sx: { fontSize: '15px', fontWeight: 500 } } }} />
          </NavItem>
        </ListItem>
      </List>
    </SidebarRoot>
  );
}
