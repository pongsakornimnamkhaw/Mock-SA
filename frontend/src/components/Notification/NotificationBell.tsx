import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Box, Divider, IconButton, List, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import CircleIcon from '@mui/icons-material/Circle';
import { concertApi } from '@/api/concertApi';
import { artistApi } from '@/api/artistApi';

interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
}

const READ_AT_KEY = 'octavia_notifications_read_at';

function notificationTitle(detail: string): string {
  if (detail.includes('ตารางการแสดง')) return 'อัปเดตตารางการแสดง';
  if (detail.includes('ศิลปิน')) return 'อัปเดตข้อมูลศิลปิน';
  if (detail.includes('ความต้องการ')) return 'อัปเดตความต้องการศิลปิน';
  if (detail.includes('สถานะ')) return 'อัปเดตสถานะงาน';
  if (detail.includes('เอกสาร')) return 'อัปเดตเอกสาร';
  if (detail.includes('ลบ')) return 'ลบข้อมูล';
  if (detail.includes('สร้าง') || detail.includes('เพิ่ม')) return 'เพิ่มข้อมูล';
  return 'อัปเดตข้อมูลงาน';
}

const NotificationBell: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readAt, setReadAt] = useState(() => localStorage.getItem(READ_AT_KEY) || '');

  const loadNotifications = useCallback(async () => {
    try {
      const [concertHistory, artistHistory] = await Promise.all([
        concertApi.getHistory(),
        artistApi.getHistory() as Promise<any[]>,
      ]);
      const combined: NotificationItem[] = [
        ...concertHistory.map((item) => ({ id: `concert-${item.id}`, title: notificationTitle(item.detail), detail: item.detail, createdAt: item.created_at })),
        ...artistHistory.map((item) => ({ id: `artist-${item.history_id}`, title: notificationTitle(item.description), detail: item.description, createdAt: item.created_at })),
      ];
      setNotifications(combined.filter((item) => item.createdAt).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 20));
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter((item) => !readAt || Date.parse(item.createdAt) > Date.parse(readAt)).length, [notifications, readAt]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    const latest = notifications[0]?.createdAt;
    if (latest) {
      localStorage.setItem(READ_AT_KEY, latest);
      setReadAt(latest);
    }
  };

  return (
    <>
      <IconButton onClick={handleClick} aria-label={unreadCount ? `มีการแจ้งเตือนใหม่ ${unreadCount} รายการ` : 'ไม่มีการแจ้งเตือนใหม่'} sx={{ p: 1 }}>
        <Badge badgeContent={unreadCount} color="error" invisible={unreadCount === 0} max={99}>
          {unreadCount > 0 ? <NotificationsIcon sx={{ color: '#ffb300', fontSize: 28 }} /> : <NotificationsNoneIcon sx={{ color: '#6b7280', fontSize: 28 }} />}
        </Badge>
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} slotProps={{ paper: { sx: { width: 360, maxHeight: 440, borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', mt: 1 } } }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: 18 }}>การแจ้งเตือน</Typography>
          <Typography sx={{ fontSize: 12, color: 'gray' }}>{notifications.length === 0 ? 'ไม่มีแจ้งเตือน' : unreadCount === 0 ? 'อ่านแล้วทั้งหมด' : `${unreadCount} รายการใหม่`}</Typography>
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}><Typography color="text.secondary">ไม่มีแจ้งเตือน</Typography></Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 350, overflowY: 'auto' }}>
            {notifications.map((item) => {
              const unread = !readAt || Date.parse(item.createdAt) > Date.parse(readAt);
              return <React.Fragment key={item.id}>
                <MenuItem onClick={() => setAnchorEl(null)} sx={{ py: 1.5, px: 2, alignItems: 'flex-start', gap: 1.5, whiteSpace: 'normal', bgcolor: unread ? 'rgba(233,30,99,0.05)' : 'transparent' }}>
                  <CircleIcon sx={{ fontSize: 9, color: unread ? '#e91e63' : '#bdbdbd', mt: 0.8, flexShrink: 0 }} />
                  <ListItemText primary={<Typography sx={{ fontWeight: unread ? 'bold' : 500, fontSize: 16 }}>{item.title}</Typography>} secondary={<Box component="span" sx={{ display: 'block', mt: 0.3 }}><Typography component="span" sx={{ display: 'block', fontSize: 14, color: '#555' }}>{item.detail}</Typography><Typography component="span" sx={{ display: 'block', fontSize: 12, color: '#888', mt: 0.5 }}>{new Date(item.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</Typography></Box>} />
                </MenuItem>
                <Divider component="li" />
              </React.Fragment>;
            })}
          </List>
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;
