import { useState } from 'react';
import { Alert, Box, Button, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Navigate, useNavigate } from 'react-router-dom';
import Logo from '@/components/common/Logo';
import { employeeAuthApi, EMPLOYEE_SETUP_TOKEN_KEY } from '@/api/employeeAuthApi';

export default function EmployeePasswordSetupPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!sessionStorage.getItem(EMPLOYEE_SETUP_TOKEN_KEY)) {
    return <Navigate to="/employee/login?password_setup=missing" replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== confirmation) { setError('รหัสผ่านและการยืนยันไม่ตรงกัน'); return; }
    setLoading(true); setError('');
    try {
      await employeeAuthApi.completePasswordSetup(password, confirmation);
      navigate('/employee/login?password_setup=success', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถตั้งรหัสผ่านได้');
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#050C38', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper elevation={6} sx={{ width: '100%', maxWidth: 480, borderRadius: 4, p: { xs: 3.5, sm: 5 } }}>
        <Stack spacing={3} sx={{ alignItems: 'center' }}>
          <Logo variant="OC1" width={170} />
          <Box sx={{ textAlign: 'center' }}><Typography variant="h5" sx={{ fontWeight: 800 }}>ตั้งรหัสผ่านพนักงาน</Typography><Typography color="text.secondary">กรุณาตั้งรหัสผ่านส่วนตัวก่อนเข้าใช้งานระบบ</Typography></Box>
          {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
          <Box component="form" onSubmit={submit} sx={{ width: '100%' }}>
            <TextField
              fullWidth required type={showPassword ? 'text' : 'password'} label="รหัสผ่านใหม่"
              value={password} onChange={e => setPassword(e.target.value)} sx={{ mb: 2 }}
              slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShowPassword(value => !value)} edge="end">{showPassword ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> } }}
            />
            <TextField fullWidth required type={showPassword ? 'text' : 'password'} label="ยืนยันรหัสผ่านใหม่" value={confirmation} onChange={e => setConfirmation(e.target.value)} sx={{ mb: 3 }} />
            <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ bgcolor: '#10b981', py: 1.5 }}>{loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่าน'}</Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
