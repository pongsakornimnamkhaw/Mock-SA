import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Grid, Paper, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import { artistApi, type ArtistData } from '@/api/artistApi';

const fields: Array<{ key: keyof ArtistData; label: string }> = [
  { key: 'artist_name', label: 'ชื่อศิลปิน' },
  { key: 'artist_type', label: 'ประเภทศิลปิน' },
  { key: 'record_label', label: 'ค่ายเพลงหรือสังกัดศิลปิน' },
  { key: 'official_contact', label: 'ช่องทางติดต่อ Official' },
  { key: 'coordinator_name', label: 'ผู้ประสานงาน' },
  { key: 'coordinator_phone', label: 'เบอร์โทรผู้ประสานงาน' },
  { key: 'coordinator_email', label: 'E-mail ผู้ประสานงาน' },
  { key: 'more_info', label: 'ข้อมูลเพิ่มเติม' },
  { key: 'status', label: 'สถานะ' },
];

export default function ArtistDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    artistApi.getArtist(id).then(setArtist).catch((reason) => setError(reason instanceof Error ? reason.message : 'โหลดข้อมูลไม่สำเร็จ'));
  }, [id]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 3, borderRadius: 5, color: '#fff', bgcolor: '#e91e63', px: 3, fontWeight: 700, '&:hover': { bgcolor: '#c2185b' } }}>ย้อนกลับ</Button>
      <Typography sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 800, color: '#1a237e', mb: 3 }}>รายละเอียดข้อมูลศิลปิน</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {!artist && !error && <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress /></Box>}
      {artist && (
        <Paper sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, bgcolor: '#F7DCF3' }}>
          <Grid container spacing={3}>
            {fields.map((field) => (
              <Grid size={{ xs: 12, md: field.key === 'more_info' ? 12 : 6 }} key={field.key}>
                <Typography sx={{ mb: 0.75, color: '#1a237e', fontSize: 18, fontWeight: 700 }}>{field.label}</Typography>
                <TextField fullWidth value={artist[field.key] || '-'} multiline={field.key === 'more_info'} minRows={field.key === 'more_info' ? 3 : undefined} slotProps={{ input: { readOnly: true } }} sx={{ bgcolor: '#fff', borderRadius: 1, '& .MuiInputBase-input': { color: '#20244d', fontWeight: 600 } }} />
              </Grid>
            ))}
          </Grid>
          <Alert severity="info" sx={{ mt: 3 }}>หน้านี้ใช้สำหรับดูข้อมูลปัจจุบันเท่านั้น ไม่สามารถแก้ไขหรือลบข้อมูลได้</Alert>
        </Paper>
      )}
    </Box>
  );
}
