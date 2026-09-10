import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { EmployeeProfile } from '@/api/employeeAccountApi';
import { employeeAccountApi } from '@/api/employeeAccountApi';
import { saveEmployeeSession } from '@/utils/employeeSession';

interface Props {
  profile: EmployeeProfile;
  onProfileUpdated: (p: EmployeeProfile) => void;
}

export default function ProfileTab({ profile, onProfileUpdated }: Props) {
  const isInternal = profile.personnelType === 'internal';

  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const payload = isInternal ? { phone } : { email, phone };
      const updated = await employeeAccountApi.updateProfile(payload);
      onProfileUpdated(updated);
      saveEmployeeSession({
        userId: updated.userId,
        employeeCode: updated.employeeCode,
        firstName: updated.firstName,
        lastName: updated.lastName,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        department: updated.department,
        role: updated.role,
        personnelType: updated.personnelType,
        lastLoginAt: updated.lastLoginAt,
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
        ข้อมูลโปรไฟล์
      </Typography>

      {/* Read-only identity fields */}
      <TextField
        label="ชื่อ-นามสกุล"
        value={profile.name}
        disabled
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        sx={fieldSx}
      />
      <TextField
        label="รหัสพนักงาน"
        value={profile.employeeCode}
        disabled
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        sx={fieldSx}
      />
      <TextField
        label="แผนก"
        value={profile.department}
        disabled
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        sx={fieldSx}
      />
      <TextField
        label="บทบาท"
        value={profile.role}
        disabled
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        sx={fieldSx}
      />
      <TextField
        label="ประเภทบุคลากร"
        value={isInternal ? 'บุคลากรภายใน' : 'บุคลากรภายนอก'}
        disabled
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        sx={fieldSx}
      />

      {/* Editable fields */}
      <TextField
        label="อีเมล"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isInternal}
        size="small"
        type="email"
        slotProps={{
          htmlInput: { 'aria-label': 'อีเมล' },
          inputLabel: { shrink: true },
        }}
        sx={fieldSx}
      />
      <TextField
        label="เบอร์โทรศัพท์"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        size="small"
        slotProps={{
          htmlInput: { 'aria-label': 'เบอร์โทรศัพท์' },
          inputLabel: { shrink: true },
        }}
        sx={fieldSx}
      />

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ borderRadius: 2 }}>บันทึกข้อมูลสำเร็จ</Alert>}

      <Button
        variant="contained"
        onClick={handleSave}
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
        {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'บันทึก'}
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
    '&.Mui-disabled': {
      bgcolor: '#f8fafc',
      color: '#64748b',
      '& fieldset': { borderColor: '#e2e8f0' },
    },
  },
  '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#d63384' },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#64748b' },
};
