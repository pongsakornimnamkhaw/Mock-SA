// src/components/promotions/list/PromotionListPage.tsx
import { useState, useMemo, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VerifiedIcon from '@mui/icons-material/Verified';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ClearIcon from '@mui/icons-material/Clear';

import { managementApi } from '../../../../api/managementApi';
import type { Promotion, TabStatus, EditHistoryEntry, ActivityLog } from '../../../../types/promotion';
import StatusBadge from '../../../../components/ui/StatusBadge';
import Pagination from '../../../../components/ui/Pagination';
import { useNavigate } from 'react-router-dom';
import { promotionFontSizes, promotionPageSx, promotionTitleSx } from '../typography';

const PAGE_SIZE = 3;

interface Props {
  editHistory: EditHistoryEntry[];
  onAddHistory: (entry: EditHistoryEntry) => void;
}

export default function PromotionListPage(_props: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabStatus>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof managementApi.listPromotions>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [logs, setLogs] = useState<(ActivityLog & { target_id?: string })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historyRetry, setHistoryRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setResult(null);
    const load = async () => {
      try {
        const response = await managementApi.listPromotions();
        if (active) setResult(response);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดโปรโมชั่นได้');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    const load = async () => {
      try {
        const response = await managementApi.activityLogs('staff');
        if (active) setLogs(response.data);
      } catch (err) {
        if (active) setHistoryError(err instanceof Error ? err.message : 'ไม่สามารถโหลดประวัติได้');
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [historyRetry]);

  // Keep the legacy props accepted, but only display persisted audit entries.
  const editHistory = logs.filter((entry) =>
    entry.action_code?.includes('PROMOTION') ||
    entry.activity_type.toLowerCase().includes('promotion') ||
    result?.data.some((promo) => promo.promotion_id === entry.target_id)
  );
  const summary = result?.summary;

  const filtered = useMemo(() => {
    return (result?.data ?? []).filter((p) => {
      const matchTab = tab === 'all' || p.status === tab;
      const matchSearch =
        !search ||
        p.promotion_name.toLowerCase().includes(search.toLowerCase()) ||
        p.concert?.concert_name?.toLowerCase().includes(search.toLowerCase());
      const updatedAt = new Date(p.updated_at);
      const matchFrom = !dateFrom || updatedAt >= new Date(dateFrom);
      const matchTo = !dateTo || updatedAt <= new Date(dateTo + 'T23:59:59');
      return matchTab && matchSearch && matchFrom && matchTo;
    });
  }, [result, tab, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const currentItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleTabChange = (_: React.SyntheticEvent, val: TabStatus) => {
    setTab(val);
    setPage(1);
  };

  const handleAction = (action: 'edit' | 'view', promo: Promotion) => {
    if (action === 'view') navigate(`/promotions/${promo.promotion_id}`);
    else navigate(`/promotions/${promo.promotion_id}/edit`);
  };

  const formatRevenue = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);

  return (
    <Box sx={promotionPageSx}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography component="h1" sx={promotionTitleSx}>
          รายการโปรโมชั่น
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/promotions/new')}
            sx={{
              background: 'linear-gradient(135deg, #d63384, #b5206a)',
              '&:hover': { background: 'linear-gradient(135deg, #c2266e, #9a1a58)' },
              boxShadow: '0 4px 12px rgba(214,51,132,0.3)',
            }}
          >
            + สร้างโปรโมชั่นใหม่
          </Button>
          <Button
            variant="outlined"
            startIcon={<VerifiedIcon />}
            onClick={() => navigate('/approvals')}
            sx={{ borderColor: '#d63384', color: '#d63384', '&:hover': { bgcolor: '#fdf2f8' } }}
          >
            ตรวจสอบรายการอนุมัติ
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,minmax(0,1fr))' }, gap: 2, mb: 3 }}>
        {[
          { label: 'โปรโมชั่นที่เปิดใช้งาน', value: summary?.active_promotion_count ?? '—', unit: '', icon: <LocalOfferIcon sx={{ color: '#d63384', fontSize: 28 }} />, bg: '#fdf2f8' },
          { label: 'รายได้รวม', value: summary ? formatRevenue(summary.total_revenue) : '—', unit: 'บาท', icon: <AttachMoneyIcon sx={{ color: '#22c55e', fontSize: 28 }} />, bg: '#f0fdf4' },
          { label: 'จำนวนการใช้สิทธิ์', value: summary?.total_redemptions.toLocaleString() ?? '—', unit: 'ครั้ง', icon: <PeopleIcon sx={{ color: '#7c3aed', fontSize: 28 }} />, bg: '#f5f3ff' },
        ].map((s) => (
          <Card key={s.label} sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '14px !important' }}>
              <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2, bgcolor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </Box>
              <Box>
                <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 700, color: '#64748b', mb: 0.5 }}>{s.label}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: promotionFontSizes.heading, lineHeight: 1.4, color: '#1e293b' }}>
                  {s.value}
                  {s.unit && <span style={{ fontSize: promotionFontSizes.body, fontWeight: 500, color: '#94a3b8', marginLeft: 4 }}>{s.unit}</span>}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Table Card */}
      <Card sx={{ border: '1px solid #f1f5f9', mb: 3 }}>
        {/* Filter Bar */}
        <Box sx={{ p: '12px 16px', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 44, maxWidth: '100%', '& .MuiTabs-indicator': { background: '#d63384' } }}>
            {(['all', 'active', 'expired', 'draft'] as TabStatus[]).map((t) => (
              <Tab
                key={t}
                value={t}
                label={{ all: 'ทั้งหมด', active: 'กำลังใช้งาน', expired: 'หมดอายุ', draft: 'แบบร่าง' }[t]}
                sx={{ minHeight: 44, py: 0.75, color: tab === t ? '#d63384 !important' : '#64748b' }}
              />
            ))}
          </Tabs>
          <Box sx={{ flex: 1 }} />

          {/* Search */}
          <Box sx={{ position: 'relative', width: { xs: '100%', sm: 300 } }}>
            <Box sx={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
            </Box>
            <TextField
              size="small"
              placeholder="ชื่อคอนเสิร์ต หรือ ชื่อโปรโมชั่น"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              sx={{ width: '100%', '& .MuiOutlinedInput-root input': { paddingLeft: '32px' } }}
            />
            {search && (
              <IconButton size="small" onClick={() => { setSearch(''); setPage(1); }}
                sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}>
                <ClearIcon sx={{ fontSize: 15 }} />
              </IconButton>
            )}
          </Box>

          {/* Date filters */}
          <TextField
            size="small" type="date"
            label="แก้ไขตั้งแต่" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 190 }}
          />
          <TextField
            size="small" type="date"
            label="ถึง" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 190 }}
          />
        </Box>

        <Divider />

        {/* Table */}
        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '35%' }}>ชื่อโปรโมชั่น</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell>การใช้งาน</TableCell>
                <TableCell>ยอดขาย</TableCell>
                <TableCell align="center">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5}><LinearProgress aria-label="กำลังโหลดโปรโมชั่น" /><Typography sx={{ py: 2 }}>กำลังโหลดโปรโมชั่น...</Typography></TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={5}><Alert severity="error" action={<Button color="inherit" onClick={() => setRetry((value) => value + 1)}>ลองอีกครั้ง</Button>}>{error}</Alert></TableCell></TableRow>
              ) : currentItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                    ไม่พบโปรโมชั่นที่ตรงกับเงื่อนไข
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((promo) => (
                  <TableRow key={promo.promotion_id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={promo.banner_image_url}
                          variant="rounded"
                          sx={{ width: 52, height: 38, borderRadius: 1.5, border: '1px solid #f1f5f9' }}
                        />
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: promotionFontSizes.body, color: '#1e293b' }}>
                            {promo.promotion_name}
                          </Typography>
                          <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>
                            {promo.concert?.concert_name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><StatusBadge status={promo.status} /></TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 600, color: '#475569' }}>
                        {promo.quota_and_period?.used_quota ?? '—'}/
                        {promo.quota_and_period?.total_quota ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 700, color: '#1e293b' }}>
                        {promo.total_revenue?.toLocaleString() ?? '—'}
                        <span style={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8', marginLeft: 2 }}>บาท</span>
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleAction('edit', promo)}
                          sx={{ color: '#64748b', '&:hover': { color: '#d63384', bgcolor: '#fdf2f8' } }}
                          title="แก้ไข"
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleAction('view', promo)}
                          sx={{ color: '#64748b', '&:hover': { color: '#d63384', bgcolor: '#fdf2f8' } }}
                          title="ดูรายละเอียด"
                        >
                          <VisibilityIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8' }}>
            {loading || error ? '—' : `แสดง ${filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} จาก ${filtered.length} รายการ`}
          </Typography>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
        </Box>
      </Card>

      {/* Edit History Panel */}
      <Card sx={{ border: '1px solid #f1f5f9' }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <HistoryIcon sx={{ color: '#d63384', fontSize: 20 }} />
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: promotionFontSizes.heading, color: '#1e293b' }}>ประวัติการแก้ไข</Typography>
            {!historyLoading && !historyError && editHistory.length > 0 && (
              <Chip label={editHistory.length} size="small"
                sx={{ height: 18, fontSize: promotionFontSizes.secondary, bgcolor: '#fdf2f8', color: '#d63384' }} />
            )}
          </Box>
          <Divider sx={{ mb: 1.5 }} />
          {historyLoading ? (
            <Box><LinearProgress aria-label="กำลังโหลดประวัติ" /><Typography sx={{ py: 2 }}>กำลังโหลดประวัติ...</Typography></Box>
          ) : historyError ? (
            <Alert severity="error" action={<Button color="inherit" onClick={() => setHistoryRetry((value) => value + 1)}>ลองอีกครั้ง</Button>}>{historyError}</Alert>
          ) : editHistory.length === 0 ? (
            <Typography sx={{ color: '#94a3b8', fontSize: promotionFontSizes.body, textAlign: 'center', py: 2 }}>
              ยังไม่มีประวัติการแก้ไขที่บันทึกไว้
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 180, overflowY: 'auto' }}>
              {editHistory.map((entry) => (
                <Box
                  key={entry.log_id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '8px 12px', bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #f1f5f9' }}
                >
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <HistoryIcon sx={{ fontSize: 14, color: '#d63384' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: promotionFontSizes.body, fontWeight: 600, color: '#1e293b' }}>
                      {entry.detail || entry.activity_type} — {entry.user_name || 'ไม่ทราบผู้ดำเนินการ'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 11, color: '#94a3b8' }} />
                    <Typography sx={{ fontSize: promotionFontSizes.secondary, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {entry.date ? new Date(entry.date).toLocaleString('th-TH') : '—'}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
