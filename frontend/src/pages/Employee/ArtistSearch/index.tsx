import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { artistApi, type ArtistData, type PerformanceScheduleData } from '@/api/artistApi';
import { concertApi, type ConcertData } from '@/api/concertApi';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';

const normalize = (value: string) => value.trim().toLocaleLowerCase('th');

const formatDate = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatTime = (value?: string) => value ? value.slice(0, 5) : '-';

export default function ArtistSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [schedules, setSchedules] = useState<PerformanceScheduleData[]>([]);
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [artistToDelete, setArtistToDelete] = useState<ArtistData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([artistApi.getArtists(), artistApi.getSchedules(), concertApi.getConcerts()])
      .then(([artistRows, scheduleRows, concertRows]) => {
        setArtists(artistRows);
        setSchedules(scheduleRows);
        setConcerts(concertRows);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const keyword = query.trim();
    setSearchParams(keyword ? { q: keyword } : {}, { replace: true });
  }, [query, setSearchParams]);

  const concertById = useMemo(() => new Map(concerts.map((concert) => [concert.concert_id, concert])), [concerts]);
  const artistById = useMemo(() => new Map(artists.map((artist) => [artist.artist_id, artist])), [artists]);
  const keyword = normalize(query);
  const artistResults = artists.filter((artist) => !keyword || normalize(artist.artist_name).includes(keyword));
  const scheduleResults = schedules.filter((schedule) => {
    if (!keyword) return true;
    const concert = concertById.get(schedule.concert_id || '');
    return normalize(`${concert?.concert_name || ''} ${schedule.details} ${schedule.show_date || ''}`).includes(keyword);
  });

  const confirmDelete = async () => {
    if (!artistToDelete) return;
    setDeleting(true);
    try {
      await artistApi.deleteArtist(artistToDelete.artist_id);
      setArtists((current) => current.filter((artist) => artist.artist_id !== artistToDelete.artist_id));
      setSchedules((current) => current.filter((schedule) => schedule.artist_id !== artistToDelete.artist_id));
      setArtistToDelete(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ลบข้อมูลไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: '#f8f9fa', fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, maxWidth: 980, mx: 'auto' }}>
        <TextField
          autoFocus fullWidth value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาชื่อศิลปิน ชื่อคอนเสิร์ต หรือตารางการแสดง"
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#777' }} /></InputAdornment> } }}
          sx={{ bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 3, minHeight: 56, fontSize: '18px' } }}
        />
        <Button variant="outlined" onClick={() => setQuery('')} sx={{ minWidth: 110, borderRadius: 3, borderColor: '#1a237e', color: '#1a237e', fontWeight: 700 }}>ล้างคำค้น</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress /></Box> : (
        <>
          {artistResults.length > 0 && (
            <Box sx={{ mb: 5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 800, color: '#10163e', fontSize: { xs: 26, md: 32 } }}>ผลการค้นหาศิลปิน</Typography>
                <Chip label={`${artistResults.length} ศิลปิน`} sx={{ bgcolor: '#fce4ec', color: '#ad1457', fontWeight: 700 }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {artistResults.map((artist) => (
                  <Paper key={artist.artist_id} variant="outlined" sx={{ p: 2.5, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderColor: '#e1e5ec', boxShadow: '0 3px 10px rgba(15,23,42,.05)' }}>
                    <Box>
                      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#11183f' }}>{artist.artist_name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Tooltip title="รายละเอียด"><IconButton aria-label={`รายละเอียด ${artist.artist_name}`} onClick={() => navigate(`/artists/${artist.artist_id}`)} sx={{ color: '#1565c0', bgcolor: '#e3f2fd' }}><InfoOutlinedIcon /></IconButton></Tooltip>
                      <Tooltip title="แก้ไข"><IconButton aria-label={`แก้ไข ${artist.artist_name}`} onClick={() => navigate(`/artist-info?mode=edit&id=${artist.artist_id}`)} sx={{ color: '#ef6c00', bgcolor: '#fff3e0' }}><EditIcon /></IconButton></Tooltip>
                      <Tooltip title="ลบ"><IconButton aria-label={`ลบ ${artist.artist_name}`} onClick={() => setArtistToDelete(artist)} sx={{ color: '#d32f2f', bgcolor: '#ffebee' }}><DeleteIcon /></IconButton></Tooltip>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {scheduleResults.length > 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 800, color: '#10163e', fontSize: { xs: 26, md: 32 } }}>ผลการค้นหาตารางการแสดง</Typography>
                <Chip label={`${scheduleResults.length} รายการ`} sx={{ bgcolor: '#ede7f6', color: '#6a1b9a', fontWeight: 700 }} />
              </Box>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4 }}>
                <Table>
                  <TableHead sx={{ bgcolor: '#1a237e' }}><TableRow>{['คอนเสิร์ต', 'วันที่แสดง', 'ลำดับ', 'ศิลปิน', 'เวลา', 'รายละเอียด'].map((title) => <TableCell key={title} sx={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{title}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {scheduleResults.map((schedule) => (
                      <TableRow key={schedule.schedule_id} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{concertById.get(schedule.concert_id || '')?.concert_name || schedule.concert_id || '-'}</TableCell>
                        <TableCell>{formatDate(schedule.show_date)}</TableCell>
                        <TableCell>{schedule.performance_order}</TableCell>
                        <TableCell>{artistById.get(schedule.artist_id)?.artist_name || schedule.artist_id || '-'}</TableCell>
                        <TableCell>{formatTime(schedule.start_show)}–{formatTime(schedule.end_show)} น.</TableCell>
                        <TableCell>{schedule.details || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {artistResults.length === 0 && scheduleResults.length === 0 && <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4 }}><Typography sx={{ fontSize: 20, color: '#68758b' }}>ไม่พบศิลปินหรือการแสดงที่ตรงกับ “{query}”</Typography></Paper>}
        </>
      )}
      <ConfirmDeleteDialog open={Boolean(artistToDelete)} loading={deleting} message={`ยืนยันการลบศิลปิน ${artistToDelete?.artist_name || ''} หรือไม่`} onCancel={() => setArtistToDelete(null)} onConfirm={confirmDelete} />
    </Box>
  );
}
