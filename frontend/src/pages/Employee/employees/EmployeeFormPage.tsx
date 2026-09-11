import { useState, useEffect, useRef } from 'react';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import IconButton from '@mui/material/IconButton';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import type { Employee, EmployeeJobRole, EmployeeModuleAccess, EmployeePermission, PersonnelType } from '../../../types/promotion';
import { BACKOFFICE_MODULES, defaultModuleAccess, moduleOverridesForSave, type BackofficeModule } from '../../../access/backofficeAccess';
import { managementApi } from '../../../api/managementApi';
import { useNavigate, useParams } from 'react-router-dom';

const DEPARTMENTS = ['ฝ่ายสถานที่', 'ฝ่ายการเงิน', 'ฝ่ายโปรดักชั่น', 'ฝ่ายการตลาด', 'ฝ่ายประชาสัมพันธ์', 'ฝ่ายบุคคล'];
const JOB_ROLES: { value: EmployeeJobRole; label: string }[] = [
  { value: 'staff', label: 'พนักงานทั่วไป' },
  { value: 'organizer', label: 'ผู้จัดงาน' },
  { value: 'co_organizer', label: 'ผู้จัดงานร่วม' },
  { value: 'event_staff', label: 'สตาฟงาน' },
  { value: 'approver', label: 'ผู้มีอำนาจอนุมัติ' },
  { value: 'sales', label: 'ฝ่ายขาย' },
];
type EmployeePayload = Omit<Employee, 'employee_id'>;
type FieldErrors = Partial<Record<keyof EmployeePayload, string>>;

export default function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  return <EmployeeForm key={id ?? 'new'} id={id} />;
}

function EmployeeForm({ id }: { id?: string }) {
  const mode = id ? 'edit' : 'create';
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [department, setDepartment] = useState('');
  const [jobRole, setJobRole] = useState<EmployeeJobRole>('staff');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [personnelType, setPersonnelType] = useState<PersonnelType>('internal');
  
  const [permission, setPermission] = useState<EmployeePermission>('view_only');
  const [editScope, setEditScope] = useState('');
  const [modulePermissions, setModulePermissions] = useState<Partial<Record<BackofficeModule, EmployeeModuleAccess>>>({});
  
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reloadKey, setReloadKey] = useState(0);
  const mounted = useRef(false);
  const saveInFlight = useRef(false);
  const disabled = loading || !!loadError || saving;

  useEffect(() => {
    let active = true;
    mounted.current = true;
    setLoadError('');
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const emp = await managementApi.getEmployee(id);
        if (!active) return;
        if (!emp || emp.employee_id !== id) throw new Error('ไม่พบข้อมูลพนักงานที่ต้องการแก้ไข');
        setFirstName(emp.first_name);
        setLastName(emp.last_name);
        setEmployeeCode(emp.employee_code);
        setDepartment(emp.department);
        setJobRole(emp.job_role ?? 'staff');
        setEmail(emp.email);
        setPhone(emp.phone);
        setPersonnelType(emp.personnel_type ?? 'internal');
        setPermission(emp.permission);
        setEditScope(emp.edit_scope ?? '');
        setModulePermissions(Object.fromEntries((emp.module_permissions ?? []).map(item => [item.module, item.level])));
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message || 'โหลดข้อมูลพนักงานไม่สำเร็จ' : 'โหลดข้อมูลพนักงานไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; mounted.current = false; };
  }, [id, reloadKey]);

  const handleSave = async () => {
    if (disabled || saveInFlight.current) return;
    setSaveError('');
    const payload: EmployeePayload = {
      first_name: firstName.trim(), last_name: lastName.trim(),
      employee_code: employeeCode.trim(), department: department.trim(),
      job_role: jobRole,
      email: email.trim(), phone: phone.trim(), permission,
      edit_scope: permission === 'edit' ? editScope.trim() : '',
      module_permissions: moduleOverridesForSave(permission, modulePermissions),
      personnel_type: personnelType,
    };
    const nextErrors: FieldErrors = {};
    const namePattern = /^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u;
    if (!payload.first_name || !namePattern.test(payload.first_name)) nextErrors.first_name = 'กรุณากรอกชื่อจริงให้ถูกต้อง';
    if (!payload.last_name || !namePattern.test(payload.last_name)) nextErrors.last_name = 'กรุณากรอกนามสกุลให้ถูกต้อง';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(payload.employee_code)) nextErrors.employee_code = 'กรุณากรอกรหัสพนักงาน ใช้ตัวอักษรอังกฤษ ตัวเลข - หรือ _';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) nextErrors.email = 'กรุณากรอกอีเมลให้ถูกต้อง';
    const phoneDigits = payload.phone.replace(/\D/g, '');
    if (!/^\+?[0-9()\s-]+$/.test(payload.phone) || phoneDigits.length < 9 || phoneDigits.length > 15) nextErrors.phone = 'กรุณากรอกเบอร์โทร 9–15 หลัก';
    const maxLengths = { first_name: 100, last_name: 100, employee_code: 50, email: 255, phone: 20 } as const;
    for (const field of Object.keys(maxLengths) as (keyof typeof maxLengths)[]) {
      if (payload[field].length > maxLengths[field]) nextErrors[field] = `กรุณากรอกไม่เกิน ${maxLengths[field]} ตัวอักษร`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    saveInFlight.current = true;
    setSaving(true);
    try {
      await managementApi.saveEmployee(payload, id);
      if (!mounted.current) return;
      navigate('/employees');
    } catch (error) {
      if (mounted.current) setSaveError(error instanceof Error ? error.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง' : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <Box component="form" noValidate onSubmit={event => { event.preventDefault(); void handleSave(); }} aria-busy={loading || saving}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          size="small"
          onClick={() => navigate('/employees')}
          disabled={saving}
          aria-label="กลับไปรายชื่อพนักงาน"
          sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#fff', '&:hover': { bgcolor: '#fdf2f8', borderColor: '#d63384' } }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', flex: 1 }}>
          {mode === 'create' ? 'เพิ่มพนักงานใหม่' : 'แก้ไขสิทธิ์พนักงาน'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="error"
            onClick={() => navigate('/employees')}
            disabled={saving}
            sx={{ fontWeight: 600 }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            sx={{ background: 'linear-gradient(135deg,#22c55e,#10b981)', '&:hover': { background: 'linear-gradient(135deg,#16a34a,#059669)' }, fontWeight: 700, boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
            type="submit"
            disabled={disabled}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
        </Box>
      </Box>

      {loading && <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><CircularProgress size={20} />กำลังโหลดข้อมูลพนักงาน...</Box>}
      {!loading && loadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => { setLoading(true); setReloadKey(value => value + 1); }}>ลองอีกครั้ง</Button>}>{loadError}</Alert>}
      {saveError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" disabled={disabled} onClick={() => void handleSave()}>ลองอีกครั้ง</Button>}>{saveError}</Alert>}

      <Card sx={{ mb: 3, border: '1px solid #f1f5f9' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3 }}>1. ข้อมูลพนักงาน</Typography>
          
          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>ชื่อจริง*</Typography>
              <TextField fullWidth size="small" value={firstName} onChange={e => setFirstName(e.target.value)} disabled={disabled} required error={!!errors.first_name} helperText={errors.first_name} slotProps={{ htmlInput: { 'aria-label': 'ชื่อจริง', maxLength: 100 } }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>นามสกุล*</Typography>
              <TextField fullWidth size="small" value={lastName} onChange={e => setLastName(e.target.value)} disabled={disabled} required error={!!errors.last_name} helperText={errors.last_name} slotProps={{ htmlInput: { 'aria-label': 'นามสกุล', maxLength: 100 } }} />
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>รหัสพนักงาน</Typography>
              <TextField fullWidth size="small" placeholder="CD-5647" value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} disabled={disabled} required error={!!errors.employee_code} helperText={errors.employee_code} slotProps={{ htmlInput: { 'aria-label': 'รหัสพนักงาน', maxLength: 50 } }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>ฝ่าย</Typography>
              <FormControl fullWidth size="small" disabled={disabled}>
                <Select value={department} onChange={e => setDepartment(e.target.value)} inputProps={{ 'aria-label': 'ฝ่าย' }}>
                  {department && !DEPARTMENTS.includes(department) && <MenuItem value={department}>{department}</MenuItem>}
                  {DEPARTMENTS.map(dep => (
                    <MenuItem key={dep} value={dep}>{dep}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>Email Address*</Typography>
              <TextField fullWidth size="small" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={disabled} required error={!!errors.email} helperText={errors.email} slotProps={{ htmlInput: { 'aria-label': 'Email Address', maxLength: 255 } }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>เบอร์โทร*</Typography>
              <TextField fullWidth size="small" type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={disabled} required error={!!errors.phone} helperText={errors.phone} slotProps={{ htmlInput: { 'aria-label': 'เบอร์โทร', maxLength: 20 } }} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>ประเภทบุคลากร*</Typography>
              <FormControl fullWidth size="small" disabled={disabled}>
                <Select
                  value={personnelType}
                  onChange={(e) => setPersonnelType(e.target.value as PersonnelType)}
                  inputProps={{ 'aria-label': 'ประเภทบุคลากร' }}
                >
                  <MenuItem value="internal">บุคลากรภายใน (Internal)</MenuItem>
                  <MenuItem value="external">บุคลากรภายนอก (External)</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>บทบาทงาน*</Typography>
              <FormControl fullWidth size="small" disabled={disabled}>
                <Select value={jobRole} onChange={e => setJobRole(e.target.value as EmployeeJobRole)} inputProps={{ 'aria-label': 'บทบาทงาน' }}>
                  {JOB_ROLES.map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid #f1f5f9' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3 }}>2. สิทธิ์การใช้งาน</Typography>
          
          <RadioGroup 
            value={permission} 
            onChange={(e) => setPermission(e.target.value as EmployeePermission)}
          >
            <FormControlLabel 
              value="view_only" 
              disabled={disabled}
              control={<Radio />} 
              label="ดูได้อย่างเดียว" 
            />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 1 }}>
              <FormControlLabel 
                value="edit" 
                disabled={disabled}
                control={<Radio />} 
                label="มีสิทธิ์แก้ไข" 
                sx={{ mr: 0 }}
              />
            </Box>

            <FormControlLabel 
              value="admin" 
              disabled={disabled}
              control={<Radio />} 
              label="แอดมิน" 
            />
          </RadioGroup>

          {permission !== 'admin' && (
            <Box sx={{ mt: 2, borderTop: '1px solid #e2e8f0', pt: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>กำหนดสิทธิ์รายโมดูล</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                โมดูลที่เกี่ยวข้องกับบทบาทจะถูกกำหนดให้อัตโนมัติ และผู้ดูแลระบบเพิ่มหรือลดสิทธิ์รายบุคคลได้ โมดูลอื่นจะถูกล็อก
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                {BACKOFFICE_MODULES.map(({ key, label }) => {
                  const lockedLevel: EmployeeModuleAccess | undefined = key === 'dashboard' ? 'view' : (key === 'audit' || key === 'employees') ? 'none' : undefined;
                  const fallback = lockedLevel ?? defaultModuleAccess(jobRole, department, key);
                  const configuredLevel = lockedLevel ?? modulePermissions[key] ?? fallback;
                  const level = permission === 'view_only' && configuredLevel === 'edit' ? 'view' : configuredLevel;
                  return (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>{label}</Typography>
                      <FormControl size="small" disabled={disabled || lockedLevel !== undefined} sx={{ width: 145 }}>
                        <Select
                          value={level}
                          onChange={(event) => setModulePermissions(current => ({ ...current, [key]: event.target.value as EmployeeModuleAccess }))}
                          inputProps={{ 'aria-label': `สิทธิ์ ${label}` }}
                        >
                          <MenuItem value="none">ไม่ให้เข้า</MenuItem>
                          <MenuItem value="view">ดูอย่างเดียว</MenuItem>
                          {permission === 'edit' && <MenuItem value="edit">ดูและแก้ไข</MenuItem>}
                        </Select>
                      </FormControl>
                    </Box>
                  );
                })}
              </Box>
              {errors.edit_scope && <FormHelperText error sx={{ mt: 1 }}>{errors.edit_scope}</FormHelperText>}
            </Box>
          )}
        </CardContent>
      </Card>

    </Box>
  );
}
