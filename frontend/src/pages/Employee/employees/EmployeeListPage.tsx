import { useState, useMemo, useEffect, useRef } from 'react';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';

import type { Employee, EmployeePermission } from '../../../types/promotion';
import { managementApi } from '../../../api/managementApi';
import { getEmployeeSession } from '@/utils/employeeSession';
import Pagination from '../../../components/ui/Pagination';
import PasswordResetRequestsPanel from './PasswordResetRequestsPanel';
import { useNavigate } from 'react-router-dom';

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<{
    employee_count: number; admin_count: number; customer_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleting = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissionFilter, setPermissionFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'employees' | 'reset-requests'>('employees');
  
  const currentSession = getEmployeeSession();
  const isAdmin = currentSession?.role === 'admin';
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setEmployees([]);
    setSummary(null);
    const load = async () => {
      try {
        const result = await managementApi.listEmployees();
        if (active) {
          setEmployees(result.data);
          setSummary(result.summary);
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message || 'โหลดรายชื่อพนักงานไม่สำเร็จ' : 'โหลดรายชื่อพนักงานไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [reloadKey]);

  const busy = loading || deletingId !== null;

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const query = searchTerm.trim().toLowerCase();
      const matchSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(query) ||
                          emp.employee_code.toLowerCase().includes(query);
      const matchPerm = permissionFilter === 'all' ? true : emp.permission === permissionFilter;
      return matchSearch && matchPerm;
    });
  }, [employees, searchTerm, permissionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (!loading && !loadError) setPage(currentPage);
  }, [currentPage, loading, loadError]);

  const getPermissionLabel = (perm: EmployeePermission) => {
    switch (perm) {
      case 'admin': return 'แอดมิน';
      case 'edit': return 'แก้ไขเอกสาร';
      case 'view_only': return 'ดูได้อย่างเดียว';
      default: return perm;
    }
  };

  const getPermissionColor = (perm: EmployeePermission) => {
    switch (perm) {
      case 'admin': return '#f97316';
      case 'edit': return '#d63384';
      case 'view_only': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const handleDelete = async (id: string) => {
    if (busy || deleting.current || loadError) return;
    if (!window.confirm('ยืนยันการปิดใช้งานพนักงาน? รายชื่อจะถูกนำออกจากรายการที่ใช้งาน โดยยังเก็บประวัติการใช้งานไว้')) return;
    deleting.current = true;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await managementApi.deleteEmployee(id);
      setLoading(true);
      setEmployees([]);
      setSummary(null);
      setReloadKey(value => value + 1);
    } catch (error) {
      setDeleteError({ id, message: error instanceof Error ? error.message || 'ปิดใช้งานพนักงานไม่สำเร็จ' : 'ปิดใช้งานพนักงานไม่สำเร็จ' });
    } finally {
      deleting.current = false;
      setDeletingId(null);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', flex: 1 }}>
          จัดการสิทธิ์ของพนักงาน
        </Typography>
        {activeTab === 'employees' && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ background: 'linear-gradient(135deg, #d63384, #7c3aed)', '&:hover': { background: 'linear-gradient(135deg,#b5206a,#6d28d9)' }, fontWeight: 700, boxShadow: '0 4px 12px rgba(214,51,132,0.3)' }}
            onClick={() => navigate('/employees/new')}
            disabled={deletingId !== null}
          >
            เพิ่มรายชื่อพนักงานใหม่
          </Button>
        )}
      </Box>

      {isAdmin && (
        <Tabs
          value={activeTab}
          onChange={(_, val: 'employees' | 'reset-requests') => setActiveTab(val)}
          sx={{
            mb: 3,
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '0.95rem' },
            '& .Mui-selected': { color: '#d63384' },
            '& .MuiTabs-indicator': { backgroundColor: '#d63384' },
          }}
        >
          <Tab label="รายชื่อพนักงาน" value="employees" />
          <Tab label="คำร้องรีเซ็ตรหัสผ่าน" value="reset-requests" />
        </Tabs>
      )}

      {activeTab === 'reset-requests' && isAdmin ? (
        <PasswordResetRequestsPanel />
      ) : (
        <>
          {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1, border: '1px solid #f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PeopleIcon sx={{ color: '#4f46e5', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#64748b', fontSize: '0.78rem' }}>พนักงานทั้งหมด</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>{summary?.employee_count.toLocaleString() ?? '—'} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>คน</span></Typography>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, border: '1px solid #f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AdminPanelSettingsIcon sx={{ color: '#f97316', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#64748b', fontSize: '0.78rem' }}>แอดมิน</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#f97316' }}>{summary?.admin_count.toLocaleString() ?? '—'} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>คน</span></Typography>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, border: '1px solid #f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PersonOutlineIcon sx={{ color: '#22c55e', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#64748b', fontSize: '0.78rem' }}>ผู้ใช้งานทั่วไป</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#22c55e' }}>{summary?.customer_count.toLocaleString() ?? '—'} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>คน</span></Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Search & Filter */}
      {deleteError && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" disabled={busy} onClick={() => void handleDelete(deleteError.id)}>ลองอีกครั้ง</Button>
        }>{deleteError.message}</Alert>
      )}
      <Card sx={{ border: '1px solid #f1f5f9', borderRadius: 3, mb: 2.5, p: '12px 16px' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="ค้นหาชื่อพนักงาน หรือ รหัส..."
            size="small"
            value={searchTerm}
            disabled={busy || !!loadError}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            sx={{ width: 300, bgcolor: '#fff' }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: '#94a3b8' }} /></InputAdornment> } }}
          />
          <Select
            size="small"
            value={permissionFilter}
            disabled={busy || !!loadError}
            onChange={(e) => { setPermissionFilter(e.target.value); setPage(1); }}
            sx={{ width: 200, bgcolor: '#fff' }}
          >
            <MenuItem value="all">ทุกสิทธิ์</MenuItem>
            <MenuItem value="admin">แอดมิน</MenuItem>
            <MenuItem value="edit">แก้ไขเอกสาร</MenuItem>
            <MenuItem value="view_only">ดูได้อย่างเดียว</MenuItem>
          </Select>
        </Box>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>รายชื่อพนักงาน</Typography>
        <Typography variant="body2" color="text.secondary">{loading ? 'กำลังโหลด...' : loadError ? 'โหลดข้อมูลไม่สำเร็จ' : `พบ ${filteredEmployees.length} รายการ`}</Typography>
      </Box>

      <TableContainer component={Card} sx={{ border: '1px solid #f1f5f9' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell>พนักงาน</TableCell>
              <TableCell>ตำแหน่ง</TableCell>
              <TableCell>ประเภท</TableCell>
              <TableCell>สิทธิ์ปัจจุบัน</TableCell>
              <TableCell align="center">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && !loadError && paginatedEmployees.map((emp) => (
              <TableRow key={emp.employee_id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {emp.first_name} {emp.last_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{emp.employee_code}</Typography>
                </TableCell>
                <TableCell>{emp.department}</TableCell>
                <TableCell>
                  <Chip
                    label={emp.personnel_type === 'external' ? 'ภายนอก' : 'ภายใน'}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: emp.personnel_type === 'external' ? '#a855f7' : '#3b82f6',
                      color: emp.personnel_type === 'external' ? '#7e22ce' : '#1d4ed8',
                      fontWeight: 600,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={getPermissionLabel(emp.permission)}
                    size="small"
                    sx={{ backgroundColor: getPermissionColor(emp.permission), color: 'white' }}
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/employees/${emp.employee_id}/edit`)}
                    disabled={busy}
                    aria-label={`แก้ไข ${emp.first_name} ${emp.last_name}`}
                    sx={{ color: '#64748b', mr: 0.5, '&:hover': { color: '#7c3aed', bgcolor: '#f5f3ff' } }}
                  >
                    <EditIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(emp.employee_id)}
                    disabled={busy}
                    aria-label={`ปิดใช้งาน ${emp.first_name} ${emp.last_name}`}
                    sx={{ color: '#64748b', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}
                  >
                    {deletingId === emp.employee_id ? <CircularProgress size={18} /> : <DeleteIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && (
              <TableRow><TableCell colSpan={5} align="center">
                <Box role="status" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}><CircularProgress size={20} />กำลังโหลดรายชื่อพนักงาน...</Box>
              </TableCell></TableRow>
            )}
            {!loading && loadError && (
              <TableRow><TableCell colSpan={5}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setLoading(true); setReloadKey(value => value + 1); }}>ลองอีกครั้ง</Button>}>{loadError}</Alert>
              </TableCell></TableRow>
            )}
            {!loading && !loadError && paginatedEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">ไม่พบข้อมูล</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && !loadError && <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          แสดง {filteredEmployees.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredEmployees.length)} จาก {filteredEmployees.length} รายการ
        </Typography>
        <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0 }}>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={nextPage => { if (!busy) setPage(nextPage); }} />
        </Box>
      </Box>}
        </>
      )}
    </Box>
  );
}
