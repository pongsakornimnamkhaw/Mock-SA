import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Grid,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import { concertApi, ConcertData } from '@/api/concertApi';

const ConcertStatusPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [concertId, setConcertId] = useState('');
  const [status, setStatus] = useState('วางแผน');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConcerts();
  }, []);

  const loadConcerts = async () => {
    try {
      const data = await concertApi.getConcerts();
      setConcerts(data);
      if (data.length > 0 && !concertId) {
        handleSelectConcert(data[0].concert_id, data);
      }
    } catch (err) {
      console.error('Failed to load concerts:', err);
    }
  };

  const handleSelectConcert = async (id: string, currentList = concerts) => {
    setConcertId(id);
    if (!id) return;

    try {
      const c = await concertApi.getConcert(id);
      if (c) {
        setStartDate(c.start_date ? dayjs(c.start_date) : null);
        setEndDate(c.end_date ? dayjs(c.end_date) : null);
        setStartTime(c.start_time || '');
        setEndTime(c.end_time || '');
        setLocation(c.location || '');
        setStatus(c.status || 'วางแผน');
      }
    } catch {
      const c = currentList.find((item) => item.concert_id === id);
      if (c) {
        setStartDate(c.start_date ? dayjs(c.start_date) : null);
        setEndDate(c.end_date ? dayjs(c.end_date) : null);
        setStartTime(c.start_time || '');
        setEndTime(c.end_time || '');
        setLocation(c.location || '');
        setStatus(c.status || 'วางแผน');
      }
    }
  };

  const handleSave = async () => {
    if (!concertId || !status) {
      alert("บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง");
      return;
    }

    try {
      setLoading(true);
      await concertApi.updateStatus(concertId, status);
      alert("บันทึกข้อมูลสำเร็จ");
      loadConcerts();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + (err.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (concertId) {
      handleSelectConcert(concertId);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ fontWeight: 'bold', color: '#1a237e', mb: 3, fontSize: '38px' }}>
        สถานะคอนเสิร์ต
      </Typography>

      <Box sx={{ p: 4, bgcolor: '#ede7f6', borderRadius: 3 }}>
        <Grid container spacing={2.5} sx={{ alignItems: 'flex-start' }}>
          {/* ชื่อคอนเสิร์ต */}
          <Grid size={{ xs: 12, sm: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              ชื่อคอนเสิร์ต
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10.5 }}>
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={concertId}
                onChange={(e) => handleSelectConcert(e.target.value as string)}
                sx={{ bgcolor: 'white', borderRadius: 1, fontSize: '20px' }}
              >
                <MenuItem value="" disabled sx={{ fontSize: '22px' }}>โปรดระบุชื่อคอนเสิร์ต</MenuItem>
                {concerts.map((c) => (
                  <MenuItem key={c.concert_id} value={c.concert_id} sx={{ fontSize: '20px' }}>
                    {c.concert_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* วัน/เดือน/ปี + เวลา */}
          <Grid size={{ xs: 12, sm: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              วัน/เดือน/ปี
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DatePicker
                format="DD/MM/YYYY"
                value={startDate}
                readOnly
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
              <Typography sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '18px' }}>ถึง</Typography>
              <DatePicker
                format="DD/MM/YYYY"
                value={endDate}
                readOnly
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              เวลา
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField size="small" value={startTime} slotProps={{ input: { readOnly: true } }} sx={{ bgcolor: 'white', borderRadius: 1, width: 140 }} />
              <Typography sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '18px' }}>ถึง</Typography>
              <TextField size="small" value={endTime} slotProps={{ input: { readOnly: true } }} sx={{ bgcolor: 'white', borderRadius: 1, width: 140 }} />
            </Box>
          </Grid>

          {/* สถานที่ */}
          <Grid size={{ xs: 12, sm: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              สถานที่
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10.5 }}>
            <TextField fullWidth size="small" value={location} slotProps={{ input: { readOnly: true } }} sx={{ bgcolor: 'white', borderRadius: 1 }} />
          </Grid>

          {/* สถานะ - vertical radio */}
          <Grid
            size={{ xs: 12, sm: 1.2 }}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              pt: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              สถานะ
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10.5 }}>
            <RadioGroup value={status} onChange={(e) => setStatus(e.target.value)}>
              <FormControlLabel value="วางแผน" control={<Radio />} label={<Typography sx={{ fontSize: '22px' }}>วางแผน</Typography>} />
              <FormControlLabel value="ยืนยันแล้ว" control={<Radio />} label={<Typography sx={{ fontSize: '22px' }}>ยืนยันแล้ว</Typography>} />
              <FormControlLabel value="เลื่อนการจัด" control={<Radio />} label={<Typography sx={{ fontSize: '22px' }}>เลื่อนการจัด</Typography>} />
              <FormControlLabel value="ยกเลิกการจัด" control={<Radio />} label={<Typography sx={{ fontSize: '22px' }}>ยกเลิกการจัด</Typography>} />
            </RadioGroup>
          </Grid>
        </Grid>

        {/* Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
          <Button onClick={handleCancel} disabled={loading} variant="contained" sx={{ bgcolor: '#ef5350', '&:hover': { bgcolor: '#d32f2f' }, px: 4, borderRadius: 1, textTransform: 'none', fontSize: '22px' }}>
            ยกเลิก
          </Button>
          <Button onClick={handleSave} disabled={loading} variant="contained" sx={{ bgcolor: '#47921E', '&:hover': { bgcolor: '#388e3c' }, px: 4, borderRadius: 1, textTransform: 'none', fontSize: '22px' }}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกสถานะ'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ConcertStatusPage;
