import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, TextField, InputAdornment, Stack, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, IconButton, Tooltip, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CloseIcon from '@mui/icons-material/Close';
import type { BookingRecord, BookingStatus } from '@/types/booking';
import {
  getBookingsSnapshot, subscribeBookings,
} from '@/utils/bookingStore';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';
import { getEmployeeSession } from '@/utils/employeeSession';

const money = (val: number) => `${val.toLocaleString('th-TH')} ฿`;

const formatDate = (val?: string) => {
  if (!val) return '-';
  try {
    const d = new Date(val);
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(d);
  } catch {
    return val;
  }
};

export default function SalesBookingManagementPage() {
  const employee = getEmployeeSession();
  const [bookings, setBookings] = useState<BookingRecord[]>(getBookingsSnapshot());
  const [searchQuery, setSearchQuery] = useState('');
  const [tabStatus, setTabStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Verification Dialog
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [verifierName, setVerifierName] = useState(
    employee ? `${employee.name} (${employee.employeeCode || 'ฝ่ายขาย'})` : 'พงกรศกร อิ่มน้ำขาว (B6728786)'
  );
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Ticket Preview Dialog
  const [ticketViewBooking, setTicketViewBooking] = useState<BookingRecord | null>(null);

  const fetchBookings = async () => {
    try {
      const data = await bookingPaymentApi.getSalesBookings(searchQuery, tabStatus);
      if (data && data.length > 0) {
        setBookings(data);
      }
    } catch {
      // Keep local snapshot
    }
  };

  useEffect(() => {
    void fetchBookings();
    return subscribeBookings(() => {
      setBookings([...getBookingsSnapshot()]);
    });
  }, [tabStatus, searchQuery]);

  // Filter bookings (U4: ค้นหารายการจองของลูกค้า)
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.customerPhone && b.customerPhone.includes(searchQuery)) ||
      b.concertTitle.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (tabStatus === 'all') return true;
    return b.status === tabStatus;
  });

  // UP2 & UP3: อนุมัติการชำระเงิน
  const handleApprove = async (bookingId: string) => {
    const result = await bookingPaymentApi.approveBooking(bookingId, verifierName);
    if (result) {
      setMessage({
        severity: 'success',
        text: `อนุมัติการชำระเงินรายการ ${bookingId} เรียบร้อยแล้ว! ระบบได้สร้าง E-Ticket พร้อม QR Code และจำลองการจัดส่งอีเมลไปยัง ${result.customerEmail} แล้ว`,
      });
      setSelectedBooking(null);
      setShowRejectInput(false);
      setRejectReason('');
      void fetchBookings();
    }
  };

  // UP2: ปฏิเสธการชำระเงิน
  const handleReject = async (bookingId: string) => {
    if (!rejectReason.trim()) {
      setMessage({ severity: 'error', text: 'กรุณาระบุเหตุผลการปฏิเสธการชำระเงิน เพื่อให้ลูกค้าทราบ' });
      return;
    }
    const result = await bookingPaymentApi.rejectBooking(bookingId, rejectReason, verifierName);
    if (result) {
      setMessage({
        severity: 'info',
        text: `บันทึกการปฏิเสธรายการ ${bookingId} แล้ว พร้อมส่งเหตุผลแจ้งเตือนให้ลูกค้าแนบสลิปใหม่`,
      });
      setSelectedBooking(null);
      setShowRejectInput(false);
      setRejectReason('');
      void fetchBookings();
    }
  };

  // UP5: ส่งบัตรซ้ำกรณีสูญหาย
  const handleResend = async (booking: BookingRecord) => {
    await bookingPaymentApi.resendTickets(booking.id);
    setMessage({
      severity: 'success',
      text: `ส่งบัตรเดิม (QR Code เดิม) ซ้ำไปยังอีเมล ${booking.customerEmail} สำเร็จแล้ว`,
    });
  };

  const getStatusChip = (status: BookingStatus) => {
    switch (status) {
      case 'issued':
        return <Chip label="ออกบัตรแล้ว (ชำระแล้ว)" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700 }} />;
      case 'under_review':
        return <Chip label="รอตรวจสอบสลิป" size="small" sx={{ bgcolor: '#fff8e1', color: '#b78103', fontWeight: 700 }} />;
      case 'rejected':
        return <Chip label="ปฏิเสธการชำระเงิน" size="small" sx={{ bgcolor: '#ffebee', color: '#c62828', fontWeight: 700 }} />;
      case 'pending_payment':
        return <Chip label="รอชำระเงิน" size="small" sx={{ bgcolor: '#ede7f6', color: '#512da8', fontWeight: 700 }} />;
      case 'expired':
        return <Chip label="หมดอายุ" size="small" sx={{ bgcolor: '#f5f5f5', color: '#757575', fontWeight: 700 }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const pendingCount = bookings.filter((b) => b.status === 'under_review').length;
  const issuedCount = bookings.filter((b) => b.status === 'issued').length;
  const totalRevenue = bookings.filter((b) => b.status === 'issued').reduce((sum, b) => sum + b.totalPrice, 0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6fb', py: 4 }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ color: '#11366b', fontWeight: 800 }}>
            ระบบจัดการการจองและตรวจสอบการชำระเงิน (Sales & Payment Verification)
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
            สำหรับเจ้าหน้าที่ฝ่ายขาย: ตรวจสอบหลักฐานสลิปการโอนเงิน, อนุมัติ/ปฏิเสธ, ออกบัตรเข้าชม E-Ticket และส่งบัตรซ้ำทางอีเมล
          </Typography>
        </Box>

        {message && (
          <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        {/* Overview Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2.5, mb: 3 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e0e3ec', bgcolor: '#fff' }}>
            <Typography variant="body2" sx={{ color: '#888' }}>รายการจองทั้งหมด</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#11366b', mt: 0.5 }}>{bookings.length}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #ffe082', bgcolor: '#fffdf5' }}>
            <Typography variant="body2" sx={{ color: '#b78103', fontWeight: 600 }}>รอตรวจสอบสลิป (ต้องจัดการ)</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#f57f17', mt: 0.5 }}>{pendingCount}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #c8e6c9', bgcolor: '#f5fbf6' }}>
            <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600 }}>อนุมัติและออกบัตรแล้ว</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#2e7d32', mt: 0.5 }}>{issuedCount}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e0e3ec', bgcolor: '#fff' }}>
            <Typography variant="body2" sx={{ color: '#888' }}>ยอดเงินที่ชำระสำเร็จ</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#11366b', mt: 0.5 }}>{money(totalRevenue)}</Typography>
          </Paper>
        </Box>

        {/* Filter & Search Bar */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e0e3ec', mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
            <Tabs
              value={tabStatus}
              onChange={(_, val) => setTabStatus(val)}
              textColor="primary"
              indicatorColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab value="all" label={`ทั้งหมด (${bookings.length})`} sx={{ fontWeight: 700, textTransform: 'none' }} />
              <Tab value="under_review" label={`รอตรวจสอบ (${pendingCount})`} sx={{ fontWeight: 700, textTransform: 'none', color: pendingCount > 0 ? '#e65100' : 'inherit' }} />
              <Tab value="issued" label={`ออกบัตรแล้ว (${issuedCount})`} sx={{ fontWeight: 700, textTransform: 'none' }} />
              <Tab value="rejected" label="ถูกปฏิเสธ" sx={{ fontWeight: 700, textTransform: 'none' }} />
              <Tab value="pending_payment" label="รอชำระเงิน" sx={{ fontWeight: 700, textTransform: 'none' }} />
            </Tabs>

            <TextField
              size="small"
              placeholder="ค้นหาชื่อ, เบอร์โทร, คอนเสิร์ต หรือ BK-ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ width: { xs: '100%', md: 340 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#888' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </Paper>

        {/* Bookings Table */}
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e3ec' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f7f9fd' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, color: '#11366b' }}>รหัสการจอง</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#11366b' }}>ลูกค้า / ผู้รับบัตร</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#11366b' }}>คอนเสิร์ต / โซน</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#11366b' }}>จำนวน</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#11366b' }}>ยอดชำระ</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#11366b' }}>สถานะ</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#11366b' }}>วันที่ทำรายการ</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#11366b', textAlign: 'center' }}>จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 5, color: '#888' }}>
                    ไม่พบรายการจองตามเงื่อนไขที่ค้นหา
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell sx={{ fontWeight: 700, color: '#11366b' }}>{b.id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{b.customerName}</Typography>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>{b.customerEmail}</Typography>
                      {b.customerPhone && <Typography variant="caption" sx={{ color: '#888' }}>{b.customerPhone}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.concertTitle}</Typography>
                      <Typography variant="caption" sx={{ color: '#666' }}>โซน {b.zoneId} ({b.tierName}) · {b.seats?.join(', ') || '-'}</Typography>
                    </TableCell>
                    <TableCell>{b.quantity} ใบ</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{money(b.totalPrice)}</TableCell>
                    <TableCell>{getStatusChip(b.status)}</TableCell>
                    <TableCell sx={{ fontSize: '0.85rem', color: '#555' }}>{formatDate(b.createdAt)}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                        {/* Action for under_review: ตรวจสอบสลิป */}
                        {b.status === 'under_review' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            startIcon={<ReceiptLongOutlinedIcon />}
                            onClick={() => {
                              setSelectedBooking(b);
                              setShowRejectInput(false);
                              setRejectReason('');
                            }}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                          >
                            ตรวจสลิป
                          </Button>
                        )}

                        {/* Action for issued: ดูบัตร + ส่งบัตรซ้ำ */}
                        {b.status === 'issued' && (
                          <>
                            <Tooltip title="ดู E-Ticket พร้อม QR Code">
                              <IconButton size="small" color="primary" onClick={() => setTicketViewBooking(b)}>
                                <VisibilityOutlinedIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="ขอส่งบัตรซ้ำทางอีเมล (UP5)">
                              <IconButton size="small" color="secondary" onClick={() => handleResend(b)}>
                                <SendOutlinedIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}

                        {/* Action for rejected / other: ดูรายละเอียด */}
                        {b.status === 'rejected' && (
                          <Tooltip title="ดูรายละเอียดข้อผิดพลาด">
                            <IconButton size="small" color="error" onClick={() => setSelectedBooking(b)}>
                              <HighlightOffIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>

      {/* Verification Dialog (UP2: ตรวจสอบและอนุมัติการชำระเงิน) */}
      <Dialog open={Boolean(selectedBooking)} onClose={() => setSelectedBooking(null)} maxWidth="sm" fullWidth>
        {selectedBooking && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#11366b' }}>
                  ตรวจสอบหลักฐานการชำระเงิน: {selectedBooking.id}
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  คอนเสิร์ต: {selectedBooking.concertTitle} (โซน {selectedBooking.zoneId})
                </Typography>
              </Box>
              <IconButton onClick={() => setSelectedBooking(null)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {/* Slip Image */}
              <Box sx={{ textAlign: 'center', mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#333' }}>
                  หลักฐานสลิปการโอนเงิน ({selectedBooking.payment?.evidenceFileName || 'สลิป'}):
                </Typography>
                {selectedBooking.payment?.evidenceDataUrl ? (
                  <Box
                    component="img"
                    src={selectedBooking.payment.evidenceDataUrl}
                    alt="Slip Evidence"
                    sx={{ maxHeight: 280, maxWidth: '100%', borderRadius: 2, border: '1px solid #ccc' }}
                  />
                ) : (
                  <Paper elevation={0} sx={{ p: 4, bgcolor: '#f0f4f8', border: '1px dashed #90caf9', borderRadius: 2 }}>
                    <ReceiptLongOutlinedIcon sx={{ fontSize: 48, color: '#1976d2', mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      ไฟล์: {selectedBooking.payment?.evidenceFileName || 'slip_payment.jpg'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>
                      (แนบเมื่อ {formatDate(selectedBooking.payment?.submittedAt)})
                    </Typography>
                  </Paper>
                )}
              </Box>

              {/* Order Info */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#fafbfd' }}>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#666' }}>ชื่อผู้จอง:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedBooking.customerName}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#666' }}>อีเมลส่งบัตร:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedBooking.customerEmail}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#666' }}>จำนวนที่นั่ง:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedBooking.quantity} ที่นั่ง ({selectedBooking.seats?.join(', ') || '-'})</Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>ยอดเงินที่ต้องตรวจสอบ:</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#11366b' }}>
                      {money(selectedBooking.totalPrice)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Verifier Name */}
              <TextField
                label="เจ้าหน้าที่ผู้ตรวจสอบ (Verified By)"
                size="small"
                fullWidth
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                sx={{ mb: 2 }}
              />

              {/* Reject Reason Form if toggled */}
              {showRejectInput && (
                <Box sx={{ mt: 1, p: 2, bgcolor: '#fff5f5', borderRadius: 2, border: '1px solid #ffcdd2' }}>
                  <Typography variant="subtitle2" sx={{ color: '#c62828', fontWeight: 700, mb: 1 }}>
                    ระบุเหตุผลการปฏิเสธ (จะส่งแจ้งลูกค้าให้แก้ไข):
                  </Typography>
                  <TextField
                    size="small"
                    multiline
                    minRows={2}
                    fullWidth
                    placeholder="เช่น ยอดเงินไม่ตรงกับราคาบัตร, สลิปไม่ชัดเจน, สลิปซ้ำ..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
                    <Button size="small" onClick={() => setShowRejectInput(false)}>ยกเลิก</Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      onClick={() => handleReject(selectedBooking.id)}
                    >
                      ยืนยันปฏิเสธการชำระเงิน
                    </Button>
                  </Box>
                </Box>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
              {!showRejectInput ? (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<HighlightOffIcon />}
                    onClick={() => setShowRejectInput(true)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    ปฏิเสธการชำระเงิน
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleApprove(selectedBooking.id)}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3 }}
                  >
                    อนุมัติและออกบัตรทันที (Approve)
                  </Button>
                </>
              ) : null}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Ticket View Dialog (UP3 / UP5) */}
      <Dialog open={Boolean(ticketViewBooking)} onClose={() => setTicketViewBooking(null)} maxWidth="sm" fullWidth>
        {ticketViewBooking && (
          <>
            <DialogTitle sx={{ fontWeight: 800, color: '#11366b', display: 'flex', justifyContent: 'space-between' }}>
              <span>E-Ticket: {ticketViewBooking.concertTitle}</span>
              <IconButton onClick={() => setTicketViewBooking(null)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                ผู้ถือบัตร: <strong>{ticketViewBooking.customerName}</strong> ({ticketViewBooking.customerEmail})
              </Typography>
              <Stack spacing={2}>
                {ticketViewBooking.tickets?.map((t) => (
                  <Paper key={t.code} variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 3, bgcolor: '#fcfdfe' }}>
                    <Typography variant="caption" sx={{ color: '#888' }}>QR CODE สแกนเข้างาน</Typography>
                    <Box component="img" src={t.qrCodeUrl} alt="QR" sx={{ width: 140, height: 140, mx: 'auto', my: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#11366b' }}>{t.code}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#444' }}>ที่นั่ง: {t.seatLabel}</Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>ออกบัตรเมื่อ: {formatDate(t.issuedAt)}</Typography>
                  </Paper>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setTicketViewBooking(null)}>ปิด</Button>
              <Button
                variant="contained"
                startIcon={<SendOutlinedIcon />}
                onClick={() => {
                  handleResend(ticketViewBooking);
                  setTicketViewBooking(null);
                }}
                sx={{ bgcolor: '#11366b' }}
              >
                ส่งบัตรซ้ำทางอีเมล
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
