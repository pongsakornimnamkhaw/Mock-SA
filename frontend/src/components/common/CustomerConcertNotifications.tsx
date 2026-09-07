import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Typography,
} from '@mui/material';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { useNavigate } from 'react-router-dom';
import { customerEvents } from '@/data/customerEvents';

const STORAGE_KEY = 'octavia-customer-read-concerts-ui-v1';

function initialReadIds() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export default function CustomerConcertNotifications() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [readIds, setReadIds] = useState<string[]>(initialReadIds);
  const notifications = useMemo(() => customerEvents.filter((event) => event.isNew), []);
  const unreadCount = notifications.filter((event) => !readIds.includes(event.id)).length;

  const saveReadIds = (ids: string[]) => {
    setReadIds(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // The visual state still works when browser storage is unavailable.
    }
  };

  const markAllRead = () => saveReadIds([...new Set([...readIds, ...notifications.map((event) => event.id)])]);

  const openNotification = (id: string) => {
    if (!readIds.includes(id)) saveReadIds([...readIds, id]);
    setAnchorEl(null);
    navigate(`/event/${id}`);
  };

  return (
    <>
      <IconButton
        aria-label={unreadCount > 0 ? `การแจ้งเตือนคอนเสิร์ตใหม่ ${unreadCount} รายการ` : 'การแจ้งเตือนคอนเสิร์ต'}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
        sx={{ color: '#fff', p: 1 }}
      >
        <Badge badgeContent={unreadCount} color="error" max={9}>
          <NotificationsNoneRoundedIcon />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 24px)', sm: 390 }, mt: 1.25, borderRadius: 3, overflow: 'hidden', boxShadow: '0 18px 48px rgba(5,12,56,0.22)' } } }}
      >
        <Box sx={{ px: 2.25, py: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 800, color: '#050C38' }}>การแจ้งเตือน</Typography>
            <Typography variant="caption" color="text.secondary">คอนเสิร์ตเปิดตัวใหม่สำหรับคุณ</Typography>
          </Box>
          {unreadCount > 0 && <Button size="small" onClick={markAllRead} sx={{ color: '#FF5C58', fontWeight: 700 }}>อ่านทั้งหมด</Button>}
        </Box>
        <Divider />
        <List disablePadding>
          {notifications.map((event) => {
            const unread = !readIds.includes(event.id);
            return (
              <ListItemButton
                key={event.id}
                onClick={() => openNotification(event.id)}
                sx={{ gap: 1.5, alignItems: 'flex-start', px: 2.25, py: 1.75, bgcolor: unread ? '#fff7f6' : '#fff', '&:hover': { bgcolor: '#fff1ef' } }}
              >
                <Box component="img" src={event.image} alt="" sx={{ width: 54, height: 70, objectFit: 'cover', borderRadius: 1.5 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.35 }}>
                    <Typography noWrap sx={{ fontWeight: unread ? 800 : 650, color: '#151b3f', fontSize: '0.92rem' }}>{event.title}</Typography>
                    {unread && <Chip label="ใหม่" size="small" sx={{ height: 20, bgcolor: '#FF5C58', color: '#fff', fontSize: '0.68rem', fontWeight: 800 }} />}
                  </Box>
                  <Typography sx={{ color: '#606781', fontSize: '0.78rem', lineHeight: 1.45 }}>{event.announcement}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.65, color: '#8a90a6' }}>
                    <LocationOnOutlinedIcon sx={{ fontSize: 14 }} />
                    <Typography variant="caption">{event.location} · {event.date}</Typography>
                  </Box>
                </Box>
              </ListItemButton>
            );
          })}
        </List>
        <Divider />
        <Button fullWidth onClick={() => { setAnchorEl(null); navigate('/events'); }} sx={{ py: 1.25, color: '#050C38', fontWeight: 750 }}>
          ดูคอนเสิร์ตทั้งหมด
        </Button>
      </Popover>
    </>
  );
}
