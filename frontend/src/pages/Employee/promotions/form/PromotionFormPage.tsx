// src/components/promotions/form/PromotionFormPage.tsx
import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';

import { managementApi } from '../../../../api/managementApi';
import type { DiscountType, Concert, Zone } from '../../../../types/promotion';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmDeleteDialog from '../../../../components/common/ConfirmDeleteDialog';

interface FormState {
  promotion_name: string;
  concert_id: string;
  discount_type: DiscountType;
  discount_value: string;
  max_discount_amount: string;
  promo_code: string;
  terms_detail: string;
  max_usage_per_user: string;
  min_order_amount: string;
  start_date: string;
  end_date: string;
  total_quota: string;
  selected_zones: string[];
  banner_image_url: string;
}

const EMPTY_FORM: FormState = {
  promotion_name: '',
  concert_id: '',
  discount_type: 'percent',
  discount_value: '',
  max_discount_amount: '',
  promo_code: '',
  terms_detail: '',
  max_usage_per_user: '',
  min_order_amount: '',
  start_date: '',
  end_date: '',
  total_quota: '',
  selected_zones: [],
  banner_image_url: '',
};

export default function PromotionFormPage() {
  const { id } = useParams<{ id: string }>();
  const mode = id ? 'edit' : 'create';
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const generation = useRef(0);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    const request = ++generation.current;
    setLoading(true);
    setLoadedId(null);
    setLoadError('');
    setError('');
    setImageError('');
    setSaving(false);
    savingRef.current = false;
    setDeleteOpen(false);
    setDeleting(false);
    deletingRef.current = false;
    setReadingImage(false);
    setForm(EMPTY_FORM);
    setConcerts([]);
    setZones([]);
    const load = async () => {
      try {
        const [options, promo] = await Promise.all([
          managementApi.promotionOptions(),
          id ? managementApi.getPromotion(id) : Promise.resolve(null),
        ]);
        if (generation.current !== request) return;
        setConcerts(options.concerts);
        setZones(options.zones);
        if (promo) setForm({
          promotion_name: promo.promotion_name,
          concert_id: promo.concert_id,
          discount_type: promo.discount_info?.discount_type ?? 'percent',
          discount_value: String(promo.discount_info?.discount_value ?? ''),
          max_discount_amount: String(promo.discount_info?.max_discount_amount ?? ''),
          promo_code: promo.discount_info?.promo_code ?? '',
          terms_detail: promo.terms_and_conditions?.terms_detail ?? '',
          max_usage_per_user: String(promo.promotion_condition?.max_usage_per_user ?? ''),
          min_order_amount: String(promo.promotion_condition?.min_order_amount ?? ''),
          start_date: promo.quota_and_period?.start_date?.slice(0, 10) ?? '',
          end_date: promo.quota_and_period?.end_date?.slice(0, 10) ?? '',
          total_quota: String(promo.quota_and_period?.total_quota ?? ''),
          selected_zones: promo.zones?.map((z) => z.zone_id) ?? [],
          banner_image_url: promo.banner_image_url ?? '',
        });
        setLoadedId(id ?? '');
      } catch (err) {
        if (generation.current === request) setLoadError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลโปรโมชั่นได้');
      } finally {
        if (generation.current === request) setLoading(false);
      }
    };
    void load();
    return () => {
      generation.current = request + 1;
      readerRef.current?.abort();
      readerRef.current = null;
    };
  }, [id, retry]);

  const ready = !loading && !loadError && loadedId === (id ?? '');
  const disabled = !ready || saving || deleting;

  const set = (key: keyof FormState, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || disabled || savingRef.current) return;
    readerRef.current?.abort();
    readerRef.current = null;
    setReadingImage(false);
    setImageError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setImageError('กรุณาเลือกภาพ PNG, JPEG หรือ WebP ขนาดไม่เกิน 5 MB');
      return;
    }
    const reader = new FileReader();
    const request = generation.current;
    readerRef.current = reader;
    setReadingImage(true);
    const isCurrent = () => generation.current === request && readerRef.current === reader;
    reader.onload = () => {
      if (!isCurrent()) return;
      if (typeof reader.result === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(reader.result)) {
        set('banner_image_url', reader.result);
      } else {
        setImageError('ไม่สามารถอ่านรูปภาพได้ กรุณาเลือกไฟล์อีกครั้ง');
      }
      readerRef.current = null;
      setReadingImage(false);
    };
    reader.onerror = () => {
      if (!isCurrent()) return;
      setImageError('ไม่สามารถอ่านรูปภาพได้ กรุณาเลือกไฟล์อีกครั้ง');
      readerRef.current = null;
      setReadingImage(false);
    };
    reader.onabort = () => {
      if (!isCurrent()) return;
      readerRef.current = null;
      setReadingImage(false);
    };
    try {
      reader.readAsDataURL(file);
    } catch {
      reader.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
    }
  };

  const toggleZone = (zoneId: string) => {
    setForm((prev) => ({
      ...prev,
      selected_zones: prev.selected_zones.includes(zoneId)
        ? prev.selected_zones.filter((id) => id !== zoneId)
        : [...prev.selected_zones, zoneId],
    }));
  };

  const handleSave = async () => {
    if (!ready || savingRef.current || readerRef.current || readingImage || imageError) return;
    const discount = Number(form.discount_value);
    const maxDiscount = Number(form.max_discount_amount);
    const maxUsage = Number(form.max_usage_per_user);
    const minOrder = Number(form.min_order_amount);
    const quota = Number(form.total_quota);
    if (!form.promotion_name.trim() || !form.promo_code.trim() || !form.terms_detail.trim() || !form.concert_id ||
        !concerts.some((concert) => concert.concert_id === form.concert_id)) {
      setError('กรุณาระบุชื่อโปรโมชั่น รหัสโปรโมชั่น เงื่อนไขการใช้งาน และเลือกคอนเสิร์ตที่ถูกต้อง');
      return;
    }
    if (!form.discount_value.trim() || !Number.isFinite(discount) || discount <= 0 ||
        (form.discount_type === 'percent' && discount > 100) ||
        !Number.isFinite(maxDiscount) || maxDiscount < 0 || !Number.isFinite(minOrder) || minOrder < 0 ||
        !form.max_usage_per_user.trim() || !Number.isSafeInteger(maxUsage) || maxUsage <= 0 || maxUsage > 2147483647 ||
        !form.total_quota.trim() || !Number.isSafeInteger(quota) || quota <= 0 || quota > 2147483647 || maxUsage > quota) {
      setError('กรุณาระบุตัวเลขให้ถูกต้อง: ส่วนลดมากกว่า 0 (เปอร์เซ็นต์ไม่เกิน 100), จำนวนสิทธิ์และครั้งต่อคนเป็นจำนวนเต็ม 1–2147483647 และจำนวนเงินต้องไม่ติดลบ โดยครั้งต่อคนไม่เกินสิทธิ์ทั้งหมด');
      return;
    }
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1 &&
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!validDate(form.start_date) || !validDate(form.end_date) || form.start_date > form.end_date) {
      setError('กรุณาระบุวันเริ่มต้นและวันสิ้นสุดที่ถูกต้อง โดยวันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');
      return;
    }
    if (form.selected_zones.length === 0 || form.selected_zones.some((zoneId) => !zones.some((zone) => zone.zone_id === zoneId))) {
      setError('กรุณาเลือกโซนที่เข้าร่วมอย่างน้อยหนึ่งโซนจากรายการที่มีอยู่');
      return;
    }
    if (form.banner_image_url.startsWith('blob:')) {
      setImageError('กรุณาอัปโหลดรูปภาพอีกครั้งเพื่อบันทึกภาพอย่างถาวร');
      return;
    }
    const request = generation.current;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      // Flat API payload; both creates and edits return to the approval workflow.
      const saved = await managementApi.savePromotion({
        ...form,
        promotion_name: form.promotion_name.trim(),
        promo_code: form.promo_code.trim(),
        terms_detail: form.terms_detail.trim(),
        discount_value: discount,
        max_discount_amount: maxDiscount,
        max_usage_per_user: maxUsage,
        min_order_amount: minOrder,
        total_quota: quota,
        remove_banner: form.banner_image_url === '',
      }, id);
      if (generation.current === request) navigate(`/promotions/${saved.promotion_id}`);
    } catch (err) {
      if (generation.current === request) setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      if (generation.current === request) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (mode !== 'edit' || !id || !ready || deletingRef.current || savingRef.current) return;
    const request = generation.current;
    deletingRef.current = true;
    setDeleting(true);
    setError('');
    try {
      await managementApi.deletePromotion(id);
      if (generation.current === request) navigate('/promotions');
    } catch (err) {
      if (generation.current === request) {
        setDeleteOpen(false);
        setError(err instanceof Error ? err.message : 'ลบโปรโมชั่นไม่สำเร็จ');
      }
    } finally {
      if (generation.current === request) {
        deletingRef.current = false;
        setDeleting(false);
      }
    }
  };

  const sectionTitle = (title: string) => (
    <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', mb: 2 }}>
      {title}
    </Typography>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton size="small" disabled={saving || deleting} onClick={() => navigate('/promotions')} sx={{ border: '1px solid #e2e8f0' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
            {mode === 'create' ? 'สร้างโปรโมชั่นใหม่' : 'แก้ไขโปรโมชั่น'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {mode === 'edit' && (
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={!ready || saving || deleting}
              onClick={() => setDeleteOpen(true)}
              sx={{ borderColor: '#dc2626', color: '#dc2626', '&:hover': { borderColor: '#b91c1c', bgcolor: '#fef2f2' } }}
            >
              {deleting ? 'กำลังลบ...' : 'ลบโปรโมชั่น'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            disabled={saving || deleting}
            onClick={() => navigate('/promotions')}
            sx={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={disabled || readingImage || !!imageError || concerts.length === 0 || zones.length === 0}
            onClick={handleSave}
            sx={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              '&:hover': { background: 'linear-gradient(135deg,#16a34a,#15803d)' },
            }}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
        </Stack>
      </Box>

      {loading && <Box sx={{ mb: 2 }}><LinearProgress aria-label="กำลังโหลดข้อมูล" /><Typography sx={{ mt: 1 }}>กำลังโหลดข้อมูล...</Typography></Box>}
      {loadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setRetry((value) => value + 1)}>ลองอีกครั้ง</Button>}>{loadError}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {ready && <Alert severity="info" sx={{ mb: 2 }}>เมื่อบันทึก โปรโมชั่นใหม่และรายการแก้ไขจะเป็นแบบร่างรอการอนุมัติ</Alert>}
      {ready && (concerts.length === 0 || zones.length === 0) && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setRetry((value) => value + 1)}>ลองอีกครั้ง</Button>}>ยังไม่มีคอนเสิร์ตหรือโซนให้เลือก ไม่สามารถบันทึกได้</Alert>}

      <Box component="fieldset" disabled={disabled} sx={{
        m: 0, p: 0, border: 0, minWidth: 0, display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 11fr) minmax(0, 9fr)' },
        alignItems: 'start', gap: 2.5,
      }}>
        {/* LEFT COLUMN */}
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* ข้อมูลพื้นฐาน */}
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent>
              {sectionTitle('ข้อมูลพื้นฐาน')}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mb: 2 }}>
                <TextField
                  label="ชื่อโปรโมชั่น"
                  required
                  placeholder="ชื่อ"
                  fullWidth
                  size="small"
                  value={form.promotion_name}
                  onChange={(e) => set('promotion_name', e.target.value)}
                />
                <FormControl fullWidth size="small" required>
                  <InputLabel>คอนเสิร์ตที่เกี่ยวข้อง</InputLabel>
                  <Select
                    value={form.concert_id}
                    label="คอนเสิร์ตที่เกี่ยวข้อง"
                    onChange={(e) => set('concert_id', e.target.value)}
                  >
                    <MenuItem value=""><em>------</em></MenuItem>
                    {concerts.map((c) => (
                      <MenuItem key={c.concert_id} value={c.concert_id}>
                        {c.concert_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.82rem', color: '#64748b', mb: 0.75, fontWeight: 600 }}>
                  ชนิดโปรโมชั่น
                </Typography>
                <RadioGroup row value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
                  <FormControlLabel value="percent" control={<Radio size="small" />} label="เปอร์เซ็นต์ (%)" />
                  <FormControlLabel value="fixed" control={<Radio size="small" />} label="จำนวนเงินคงที่" />
                </RadioGroup>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                <TextField
                  label="มูลค่าส่วนลด"
                  required type="number"
                  fullWidth size="small"
                  value={form.discount_value}
                  onChange={(e) => set('discount_value', e.target.value)}
                  slotProps={{
                    input: { endAdornment: <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', ml: 0.5 }}>{form.discount_type === 'percent' ? '%' : 'บาท'}</Typography> },
                  }}
                />
                <TextField
                  label="ส่วนลดสูงสุด"
                  type="number"
                  fullWidth size="small"
                  value={form.max_discount_amount}
                  onChange={(e) => set('max_discount_amount', e.target.value)}
                  slotProps={{
                    input: { endAdornment: <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', ml: 0.5 }}>บาท</Typography> },
                  }}
                />
                <TextField
                  label="รหัสโปรโมชั่น"
                  required
                  fullWidth size="small"
                  placeholder="เช่น ERLY20"
                  value={form.promo_code}
                  onChange={(e) => set('promo_code', e.target.value.toUpperCase())}
                />
              </Box>
            </CardContent>
          </Card>

          {/* รายละเอียดและเงื่อนไข */}
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent>
              {sectionTitle('รายละเอียดและเงื่อนไข')}
              <TextField
                label="เงื่อนไขการใช้งาน"
                required
                multiline rows={4} fullWidth size="small"
                placeholder="ระบุเงื่อนไขต่างๆ"
                value={form.terms_detail}
                onChange={(e) => set('terms_detail', e.target.value)}
              />
            </CardContent>
          </Card>

          {/* เงื่อนไขการใช้ */}
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent>
              {sectionTitle('เงื่อนไขการใช้งาน')}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                <TextField
                  label="ใช้ได้สูงสุด (ครั้ง/คน)"
                  required
                  fullWidth size="small" type="number"
                  value={form.max_usage_per_user}
                  onChange={(e) => set('max_usage_per_user', e.target.value)}
                  slotProps={{
                    input: { endAdornment: <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', ml: 0.5 }}>ครั้ง</Typography> },
                  }}
                />
                <TextField
                  label="ยอดสั่งซื้อขั้นต่ำ"
                  fullWidth size="small" type="number"
                  value={form.min_order_amount}
                  onChange={(e) => set('min_order_amount', e.target.value)}
                  slotProps={{
                    input: { endAdornment: <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', ml: 0.5 }}>บาท</Typography> },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* RIGHT COLUMN */}
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent>
              {sectionTitle('สื่อและการตั้งค่าแคมเปญ')}

              {/* Upload Area */}
              <Box
                onClick={() => { if (!disabled && !savingRef.current) fileInputRef.current?.click(); }}
                sx={{
                  border: '2px dashed #e2e8f0', borderRadius: 2, mb: 2,
                  overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s',
                  '&:hover': { borderColor: '#d63384' },
                  minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {form.banner_image_url ? (
                  <Box sx={{ position: 'relative', width: '100%' }}>
                    <Box
                      component="img"
                      src={form.banner_image_url}
                      alt="banner"
                      sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                    />
                    <IconButton
                      size="small"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); readerRef.current?.abort(); readerRef.current = null; setReadingImage(false); setImageError(''); set('banner_image_url', ''); }}
                      sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(239,68,68,0.8)' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <CloudUploadIcon sx={{ fontSize: 36, color: '#cbd5e1', mb: 1 }} />
                    <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>คลิกเพื่ออัปโหลด</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#cbd5e1' }}>PNG, JPEG, WebP ไม่เกิน 5 MB</Typography>
                  </Box>
                )}
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={disabled}
                style={{ display: 'none' }}
                onChange={handleImageChange}
              />

              {readingImage && <Typography role="status">กำลังอ่านรูปภาพ...</Typography>}
              {imageError && <Alert severity="error" onClose={() => setImageError('')}>{imageError}</Alert>}

              <Divider sx={{ my: 2 }} />

              {/* Date Range */}
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', mb: 1, fontWeight: 600 }}>
                ระยะเวลาที่ใช้ได้
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  type="date" size="small" label="เริ่มต้น"
                  required
                  value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
                <TextField
                  type="date" size="small" label="สิ้นสุด"
                  required
                  value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Box>

              {/* Total Quota */}
              <TextField
                label="จำนวนสิทธิ์ทั้งหมด"
                required
                type="number" fullWidth size="small"
                value={form.total_quota}
                onChange={(e) => set('total_quota', e.target.value)}
                sx={{ mb: 2 }}
              />

              {/* Zones */}
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', mb: 1, fontWeight: 600 }}>
                โซนเข้าร่วม
              </Typography>
              <FormGroup>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25 }}>
                  {zones.map((z) => (
                    <FormControlLabel
                      key={z.zone_id}
                      control={
                        <Checkbox
                          size="small"
                          checked={form.selected_zones.includes(z.zone_id)}
                          onChange={() => toggleZone(z.zone_id)}
                          sx={{ '&.Mui-checked': { color: '#d63384' } }}
                        />
                      }
                      label={<Typography sx={{ fontSize: '0.82rem' }}>{z.zone_name}</Typography>}
                    />
                  ))}
                </Box>
              </FormGroup>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onCancel={() => { if (!deletingRef.current) setDeleteOpen(false); }}
        onConfirm={handleDelete}
        loading={deleting}
        message={`ยืนยันว่าจะลบโปรโมชั่น “${form.promotion_name}” จริงหรือไม่?`}
      />

    </Box>
  );
}
