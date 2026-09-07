import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

import { concertApi, ConcertData } from '@/api/concertApi';
import { artistApi, type ArtistData } from '@/api/artistApi';
import { concertDateOptions, validateScheduleRows } from '@/utils/scheduleRules';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';

export interface ScheduleRow {
  id: number | string;
  seq: number;
  detail: string;
  artist: string;
  startTime: string;
  endTime: string;
}

const parseTimeString = (timeStr?: string): Dayjs | null => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return dayjs().hour(hours).minute(minutes).second(0);
    }
  }
  return null;
};

const EditPerformancePage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [artists, setArtists] = useState<ArtistData[]>([]);
  // Form states
  const [concert, setConcert] = useState('');
  const [date, setDate] = useState<Dayjs | null>(null);
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  
  // Table rows starts empty (only headers initially)
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    if (concert) {
      const found = concerts.find((c) => c.concert_name === concert);
      if (found) {
        setDate(found.start_date ? dayjs(found.start_date) : dayjs('2026-10-16'));
        setStartTime(parseTimeString(found.start_time || '18:00'));
        setEndTime(parseTimeString(found.end_time || '23:30'));
      } else {
        setDate(dayjs('2026-10-16'));
        setStartTime(parseTimeString('18:00'));
        setEndTime(parseTimeString('23:00'));
      }
      if (!found) setRows([]);
    }
  }, [concert, concerts]);

  useEffect(() => {
    const found = concerts.find((item) => item.concert_name === concert);
    if (!found || !date) { setRows([]); return; }
    artistApi.getSchedules(found.concert_id, date.format('YYYY-MM-DD')).then((items) => setRows(items.map((item) => ({ id: item.schedule_id || item.performance_order, seq: item.performance_order, detail: item.details, artist: item.artist_id, startTime: item.start_show, endTime: item.end_show })))).catch(console.error);
  }, [concert, date, concerts]);

  const handleAddRow = () => {
    const newRow: ScheduleRow = {
      id: Date.now(),
      seq: rows.length + 1,
      detail: '',
      artist: '',
      startTime: '',
      endTime: '',
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (indexToRemove: number) => {
    setRows((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((row, idx) => ({ ...row, seq: idx + 1 }))
    );
  };

  const handleRowChange = (index: number, field: keyof ScheduleRow, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const saveSchedule = async () => {
    const selected = concerts.find((item) => item.concert_name === concert);
    if (!selected || !date) return;
    try {
      setDeleting(rows.length === 0);
      await artistApi.saveSchedules(selected.concert_id, rows.map((row) => ({ performance_order: row.seq, details: row.detail, artist_id: row.artist, start_show: row.startTime, end_show: row.endTime, show_date: date.format('YYYY-MM-DD') })), date.format('YYYY-MM-DD'));
      alert(rows.length === 0 ? 'ลบข้อมูลจากฐานข้อมูลสำเร็จ' : 'อัพเดตข้อมูลสำเร็จ');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'อัปเดตไม่สำเร็จ');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleUpdate = () => {
    const selected = concerts.find((item) => item.concert_name === concert);
    if (!selected || !date || !startTime || !endTime || rows.some((row) => !row.detail || !row.artist || !row.startTime || !row.endTime)) {
      alert('บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง');
    } else {
      const validationError = validateScheduleRows(rows, selected.start_time, selected.end_time);
      if (validationError) { alert(validationError); return; }
      if (rows.length === 0) {
        setDeleteDialogOpen(true);
        return;
      }
      void saveSchedule();
    }
  };

  const handleCancel = () => {
    setConcert('');
    setDate(null);
    setStartTime(null);
    setEndTime(null);
    setRows([]);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai', 'Inter', sans-serif" }}>
        <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e', mb: 3 }}>
          แก้ไขกำหนดการแสดง
        </Typography>

        <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#b2dfdb' }}>
          <Grid container spacing={2.5} sx={{ alignItems: 'center', mb: 3 }}>
            {/* ชื่อคอนเสิร์ต */}
            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
                ชื่อคอนเสิร์ต
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10.5 }}>
              <FormControl fullWidth size="small">
                <Select
                  value={concert}
                  onChange={(e) => setConcert(e.target.value)}
                  displayEmpty
                  sx={{ bgcolor: 'white', borderRadius: 1 }}
                >
                  <MenuItem value="" disabled>เลือกคอนเสิร์ต</MenuItem>
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
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
                วัน/เดือน/ปี
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
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
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
                เวลา
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.25 }}>
              <TimePicker
                ampm={false}
                format="HH:mm"
                value={startTime}
                readOnly
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
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
                ถึง
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 2.25 }}>
              <TimePicker
                ampm={false}
                format="HH:mm"
                value={endTime}
                readOnly
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
            </Grid>
          </Grid>

          {/* Performance Schedule Table */}
          <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden', mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#4caf50' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '20px', width: '8%', textAlign: 'center' }}>ลำดับ</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '20px', width: '30%', textAlign: 'center' }}>รายละเอียดการแสดง</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '20px', width: '22%', textAlign: 'center' }}>ชื่อศิลปิน</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '20px', width: '15%', textAlign: 'center' }}>เวลาเริ่ม</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '20px', width: '15%', textAlign: 'center' }}>เวลาสิ้นสุด</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '20px', width: '10%', textAlign: 'center' }}>
                    <Tooltip title="เพิ่มแถวใหม่">
                      <IconButton
                        onClick={handleAddRow}
                        size="small"
                        sx={{
                          bgcolor: 'white',
                          color: '#4caf50',
                          '&:hover': { bgcolor: '#e8f5e9' },
                          width: 28,
                          height: 28
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ bgcolor: '#f1f8e9' }}>
                {rows.length > 0 ? (
                  rows.map((row, index) => (
                    <TableRow key={row.id} sx={{ '&:nth-of-type(even)': { bgcolor: '#ffffff' } }}>
                      <TableCell sx={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', borderRight: '1px solid #eee' }}>
                        {row.seq}
                      </TableCell>
                      <TableCell sx={{ borderRight: '1px solid #eee' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="ระบุรายละเอียด"
                          value={row.detail}
                          onChange={(e) => handleRowChange(index, 'detail', e.target.value)}
                          sx={{ '& .MuiInputBase-input': { fontSize: '18px' } }}
                        />
                      </TableCell>
                      <TableCell sx={{ borderRight: '1px solid #eee' }}>
                        <FormControl fullWidth size="small">
                          <Select
                            displayEmpty
                            value={row.artist}
                            onChange={(e) => handleRowChange(index, 'artist', e.target.value)}
                            sx={{ fontSize: '18px' }}
                          >
                            <MenuItem value="" disabled>เลือกศิลปิน</MenuItem>
                            {artists.map((artist) => (
                              <MenuItem key={artist.artist_id} value={artist.artist_id} sx={{ fontSize: '18px' }}>
                                {artist.artist_name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={{ borderRight: '1px solid #eee' }}>
                        <TimePicker
                          ampm={false}
                          format="HH:mm"
                          minTime={startTime || undefined}
                          maxTime={endTime || undefined}
                          value={parseTimeString(row.startTime)}
                          onChange={(val) => handleRowChange(index, 'startTime', val ? val.format('HH:mm:ss') : '')}
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                              sx: { bgcolor: 'white', borderRadius: 1 }
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ borderRight: '1px solid #eee' }}>
                        <TimePicker
                          ampm={false}
                          format="HH:mm"
                          minTime={startTime || undefined}
                          maxTime={endTime || undefined}
                          value={parseTimeString(row.endTime)}
                          onChange={(val) => handleRowChange(index, 'endTime', val ? val.format('HH:mm:ss') : '')}
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                              sx: { bgcolor: 'white', borderRadius: 1 }
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Tooltip title="ลบแถวนี้">
                          <IconButton
                            onClick={() => handleRemoveRow(index)}
                            size="small"
                            sx={{
                              bgcolor: '#ef5350',
                              color: 'white',
                              width: 32,
                              height: 32,
                              '&:hover': { bgcolor: '#d32f2f' }
                            }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: '#757575', fontSize: '18px' }}>
                      ยังไม่มีรายการข้อมูล กดปุ่ม + ที่หัวตารางหรือด้านล่างเพื่อเพิ่มแถว
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Quick Add Row Button below Table */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddRow}
              sx={{
                color: '#2e7d32',
                borderColor: '#2e7d32',
                bgcolor: 'white',
                fontWeight: 'bold',
                fontSize: '16px',
                borderRadius: 2,
                '&:hover': { bgcolor: '#e8f5e9', borderColor: '#1b5e20' }
              }}
            >
              เพิ่มแถวข้อมูล
            </Button>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleCancel}
              sx={{
                bgcolor: '#ef5350',
                '&:hover': { bgcolor: '#d32f2f' },
                px: 4,
                py: 1,
                fontSize: '20px',
                borderRadius: 1,
                textTransform: 'none'
              }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={handleUpdate}
              sx={{
                bgcolor: '#4caf50',
                '&:hover': { bgcolor: '#388e3c' },
                px: 4,
                py: 1,
                fontSize: '20px',
                borderRadius: 1,
                textTransform: 'none'
              }}
            >
              อัพเดตข้อมูล
            </Button>
          </Box>
        </Paper>
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={saveSchedule}
          loading={deleting}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default EditPerformancePage;
