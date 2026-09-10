import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { employeeAccountApi } from '@/api/employeeAccountApi';

export default function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }
    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setSaving(true);
    try {
      await employeeAccountApi.updatePassword({ currentPassword, newPassword, confirmPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
        เปลี่ยนรหัสผ่าน
      </Typography>

      <TextField
        label="รหัสผ่านปัจจุบัน"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        size="small"
        slotProps={{
          htmlInput: { 'aria-label': 'รหัสผ่านปัจจุบัน' },
          inputLabel: { shrink: true },
        }}
        sx={fieldSx}
      />
      <TextField
        label="รหัสผ่านใหม่"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        size="small"
        slotProps={{
          htmlInput: { 'aria-label': 'รหัสผ่านใหม่' },
          inputLabel: { shrink: true },
        }}
        sx={fieldSx}
      />
      <TextField
        label="ยืนยันรหัสผ่านใหม่"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        size="small"
        slotProps={{
          htmlInput: { 'aria-label': 'ยืนยันรหัสผ่านใหม่' },
          inputLabel: { shrink: true },
        }}
        sx={fieldSx}
      />

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ borderRadius: 2 }}>เปลี่ยนรหัสผ่านสำเร็จ</Alert>}

      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={saving}
        sx={{
          alignSelf: 'flex-start',
          background: 'linear-gradient(135deg, #d63384, #7c3aed)',
          '&:hover': { background: 'linear-gradient(135deg, #b5206a, #6d28d9)' },
          fontWeight: 700,
          borderRadius: 2,
          textTransform: 'none',
          px: 3,
          py: 1,
          boxShadow: '0 4px 12px rgba(214,51,132,0.3)',
        }}
      >
        {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'เปลี่ยนรหัสผ่าน'}
      </Button>
    </Box>
  );
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#1e293b',
    bgcolor: '#fff',
    borderRadius: 2,
    '& fieldset': { borderColor: '#e2e8f0' },
    '&:hover fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: '#d63384' },
  },
  '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#d63384' },
};
