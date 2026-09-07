import { Box, Typography, Button, Container, Grid } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { starlight, pulse, flux, celestial } from '@/assets/Poster';
import { Link as RouterLink } from 'react-router-dom';

const eventsData = [
  { id: 1, image: flux, title: 'Neon Flux Festival 2024', date: '16-18 ส.ค. 2024', location: 'กรุงเทพมหานคร' },
  { id: 2, image: pulse, title: 'Neon Pulse', date: '18 ต.ค. 2024', location: 'นครราชสีมา' },
  { id: 3, image: celestial, title: 'Celestial Sounds', date: '26 ต.ค. 2024', location: 'เชียงใหม่' },
  { id: 4, image: starlight, title: 'Starlight Festival', date: '23-25 ส.ค. 2024', location: 'ขอนแก่น' },
];

export default function EventList({ title = 'ทุกงานแสดง' }: { title?: string }) {
  return (
    <Container maxWidth="xl" sx={{ py: 5, px: { xs: 2, md: 6 } }}>
      <Typography variant="h5" sx={{ mb: 4, color: '#1a1a1a', fontWeight: 'bold' }}>
        {title}
      </Typography>
      <Grid container spacing={4}>
        {eventsData.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.id}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'transform 0.3s ease', '&:hover': { transform: 'translateY(-6px)' } }}>
              <Box component="img" src={item.image} alt={item.title} sx={{ width: '100%', height: '320px', objectFit: 'cover', borderRadius: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', mb: 2 }} />
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
      </Grid>
    </Container>
  );
}
