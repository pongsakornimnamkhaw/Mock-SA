// src/components/promotions/approval/PromotionApprovalPage.tsx
import { useState, useEffect, useRef } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Avatar from '@mui/material/Avatar';
import Card from '@mui/material/Card';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import DiscountIcon from '@mui/icons-material/Discount';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PendingIcon from '@mui/icons-material/Pending';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

import { managementApi } from '../../../../api/managementApi';
import type { Promotion, PromotionApproval } from '../../../../types/promotion';
import Pagination from '../../../../components/ui/Pagination';
import { useNavigate } from 'react-router-dom';
import { promotionFontSizes, promotionPageSx, promotionTitleSx } from '../typography';

interface ApprovalItem {
  approval: PromotionApproval;
  promotion: Promotion;
}

// ─── Styled ──────────────────────────────────────────────────────────────────
const RequestCard = styled(Box)<{ selected?: number }>(({ selected }) => ({
  padding: '14px 16px',
  borderRadius: 12,
  cursor: 'pointer',
  marginBottom: 8,
  border: selected ? '2px solid transparent' : '2px solid #f1f5f9',
  background: selected
    ? 'linear-gradient(135deg, #d63384 0%, #7c3aed 100%)'
    : '#ffffff',
  color: selected ? '#fff' : '#1e293b',
  transition: 'all 0.25s ease',
  boxShadow: selected ? '0 6px 20px rgba(214,51,132,0.35)' : '0 1px 4px rgba(0,0,0,0.05)',
  '&:hover': {
    boxShadow: '0 4px 14px rgba(214,51,132,0.2)',
    borderColor: selected ? 'transparent' : '#d63384',
  },
}));

const YellowSummaryBox = styled(Box)({
  background: 'linear-gradient(135deg, #fef9c3, #fde68a)',
  border: '1px solid #fbbf24',
  borderRadius: 12,
  padding: '16px 20px',
  textAlign: 'center',
});

const InfoRow = styled(Box)({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '10px 14px',
  backgroundColor: '#fdf4ff',
  borderRadius: 10,
  border: '1px solid #f3e8ff',
});

// ─── helpers ─────────────────────────────────────────────────────────────────
const timeAgo = (dateStr: string) => {
  if (!dateStr || !Number.isFinite(Date.parse(dateStr))) return '—';
  const diff = Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.round(diff / 60)} นาทีที่ผ่านมา`;
  if (diff < 86400) return `${Math.round(diff / 3600)} ชม.ที่ผ่านมา`;
  return `${Math.round(diff / 86400)} วันที่ผ่านมา`;
};

const formatDate = (d?: string) =>
  d && Number.isFinite(Date.parse(d)) ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PAGE_SIZE = 8;

// ─── Component ───────────────────────────────────────────────────────────────
export default function PromotionApprovalPage() {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const decisionRef = useRef(false);

  const [mainTab, setMainTab] = useState<'pending' | 'history'>('pending');
  const [selectedId, setSelectedId] = useState('');
  const [remark, setRemark] = useState('');
  const [toast, setToast] = useState('');

  // History tab state
  const [historyTab, setHistoryTab] = useState<'all' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    setAllItems([]);
    const load = async () => {
      try {
        const response = await managementApi.listApprovals();
        if (generation.current !== request) return;
        setAllItems(response.data);
        setSelectedId((previous) => response.data.some((item) => item.approval.approval_id === previous && item.approval.status === 'pending')
          ? previous : response.data.find((item) => item.approval.status === 'pending')?.approval.approval_id ?? '');
      } catch (err) {
        if (generation.current === request) setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการอนุมัติได้');
      } finally {
        if (generation.current === request) {
          setLoading(false);
          setBusy(false);
          decisionRef.current = false;
        }
      }
    };
    void load();
    return () => { generation.current = request + 1; };
  }, [retry]);

  // ── Pending items (not yet acted on) ──
  const pendingItems = allItems.filter(
    (item) => item.approval.status === 'pending'
  );

  const selected = pendingItems.find((i) => i.approval.approval_id === selectedId) ?? pendingItems[0];

  // Decisions and actors are always read back from the backend.
  const historyItems = allItems.filter((item) => item.approval.status === 'approved' || item.approval.status === 'rejected');

  const filteredHistory = historyItems.filter((item) => {
    const status = item.approval.status;
    const matchTab = historyTab === 'all' || status === historyTab;
    const matchSearch =
      !search ||
      item.promotion.promotion_name.toLowerCase().includes(search.toLowerCase()) ||
      (item.approval.requested_by ?? '').toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const currentHistoryRows = filteredHistory.slice((currentHistoryPage - 1) * PAGE_SIZE, currentHistoryPage * PAGE_SIZE);

  const countByStatus = (s: 'approved' | 'rejected') =>
    historyItems.filter((item) => item.approval.status === s).length;

  const handleDecision = async (status: 'approved' | 'rejected') => {
    if (!selected || loading || error || decisionRef.current) return;
    const request = generation.current;
    decisionRef.current = true;
    setBusy(true);
    setActionError('');
    setToast('');
    try {
      await managementApi.decideApproval(selected.approval.approval_id, status, remark.trim());
      if (generation.current !== request) return;
      setToast(status === 'approved' ? 'อนุมัติโปรโมชั่นเรียบร้อยแล้ว' : 'บันทึกการปฏิเสธคำขอแล้ว');
      setRemark('');
    } catch (err) {
      if (generation.current === request) setActionError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกผลการพิจารณาได้');
    } finally {
      if (generation.current === request) {
        // Refresh even after an uncertain failure; never repeat the mutation.
        setLoading(true);
        setRetry((value) => value + 1);
      }
    }
  };

  const promo = selected?.promotion;
  const approval = selected?.approval;
  const di = promo?.discount_info;
  const qp = promo?.quota_and_period;
  const tc = promo?.terms_and_conditions;
  const discountCap = di?.discount_type === 'fixed'
    ? (di.max_discount_amount > 0 ? Math.min(di.discount_value, di.max_discount_amount) : di.discount_value)
    : di && di.max_discount_amount > 0 ? di.max_discount_amount : null;
  const totalEstimate = qp && discountCap != null ? qp.total_quota * discountCap : null;
  const countLabel = (count: number) => loading || error ? '—' : count;

  return (
    <Box sx={[promotionPageSx, { display: 'flex', flexDirection: 'column', height: { xs: 'auto', lg: 'calc(100vh - 48px)' }, minHeight: 'calc(100vh - 48px)' }]}>
      {/* ── Top: Main Tabs ──────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, gap: 2, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('/promotions')} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography component="h1" sx={promotionTitleSx}>
          ตรวจสอบการอนุมัติ
        </Typography>
        <Box sx={{ flex: 1 }} />
        {/* Stats chips */}
        <Chip icon={<PendingIcon sx={{ fontSize: 14 }} />} label={`รออนุมัติ ${countLabel(pendingItems.length)}`}
          sx={{ bgcolor: '#fdf2f8', color: '#d63384', fontWeight: 700, border: '1px solid #fbcfe8' }} />
        <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label={`อนุมัติแล้ว ${countLabel(countByStatus('approved'))}`}
          sx={{ bgcolor: '#f0fdf4', color: '#16a34a', fontWeight: 700, border: '1px solid #bbf7d0' }} />
        <Chip icon={<CancelIcon sx={{ fontSize: 14 }} />} label={`ปฏิเสธ ${countLabel(countByStatus('rejected'))}`}
          sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700, border: '1px solid #fecaca' }} />
      </Box>

      {/* Main Tab bar */}
      <Box sx={{ borderBottom: '2px solid #f1f5f9', flexShrink: 0, mb: 1.5 }}>
        <Tabs
          value={mainTab}
          variant="scrollable"
          scrollButtons="auto"
          onChange={(_, v) => setMainTab(v)}
          sx={{ minHeight: 38, '& .MuiTabs-indicator': { background: 'linear-gradient(90deg,#d63384,#7c3aed)', height: 3 } }}
        >
          <Tab value="pending" label={`รออนุมัติ (${countLabel(pendingItems.length)})`}
            sx={{ minHeight: 38, fontWeight: 700, color: mainTab === 'pending' ? '#d63384 !important' : '#64748b', fontSize: promotionFontSizes.body }} />
          <Tab value="history" label={`ประวัติการอนุมัติ (${countLabel(historyItems.length)})`}
            sx={{ minHeight: 38, fontWeight: 700, color: mainTab === 'history' ? '#d63384 !important' : '#64748b', fontSize: promotionFontSizes.body }} />
        </Tabs>
      </Box>

      {loading && <Box sx={{ mb: 2 }}><LinearProgress aria-label="กำลังโหลดรายการอนุมัติ" /><Typography sx={{ mt: 1 }}>กำลังโหลดรายการอนุมัติ...</Typography></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setRetry((value) => value + 1)}>ลองอีกครั้ง</Button>}>{error}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: รออนุมัติ — 2-panel
      ══════════════════════════════════════════════════════════════ */}
      {!loading && !error && mainTab === 'pending' && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 0, flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 3, border: '1px solid #e2e8f0' }}>
          {/* LEFT: Request List */}
          <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0, maxHeight: { xs: 360, md: 'none' }, display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
            <Box sx={{ p: '10px 14px', bgcolor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
              <Typography component="h2" sx={{ fontWeight: 700, fontSize: promotionFontSizes.heading, color: '#1e293b' }}>รายการคำขอ</Typography>
              <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>{pendingItems.length} รายการรออนุมัติ</Typography>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', p: '10px' }}>
              {pendingItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
                  <CheckCircleIcon sx={{ fontSize: 40, mb: 1, color: '#22c55e' }} />
                  <Typography sx={{ fontSize: promotionFontSizes.body }}>ไม่มีรายการรออนุมัติ</Typography>
                  <Button size="small" sx={{ mt: 1, color: '#d63384' }} onClick={() => setMainTab('history')}>
                    ดูประวัติ →
                  </Button>
                </Box>
              ) : (
                pendingItems.map((item) => {
                  const isSel = item.approval.approval_id === selected?.approval.approval_id;
                  return (
                    <RequestCard key={item.approval.approval_id} selected={isSel ? 1 : 0}
                      aria-disabled={busy}
                      onClick={() => { if (!decisionRef.current) { setSelectedId(item.approval.approval_id); setRemark(''); } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                        <Typography sx={{ fontSize: promotionFontSizes.secondary, opacity: 0.75 }}>{timeAgo(item.approval.requested_at)}</Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: promotionFontSizes.body, mb: 0.25 }}>{item.promotion.promotion_name}</Typography>
                      <Typography sx={{ fontSize: promotionFontSizes.secondary, opacity: 0.8, mb: 0.75 }}>โดย: {item.approval.requested_by || 'ไม่ทราบผู้ยื่นคำขอ'}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <DiscountIcon sx={{ fontSize: 13, opacity: 0.85 }} />
                          <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 700 }}>
                            {item.promotion.discount_info ? `ลด ${item.promotion.discount_info.discount_value}${item.promotion.discount_info.discount_type === 'percent' ? '%' : ' บาท'}` : '—'}
                          </Typography>
                        </Box>
                        {isSel && <Typography sx={{ fontSize: promotionFontSizes.body, opacity: 0.9 }}>›</Typography>}
                      </Box>
                    </RequestCard>
                  );
                })
              )}
            </Box>
          </Box>

          {/* RIGHT: Detail */}
          {selected && promo ? (
            <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', bgcolor: '#fff', display: 'flex', flexDirection: 'column' }}>
              {/* Banner */}
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                {promo.banner_image_url ? <Box component="img" src={promo.banner_image_url} alt={promo.promotion_name}
                  sx={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} /> : <Box sx={{ height: 150, bgcolor: '#64748b', color: '#fff', textAlign: 'center', pt: 7 }}>ไม่มีรูปภาพ</Box>}
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
                <Box sx={{ position: 'absolute', top: 10, left: 14 }}>
                  <Chip label={`CONCERT: ${promo.concert?.concert_name?.toUpperCase() || '—'}`} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: '#fff', fontWeight: 700, backdropFilter: 'blur(4px)', fontSize: promotionFontSizes.secondary, border: '1px solid rgba(255,255,255,0.35)' }} />
                </Box>
                <Box sx={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
                  <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: promotionFontSizes.heading, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    {promo.promotion_name}
                  </Typography>
                </Box>
              </Box>

              {/* Body */}
              <Box sx={{ p: '16px 20px', flex: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', xl: 'repeat(2,minmax(0,1fr))' }, gap: 2, mb: 2 }}>
                  {/* Left: Discount info */}
                  <Box>
                    <Typography component="h3" sx={{ fontWeight: 700, fontSize: promotionFontSizes.heading, color: '#1e293b', mb: 1 }}>รายละเอียดส่วนลด</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <InfoRow>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#fdf4ff', border: '2px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <DiscountIcon sx={{ fontSize: 14, color: '#7c3aed' }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>Discount Type</Typography>
                          <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 700, color: '#7c3aed' }}>
                            {di ? `${di.discount_type === 'percent' ? 'Percentage Discount' : 'Fixed Amount'} (${di.discount_value}${di.discount_type === 'percent' ? '%' : ' บาท'})` : '—'}
                          </Typography>
                        </Box>
                      </InfoRow>
                      <InfoRow>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#fff7ed', border: '2px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <LocalOfferIcon sx={{ fontSize: 14, color: '#ea580c' }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>Promo Code</Typography>
                          <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 700, color: '#1e293b', letterSpacing: 1 }}>{di?.promo_code || '—'}</Typography>
                        </Box>
                      </InfoRow>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '8px 12px', bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                        <CalendarMonthIcon sx={{ fontSize: 15, color: '#22c55e' }} />
                        <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 600, color: '#15803d' }}>
                          {formatDate(qp?.start_date)} → {formatDate(qp?.end_date)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Right: Quota + Budget */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '8px 12px', bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <PeopleIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                        <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#64748b' }}>ประมาณการสิทธิ์</Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: promotionFontSizes.body, color: '#1e293b' }}>
                        {qp?.total_quota?.toLocaleString() ?? '—'} สิทธิ์
                      </Typography>
                    </Box>
                    <YellowSummaryBox>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.25 }}>
                        <AttachMoneyIcon sx={{ color: '#92400e', fontSize: 16 }} />
                        <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#92400e', fontWeight: 700 }}>เพดานงบส่วนลดตามสิทธิ์ทั้งหมด</Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: promotionFontSizes.heading, color: '#78350f', lineHeight: 1.4 }}>
                        {totalEstimate?.toLocaleString() ?? 'ไม่ทราบ'}
                        <span style={{ fontSize: promotionFontSizes.secondary, marginLeft: 4 }}>บาท</span>
                      </Typography>
                    </YellowSummaryBox>
                    {tc?.terms_detail && (
                      <Box sx={{ p: '8px 12px', bgcolor: '#fef9c3', borderRadius: 2, border: '1px solid #fde047', flex: 1 }}>
                        <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#713f12', fontWeight: 700, mb: 0.25 }}>เงื่อนไขการใช้งาน</Typography>
                        <Typography sx={{ fontSize: promotionFontSizes.body, color: '#854d0e', lineHeight: 1.6 }}>{tc.terms_detail}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                {/* Requester */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, p: '8px 12px', bgcolor: '#f8fafc', borderRadius: 2 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#d63384,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: promotionFontSizes.body }}>{approval?.requested_by?.[0] ?? '?'}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: promotionFontSizes.body, color: '#1e293b' }}>{approval?.requested_by || 'ไม่ทราบผู้ยื่นคำขอ'}</Typography>
                    <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>ยื่นคำขอเมื่อ {formatDate(approval?.requested_at)}</Typography>
                  </Box>
                </Box>

                {/* Remark */}
                <TextField label="หมายเหตุ (ถ้ามี)" multiline rows={2} fullWidth size="small"
                  disabled={busy}
                  placeholder="ระบุเหตุผลหรือคำแนะนำ..." value={remark}
                  onChange={(e) => setRemark(e.target.value)} sx={{ mb: 1.5 }} />

                {/* Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button fullWidth variant="contained" startIcon={<CancelIcon />} disabled={busy} onClick={() => handleDecision('rejected')}
                    sx={{ background: 'linear-gradient(135deg,#f43f5e,#e11d48)', '&:hover': { background: 'linear-gradient(135deg,#e11d48,#be123c)' }, py: 1.25, fontWeight: 700, boxShadow: '0 4px 12px rgba(244,63,94,0.3)' }}>
                    ปฏิเสธคำขอ
                  </Button>
                  <Button fullWidth variant="contained" startIcon={<CheckCircleIcon />} disabled={busy} onClick={() => handleDecision('approved')}
                    sx={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', '&:hover': { background: 'linear-gradient(135deg,#6d28d9,#4338ca)' }, py: 1.25, fontWeight: 700, boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                    อนุมัติโปรโมชั่น
                  </Button>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, bgcolor: '#fff', color: '#94a3b8' }}>
              <CheckCircleIcon sx={{ fontSize: 52, color: '#22c55e' }} />
              <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 600 }}>ไม่มีรายการรออนุมัติ</Typography>
              <Button variant="outlined" size="small" sx={{ color: '#d63384', borderColor: '#d63384' }} onClick={() => setMainTab('history')}>
                ดูประวัติการอนุมัติ →
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: ประวัติการอนุมัติ — Table
      ══════════════════════════════════════════════════════════════ */}
      {!loading && !error && mainTab === 'history' && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            {/* Sub filter bar */}
            <Box sx={{ p: '12px 16px', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
              {/* Sub tabs */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {([
                  { value: 'all', label: 'ทั้งหมด', count: historyItems.length, color: '#64748b', bg: '#f8fafc' },
                  { value: 'approved', label: 'อนุมัติแล้ว', count: countByStatus('approved'), color: '#16a34a', bg: '#f0fdf4' },
                  { value: 'rejected', label: 'ปฏิเสธ', count: countByStatus('rejected'), color: '#dc2626', bg: '#fef2f2' },
                ] as const).map((t) => (
                  <Button
                    key={t.value}
                    size="small"
                    onClick={() => { setHistoryTab(t.value); setHistoryPage(1); }}
                    sx={{
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.5,
                      fontWeight: 700,
                      fontSize: promotionFontSizes.body,
                      color: historyTab === t.value ? t.color : '#94a3b8',
                      bgcolor: historyTab === t.value ? t.bg : 'transparent',
                      border: historyTab === t.value ? `1.5px solid ${t.color}30` : '1.5px solid transparent',
                    }}
                  >
                    {t.label}
                    <Chip label={t.count} size="small"
                      sx={{ ml: 0.75, height: 18, fontSize: promotionFontSizes.secondary, bgcolor: historyTab === t.value ? `${t.color}20` : '#f1f5f9', color: historyTab === t.value ? t.color : '#94a3b8' }} />
                  </Button>
                ))}
              </Box>

              <Box sx={{ flex: 1 }} />

              {/* Search */}
              <Box sx={{ position: 'relative', width: { xs: '100%', sm: 320 } }}>
                <Box sx={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                  <SearchIcon sx={{ fontSize: 17, color: '#94a3b8' }} />
                </Box>
                <TextField size="small" placeholder="ค้นหาชื่อโปรโมชั่น หรือ ผู้ขอ..."
                  value={search} onChange={(e) => { setSearch(e.target.value); setHistoryPage(1); }}
                  sx={{ width: '100%', '& .MuiOutlinedInput-root input': { paddingLeft: '32px' } }} />
                {search && (
                  <IconButton size="small" onClick={() => { setSearch(''); setHistoryPage(1); }}
                    sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}>
                    <ClearIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Table */}
            <TableContainer>
              <Table sx={{ minWidth: 1400 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '30%' }}>ชื่อโปรโมชั่น</TableCell>
                    <TableCell>ผู้ยื่นคำขอ</TableCell>
                    <TableCell>วันที่ยื่น</TableCell>
                    <TableCell>ผู้อนุมัติ / พิจารณา</TableCell>
                    <TableCell>วันที่พิจารณา</TableCell>
                    <TableCell>ผลการพิจารณา</TableCell>
                    <TableCell>หมายเหตุ</TableCell>
                    <TableCell align="center">ดูรายละเอียด</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentHistoryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 5, color: '#94a3b8', fontSize: promotionFontSizes.body }}>
                        ไม่พบรายการประวัติที่ตรงกับเงื่อนไข
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentHistoryRows.map((item) => {
                      const finalStatus = item.approval.status;
                      const finalRemark = item.approval.remark;
                      const finalAt = item.approval.approved_at;
                      const finalBy = item.approval.approved_by || 'ไม่ทราบผู้พิจารณา';
                      const isApproved = finalStatus === 'approved';

                      return (
                        <TableRow key={item.approval.approval_id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar src={item.promotion.banner_image_url} variant="rounded"
                                sx={{ width: 44, height: 32, borderRadius: 1.5, border: '1px solid #f1f5f9' }} />
                              <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: promotionFontSizes.body, color: '#1e293b' }}>
                                  {item.promotion.promotion_name}
                                </Typography>
                                <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>
                                  {item.promotion.concert?.concert_name}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: promotionFontSizes.body }}>{item.approval.requested_by || 'ไม่ทราบผู้ยื่นคำขอ'}</TableCell>
                          <TableCell sx={{ fontSize: promotionFontSizes.body }}>{formatDate(item.approval.requested_at)}</TableCell>
                          <TableCell sx={{ fontSize: promotionFontSizes.body, color: '#475569' }}>{finalBy}</TableCell>
                          <TableCell sx={{ fontSize: promotionFontSizes.body }}>{formatDate(finalAt)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, borderRadius: 6,
                              bgcolor: isApproved ? '#f0fdf4' : '#fef2f2',
                              border: `1px solid ${isApproved ? '#bbf7d0' : '#fecaca'}` }}>
                              {isApproved
                                ? <CheckCircleIcon sx={{ fontSize: 13, color: '#16a34a' }} />
                                : <CancelIcon sx={{ fontSize: 13, color: '#dc2626' }} />}
                              <Typography sx={{ fontSize: promotionFontSizes.secondary, fontWeight: 700, color: isApproved ? '#16a34a' : '#dc2626' }}>
                                {isApproved ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: promotionFontSizes.body, color: '#64748b', maxWidth: 140 }}>
                            <Typography sx={{ fontSize: promotionFontSizes.body, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                              {finalRemark || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small"
                              onClick={() => navigate(`/promotions/${item.promotion.promotion_id}`)}
                              sx={{ color: '#64748b', '&:hover': { color: '#d63384', bgcolor: '#fdf2f8' } }}>
                              <VisibilityIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
              <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>
                แสดง {filteredHistory.length === 0 ? 0 : (currentHistoryPage - 1) * PAGE_SIZE + 1}–{Math.min(currentHistoryPage * PAGE_SIZE, filteredHistory.length)} จาก {filteredHistory.length} รายการ
              </Typography>
              <Pagination currentPage={currentHistoryPage} totalPages={totalHistoryPages} onPageChange={setHistoryPage} />
            </Box>
          </Card>
        </Box>
      )}

      {/* Toast */}
      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" sx={{ fontWeight: 600 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
