import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { Link } from 'react-router-dom';
import NotificationBell from '@/components/Notification/NotificationBell';
import { dashboardApi, type DashboardData } from '@/api/dashboardApi';

const parseDate = (value: string) => {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: string) => {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : '-';
};
const formatDateTime = (value: string) => {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(date)
    : '-';
};

const emptyData: DashboardData = {
  summary: { total_concerts: 0, concerts_this_month: 0, total_budget: 0, incomplete_tasks: 0, responsible_people: 0 },
  featured_concerts: [], concert_statuses: [], responsibilities: [], recent_updates: [],
};

const DashboardPage = () => {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await dashboardApi.getDashboard());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูล Dashboard ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, fontFamily: "'Noto Sans Thai', sans-serif" }}>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>ลองใหม่</Button>} sx={{ mb: 2 }}>{error}</Alert>}
      {!error && <>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button component={Link} to="/concert-search" variant="outlined" sx={{ borderRadius: 5, fontWeight: 700 }}>ค้นหาคอนเสิร์ต</Button>
          <NotificationBell />
          <Button component={Link} to="/add-concert" variant="contained" startIcon={<AddIcon />} sx={{ borderRadius: 5, bgcolor: '#e91e63', fontWeight: 700 }}>คอนเสิร์ต</Button>
        </Box>

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {[
            ['คอนเสิร์ตทั้งหมด ณ ปัจจุบัน', `${data.summary.total_concerts} คอนเสิร์ต`, `${data.summary.concerts_this_month} คอนเสิร์ตภายในเดือนนี้`],
            ['งบประมาณที่ใช้ทั้งหมด', `${data.summary.total_budget.toLocaleString('th-TH')} บาท`, 'รวมจากแผนงานในฐานข้อมูล'],
            ['ภารกิจย่อยที่ยังไม่ลุล่วง', `${data.summary.incomplete_tasks} ภารกิจ`, `${data.summary.responsible_people} ผู้รับผิดชอบ`],
          ].map(([label, value, detail]) => <Grid size={{ xs: 12, md: 4 }} key={label}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}><CardContent>
              <Typography color="text.secondary">{label}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 28, my: 1 }}>{value}</Typography>
              <Typography color="text.secondary">{detail}</Typography>
            </CardContent></Card>
          </Grid>)}
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 28 }}>คอนเสิร์ต</Typography>
          <MuiLink component={Link} to="/concert-search" underline="none" sx={{ fontWeight: 700 }}>คอนเสิร์ตทั้งหมด →</MuiLink>
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {data.featured_concerts.map((concert) => <Grid size={{ xs: 12, md: 4 }} key={concert.concert_id}>
            <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#ffe0b2', display: 'flex', gap: 2, minHeight: 140 }} elevation={0}>
              <Box component="img" src={concert.poster_url} alt={concert.concert_name} sx={{ width: 95, height: 125, borderRadius: 2, objectFit: 'cover' }} />
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{concert.concert_name}</Typography>
                <Typography>{formatDate(concert.start_date)} – {formatDate(concert.end_date)}</Typography>
                <Typography>{concert.start_time}–{concert.end_time} น.</Typography>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 1 }}><LocationOnIcon color="error" fontSize="small" /><Typography sx={{ fontWeight: 700 }}>{concert.location}</Typography></Stack>
              </Box>
            </Paper>
          </Grid>)}
          {data.featured_concerts.length === 0 && <Grid size={{ xs: 12 }}><Alert severity="info">ยังไม่มีคอนเสิร์ตที่มีโปสเตอร์</Alert></Grid>}
        </Grid>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}><Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 25, mb: 2 }}>สถานะคอนเสิร์ต</Typography>
            <Stack spacing={1.25}>{data.concert_statuses.map((concert) => <Paper key={concert.concert_id} elevation={0} sx={{ p: 1.5, bgcolor: '#fafafa', display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Box><Typography sx={{ fontWeight: 700 }}>{concert.concert_name}</Typography><Typography color="text.secondary">{formatDate(concert.start_date)} · {concert.location}</Typography></Box>
              <Chip label={concert.status} size="small" />
            </Paper>)}</Stack>
          </Paper></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 25, mb: 2 }}>🤝 ผู้รับผิดชอบ</Typography>
            <Stack spacing={1.25}>{data.responsibilities.map((task) => <Paper key={task.task_id} elevation={0} sx={{ p: 1.5, bgcolor: '#f3eefb' }}>
              <Typography sx={{ fontWeight: 700 }}>{task.task_name}</Typography><Typography color="text.secondary">{task.concert_name}</Typography>
              <Typography>{task.owner || '-'} · {task.department || '-'}</Typography>
            </Paper>)}</Stack>
          </Paper></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 25, mb: 2 }}>🕘 อัปเดตข้อมูลล่าสุด</Typography>
            <Stack spacing={1}>{data.recent_updates.map((history) => <Box key={history.history_id} sx={{ pb: 1, borderBottom: '1px solid #eee' }}>
              <Typography sx={{ fontWeight: 700 }}>{history.description}</Typography><Typography color="text.secondary">{history.concert_name}</Typography>
              <Typography variant="caption">{formatDateTime(history.created_at)}</Typography>
            </Box>)}</Stack>
          </Paper></Grid>
        </Grid>
      </>}
    </Box>
  );
};

export default DashboardPage;
