import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { Link as RouterLink, useParams } from 'react-router-dom';
import CustomerHeader from '@/components/common/CustomerHeader';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerPromotion } from '@/types/customerPromotion';
import { discountLabel, formatThaiDate } from '@/utils/customerPromotion';

export default function CustomerPromotionDetailPage() {
  const { id = '' } = useParams();
  const [promotion, setPromotion] = useState<CustomerPromotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyNotice, setCopyNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    customerPromotionApi.get(id)
      .then((response) => {
        if (active) setPromotion(response.data);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดโปรโมชั่นได้');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  const copyCode = async () => {
    if (!promotion) return;
    try {
      await navigator.clipboard.writeText(promotion.discount.promo_code);
      setCopyNotice('คัดลอกรหัสโปรโมชั่นแล้ว');
    } catch {
      setCopyNotice('ไม่สามารถคัดลอกรหัสโปรโมชั่นได้');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f8fc' }}>
      <CustomerHeader />
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Button component={RouterLink} to="/offers" startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 2, color: '#050C38', fontWeight: 800 }}>
          กลับไปหน้ารวมโปรโมชั่น
        </Button>

        {loading ? (
          <Box sx={{ py: 14, display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: '#FF5C58' }} /></Box>
        ) : error || !promotion ? (
          <Alert severity="error" action={<Button component={RouterLink} to="/offers" color="inherit">ดูโปรโมชั่นอื่น</Button>} sx={{ borderRadius: 3 }}>
            {error || 'ไม่พบโปรโมชั่น'}
          </Alert>
        ) : (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 4, border: '1px solid #e3e6f0' }}>
                {promotion.banner_image_url ? (
                  <Box component="img" src={promotion.banner_image_url} alt={promotion.promotion_name} sx={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Box sx={{ height: 330, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #11194e, #d72b79)' }}>
                    <LocalOfferOutlinedIcon sx={{ fontSize: 92, color: 'rgba(255,255,255,.85)' }} />
                  </Box>
                )}
                <Box sx={{ p: { xs: 2.5, md: 4 } }}>
                  <Chip label={discountLabel(promotion)} sx={{ mb: 1.5, bgcolor: '#fff0ef', color: '#d83f43', fontWeight: 900 }} />
                  <Typography component="h1" sx={{ color: '#10173b', fontWeight: 900, fontSize: { xs: '1.8rem', md: '2.5rem' }, lineHeight: 1.15 }}>
                    {promotion.promotion_name}
                  </Typography>
                  {promotion.description && <Typography sx={{ mt: 2, color: '#555d75', lineHeight: 1.8 }}>{promotion.description}</Typography>}
                  <Divider sx={{ my: 3 }} />
                  <Typography sx={{ fontWeight: 900, color: '#10173b', mb: 1 }}>เงื่อนไขการใช้งาน</Typography>
                  <Typography sx={{ color: '#555d75', whiteSpace: 'pre-line', lineHeight: 1.8 }}>{promotion.terms}</Typography>
                  <Typography sx={{ mt: 2, color: '#555d75' }}>
                    ยอดซื้อขั้นต่ำ {promotion.discount.minimum_order.toLocaleString()} บาท
                    {promotion.discount.max_discount_amount > 0 && ` · ลดสูงสุด ${promotion.discount.max_discount_amount.toLocaleString()} บาท`}
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {promotion.zones.map((zone) => <Chip key={zone.zone_id} label={zone.zone_name} variant="outlined" />)}
                  </Box>
                </Box>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 4, border: '1px solid #e3e6f0', position: { md: 'sticky' }, top: { md: 108 } }}>
                <Typography variant="overline" sx={{ color: '#8a90a6', fontWeight: 800 }}>ใช้กับคอนเสิร์ต</Typography>
                <Typography sx={{ color: '#10173b', fontWeight: 900, fontSize: '1.35rem', mt: 0.5 }}>{promotion.concert.concert_name}</Typography>
                <Box sx={{ display: 'grid', gap: 1.25, mt: 2, color: '#636a82' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><CalendarMonthOutlinedIcon /><Typography variant="body2">{formatThaiDate(promotion.concert.start_date)}</Typography></Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><LocationOnOutlinedIcon /><Typography variant="body2">{promotion.concert.location}</Typography></Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><ConfirmationNumberOutlinedIcon /><Typography variant="body2">เหลือ {promotion.validity.remaining_quota.toLocaleString()} สิทธิ์</Typography></Box>
                </Box>

                <Box sx={{ mt: 3, p: 2, borderRadius: 3, bgcolor: '#f3f4fa' }}>
                  <Typography variant="caption" color="text.secondary">รหัสโปรโมชั่น</Typography>
                  <Typography sx={{ fontSize: '1.5rem', color: '#050C38', fontWeight: 900, letterSpacing: 1.5 }}>{promotion.discount.promo_code}</Typography>
                  <Button fullWidth variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyCode()} sx={{ mt: 1.5, borderRadius: 999, fontWeight: 800 }}>
                    คัดลอกรหัส
                  </Button>
                </Box>

                <Typography variant="body2" sx={{ mt: 2, color: '#777e94' }}>
                  ใช้ได้ {formatThaiDate(promotion.validity.start_date)} – {formatThaiDate(promotion.validity.end_date)}
                </Typography>
                <Button component={RouterLink} to={`/event/${promotion.concert.concert_id}`} fullWidth variant="contained" sx={{ mt: 2.5, py: 1.25, borderRadius: 999, bgcolor: '#FF5C58', fontWeight: 900 }}>
                  ดูคอนเสิร์ตและซื้อบัตร
                </Button>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
      <Snackbar open={Boolean(copyNotice)} autoHideDuration={2500} onClose={() => setCopyNotice('')} message={copyNotice} />
    </Box>
  );
}
