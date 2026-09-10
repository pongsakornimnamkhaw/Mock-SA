import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  BadgeOutlined,
  LockResetOutlined,
  CheckCircleOutlined,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Logo from '@/components/common/Logo';
import {
  employeeAccountApi,
  EMPLOYEE_RESET_TOKEN_KEY,
  EmployeeApiError,
} from '@/api/employeeAccountApi';

type RecoveryStep = 'request' | 'waiting' | 'reset' | 'completed';

export default function EmployeePasswordRecoveryPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<RecoveryStep>('request');
  const [identifier, setIdentifier] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  // New password inputs
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if there is already a token in sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem(EMPLOYEE_RESET_TOKEN_KEY);
    if (token && step === 'request') {
      // Check its status
      employeeAccountApi
        .getResetStatus()
        .then((res) => {
          if (res.status === 'pending') {
            setStep('waiting');
          } else if (res.status === 'approved') {
            setStep('reset');
          } else if (res.status === 'rejected') {
            setStep('waiting');
            setRejectionReason(res.rejectionReason ?? 'คำร้องไม่ได้รับการอนุมัติ');
          } else if (res.status === 'expired') {
            setStep('waiting');
            setIsExpired(true);
          }
        })
        .catch(() => {
          sessionStorage.removeItem(EMPLOYEE_RESET_TOKEN_KEY);
        });
    }
  }, []);

  // Polling in 'waiting' state
  useEffect(() => {
    if (step !== 'waiting') return;

    let mounted = true;
    const checkStatus = async () => {
      try {
        const res = await employeeAccountApi.getResetStatus();
        if (!mounted) return;

        if (res.status === 'approved') {
          setStep('reset');
        } else if (res.status === 'rejected') {
          setRejectionReason(res.rejectionReason ?? 'คำร้องไม่ได้รับการอนุมัติ');
        } else if (res.status === 'expired') {
          setIsExpired(true);
        }
      } catch (err) {
        if (!mounted) return;
        if (err instanceof EmployeeApiError && err.status === 400) {
          setError('โทเคนหมดอายุหรือไม่ถูกต้อง กรุณาส่งคำร้องใหม่');
          setStep('request');
        }
      }
    };

    const interval = setInterval(checkStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [step]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError('');
    setIsExpired(false);
    setRejectionReason('');

    try {
      const res = await employeeAccountApi.createResetRequest(identifier.trim());
      if (res.browserToken) {
        sessionStorage.setItem(EMPLOYEE_RESET_TOKEN_KEY, res.browserToken);
      }
      setReferenceCode(res.referenceCode);
      setStep('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถส่งคำร้องได้');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }

    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await employeeAccountApi.completeReset({ newPassword, confirmPassword });
      setStep('completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    sessionStorage.removeItem(EMPLOYEE_RESET_TOKEN_KEY);
    setIdentifier('');
    setReferenceCode('');
    setRejectionReason('');
    setIsExpired(false);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setStep('request');
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
              กู้คืนรหัสผ่านพนักงาน
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              ระบบความปลอดภัย Octavia Staff Portal
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* STEP 1: REQUEST FORM */}
          {step === 'request' && (
            <Box component="form" onSubmit={handleRequestSubmit} sx={{ width: '100%' }}>
              <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
                กรอกรหัสพนักงานหรืออีเมลที่ลงทะเบียนไว้ในระบบ เพื่อส่งคำร้องขอรีเซ็ตรหัสผ่านไปยังผู้ดูแลระบบ
              </Typography>

              <TextField
                fullWidth
                label="รหัสพนักงานหรืออีเมล"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="เช่น B6728786 หรือ admin@octavia.test"
                sx={inputSx}
                slotProps={{
                  htmlInput: {
                    'aria-label': 'รหัสพนักงานหรืออีเมล',
                  },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <BadgeOutlined sx={{ color: '#64748b' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || !identifier.trim()}
                sx={primaryBtnSx}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'ส่งคำร้อง'}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button
                  component={RouterLink}
                  to="/employee/login"
                  startIcon={<ArrowBack />}
                  sx={{ color: '#64748b', textTransform: 'none', fontSize: '0.88rem' }}
                >
                  กลับสู่หน้าเข้าสู่ระบบ
                </Button>
              </Box>
            </Box>
          )}

          {/* STEP 2: WAITING FOR APPROVAL */}
          {step === 'waiting' && (
            <Box sx={{ width: '100%', textAlign: 'center' }}>
              {referenceCode && (
                <Box sx={{ my: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px dashed #cbd5e1' }}>
                  <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                    รหัสอ้างอิงคำร้องของคุณ
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#d63384', mt: 0.5 }}>
                    {referenceCode}
                  </Typography>
                </Box>
              )}

              {rejectionReason ? (
                <Alert severity="error" sx={{ my: 2, textAlign: 'left', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    คำร้องถูกปฏิเสธ
                  </Typography>
                  เหตุผล: {rejectionReason}
                </Alert>
              ) : isExpired ? (
                <Alert severity="warning" sx={{ my: 2, textAlign: 'left', borderRadius: 2 }}>
                  คำร้องหมดอายุแล้ว (เกิน 30 นาที) กรุณาส่งคำร้องใหม่
                </Alert>
              ) : (
                <Box sx={{ my: 3 }}>
                  <CircularProgress size={36} sx={{ color: '#d63384', mb: 2 }} />
                  <Typography variant="body2" sx={{ color: '#334155', fontWeight: 600 }}>
                    กำลังรอผู้ดูแลระบบตรวจสอบและอนุมัติ...
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                    ผู้ดูแลระบบจะโทรยืนยันตัวตนกับหมายเลขโทรศัพท์ที่ลงทะเบียนไว้
                    (หน้านี้จะอัปเดตอัตโนมัติเมื่อได้รับการอนุมัติ)
                  </Typography>
                </Box>
              )}

              {(rejectionReason || isExpired) ? (
                <Button variant="contained" fullWidth onClick={handleRestart} sx={primaryBtnSx}>
                  ส่งคำร้องใหม่
                </Button>
              ) : (
                <Button
                  component={RouterLink}
                  to="/employee/login"
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 2, textTransform: 'none', borderRadius: '15px' }}
                >
                  กลับสู่หน้าเข้าสู่ระบบ (สามารถกลับมาหน้านี้ได้)
                </Button>
              )}
            </Box>
          )}

          {/* STEP 3: RESET PASSWORD FORM */}
          {step === 'reset' && (
            <Box component="form" onSubmit={handleResetSubmit} sx={{ width: '100%' }}>
              <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                คำร้องได้รับการอนุมัติเรียบร้อยแล้ว กรุณากำหนดรหัสผ่านใหม่
              </Alert>

              <TextField
                fullWidth
                label="รหัสผ่านใหม่"
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                sx={inputSx}
                slotProps={{
                  htmlInput: {
                    'aria-label': 'รหัสผ่านใหม่',
                  },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockResetOutlined sx={{ color: '#64748b' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                fullWidth
                label="ยืนยันรหัสผ่านใหม่"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                sx={inputSx}
                slotProps={{
                  htmlInput: {
                    'aria-label': 'ยืนยันรหัสผ่านใหม่',
                  },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockResetOutlined sx={{ color: '#64748b' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || !newPassword || !confirmPassword}
                sx={primaryBtnSx}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'ตั้งรหัสผ่านใหม่'}
              </Button>
            </Box>
          )}

          {/* STEP 4: COMPLETED */}
          {step === 'completed' && (
            <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
              <CheckCircleOutlined sx={{ fontSize: 64, color: '#10b981', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                ตั้งรหัสผ่านใหม่สำเร็จ!
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate('/employee/login', { replace: true })}
                sx={primaryBtnSx}
              >
                เข้าสู่ระบบ
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

const inputSx = {
  mb: 2.5,
  '& .MuiOutlinedInput-root': {
    bgcolor: '#f8fafc',
    color: '#0f172a',
    borderRadius: '15px',
    '& fieldset': { borderColor: '#e2e8f0' },
    '&:hover fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: '#d63384' },
  },
  '& .MuiInputLabel-root': { color: '#64748b' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#d63384' },
};

const primaryBtnSx = {
  bgcolor: '#d63384',
  color: '#ffffff',
  borderRadius: '15px',
  py: 1.5,
  fontWeight: 700,
  fontSize: '1rem',
  textTransform: 'none',
  boxShadow: '0 4px 12px rgba(214, 51, 132, 0.25)',
  '&:hover': { bgcolor: '#b5206a' },
};
