import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff, BadgeOutlined, ArrowBack } from '@mui/icons-material';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import Logo from '@/components/common/Logo';
import { employeeAuthApi } from '@/api/employeeAuthApi';
import { saveEmployeeSession } from '@/utils/employeeSession';

export default function EmployeeLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/sales/bookings';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const session = await employeeAuthApi.login(username.trim(), password);
      saveEmployeeSession(session);
      navigate(redirectUrl, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบพนักงานได้');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFillSales = () => {
    setUsername('B6728786');
    setPassword('Admin1234!');
    setError('');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#050C38',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 4,
          p: { xs: 3.5, sm: 5 },
          bgcolor: '#FFFFFF',
          color: '#0f172a',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Stack spacing={3} sx={{ alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Logo variant="OC1" width={170} />
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#050C38', mb: 0.5 }}>
              ระบบงานพนักงาน (Staff Portal)
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              ฝ่ายขายและการตรวจสอบสลิป
              <br />
              จัดการคอนเสิร์ตและโปรโมชั่น
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              fullWidth
              label="รหัสพนักงาน หรือ อีเมล"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="เช่น B6728786 หรือ CD-1234"
              sx={{
                mb: 2.5,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#f8fafc',
                  color: '#0f172a',
                  borderRadius: '15px',
                  '& fieldset': { borderColor: '#e2e8f0' },
                  '&:hover fieldset': { borderColor: '#cbd5e1' },
                  '&.Mui-focused fieldset': { borderColor: '#10b981' },
                },
                '& .MuiInputLabel-root': { color: '#64748b' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#10b981' },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <BadgeOutlined sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              label="รหัสผ่าน"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#f8fafc',
                  color: '#0f172a',
                  borderRadius: '15px',
                  '& fieldset': { borderColor: '#e2e8f0' },
                  '&:hover fieldset': { borderColor: '#cbd5e1' },
                  '&.Mui-focused fieldset': { borderColor: '#10b981' },
                },
                '& .MuiInputLabel-root': { color: '#64748b' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#10b981' },
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: '#64748b' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1.5, mb: 2 }}>
              <Button
                component={RouterLink}
                to="/employee/forgot-password"
                sx={{
                  color: '#d63384',
                  textTransform: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  p: 0,
                  minWidth: 0,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                ลืมรหัสผ่าน
              </Button>
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                bgcolor: '#10b981',
                color: '#ffffff',
                borderRadius: '15px',
                py: 1.5,
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบพนักงาน'}
            </Button>
          </Box>

          <Divider sx={{ width: '100%', borderColor: '#e2e8f0' }}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              บัญชีทดสอบสำหรับตรวจงาน
            </Typography>
          </Divider>

          <Button
            variant="outlined"
            fullWidth
            onClick={handleQuickFillSales}
            sx={{
              borderColor: '#cbd5e1',
              color: '#11366b',
              bgcolor: '#f8fafc',
              borderRadius: '15px',
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              '&:hover': { borderColor: '#11366b', bgcolor: '#f1f5f9' },
            }}
          >
            ใส่ข้อมูลเจ้าหน้าที่ฝ่ายขาย (B6728786) ทันที
          </Button>

          <Button
            component={RouterLink}
            to="/home"
            startIcon={<ArrowBack />}
            sx={{
              color: '#64748b',
              textTransform: 'none',
              fontSize: '0.88rem',
              '&:hover': { color: '#050C38' },
            }}
          >
            กลับสู่หน้าเว็บไซต์ลูกค้า
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
