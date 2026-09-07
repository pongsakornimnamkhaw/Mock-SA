import { useState, useEffect } from 'react';
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
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import { concertApi, ConcertData } from '@/api/concertApi';
import { artistApi, type ArtistData } from '@/api/artistApi';
import { concertDateOptions, validateScheduleRows } from '@/utils/scheduleRules';

const ArtistRequirementsPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [concert, setConcert] = useState('');
  const [date, setDate] = useState<Dayjs | null>(null);
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [artist, setArtist] = useState('');
  const [requirements, setRequirements] = useState('');
  const [artists, setArtists] = useState<ArtistData[]>([]);

  useEffect(() => {
    loadConcerts();
    artistApi.getArtists().then(setArtists).catch(console.error);
  }, []);

  const loadConcerts = async () => {
    try {
      const list = await concertApi.getConcerts();
      setConcerts(list);
      if (list.length > 0 && !concert) {
        setConcert(list[0].concert_name);
      }
    } catch (err) {
      console.error('Failed to load concerts:', err);
    }
  };

  useEffect(() => {
    const selected = concerts.find((item) => item.concert_name === concert);
    if (!selected) { setDate(null); setStartTime(null); setEndTime(null); return; }
    setDate(dayjs(selected.start_date));
    setStartTime(null);
    setEndTime(null);
  }, [concert, concerts]);

  const handleSave = async () => {
    const selected = concerts.find((item) => item.concert_name === concert);
    if (!selected || !date || !startTime || !endTime || !artist || !requirements) {
      alert('บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง');
    } else {
      const validationError = validateScheduleRows([{ startTime: startTime.format('HH:mm:ss'), endTime: endTime.format('HH:mm:ss') }], selected.start_time, selected.end_time);
      if (validationError) { alert(validationError.replace('ลำดับที่ 1', 'ช่วงความต้องการของศิลปิน')); return; }
      try { await artistApi.createRequirement({ concert_id: selected.concert_id, artist_id: artist, req_date: date.format('YYYY-MM-DD'), start_req: startTime.format('HH:mm:ss'), end_req: endTime.format('HH:mm:ss'), requirement: requirements }); handleCancel(); alert('บันทึกข้อมูลสำเร็จ'); } catch (error) { alert(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    }
  };

  const handleCancel = () => {
    setConcert('');
    setDate(null);
    setStartTime(null);
    setEndTime(null);
    setArtist('');
    setRequirements('');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai', 'Inter', sans-serif" }}>
        <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e', mb: 3 }}>
          ความต้องการของศิลปิน
        </Typography>

        <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#b2dfdb' }}>
          <Grid container spacing={2.5} sx={{ alignItems: 'center', mb: 3 }}>
            {/* ชื่อคอนเสิร์ต */}
            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
                ชื่อคอนเสิร์ต
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10 }}>
              <FormControl fullWidth size="small">
                <Select
                  value={concert}
                  onChange={(e) => setConcert(e.target.value)}
                  displayEmpty
                  sx={{ bgcolor: 'white', borderRadius: 1 }}
                >
                  <MenuItem value="" disabled>โปรดระบุคอนเสิร์ต</MenuItem>
                  {concerts.map((c) => (
                    <MenuItem key={c.concert_id} value={c.concert_name}>
                      {c.concert_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* วัน/เดือน/ปี & เวลา */}
            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
                วัน/เดือน/ปี
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <Select value={date?.format('YYYY-MM-DD') || ''} onChange={(event) => setDate(dayjs(event.target.value))} displayEmpty sx={{ bgcolor: 'white', borderRadius: 1 }}>
                  <MenuItem value="" disabled>เลือกวันที่จัดคอนเสิร์ต</MenuItem>
                  {concertDateOptions(concerts.find((item) => item.concert_name === concert)?.start_date, concerts.find((item) => item.concert_name === concert)?.end_date).map((option) => <MenuItem key={option.format('YYYY-MM-DD')} value={option.format('YYYY-MM-DD')}>{option.format('DD/MM/YYYY')}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
                เวลา
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.25 }}>
              <TimePicker
                ampm={false}
                format="HH:mm"
                value={startTime}
                minTime={dayjs().hour(Number((concerts.find((item) => item.concert_name === concert)?.start_time || '00:00').slice(0, 2))).minute(Number((concerts.find((item) => item.concert_name === concert)?.start_time || '00:00').slice(3, 5)))}
                maxTime={dayjs().hour(Number((concerts.find((item) => item.concert_name === concert)?.end_time || '23:59').slice(0, 2))).minute(Number((concerts.find((item) => item.concert_name === concert)?.end_time || '23:59').slice(3, 5)))}
                onChange={(newValue) => setStartTime(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 0.5 }} sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
                ถึง
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.25 }}>
              <TimePicker
                ampm={false}
                format="HH:mm"
                value={endTime}
                minTime={dayjs().hour(Number((concerts.find((item) => item.concert_name === concert)?.start_time || '00:00').slice(0, 2))).minute(Number((concerts.find((item) => item.concert_name === concert)?.start_time || '00:00').slice(3, 5)))}
                maxTime={dayjs().hour(Number((concerts.find((item) => item.concert_name === concert)?.end_time || '23:59').slice(0, 2))).minute(Number((concerts.find((item) => item.concert_name === concert)?.end_time || '23:59').slice(3, 5)))}
                onChange={(newValue) => setEndTime(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
            </Grid>

            {/* ศิลปิน */}
            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
                ศิลปิน
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10 }}>
              <FormControl fullWidth size="small">
                <Select value={artist} onChange={(e) => setArtist(e.target.value)} displayEmpty sx={{ bgcolor: 'white', borderRadius: 1 }}>
                  <MenuItem value="" disabled>โปรดระบุศิลปิน</MenuItem>
                  {artists.map((item) => <MenuItem key={item.artist_id} value={item.artist_id}>{item.artist_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {/* ความต้องการ */}
            <Grid size={{ xs: 12, sm: 1.5 }} sx={{ alignSelf: 'flex-start' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', pt: 1 }}>
                ความต้องการ
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="ระบุความต้องการของศิลปิน เช่น เครื่องดนตรี, อาหาร, เครื่องดื่ม, ห้องพัก"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>
          </Grid>

          {/* Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleCancel}
              sx={{ bgcolor: '#ef5350', '&:hover': { bgcolor: '#d32f2f' }, borderRadius: 1, px: 3, fontSize: '20px' }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' }, borderRadius: 1, px: 3, fontSize: '20px' }}
            >
              บันทึกข้อมูล
            </Button>
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default ArtistRequirementsPage;
