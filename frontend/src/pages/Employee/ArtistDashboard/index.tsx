import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, TextField, InputAdornment, Paper, Stack, Link as MuiLink } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { Link } from 'react-router-dom';
import NotificationBell from '@/components/Notification/NotificationBell';
import { flux, pulse, celestial } from '@/assets/Poster';
import { artistApi } from '@/api/artistApi';

const ArtistDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<any>({ artist_count: 0, schedule_count: 0, requirement_count: 0, invitations: [], history: [] });
  useEffect(() => { artistApi.getDashboard().then(setSummary).catch(console.error); }, []);
  return (
    <Box sx={{ p: 3, bgcolor: '#f8f9fa', minHeight: '100vh', fontFamily: "'Noto Sans Thai', 'Inter', sans-serif" }}>
      {/* Header section with Search, Notifications and Action Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 4, gap: 2 }}>
        <TextField
          placeholder="ค้นหาข้อมูลศิลปิน หรือตารางการแสดง"
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: 5, bgcolor: '#fff', width: '300px' }
            }
          }}
        />
        <NotificationBell />
        <Button
          component={Link}
          to="/performance-schedule"
          variant="contained"
          sx={{
            background: 'linear-gradient(to right, #e91e63, #ab47bc)',
            color: 'white',
            borderRadius: '20px',
            textTransform: 'none',
            px: 3,
            py: 1,
            fontWeight: 'bold',
            fontSize: '16px',
            fontFamily: "'Noto Sans Thai', sans-serif"
          }}
        >
          + ตารางการแสดง
        </Button>
      </Box>

      {/* Summary Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { color: '#ef5350', title: 'ตารางการแสดงทั้งหมด', main: `${summary.schedule_count} ตารางงาน`, sub: 'ข้อมูลจากฐานข้อมูล' },
          { color: '#e91e63', title: 'ศิลปินที่เข้าร่วมทั้งหมด', main: `${summary.artist_count} ท่าน`, sub: 'ข้อมูลจากฐานข้อมูล' },
          { color: '#9c27b0', title: 'ความต้องการของศิลปิน', main: `${summary.requirement_count} ความต้องการ`, sub: 'ข้อมูลจากฐานข้อมูล' }
        ].map((stat, idx) => (
          <Grid size={{ xs: 12, md: 4 }} key={idx}>
            <Card variant="outlined" sx={{ borderRadius: 3, borderColor: '#eee', bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: stat.color }} />
                  <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                    {stat.title}
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a1a2e', mb: 1, fontSize: '28px' }}>
                  {stat.main}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
                  {stat.sub}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Concerts Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: '28px' }}>
          คอนเสิร์ต
        </Typography>
        <MuiLink component={Link} to="/search-concert" sx={{ textDecoration: 'none', color: '#1a237e', fontWeight: 'bold' }}>
          คอนเสิร์ตทั้งหมด →
        </MuiLink>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { image: flux, title: 'Neon Flux Festival 2024', date: '16-18 สิงหาคม 2569', venue: 'Metroplex Arena' },
          { image: pulse, title: 'NEON PULSE', date: '28 ตุลาคม 2569', venue: 'THE Arena LONDON' },
          { image: celestial, title: 'Celestial Sounds', date: '26 ตุลาคม 2569', time: '20.00-23.00 น.', venue: 'THE Aurora Concert Hall' }
        ].map((concert, idx) => (
          <Grid size={{ xs: 12, md: 4 }} key={idx}>
            <Paper elevation={0} sx={{ bgcolor: '#ffe0b2', borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box
                  component="img"
                  src={concert.image}
                  alt={concert.title}
                  sx={{ width: 100, height: 140, objectFit: 'cover', borderRadius: 2 }}
                />
                <Box>
                  <Typography sx={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: '18px', mb: 1 }}>
                    {concert.title}
                  </Typography>
                  <Typography sx={{ color: '#d84315', fontSize: '14px', mb: 0.5 }}>
                    {concert.date}
                  </Typography>
                  {concert.time && (
                    <Typography sx={{ color: '#d84315', fontSize: '14px', mb: 0.5 }}>
                      {concert.time}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#e65100' }}>
                    <LocationOnIcon sx={{ fontSize: 16 }} />
                    <Typography sx={{ fontSize: '14px' }}>{concert.venue}</Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Bottom 3 Columns */}
      <Grid container spacing={3}>
        {/* Artist Invitation Status */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, height: '100%', bgcolor: '#d1e8ff' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a1a2e', mb: 2 }}>
              สถานะคำเชิญของศิลปิน
            </Typography>
            <Stack spacing={1.5}>
              {(summary.invitations || []).map((item: any, idx: number) => {
                const artist = { name: item.artist_name, status: item.status, bg: item.status === 'เข้าร่วม' ? '#e8f5e9' : item.status === 'ปฏิเสธ' ? '#fce4ec' : '#fff3e0', color: item.status === 'เข้าร่วม' ? '#2e7d32' : item.status === 'ปฏิเสธ' ? '#c62828' : '#e65100' };
                return (
                <Paper key={idx} elevation={0} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, px: 2, borderRadius: 2, bgcolor: 'white' }}>
                  <Typography sx={{ fontSize: '18px', fontWeight: 'bold' }}>{artist.name}</Typography>
                  <Box sx={{ bgcolor: artist.bg, color: artist.color, px: 2, py: 0.5, borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
                    {artist.status}
                  </Box>
                </Paper>
              );})}
            </Stack>
          </Paper>
        </Grid>

        {/* Performance Details */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, height: '100%', bgcolor: '#c8e6c9' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a1a2e', mb: 2 }}>
              รายละเอียดการแสดง
            </Typography>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'white' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '18px', mb: 1, borderBottom: '1px solid #eee', pb: 1 }}>PUN</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '18px' }}>
                <Typography component="li" sx={{ fontSize: '18px', mb: 0.5 }}>แสดง 1 ชม.</Typography>
                <Typography component="li" sx={{ fontSize: '18px', mb: 0.5 }}>มีช่วงเวลาพักให้ผู้ชม</Typography>
                <Typography component="li" sx={{ fontSize: '18px', mb: 0.5 }}>เน้นไฟสีขาว</Typography>
                <Typography component="li" sx={{ fontSize: '18px', mb: 0.5 }}>มีทีมงานของตัวเองมา 7 คน</Typography>
              </Box>
            </Paper>
          </Paper>
        </Grid>

        {/* Latest Updates */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%', borderColor: '#eee', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a1a2e', mb: 2 }}>
              ⏰ อัพเดตข้อมูลล่าสุด
            </Typography>
            <Box sx={{ display: 'flex', bgcolor: '#ffe0b2', p: 1, borderRadius: '8px 8px 0 0', fontWeight: 'bold', color: '#1a1a2e' }}>
              <Box sx={{ flex: 1, px: 1 }}>วันที่และเวลา</Box>
              <Box sx={{ flex: 1, px: 1, bgcolor: '#ffcdd2', m: -1, p: 1, borderRadius: '0 8px 0 0' }}>การเปลี่ยนแปลง</Box>
            </Box>
            <Box sx={{ display: 'flex', p: 1.5, borderBottom: '1px solid #eee' }}>
              <Box sx={{ flex: 1, fontSize: '14px' }}>22/07/69 15.33 น.</Box>
              <Box sx={{ flex: 1, fontSize: '14px', fontWeight: 'bold' }}>ตารางการแสดง</Box>
            </Box>
            <Box sx={{ display: 'flex', p: 1.5 }}>
              <Box sx={{ flex: 1, fontSize: '14px' }}>22/07/69 13.15 น.</Box>
              <Box sx={{ flex: 1, fontSize: '14px', fontWeight: 'bold' }}>ความต้องการของศิลปิน</Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ArtistDashboardPage;
