import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { artistApi, type ArtistData } from '@/api/artistApi';
import type { PerformanceScheduleData } from '@/api/artistApi';
import { concertApi, type ConcertData } from '@/api/concertApi';

const PerformanceDetailPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [concert, setConcert] = useState('');
  const [schedules, setSchedules] = useState<PerformanceScheduleData[]>([]);
  const [scheduleId, setScheduleId] = useState('');
  const [artist, setArtist] = useState('');
  const [detail, setDetail] = useState('');
  const [stageInfo, setStageInfo] = useState('');
  const [soundCheck, setSoundCheck] = useState('');
  const [artists, setArtists] = useState<ArtistData[]>([]);
  useEffect(() => {
    Promise.all([concertApi.getConcerts(), artistApi.getArtists()])
      .then(([concertItems, artistItems]) => { setConcerts(concertItems); setArtists(artistItems); })
      .catch((error) => alert(error.message));
  }, []);

  useEffect(() => {
    setScheduleId('');
    setArtist('');
    setSchedules([]);
    if (!concert) return;
    artistApi.getSchedules(concert)
      .then(setSchedules)
      .catch((error) => alert(error.message));
  }, [concert]);

  const handleScheduleChange = (id: string) => {
    setScheduleId(id);
    const selected = schedules.find((item) => item.schedule_id === id);
    setArtist(selected?.artist_id || '');
  };

  const handleSave = async () => {
    if (!concert || !scheduleId || !artist || !detail || !stageInfo || !soundCheck) {
      alert('บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง');
    } else {
      try { await artistApi.createPerformanceDetail({ schedule_id: scheduleId, artist_id: artist, performance_details: detail, stage_info: stageInfo, sound_check_info: soundCheck }); handleCancel(); alert('บันทึกข้อมูลสำเร็จ'); } catch (error) { alert(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    }
  };

  const handleCancel = () => {
    setConcert('');
    setScheduleId('');
    setSchedules([]);
    setArtist('');
    setDetail('');
    setStageInfo('');
    setSoundCheck('');
  };


  return (
    <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai'" }}>
      <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e', mb: 3 }}>
        รายละเอียดการแสดง
      </Typography>

      <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#dee0f4' }}>
        <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
          <Grid size={{ xs: 12, sm: 2.15 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
              ชื่อคอนเสิร์ต<Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.35 }}>
            <FormControl fullWidth size="small">
              <Select value={concert} onChange={(e) => setConcert(e.target.value)} displayEmpty sx={{ fontSize: '22px', bgcolor: 'white', borderRadius: 1 }}>
                <MenuItem value="" disabled>โปรดระบุคอนเสิร์ต</MenuItem>
                {concerts.map((item) => <MenuItem key={item.concert_id} value={item.concert_id}>{item.concert_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 2.15 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
              เวลาการแสดง<Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.35 }}>
            <FormControl fullWidth size="small" disabled={!concert || schedules.length === 0}>
              <Select value={scheduleId} onChange={(e) => handleScheduleChange(e.target.value)} displayEmpty sx={{ fontSize: '22px', bgcolor: 'white', borderRadius: 1 }}>
                <MenuItem value="" disabled>{!concert ? 'กรุณาเลือกคอนเสิร์ตก่อน' : schedules.length === 0 ? 'คอนเสิร์ตนี้ยังไม่มีตารางการแสดง' : 'โปรดระบุช่วงเวลาการแสดง'}</MenuItem>
                {schedules.map((item) => {
                  const artistName = artists.find((artistItem) => artistItem.artist_id === item.artist_id)?.artist_name || 'ไม่ระบุศิลปิน';
                  return <MenuItem key={item.schedule_id} value={item.schedule_id}>{item.show_date} | {item.start_show.slice(0, 5)}–{item.end_show.slice(0, 5)} | {artistName} | {item.details}</MenuItem>;
                })}
              </Select>
            </FormControl>
          </Grid>

          {/* ศิลปิน */}
          <Grid size={{ xs: 12, sm: 2.15 }}>
             <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ชื่อศิลปิน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.35 }}>
            <FormControl fullWidth size="small">
              <Select
                value={artist}
                displayEmpty
                disabled
                sx={{fontSize: '22px', bgcolor: 'white', borderRadius: 1 }}
              >
                <MenuItem value="" disabled>ศิลปินจะกำหนดตามตารางการแสดง</MenuItem>
                {artists.map((item) => <MenuItem key={item.artist_id} value={item.artist_id}>{item.artist_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {/* รายละเอียดการแสดง */}
          <Grid size={{ xs: 12, sm: 2.15 }}>
             <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              รายละเอียดการแสดง
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.35}}>
            <TextField
              fullWidth
              multiline
              rows={5}
              placeholder="ระบุรายละเอียด"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>

          {/* ข้อมูลเวที */}
          <Grid size={{ xs: 12, sm: 2.15 }}>
             <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ข้อมูลเวที
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.35 }}>
            <TextField
              fullWidth
              multiline
              rows={5}
              placeholder="ระบุรายละเอียด"
              value={stageInfo}
              onChange={(e) => setStageInfo(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>

          {/* ข้อมูล Sound Check */}
          <Grid size={{ xs: 12, sm: 2.15 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ข้อมูล Sound Check
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.5 }}>
            <TextField
              fullWidth
              multiline
              rows={5}
              placeholder="ระบุรายละเอียด"
              value={soundCheck}
              onChange={(e) => setSoundCheck(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
          <Button
            variant="contained"
            onClick={handleCancel}
            sx={{
              backgroundColor: '#ef5350',
              '&:hover': { backgroundColor: '#d32f2f' },
              px: 4,
              py: 1,
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '22px'
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            sx={{
              backgroundColor: '#47921E',
              '&:hover': { backgroundColor: '#388e3c' },
              px: 4,
              py: 1,
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '22px'
            }}
          >
            บันทึกข้อมูล
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default PerformanceDetailPage;
