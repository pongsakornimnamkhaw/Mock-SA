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
  Tooltip,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

import { concertApi, ConcertData } from '@/api/concertApi';
import { artistApi, type ArtistData } from '@/api/artistApi';
import { concertDateOptions, validateScheduleRows } from '@/utils/scheduleRules';
import { useFeatureAccess } from '@/access/useFeatureAccess';

export interface ScheduleRow {
  id: number | string;
  seq: number;
  detail: string;
  artist: string;
  startTime: string;
  endTime: string;
  concertId?: string;
  showDate?: string;
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

const PerformanceSchedulePage = () => {
  const { canEdit } = useFeatureAccess('artist.schedule.create');
  const [activeTab, setActiveTab] = useState<'add' | 'view'>(() => canEdit ? 'add' : 'view');
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [artists, setArtists] = useState<ArtistData[]>([]);

  // Form states
  const [concert, setConcert] = useState('');
  const [date, setDate] = useState<Dayjs | null>(null);
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  
  // Table rows: starts empty (only headers initially)
  const [addRows, setAddRows] = useState<ScheduleRow[]>([]);
  const [viewRows, setViewRows] = useState<ScheduleRow[]>([]);
  const [scheduleSearch, setScheduleSearch] = useState('');

  useEffect(() => {
    loadConcerts();
    artistApi.getArtists().then(setArtists).catch(console.error);
    loadAllSchedules();
  }, []);

  useEffect(() => {
    const selected = concerts.find((item) => item.concert_name === concert);
    if (!selected) { setViewRows([]); setDate(null); setStartTime(null); setEndTime(null); return; }
    setDate(dayjs(selected.start_date));
    setStartTime(parseTimeString(selected.start_time));
    setEndTime(parseTimeString(selected.end_time));
    setAddRows([]);
  }, [concert, concerts]);

  const loadAllSchedules = async () => {
    try {
      const rows = await artistApi.getSchedules();
      setViewRows(rows.map((row) => ({
        id: row.schedule_id || `${row.concert_id}-${row.show_date}-${row.performance_order}`,
        seq: row.performance_order,
        detail: row.details,
        artist: row.artist_id,
        startTime: row.start_show,
        endTime: row.end_show,
        concertId: row.concert_id,
        showDate: row.show_date,
      })));
    } catch (err) {
      console.error('Failed to load schedules:', err);
      setViewRows([]);
    }
  };

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

  const handleAddRow = () => {
    const newRow: ScheduleRow = {
      id: Date.now(),
      seq: addRows.length + 1,
      detail: '',
      artist: '',
      startTime: '',
      endTime: '',
    };
    setAddRows((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (indexToRemove: number) => {
    setAddRows((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((row, idx) => ({ ...row, seq: idx + 1 }))
    );
  };

  const handleRowChange = (index: number, field: keyof ScheduleRow, value: string) => {
    setAddRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSave = async () => {
    const selected = concerts.find((item) => item.concert_name === concert);
    if (!selected || !date || !startTime || !endTime || !addRows.length || addRows.some((row) => !row.detail || !row.artist || !row.startTime || !row.endTime)) {
      alert('บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง');
    } else {
      const validationError = validateScheduleRows(addRows, selected.start_time, selected.end_time);
      if (validationError) { alert(validationError); return; }
      try { await artistApi.saveSchedules(selected.concert_id, addRows.map((row) => ({ performance_order: row.seq, details: row.detail, artist_id: row.artist, start_show: row.startTime, end_show: row.endTime, show_date: date.format('YYYY-MM-DD') })), date.format('YYYY-MM-DD')); await loadAllSchedules(); alert('บันทึกข้อมูลสำเร็จ'); } catch (error) { alert(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    }
  };

  const handleCancel = () => {
    setConcert('');
    setDate(null);
    setStartTime(null);
    setEndTime(null);
    setAddRows([]);
  };

  const filteredViewRows = viewRows.filter((row) => {
    const term = scheduleSearch.trim().toLocaleLowerCase('th');
    if (!term) return true;
    const concertName = concerts.find((item) => item.concert_id === row.concertId)?.concert_name || row.concertId || '';
    const artistName = artists.find((item) => item.artist_id === row.artist)?.artist_name || row.artist;
    return [concertName, artistName, row.showDate, row.detail, row.startTime, row.endTime]
      .some((value) => value?.toLocaleLowerCase('th').includes(term));
  });

  const scheduleGroups = Array.from(
    filteredViewRows.reduce((groups, row) => {
      const key = row.concertId || 'unknown';
      const current = groups.get(key) || [];
      current.push(row);
      groups.set(key, current);
      return groups;
    }, new Map<string, ScheduleRow[]>())
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai', 'Inter', sans-serif" }}>
        {/* Page Title */}
        <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e', mb: 3 }}>
          ตารางการแสดง
        </Typography>

        {/* Tab Navigation */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {canEdit && <Button
            variant={activeTab === 'add' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('add')}
            sx={{
              bgcolor: activeTab === 'add' ? '#e91e63' : 'transparent',
              color: activeTab === 'add' ? 'white' : '#e91e63',
              borderRadius: '12px',
              textTransform: 'none',
              px: 3,
              py: 1,
              fontWeight: 'bold',
              fontSize: '18px',
              borderColor: '#e91e63',
              '&:hover': {
                bgcolor: activeTab === 'add' ? '#d81b60' : 'rgba(233, 30, 99, 0.04)'
              }
            }}
          >
            สร้างตารางแสดง
          </Button>}
          <Button
            variant={activeTab === 'view' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('view')}
            sx={{
              bgcolor: activeTab === 'view' ? '#e91e63' : 'transparent',
              color: activeTab === 'view' ? 'white' : '#e91e63',
              borderRadius: '12px',
              textTransform: 'none',
              px: 3,
              py: 1,
              fontWeight: 'bold',
              fontSize: '18px',
              borderColor: '#e91e63',
              '&:hover': {
                bgcolor: activeTab === 'view' ? '#d81b60' : 'rgba(233, 30, 99, 0.04)'
              }
            }}
          >
            ดูตารางแสดงรวม
          </Button>
        </Box>

        {/* Tab 1: สร้างตารางแสดง */}
        {canEdit && activeTab === 'add' && (
          <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#b2dfdb' }}>
            {/* Header Form */}
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
                  {addRows.length > 0 ? (
                    addRows.map((row, index) => (
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
                onClick={handleSave}
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
                บันทึกข้อมูล
              </Button>
            </Box>
          </Paper>
        )}

        {/* Tab 2: ดูตารางแสดงรวม */}
        {activeTab === 'view' && (
          <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#b2dfdb' }}>
            <TextField
              fullWidth
              value={scheduleSearch}
              onChange={(event) => setScheduleSearch(event.target.value)}
              placeholder="ค้นหาชื่อคอนเสิร์ต ศิลปิน วันที่ หรือรายละเอียดการแสดง"
              sx={{ mb: 3, bgcolor: 'white', borderRadius: 2 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            />
            {scheduleGroups.map(([concertId, rows]) => (
              <Box key={concertId} sx={{ mb: 3, '&:last-child': { mb: 0 } }}>
                <Typography sx={{ mb: 1.5, color: '#1a237e', fontWeight: 'bold', fontSize: '22px' }}>
                  {concerts.find((item) => item.concert_id === concertId)?.concert_name || concertId}
                </Typography>
                <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#4caf50' }}>
                      <TableRow>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>วันที่แสดง</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>ลำดับ</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>รายละเอียดการแสดง</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>ชื่อศิลปิน</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>เวลาเริ่ม</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>เวลาสิ้นสุด</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody sx={{ bgcolor: '#ffffff' }}>
                      {rows.map((row) => (
                        <TableRow key={row.id} sx={{ '&:nth-of-type(even)': { bgcolor: '#f9fbe7' } }}>
                          <TableCell sx={{ fontSize: '17px', textAlign: 'center', borderRight: '1px solid #eee' }}>{row.showDate ? dayjs(row.showDate).format('DD/MM/YYYY') : '-'}</TableCell>
                          <TableCell sx={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', borderRight: '1px solid #eee' }}>{row.seq}</TableCell>
                          <TableCell sx={{ fontSize: '18px', borderRight: '1px solid #eee' }}>{row.detail}</TableCell>
                          <TableCell sx={{ fontSize: '18px', borderRight: '1px solid #eee' }}>{artists.find((item) => item.artist_id === row.artist)?.artist_name || row.artist}</TableCell>
                          <TableCell sx={{ fontSize: '18px', textAlign: 'center', borderRight: '1px solid #eee' }}>{row.startTime}</TableCell>
                          <TableCell sx={{ fontSize: '18px', textAlign: 'center' }}>{row.endTime}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
            {scheduleGroups.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center', color: '#757575', borderRadius: 2 }}>
                {viewRows.length === 0 ? 'ยังไม่มีตารางการแสดง' : 'ไม่พบตารางการแสดงที่ค้นหา'}
              </Paper>
            )}
          </Paper>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default PerformanceSchedulePage;
