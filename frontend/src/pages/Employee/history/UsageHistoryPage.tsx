import { useState, useMemo, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import type { SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import SearchIcon from '@mui/icons-material/Search';

import { managementApi } from '../../../api/managementApi';
import Pagination from '../../../components/ui/Pagination';
import type { ActivityLog } from '../../../types/promotion';

type HistoryLog = ActivityLog & { target_id?: string };

function localDateKey(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatLogDate(isoDate: string) {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('th-TH');
}

export default function UsageHistoryPage() {
  const [tab, setTab] = useState<'staff' | 'user'>('staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [activityType, setActivityType] = useState('all');
  const [filters, setFilters] = useState({ searchTerm: '', dateRange: '', activityType: 'all' });
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setLogs([]);
    const load = async () => {
      try {
        const result = await managementApi.activityLogs(tab);
        if (active) setLogs(result.data);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message || 'โหลดประวัติการใช้งานไม่สำเร็จ' : 'โหลดประวัติการใช้งานไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [tab, reloadKey]);

  const handleTabChange = (_event: SyntheticEvent, newValue: 'staff' | 'user') => {
    if (newValue === tab) return;
    setLoading(true);
    setLoadError('');
    setLogs([]);
    setTab(newValue);
    setSearchTerm('');
    setDateRange('');
    setActivityType('all');
    setFilters({ searchTerm: '', dateRange: '', activityType: 'all' });
    setPage(1);
  };

  const filteredLogs = useMemo(() => {
    const query = filters.searchTerm.trim().toLowerCase();
    return logs.filter(log => {
      const matchSearch = log.user_name.toLowerCase().includes(query) ||
                          log.user_code.toLowerCase().includes(query);
      const matchDate = !filters.dateRange || localDateKey(log.date) === filters.dateRange;
      const matchType = filters.activityType === 'all' ||
                        (tab === 'user' && filters.activityType === 'ผู้ใช้ทั้งหมด') ||
                        log.activity_type === filters.activityType;
      
      return matchSearch && matchDate && matchType;
    });
  }, [logs, filters, tab]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const originalActivityTypes = tab === 'staff'
    ? ['อัปเดต', 'ลบ', 'สร้าง', 'อนุมัติ']
    : ['ผู้ใช้ทั้งหมด', 'ซื้อบัตร', 'ติดต่อโฆษณา', 'ซื้อบัตรคอนเสิร์ต', 'ประสานงาน'];
  const activityTypes = [...new Set([...originalActivityTypes, ...logs.map(log => log.activity_type)])];

  useEffect(() => {
    if (!loading && !loadError) setPage(currentPage);
  }, [currentPage, loading, loadError]);

  const getBadgeColor = (type: string) => {
    if (tab === 'staff') {
      switch (type) {
        case 'อัปเดต': return '#f59e0b';
        case 'ลบ': return '#ef4444';
        case 'สร้าง': return '#22c55e';
        case 'อนุมัติ': return '#f97316';
        default: return '#6b7280';
      }
    } else {
      switch (type) {
        case 'ซื้อบัตร': return '#22c55e';
        case 'ติดต่อโฆษณา': return '#7c3aed';
        case 'ซื้อบัตรคอนเสิร์ต': return '#3b82f6';
        case 'ประสานงาน': return '#f97316';
        default: return '#6b7280';
      }
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
          ตรวจสอบประวัติการใช้งาน
        </Typography>
      </Box>

      <Box sx={{ borderBottom: '2px solid #f1f5f9', mb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          sx={{ minHeight: 38, '& .MuiTabs-indicator': { background: 'linear-gradient(90deg,#d63384,#7c3aed)', height: 3 } }}
        >
          <Tab value="staff" label="พนักงาน"
            sx={{ minHeight: 38, fontWeight: 700, color: tab === 'staff' ? '#d63384 !important' : '#64748b', fontSize: '1.0rem' }} />
          <Tab value="user" label="ผู้ใช้งาน"
            sx={{ minHeight: 38, fontWeight: 700, color: tab === 'user' ? '#d63384 !important' : '#64748b', fontSize: '1.0rem' }} />
        </Tabs>
      </Box>

      <Card component="form" onSubmit={event => {
        event.preventDefault();
        if (loading || loadError) return;
        setFilters({ searchTerm, dateRange, activityType });
        setPage(1);
      }} sx={{ mb: 2.5, border: '1px solid #f1f5f9', borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SearchIcon sx={{ fontSize: 18, color: '#d63384' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
              ระบุเงื่อนไขการค้นหา
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>ผู้ใช้งาน</Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="รหัสพนักงาน หรือ ชื่อ"
                value={searchTerm}
                disabled={loading || !!loadError}
                slotProps={{ htmlInput: { 'aria-label': 'ผู้ใช้งาน' } }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>ช่วงเวลา</Typography>
              <TextField
                fullWidth
                size="small"
                type="date"
                value={dateRange}
                disabled={loading || !!loadError}
                onChange={(e) => setDateRange(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'ช่วงเวลา' } }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>ประเภทกิจกรรม</Typography>
              <Select
                fullWidth
                size="small"
                value={activityType}
                disabled={loading || !!loadError}
                inputProps={{ 'aria-label': 'ประเภทกิจกรรม' }}
                onChange={(e) => setActivityType(e.target.value)}
              >
                <MenuItem value="all">ทั้งหมด</MenuItem>
                {activityTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </Select>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', pb: 0.5 }}>
              <Button type="submit" variant="contained" color="primary" disabled={loading || !!loadError} sx={{ height: 40 }}>
                🔍 ค้นหา
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>ผลการค้นหา</Typography>
        <Typography variant="body2" color="text.secondary">{loading ? 'กำลังโหลด...' : loadError ? 'โหลดข้อมูลไม่สำเร็จ' : `พบ ${filteredLogs.length} รายการ`}</Typography>
      </Box>

      <TableContainer component={Card} sx={{ border: '1px solid #f1f5f9' }}>
        <Table sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell>วัน-เวลา</TableCell>
              <TableCell>ผู้ใช้งาน</TableCell>
              <TableCell>ประเภทกิจกรรม</TableCell>
              <TableCell sx={{ width: 180, whiteSpace: 'nowrap' }}>Id ที่เกี่ยวข้อง</TableCell>
              <TableCell>รายละเอียด</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && !loadError && paginatedLogs.map((log) => (
              <TableRow key={log.log_id}>
                <TableCell>{formatLogDate(log.date)}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{log.user_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{log.user_code}</Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={log.activity_type}
                    size="small"
                    sx={{ backgroundColor: getBadgeColor(log.activity_type), color: 'white' }}
                  />
                </TableCell>
                <TableCell sx={{ maxWidth: 240, overflowWrap: 'anywhere' }}>
                  {log.target_id?.trim() || '—'}
                </TableCell>
                <TableCell>{log.detail}</TableCell>
              </TableRow>
            ))}
            {loading && (
              <TableRow><TableCell colSpan={5} align="center">
                <Box role="status" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}><CircularProgress size={20} />กำลังโหลดประวัติการใช้งาน...</Box>
              </TableCell></TableRow>
            )}
            {!loading && loadError && (
              <TableRow><TableCell colSpan={5}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setLoading(true); setReloadKey(value => value + 1); }}>ลองอีกครั้ง</Button>}>{loadError}</Alert>
              </TableCell></TableRow>
            )}
            {!loading && !loadError && paginatedLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">ไม่พบข้อมูล</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && !loadError && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages} 
            onPageChange={setPage} 
          />
        </Box>
      )}
    </Box>
  );
}
