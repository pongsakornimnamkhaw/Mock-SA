// src/components/promotions/detail/PromotionDetailPage.tsx
import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DiscountIcon from '@mui/icons-material/Discount';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { managementApi } from '../../../../api/managementApi';
import type { Promotion } from '../../../../types/promotion';
import StatusBadge from '../../../../components/ui/StatusBadge';
import Pagination from '../../../../components/ui/Pagination';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmDeleteDialog from '../../../../components/common/ConfirmDeleteDialog';

const PAGE_SIZE = 5;

export default function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const deletingRef = useRef(false);

  useEffect(() => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    setActionError('');
    setPromo(null);
    setPage(1);
    setCopied(false);
    setDeleteOpen(false);
    setDeleting(false);
    deletingRef.current = false;
    const load = async () => {
      try {
        if (!id) throw new Error('ไม่พบรหัสโปรโมชั่น');
        const response = await managementApi.getPromotion(id);
        if (generation.current === request) setPromo(response);
      } catch (err) {
        if (generation.current === request) setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดโปรโมชั่นได้');
      } finally {
        if (generation.current === request) setLoading(false);
      }
    };
    void load();
    return () => { generation.current = request + 1; };
  }, [id, retry]);

  const handleDelete = async () => {
    if (!id || !promo || promo.promotion_id !== id || deletingRef.current) return;
    const request = generation.current;
    deletingRef.current = true;
    setDeleting(true);
    setActionError('');
    try {
      await managementApi.deletePromotion(id);
      if (generation.current === request) navigate('/promotions');
    } catch (err) {
      if (generation.current === request) {
        setActionError(err instanceof Error ? err.message : 'ลบโปรโมชั่นไม่สำเร็จ');
        setDeleteOpen(false);
      }
    } finally {
      if (generation.current === request) {
        deletingRef.current = false;
        setDeleting(false);
      }
    }
  };

  if (loading || (promo && promo.promotion_id !== id)) {
    return <Box sx={{ py: 4 }}><LinearProgress aria-label="กำลังโหลดโปรโมชั่น" /><Typography sx={{ mt: 2 }}>กำลังโหลดโปรโมชั่น...</Typography></Box>;
  }

  if (error) {
    return <Box sx={{ py: 4 }}><Alert severity="error" action={<Button color="inherit" onClick={() => setRetry((value) => value + 1)}>ลองอีกครั้ง</Button>}>{error}</Alert><Button onClick={() => navigate('/promotions')} sx={{ mt: 2 }}>กลับหน้ารายการ</Button></Box>;
  }

  if (!promo) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">ไม่พบโปรโมชั่น</Typography>
        <Button onClick={() => setRetry((value) => value + 1)} sx={{ mt: 2 }}>ลองอีกครั้ง</Button>
        <Button onClick={() => navigate('/promotions')} sx={{ mt: 2 }}>กลับหน้ารายการ</Button>
      </Box>
    );
  }

  const logs = promo.promotion_usage_logs ?? [];
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const currentLogs = logs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const qp = promo.quota_and_period;
  const di = promo.discount_info;
  const tc = promo.terms_and_conditions;
  const usedQ = qp?.used_quota;
  const totalQ = qp?.total_quota;
  const progress = usedQ != null && totalQ != null
    ? (totalQ > 0 ? Math.min(100, Math.max(0, Math.round((usedQ / totalQ) * 100))) : 0)
    : null;

  const totalRevenue = promo.total_revenue ?? (promo.promotion_usage_logs
    ? logs.reduce((sum, log) => sum + log.final_amount, 0) : undefined);
  // Percentages cannot be treated as money. Missing monetary data stays unknown.
  const totalDiscount = promo.total_discount ?? (promo.promotion_usage_logs && logs.every((log) => log.discount_amount != null)
    ? logs.reduce((sum, log) => sum + (log.discount_amount ?? 0), 0) : undefined);

  const handleCopy = async () => {
    if (!di?.promo_code) return;
    const request = generation.current;
    setActionError('');
    try {
      await navigator.clipboard.writeText(di.promo_code);
      if (generation.current === request) setCopied(true);
    } catch {
      if (generation.current === request) setActionError('คัดลอกไม่สำเร็จ กรุณาคัดลอกรหัสด้วยตนเอง');
    }
  };

  const formatDate = (d?: string) => {
    if (!d || !Number.isFinite(Date.parse(d))) return '—';
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Box>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1.5 }}>
        <Link
          underline="hover"
          sx={{ color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
          onClick={() => navigate('/promotions')}
        >
          รายการโปรโมชั่น
        </Link>
        <Typography sx={{ color: '#d63384', fontSize: '0.85rem', fontWeight: 600 }}>
          {promo.promotion_name}
        </Typography>
      </Breadcrumbs>

      {/* Title Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton size="small" disabled={deleting} onClick={() => navigate('/promotions')} sx={{ border: '1px solid #e2e8f0' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
            {promo.promotion_name}
          </Typography>
          <StatusBadge status={promo.status} />
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            disabled={deleting}
            onClick={() => setDeleteOpen(true)}
            sx={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            ลบโปรโมชั่น
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            disabled={deleting}
            onClick={() => navigate(`/promotions/${promo.promotion_id}/edit`)}
            sx={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              '&:hover': { background: 'linear-gradient(135deg,#16a34a,#166534)' },
            }}
          >
            แก้ไขข้อมูล
          </Button>
        </Stack>
      </Box>

      {actionError && !deleteOpen && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

      {/* Main Info */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 2.5, mb: 2.5 }}>
        {/* Left: Banner + Description */}
        <Card sx={{ border: '1px solid #f1f5f9' }}>
          {promo.banner_image_url ? <Box
            component="img"
            src={promo.banner_image_url}
            alt={promo.promotion_name}
            sx={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
          /> : <Box sx={{ height: 200, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>ไม่มีรูปภาพ</Box>}
          <CardContent>
            <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', mb: 1 }}>
              รายละเอียดโปรโมชั่น
            </Typography>
            <Typography sx={{ fontSize: '0.83rem', color: '#475569', lineHeight: 1.7 }}>
              {tc?.terms_detail || promo.description || '—'}
            </Typography>
          </CardContent>
        </Card>

        {/* Right: Info Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Concert + Discount */}
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent sx={{ py: '14px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mb: 0.25 }}>ชื่องานคอนเสิร์ต</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
                    {promo.concert?.concert_name || '—'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mb: 0.25 }}>ส่วนลด</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#d63384' }}>
                    {di ? `ลด ${di.discount_value}${di.discount_type === 'percent' ? '%' : ' บาท'}` : '—'}
                    {di?.discount_type === 'percent' && di.max_discount_amount > 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {' '}(สูงสุด {di.max_discount_amount?.toLocaleString()} บาท)
                      </span>
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Period + Zones */}
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent sx={{ py: '14px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mb: 0.5 }}>ระยะเวลาโปรโมชั่น</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CalendarMonthIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                      {formatDate(qp?.start_date)} → {formatDate(qp?.end_date)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mb: 0.5 }}>โซนเข้าร่วม</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(promo.zones ?? []).map((z) => (
                      <Chip key={z.zone_id} label={z.zone_name} size="small"
                        sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
                    ))}
                  </Stack>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Promo Code */}
          <Card sx={{ border: '1px solid #c4b5fd', bgcolor: '#f5f3ff' }}>
            <CardContent sx={{ py: '12px !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '0.72rem', color: '#7c3aed', mb: 0.25, fontWeight: 600 }}>PROMO CODE</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#5b21b6', letterSpacing: 2 }}>
                  {di?.promo_code || '—'}
                </Typography>
              </Box>
              <Tooltip title="คัดลอก">
                <IconButton disabled={!di?.promo_code} onClick={handleCopy} sx={{ color: '#7c3aed', bgcolor: '#ede9fe', '&:hover': { bgcolor: '#ddd6fe' } }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Usage Stats */}
      <Card sx={{ border: '1px solid #f1f5f9', mb: 2.5 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>สถานะการใช้งาน</Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#94a3b8' }}>เหลือ {totalQ != null && usedQ != null ? Math.max(0, totalQ - usedQ) : '—'} สิทธิ์</Typography>
          </Box>
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#475569' }}>
                ใช้ไปแล้ว <strong>{usedQ ?? '—'}/{totalQ ?? '—'}</strong> สิทธิ์
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#d63384', fontWeight: 600 }}>{progress == null ? '—' : `${progress}%`}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress ?? 0}
              sx={{ height: 8, borderRadius: 4, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #d63384, #7c3aed)' } }}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
            {[
              { icon: <AttachMoneyIcon sx={{ color: '#22c55e', fontSize: 22 }} />, label: 'ยอดขายรวมที่เกิดจากโปรนี้', value: totalRevenue == null ? '—' : `${totalRevenue.toLocaleString()} บ.`, bg: '#f0fdf4' },
              { icon: <DiscountIcon sx={{ color: '#f59e0b', fontSize: 22 }} />, label: 'ส่วนลดรวมที่ให้ไป', value: totalDiscount == null ? '—' : `${totalDiscount.toLocaleString()} บ.`, bg: '#fffbeb' },
              { icon: <ConfirmationNumberIcon sx={{ color: '#7c3aed', fontSize: 22 }} />, label: 'จำนวนการใช้สิทธิ์ผ่านโปรนี้', value: usedQ == null ? '—' : `${usedQ} ครั้ง`, bg: '#f5f3ff' },
            ].map((s) => (
              <Box key={s.label} sx={{ bgcolor: s.bg, borderRadius: 2, p: 2, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>{s.icon}</Box>
                <Typography sx={{ fontSize: '0.72rem', color: '#64748b', mb: 0.5, lineHeight: 1.3 }}>{s.label}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{s.value}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Usage Log Table */}
      <Card sx={{ border: '1px solid #f1f5f9' }}>
        <CardContent sx={{ pb: '8px !important' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b', mb: 1.5 }}>
            ประวัติการใช้ส่วนลด
          </Typography>
        </CardContent>
        <Divider />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>วัน-เวลา</TableCell>
                <TableCell>ชื่อผู้ใช้</TableCell>
                <TableCell>หมายเลขคำสั่งซื้อ</TableCell>
                <TableCell>โซนที่ซื้อ</TableCell>
                <TableCell align="right">ยอดหลังหักส่วนลด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#94a3b8', fontSize: '0.82rem' }}>
                    ยังไม่มีประวัติการใช้งาน
                  </TableCell>
                </TableRow>
              ) : (
                currentLogs.map((log) => (
                  <TableRow key={log.usage_log_id}>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {new Date(log.used_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })},{' '}
                      {new Date(log.used_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{log.user_name}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID: {log.user_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{log.order_id}</TableCell>
                    <TableCell>
                      <Chip label={log.purchased_zone} size="small"
                        sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 600, fontSize: '0.72rem', height: 20 }} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                        {log.final_amount.toLocaleString()} บาท
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            แสดง {Math.min((currentPage - 1) * PAGE_SIZE + 1, logs.length)}–{Math.min(currentPage * PAGE_SIZE, logs.length)} จาก {logs.length} รายการ
          </Typography>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </Box>
      </Card>

      {/* Copy Snackbar */}
      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>คัดลอกรหัสโปรโมชั่นแล้ว!</Alert>
      </Snackbar>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onCancel={() => { if (!deletingRef.current) setDeleteOpen(false); }}
        onConfirm={handleDelete}
        loading={deleting}
        message={`คุณต้องการลบ “${promo.promotion_name}” ใช่หรือไม่?`}
      />
      <Snackbar open={!!actionError} autoHideDuration={5000} onClose={() => setActionError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" variant="filled" onClose={() => setActionError('')} sx={{ width: '100%' }}>{actionError}</Alert>
      </Snackbar>
    </Box>
  );
}
