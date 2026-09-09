import { Alert, Box, Typography, Button, Chip, CircularProgress, Container, Grid } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { Link as RouterLink } from 'react-router-dom';
import { useCustomerConcerts } from '@/hooks/useCustomerConcerts';

export default function EventList({ title = 'ทุกงานแสดง', query = '' }: { title?: string; query?: string }) {
  const { concerts, loading, error } = useCustomerConcerts();
  const normalizedQuery = query.trim().toLocaleLowerCase('th-TH');
  const events = normalizedQuery
    ? concerts.filter((event) => `${event.title} ${event.location}`.toLocaleLowerCase('th-TH').includes(normalizedQuery))
    : concerts;

  return (
    <Container maxWidth="xl" sx={{ py: 5, px: { xs: 2, md: 6 } }}>
      <Typography variant="h5" sx={{ mb: 4, color: '#1a1a1a', fontWeight: 'bold' }}>
        {title}
      </Typography>
      {loading ? (
        <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}>
          <CircularProgress sx={{ color: '#FF5C58' }} />
        </Box>
      ) : error !== '' ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>
      ) : events.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center', bgcolor: '#f8f9fc', borderRadius: 4 }}>
          <SearchOffRoundedIcon sx={{ fontSize: 52, color: '#a7adbf', mb: 1 }} />
          {normalizedQuery ? (
            <>
              <Typography sx={{ fontWeight: 750, color: '#343a59' }}>ไม่พบคอนเสิร์ต “{query}”</Typography>
              <Typography variant="body2" color="text.secondary">ลองค้นหาด้วยชื่อคอนเสิร์ตหรือสถานที่อื่น</Typography>
            </>
          ) : (
            <>
              <Typography sx={{ fontWeight: 750, color: '#343a59' }}>ยังไม่มีคอนเสิร์ตที่เปิดจำหน่าย</Typography>
              <Typography variant="body2" color="text.secondary">กลับมาดูใหม่อีกครั้งเร็วๆ นี้</Typography>
            </>
          )}
        </Box>
      ) : <Grid container spacing={4}>
        {events.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.id}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'transform 0.3s ease', '&:hover': { transform: 'translateY(-6px)' } }}>
              <Box sx={{ position: 'relative', width: '100%', mb: 2 }}>
                <Box component="img" src={item.image} alt={item.title} sx={{ display: 'block', width: '100%', height: '320px', objectFit: 'cover', borderRadius: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }} />
                {item.isNew && <Chip label="คอนเสิร์ตใหม่" size="small" sx={{ position: 'absolute', top: 12, left: 12, bgcolor: '#FF5C58', color: '#fff', fontWeight: 800 }} />}
              </Box>
              <Typography sx={{ mb: 0.5, color: '#1a1a1a', fontWeight: 'bold', fontSize: '1.05rem' }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{item.date}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2, color: '#555' }}>
                <LocationOnIcon sx={{ fontSize: 18, color: '#000' }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.location}</Typography>
              </Box>
              <Button component={RouterLink} to={`/event/${item.id}`} variant="contained"
                sx={{ bgcolor: '#FF5C58', color: '#fff', borderRadius: '25px', px: 4, py: 0.8, fontWeight: 'bold', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(255,92,88,0.4)', '&:hover': { bgcolor: '#e04f4a' } }}>
                ดูรายละเอียด
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>}
    </Container>
  );
}
