import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  InputAdornment,
  Paper,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Link as RouterLink } from 'react-router-dom';
import CustomerHeader from '@/components/common/CustomerHeader';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerPromotion } from '@/types/customerPromotion';
import { discountLabel, formatThaiDate, isExpiringSoon } from '@/utils/customerPromotion';

type Filter = 'all' | 'expiring';

export default function CustomerPromotionsPage() {
  const [promotions, setPromotions] = useState<CustomerPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [notice, setNotice] = useState('');

  const loadPromotions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await customerPromotionApi.list();
      setPromotions(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดโปรโมชั่นได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPromotions();
  }, []);

  const visiblePromotions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    return promotions.filter((promotion) => {
      const matchesQuery = !normalized || `${promotion.promotion_name} ${promotion.concert.concert_name} ${promotion.concert.location} ${promotion.discount.promo_code}`
        .toLocaleLowerCase('th-TH').includes(normalized);
      return matchesQuery && (filter === 'all' || isExpiringSoon(promotion));
    });
  }, [filter, promotions, query]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`คัดลอกรหัส ${code} แล้ว`);
    } catch {
      setNotice('ไม่สามารถคัดลอกรหัสโปรโมชั่นได้');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fff' }}>
      <CustomerHeader />

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Typography component="h1" variant="h5" sx={{ mb: 3, color: '#1a1a1a', fontWeight: 'bold' }}>
          โปรโมชั่นทั้งหมด
        </Typography>

        <Paper elevation={0} sx={{ p: 1.5, mb: 3, borderRadius: 2.5, border: '1px solid #e7e9f2', display: 'flex', gap: 1, flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' } }}>
          <TextField
            fullWidth
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาโปรโมชั่น คอนเสิร์ต หรือรหัสส่วนลด"
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon color="action" /></InputAdornment> } }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button variant={filter === 'all' ? 'contained' : 'outlined'} onClick={() => setFilter('all')} sx={{ borderRadius: 999, bgcolor: filter === 'all' ? '#050C38' : undefined }}>
              ใช้ได้ตอนนี้
            </Button>
            <Button variant={filter === 'expiring' ? 'contained' : 'outlined'} onClick={() => setFilter('expiring')} sx={{ borderRadius: 999, bgcolor: filter === 'expiring' ? '#050C38' : undefined }}>
              ใกล้หมดเขต
            </Button>
          </Box>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 12 }}>
            <CircularProgress sx={{ color: '#FF5C58' }} />
            <Typography color="text.secondary" sx={{ mt: 2 }}>กำลังโหลดโปรโมชั่น...</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" action={<Button color="inherit" onClick={() => void loadPromotions()}>ลองใหม่</Button>} sx={{ borderRadius: 3 }}>
            {error}
          </Alert>
        ) : visiblePromotions.length === 0 ? (
          <Paper elevation={0} sx={{ py: 10, px: 2, textAlign: 'center', borderRadius: 4, border: '1px dashed #ccd0df' }}>
            <LocalOfferOutlinedIcon sx={{ fontSize: 56, color: '#a8aec2' }} />
            <Typography sx={{ mt: 1, fontWeight: 800, color: '#202747' }}>ยังไม่มีโปรโมชั่นที่ตรงกับการค้นหา</Typography>
            <Typography variant="body2" color="text.secondary">ลองเปลี่ยนคำค้นหาหรือตัวกรองอีกครั้ง</Typography>
          </Paper>
        ) : (
          <Grid container spacing={2.5}>
            {visiblePromotions.map((promotion) => (
              <Grid key={promotion.promotion_id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Paper elevation={0} sx={{ height: '100%', overflow: 'hidden', borderRadius: 3, border: '1px solid #e3e6f0', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 12px 28px rgba(5,12,56,0.1)' } }}>
                  {promotion.banner_image_url ? (
                    <Box component="img" src={promotion.banner_image_url} alt={promotion.promotion_name} sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <Box sx={{ height: 160, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #121a55, #d52a79)' }}>
                      <LocalOfferOutlinedIcon sx={{ fontSize: 52, color: 'rgba(255,255,255,.82)' }} />
                    </Box>
                  )}
                  <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Chip size="small" label={discountLabel(promotion)} sx={{ mb: 1, bgcolor: '#fff0ef', color: '#d83f43', fontWeight: 900 }} />
                        <Typography component="h2" sx={{ fontWeight: 900, color: '#11183c', fontSize: '1.05rem' }}>{promotion.promotion_name}</Typography>
                      </Box>
                      {isExpiringSoon(promotion) && <Chip size="small" label="ใกล้หมดเขต" color="warning" />}
                    </Box>

                    <Typography variant="body2" sx={{ mt: 0.75, color: '#555c73', fontWeight: 700 }}>{promotion.concert.concert_name}</Typography>
                    <Box sx={{ mt: 1, display: 'grid', gap: 0.5, color: '#7c8297' }}>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} /><Typography variant="caption">ใช้ได้ถึง {formatThaiDate(promotion.validity.end_date)}</Typography></Box>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><LocationOnOutlinedIcon sx={{ fontSize: 16 }} /><Typography variant="caption">{promotion.concert.location}</Typography></Box>
                    </Box>

                    <Box sx={{ mt: 1.5, p: 1, borderRadius: 2, bgcolor: '#f5f6fb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">รหัสโปรโมชั่น</Typography>
                        <Typography sx={{ color: '#050C38', fontWeight: 900, letterSpacing: 1 }}>{promotion.discount.promo_code}</Typography>
                      </Box>
                      <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyCode(promotion.discount.promo_code)}>คัดลอก</Button>
                    </Box>

                    <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      <Button size="small" component={RouterLink} to={`/offers/${promotion.promotion_id}`} variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ bgcolor: '#FF5C58', borderRadius: 999, fontWeight: 800 }}>
                        ดูรายละเอียด
                      </Button>
                      <Button size="small" component={RouterLink} to={`/event/${promotion.concert.concert_id}`} variant="outlined" sx={{ borderRadius: 999, fontWeight: 800 }}>
                        ดูคอนเสิร์ต
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Snackbar open={Boolean(notice)} autoHideDuration={2500} onClose={() => setNotice('')} message={notice} />
    </Box>
  );
}
