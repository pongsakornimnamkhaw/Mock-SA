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
type HistoryTab = 'staff' | 'user';

const accountActivityTypes: Record<HistoryTab, readonly string[]> = {
  staff: ['สร้างบัญชี', 'เข้าสู่ระบบ', 'แก้ไขบัญชี', 'เปลี่ยนสิทธิ์', 'เปลี่ยนรหัสผ่าน', 'รีเซ็ตรหัสผ่าน', 'ปิดใช้งานบัญชี'],
  user: ['สร้างบัญชี', 'เข้าสู่ระบบ', 'แก้ไขบัญชี', 'เปลี่ยนรหัสผ่าน', 'รีเซ็ตรหัสผ่าน'],
};

const thailandTimeZone = 'Asia/Bangkok';
const thailandDateTimeFormatter = new Intl.DateTimeFormat('th-TH-u-nu-latn', {
  timeZone: thailandTimeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const thailandDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: thailandTimeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function parseLogDate(isoDate: string) {
  const value = isoDate.trim();
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasTimeZone ? value : `${value}+07:00`);
}

function localDateKey(isoDate: string) {
  const date = parseLogDate(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    thailandDateKeyFormatter.formatToParts(date).map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatLogDate(isoDate: string) {
  const date = parseLogDate(isoDate);
  return Number.isNaN(date.getTime()) ? '—' : `${thailandDateTimeFormatter.format(date)} น.`;
}

export default function UsageHistoryPage() {
  const [tab, setTab] = useState<HistoryTab>('staff');
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
        const result = await managementApi.activityLogs(tab, 'account');
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

  const handleTabChange = (_event: SyntheticEvent, newValue: HistoryTab) => {
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
      const isAccountActivity = accountActivityTypes[tab].includes(log.activity_type);
      const matchSearch = log.user_name.toLowerCase().includes(query) ||
                          log.user_code.toLowerCase().includes(query);
      const matchDate = !filters.dateRange || localDateKey(log.date) === filters.dateRange;
      const matchType = filters.activityType === 'all' ||
                        log.activity_type === filters.activityType;
      
      return isAccountActivity && matchSearch && matchDate && matchType;
    });
  }, [logs, filters, tab]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const activityTypes = accountActivityTypes[tab];

  useEffect(() => {
    if (!loading && !loadError) setPage(currentPage);
  }, [currentPage, loading, loadError]);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'สร้างบัญชี': return '#16a34a';
      case 'เข้าสู่ระบบ': return '#2563eb';
      case 'แก้ไขบัญชี': return '#7c3aed';
      case 'เปลี่ยนสิทธิ์': return '#d97706';
      case 'เปลี่ยนรหัสผ่าน':
      case 'รีเซ็ตรหัสผ่าน': return '#ea580c';
      case 'ปิดใช้งานบัญชี': return '#dc2626';
      default: return '#6b7280';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
          ประวัติกิจกรรมบัญชี
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
              <Typography variant="body2" sx={{ mb: 1 }}>บัญชี</Typography>
              <TextField
                fullWidth
                size="small"
                placeholder={tab === 'staff' ? 'รหัสพนักงาน หรือ ชื่อ' : 'รหัสผู้ใช้งาน หรือ ชื่อ'}
                value={searchTerm}
                disabled={loading || !!loadError}
                slotProps={{ htmlInput: { 'aria-label': 'บัญชี' } }}
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
              <TableCell>บัญชี</TableCell>
              <TableCell>ประเภทกิจกรรม</TableCell>
              <TableCell sx={{ width: 180, whiteSpace: 'nowrap' }}>รหัสบัญชี</TableCell>
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
