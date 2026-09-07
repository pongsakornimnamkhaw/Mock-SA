import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Paper,
  Stack,
  Link as MuiLink
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddIcon from '@mui/icons-material/Add';
import { Link } from 'react-router-dom';
import NotificationBell from '@/components/Notification/NotificationBell';

import { flux, pulse, celestial } from '@/assets/Poster';

const DashboardPage = () => {
  return (
    <Box sx={{ p: 1, fontFamily: "'Noto Sans Thai', sans-serif" }}>
      {/* Top Search & Actions Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mb: 3 }}>
        <TextField
          placeholder="ค้นหาคอนเสิร์ต"
          variant="outlined"
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ backgroundColor: '#fff', borderRadius: 5, width: 280, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: '18px' } }}
        />

        <NotificationBell />

        <Button
          component={Link}
          to="/add-concert"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            background: 'linear-gradient(90deg, #e91e63, #d81b60)',
            borderRadius: 5,
            textTransform: 'none',
            px: 3,
            py: 0.8,
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: '0 4px 10px rgba(233, 30, 99, 0.3)',
            '&:hover': { background: 'linear-gradient(90deg, #d81b60, #c2185b)' },
          }}
        >
          คอนเสิร์ต
        </Button>
      </Box>

      {/* Stats Section (3 cards) */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Card 1 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: '#eee', bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ff5252', mr: 1 }} />
                <Typography color="text.secondary" sx={{ fontSize: '14px' }}>
                  คอนเสิร์ตทั้งหมด ณ ปัจจุบัน
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 'bold', color: '#1a1a2e', my: 0.5, fontSize: '28px' }}>
                12 คอนเสิร์ต
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: '14px' }}>
                4 คอนเสิร์ตภายในเดือนนี้
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: '#eee', bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#e91e63', mr: 1 }} />
                <Typography color="text.secondary" sx={{ fontSize: '14px' }}>
                  งบประมาณที่ใช้ทั้งหมด
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 'bold', color: '#1a1a2e', my: 0.5, fontSize: '28px' }}>
                ฿10.28M
              </Typography>
              <Box sx={{ height: 21 }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: '#eee', bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#7b1fa2', mr: 1 }} />
                <Typography color="text.secondary" sx={{ fontSize: '14px' }}>
                  ภารกิจย่อยที่ยังไม่ลุล่วง
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 'bold', color: '#1a1a2e', my: 0.5, fontSize: '28px' }}>
                4 ภารกิจ
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: '14px' }}>
                4 ผู้รับผิดชอบ
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Concert Cards Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: '28px' }}>
          คอนเสิร์ต
        </Typography>
        <MuiLink component={Link} to="/search-concert" sx={{ textDecoration: 'none', color: '#1a237e', fontWeight: 'bold', fontSize: '18px' }}>
          คอนเสิร์ตทั้งหมด →
        </MuiLink>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          {
            title: 'Neon Flux Festival 2024',
            date: '16-18 สิงหาคม 2569',
            time: '',
            venue: 'Metroplex Arena',
            poster: flux
          },
          {
            title: 'NEON PULSE',
            date: '28 ตุลาคม 2569',
            time: '',
            venue: 'THE Arena LONDON',
            poster: pulse
          },
          {
            title: 'Celestial Sounds',
            date: '26 ตุลาคม 2569',
            time: '20.00 - 23.00 น.',
            venue: 'THE Aurora Concert Hall',
            poster: celestial
          }
        ].map((concert, index) => (
          <Grid size={{ xs: 12, md: 4 }} key={index}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: '#ffe0b2',
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                minHeight: 140
              }}
            >
              {/* Poster Image */}
              <Box
                component="img"
                src={concert.poster}
                alt={concert.title}
                sx={{
                  width: 95,
                  height: 125,
                  borderRadius: 2,
                  objectFit: 'cover',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  flexShrink: 0
                }}
              />

              {/* Concert Info */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, flexGrow: 1 }}>
                <Typography sx={{ fontSize: '18px' }}>
                  <strong>ชื่องาน:</strong> <strong>{concert.title}</strong>
                </Typography>
                <Typography sx={{ fontSize: '18px' }}>
                  <strong>วันที่จัด:</strong> <strong>{concert.date}</strong>
                </Typography>
                <Typography sx={{ fontSize: '18px' }}>
                  <strong>เวลา:</strong> {concert.time ? <strong>{concert.time}</strong> : ''}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <LocationOnIcon fontSize="small" sx={{ color: '#d32f2f', mr: 0.3, fontSize: '20px' }} />
                  <Typography sx={{ fontWeight: 'bold', fontSize: '18px' }}>
                    {concert.venue}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Bottom 3 Columns */}
      <Grid container spacing={2.5}>
        {/* Column 1: สถานะคอนเสิร์ต */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: '#eee', bgcolor: '#fff', height: '100%' }}>
            <Typography sx={{ fontWeight: 'bold', mb: 2, color: '#1a1a2e', fontSize: '28px' }}>
              สถานะคอนเสิร์ต
            </Typography>

            <Stack spacing={1.5}>
              {[
                { name: 'Riverside Sound Festival', info: '16 พ.ย. 2569 · อิมแพ็ค อารีน่า', badge: 'ยืนยันแล้ว', bg: '#e8f5e9', text: '#2e7d32' },
                { name: 'Neon Nights Vol.3', info: '2 ธ.ค. 2569 · MCC Hall', badge: 'เลื่อนการจัด', bg: '#f3e5f5', text: '#7b1fa2' },
                { name: 'Acoustic Sessions: Bangkok', info: '14 ธ.ค. 2569 · Lido Connect', badge: 'ยกเลิกการจัด', bg: '#ffebee', text: '#c62828' },
                { name: 'New Year Countdown Live', info: '31 ธ.ค. 2569 · CentralWorld Live', badge: 'วางแผน', bg: '#fff9c4', text: '#f57f17' },
                { name: 'เชียงใหญ่เฟส ครั้งที่ 20', info: '28-29 พ.ย. 2569 · บ้านสวนรถไฟรีสอร์ท จ.เชียงใหม่', badge: 'วางแผน', bg: '#fff9c4', text: '#f57f17' }
              ].map((row, index) => (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: '#fafafa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '18px' }}>
                      {row.name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: '14px' }}>
                      {row.info}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.4,
                      borderRadius: 4,
                      bgcolor: row.bg,
                      color: row.text,
                      fontSize: '14px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {row.badge}
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Column 2: ผู้รับผิดชอบ */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: '#eee', bgcolor: '#fff', height: '100%' }}>
            <Typography sx={{ fontWeight: 'bold', mb: 2, color: '#1a1a2e', fontSize: '28px' }}>
              🤝 ผู้รับผิดชอบ
            </Typography>

            <Stack spacing={1.5}>
              {[
                {
                  task: 'ดำเนินการเอกสารเข้าพื้นที่',
                  concert: 'Riverside Sound Festival',
                  person: 'พิเชษฐ์',
                  role: 'ฝ่ายสถานที่',
                  bgColor: '#ede7f6'
                },
                {
                  task: 'ติดต่อกับผู้สนับสนุน',
                  concert: 'Riverside Sound Festival',
                  person: 'พรลภัส',
                  role: 'ผู้จัดงาน',
                  bgColor: '#e8f5e9'
                },
                {
                  task: 'จัดหาเครื่องเสียงใช้ในงาน',
                  concert: 'Neon Nights Vol.3',
                  person: 'นพรัตน์',
                  role: 'ฝ่าย Production',
                  bgColor: '#fff3e0'
                },
                {
                  task: 'วางผังที่นั่งจองบัตรคอนเสิร์ต',
                  concert: 'New Year Countdown Live',
                  person: 'ศิรินภา',
                  role: 'ฝ่าย Sell',
                  bgColor: '#fce4ec'
                }
              ].map((item, index) => (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{
                    p: 1.8,
                    borderRadius: 2,
                    bgcolor: item.bgColor,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '18px', color: '#1a1a2e' }}>
                      {item.task}
                    </Typography>
                    <Typography sx={{ opacity: 0.8, fontSize: '14px', color: '#555' }}>
                      {item.concert}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '18px', color: '#1a1a2e' }}>
                      {item.person}
                    </Typography>
                    <Typography sx={{ opacity: 0.8, fontSize: '14px', color: '#555' }}>
                      {item.role}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Column 3: อัพเดตข้อมูลล่าสุด */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: '#eee', bgcolor: '#fff', height: '100%' }}>
            <Typography sx={{ fontWeight: 'bold', mb: 2, color: '#1a1a2e', fontSize: '28px' }}>
              🕐 อัพเดตข้อมูลล่าสุด
            </Typography>

            <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #eee' }}>
              <Grid container>
                <Grid size={{ xs: 6 }} sx={{ bgcolor: '#ffe0b2', p: 1.2, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 'bold', color: '#333', fontSize: '18px' }}>
                    วันที่และเวลา
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }} sx={{ bgcolor: '#ffcdd2', p: 1.2, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 'bold', color: '#333', fontSize: '18px' }}>
                    การเปลี่ยนแปลง
                  </Typography>
                </Grid>
              </Grid>

              {[
                { datetime: '22/07/69 17.28 น.', change: 'สถานที่จัดงาน' },
                { datetime: '22/07/69 13.15 น.', change: 'การติดต่อผู้สนับสนุน' }
              ].map((row, index) => (
                <Grid container key={index} sx={{ borderTop: '1px solid #eee', bgcolor: '#fff' }}>
                  <Grid size={{ xs: 6 }} sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '18px' }}>
                      {row.datetime}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }} sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '18px' }}>
                      {row.change}
                    </Typography>
                  </Grid>
                </Grid>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
