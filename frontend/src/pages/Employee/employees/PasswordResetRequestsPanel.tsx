import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { ResetRequestItem } from '@/api/employeeAccountApi';
import { employeeAccountApi } from '@/api/employeeAccountApi';
import Pagination from '@/components/ui/Pagination';

const bangkokFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatBangkok(iso: string): string {
  try {
    const parts = bangkokFmt.formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')} น.`;
  } catch {
    return iso;
  }
}

export default function PasswordResetRequestsPanel() {
  const [requests, setRequests] = useState<ResetRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  
  // State for phone verification checkboxes per request
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});
  
  // Reject dialog state
  const [rejectDialogItem, setRejectDialogItem] = useState<ResetRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = () => {
    setLoading(true);
    setError('');
    employeeAccountApi
      .getResetRequests({ page, pageSize })
      .then((res) => {
        setRequests(res.data);
        setTotal(res.total);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการโหลด');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRequests();
  }, [page]);

  const handleVerifyChange = (requestId: string, checked: boolean) => {
    setVerifiedMap((prev) => ({ ...prev, [requestId]: checked }));
  };

  const handleApprove = async (item: ResetRequestItem) => {
    setActionError('');
    setProcessingId(item.requestId);
    try {
      await employeeAccountApi.decideResetRequest(item.requestId, {
        decision: 'approve',
        phoneVerified: true,
      });
      fetchRequests();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'อนุมัติไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectDialogItem || !rejectReason.trim()) return;
    setActionError('');
    setProcessingId(rejectDialogItem.requestId);
    try {
      await employeeAccountApi.decideResetRequest(rejectDialogItem.requestId, {
        decision: 'reject',
        phoneVerified: false,
        reason: rejectReason.trim(),
      });
      setRejectDialogItem(null);
      setRejectReason('');
      fetchRequests();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'ปฏิเสธไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending':
        return <Chip label="รออนุมัติ" size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }} />;
      case 'approved':
        return <Chip label="อนุมัติแล้ว" size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600 }} />;
      case 'rejected':
        return <Chip label="ปฏิเสธ" size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 600 }} />;
      case 'used':
        return <Chip label="ใช้งานแล้ว" size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }} />;
      case 'expired':
        return <Chip label="หมดอายุ" size="small" sx={{ bgcolor: '#f1f5f9', color: '#94a3b8', fontWeight: 600 }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={30} />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && requests.length === 0 && (
        <Card sx={{ border: '1px solid #f1f5f9', p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: '#64748b' }}>
            ไม่พบคำร้องรีเซ็ตรหัสผ่านในระบบ
          </Typography>
        </Card>
      )}

      {!loading && !error && requests.length > 0 && (
        <Card sx={{ border: '1px solid #f1f5f9' }}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>รหัสอ้างอิง</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>พนักงาน</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>ประเภท</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>แผนก</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>เบอร์โทรศัพท์ที่ลงทะเบียน</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>เวลาที่ขอ</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>สถานะ</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>การยืนยันและการตัดสินใจ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((item) => {
                    const isPending = item.status === 'pending';
                    const isVerified = !!verifiedMap[item.requestId];
                    const isProcessing = processingId === item.requestId;

                    return (
                      <TableRow key={item.requestId} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {item.referenceCode}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{item.email}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.personnelType === 'external' ? 'ภายนอก' : 'ภายใน'}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: item.personnelType === 'external' ? '#a855f7' : '#3b82f6',
                              color: item.personnelType === 'external' ? '#7e22ce' : '#1d4ed8',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#475569' }}>{item.department}</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#0f172a' }}>{item.phone}</TableCell>
                        <TableCell sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                          {formatBangkok(item.createdAt)}
                        </TableCell>
                        <TableCell>{getStatusChip(item.status)}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          {isPending ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={isVerified}
                                    onChange={(e) => handleVerifyChange(item.requestId, e.target.checked)}
                                    slotProps={{ input: { 'aria-label': 'โทรยืนยันกับเบอร์เดิมแล้ว' } }}
                                  />
                                }
                                label={<Typography variant="caption" sx={{ color: '#334155', fontWeight: 500 }}>โทรยืนยันกับเบอร์เดิมแล้ว</Typography>}
                                sx={{ mr: 0 }}
                              />
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="success"
                                  disabled={!isVerified || isProcessing}
                                  onClick={() => handleApprove(item)}
                                  sx={{ fontWeight: 600, textTransform: 'none' }}
                                >
                                  {isProcessing ? <CircularProgress size={14} color="inherit" /> : 'อนุมัติ'}
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color="error"
                                  disabled={isProcessing}
                                  data-testid="reject-btn"
                                  onClick={() => {
                                    setRejectDialogItem(item);
                                    setRejectReason('');
                                  }}
                                  sx={{ fontWeight: 600, textTransform: 'none' }}
                                >
                                  ปฏิเสธ
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              {item.approvedBy ? `ดำเนินการแล้วโดย ${item.approvedBy}` : 'ไม่มีการดำเนินการเพิ่มเติม'}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2 }}>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectDialogItem} onClose={() => setRejectDialogItem(null)} maxWidth="xs" fullWidth disablePortal>
        <DialogTitle sx={{ fontWeight: 700 }}>ปฏิเสธคำร้องรีเซ็ตรหัสผ่าน</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: '#475569' }}>
            กรุณาระบุเหตุผลการปฏิเสธคำร้อง {rejectDialogItem?.referenceCode}
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="เหตุผลที่ปฏิเสธ"
            slotProps={{
              htmlInput: {
                'aria-label': 'เหตุผลที่ปฏิเสธ',
                'data-testid': 'reject-reason-input',
              },
            }}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            rows={3}
            required
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectDialogItem(null)} color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirmReject}
            color="error"
            variant="contained"
            disabled={!rejectReason.trim()}
            data-testid="confirm-reject-btn"
          >
            ยืนยันการปฏิเสธ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
