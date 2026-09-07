import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Container, Grid, Paper, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PaidIcon from '@mui/icons-material/Paid';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import CustomerHeader from '@/components/common/CustomerHeader';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerPromotion, CustomerPromotionConcert } from '@/types/customerPromotion';
import { celestial, flux, pulse, starlight } from '@/assets/Poster';
import { discountLabel, formatThaiDate } from '@/utils/customerPromotion';

interface EventView {
  title: string;
  image: string;
  eventDate: string;
  saleDate: string;
  location: string;
  price: string;
  openTime: string;
  status: string;
  description: string;
}

const eventsMap: Record<string, EventView> = {
  '1': { title: 'Neon Flux Festival 2024', image: flux, eventDate: 'วันที่ 16-18 สิงหาคม 2024', saleDate: 'วันที่ 1-10 สิงหาคม 2024', location: 'ศูนย์การค้าสยามพารากอน กรุงเทพมหานคร', price: '3,500 / 2,500 / 1,800 / 1,200', openTime: '17:00 น.', status: 'เปิดจำหน่ายบัตรแล้ว', description: 'พร้อมสนุกไปกับเทศกาลดนตรีอิเล็กทรอนิกส์ พร้อมระบบแสง สี เสียง และศิลปินตลอดทั้งงาน' },
  '2': { title: 'Neon Pulse', image: pulse, eventDate: 'วันที่ 28 ตุลาคม 2024', saleDate: 'วันที่ 1-15 ตุลาคม 2024', location: 'ชั้น 3 The Mall Korat นครราชสีมา', price: '2,500 / 2,000 / 1,500 / 1,000', openTime: '18:30 น.', status: 'เปิดจำหน่ายบัตรแล้ว', description: 'คอนเสิร์ตเดี่ยวที่พาคุณดำดิ่งสู่โชว์ แสง และจังหวะเพลงในค่ำคืนพิเศษ' },
  '3': { title: 'Celestial Sounds', image: celestial, eventDate: 'วันที่ 26 ตุลาคม 2024', saleDate: 'วันที่ 5-20 ตุลาคม 2024', location: 'ลานเฉลิมพระเกียรติ เชียงใหม่', price: '2,800 / 2,200 / 1,600 / 1,000', openTime: '18:00 น.', status: 'เปิดจำหน่ายบัตรแล้ว', description: 'สัมผัสดนตรีสดท่ามกลางลมหนาวเชียงใหม่และท้องฟ้าที่เต็มไปด้วยดวงดาว' },
  '4': { title: 'Starlight Festival', image: starlight, eventDate: 'วันที่ 23-25 สิงหาคม 2024', saleDate: 'วันที่ 1-15 สิงหาคม 2024', location: 'ขอนแก่น ฮอลล์ ขอนแก่น', price: '3,000 / 2,200 / 1,500', openTime: '17:30 น.', status: 'เปิดจำหน่ายบัตรแล้ว', description: 'เทศกาลดนตรีสามวันเต็ม พร้อมศิลปินป๊อปและร็อก กิจกรรม และโซนอาหารตลอดงาน' },
};

function databaseConcertView(concert: CustomerPromotionConcert): EventView {
  const dateRange = concert.end_date && concert.end_date !== concert.start_date
    ? `${formatThaiDate(concert.start_date)} – ${formatThaiDate(concert.end_date)}`
    : formatThaiDate(concert.start_date);
  return {
    title: concert.concert_name,
    image: concert.poster_data || pulse,
    eventDate: dateRange,
    saleDate: 'ตรวจสอบรอบจำหน่ายในขั้นตอนเลือกบัตร',
    location: concert.location,
    price: 'เลือกโซนเพื่อดูราคา',
    openTime: concert.start_time ? `${concert.start_time.slice(0, 5)} น.` : '—',
    status: concert.status,
    description: concert.more_info || 'ติดตามรายละเอียดเพิ่มเติมของคอนเสิร์ตนี้ได้ที่ Octavia',
  };
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Box sx={{ color: '#555', mt: 0.25 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" sx={{ color: '#777', display: 'block' }}>{label}</Typography>
        <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '0.95rem' }}>{value}</Typography>
      </Box>
    </Box>
  );
}

export default function EventDetailPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventView | null>(eventsMap[id] || null);
  const [promotions, setPromotions] = useState<CustomerPromotion[]>([]);
  const [loading, setLoading] = useState(!eventsMap[id]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    setPromotions([]);
    if (eventsMap[id]) {
      setEvent(eventsMap[id]);
      setLoading(false);
    } else {
      setEvent(null);
      setLoading(true);
    }

    const concertRequest = eventsMap[id] ? Promise.resolve(null) : customerPromotionApi.getConcert(id);
    Promise.allSettled([concertRequest, customerPromotionApi.list(id)])
      .then(([concertResult, promotionResult]) => {
        if (!active) return;
        if (concertResult.status === 'fulfilled') {
          if (concertResult.value) setEvent(databaseConcertView(concertResult.value.data));
        } else if (!eventsMap[id]) {
          const reason = concertResult.reason;
          setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดคอนเสิร์ตได้');
        }
        if (promotionResult.status === 'fulfilled') setPromotions(promotionResult.value.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fff' }}>
      <CustomerHeader />
      {loading ? (
        <Box sx={{ py: 16, display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: '#FF5C58' }} /></Box>
      ) : error || !event ? (
        <Container maxWidth="md" sx={{ py: 6 }}><Alert severity="error">{error || 'ไม่พบคอนเสิร์ต'}</Alert></Container>
      ) : (
        <>
          <Box sx={{ bgcolor: '#FDECEF', py: { xs: 3, md: 5 }, px: { xs: 2, md: 8 } }}>
            <Container maxWidth="xl">
              <Button onClick={() => navigate(-1)} startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 2, color: '#050C38', fontWeight: 800 }}>ย้อนกลับ</Button>
              <Grid container spacing={4} sx={{ alignItems: 'flex-start' }}>
                <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box component="img" src={event.image} alt={event.title} sx={{ width: '100%', maxWidth: 300, height: 380, objectFit: 'cover', borderRadius: 4, boxShadow: '0 12px 30px rgba(5,12,56,.2)' }} />
                  <Button component={RouterLink} to={`/event/${id}/zones`} variant="contained" sx={{ bgcolor: '#FF5C58', borderRadius: 999, px: 6, py: 1.2, fontWeight: 900, mt: 3 }}>ซื้อบัตร</Button>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Typography component="h1" sx={{ color: '#10173b', fontWeight: 900, fontSize: { xs: '2rem', md: '2.7rem' }, mb: 3 }}>{event.title}</Typography>
                  <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4, bgcolor: '#fff', maxWidth: 760 }}>
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, sm: 6 }}><InfoRow icon={<CalendarTodayIcon />} label="วันที่แสดง" value={event.eventDate} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><InfoRow icon={<EditCalendarIcon />} label="วันที่เปิดจำหน่าย" value={event.saleDate} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><InfoRow icon={<LocationOnIcon />} label="สถานที่แสดง" value={event.location} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><InfoRow icon={<PaidIcon />} label="ราคา" value={event.price} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><InfoRow icon={<AccessTimeIcon />} label="ประตูเปิด" value={event.openTime} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><InfoRow icon={<ConfirmationNumberIcon />} label="สถานะ" value={event.status} /></Grid>
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>
            </Container>
          </Box>

          <Container maxWidth="xl" sx={{ py: 6, px: { xs: 2, md: 8 } }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#1A1A1A', mb: 2 }}>รายละเอียด</Typography>
            <Typography sx={{ color: '#444', lineHeight: 1.8, maxWidth: 900, whiteSpace: 'pre-line' }}>{event.description}</Typography>

            {promotions.length > 0 && (
              <Box sx={{ mt: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <LocalOfferOutlinedIcon sx={{ color: '#FF5C58' }} />
                  <Typography variant="h5" sx={{ fontWeight: 900, color: '#1A1A1A' }}>โปรโมชั่นสำหรับคอนเสิร์ตนี้</Typography>
                </Box>
                <Grid container spacing={2}>
                  {promotions.map((promotion) => (
                    <Grid key={promotion.promotion_id} size={{ xs: 12, md: 6 }}>
                      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e4e7f0', display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Box>
                          <Chip size="small" label={discountLabel(promotion)} sx={{ bgcolor: '#fff0ef', color: '#d83f43', fontWeight: 900 }} />
                          <Typography sx={{ mt: 1, fontWeight: 900, color: '#10173b' }}>{promotion.promotion_name}</Typography>
                          <Typography variant="body2" color="text.secondary">รหัส {promotion.discount.promo_code} · ถึง {formatThaiDate(promotion.validity.end_date)}</Typography>
                        </Box>
                        <Button component={RouterLink} to={`/offers/${promotion.promotion_id}`} variant="outlined" sx={{ borderRadius: 999, flexShrink: 0 }}>ดูโปรโมชั่น</Button>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Container>
        </>
      )}
    </Box>
  );
}
