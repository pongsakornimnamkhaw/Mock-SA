import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, List, ListItemButton, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CustomerHeader from '@/components/common/CustomerHeader';
import {
  CustomerApiError, customerAccountApi,
  type CustomerAccount, type CustomerProfileInput,
} from '@/api/customerAccountApi';
import { saveCustomerSession } from '@/utils/customerSession';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { BookingRecord } from '@/types/booking';
import {
  getBookingsSnapshot, subscribeBookings,
} from '@/utils/bookingStore';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';

type AccountPageMode = 'tickets' | 'history' | 'profile' | 'password';

const pageDetails = {
  tickets: { title: 'บัตรของฉัน', description: 'ดูบัตรคอนเสิร์ตและ QR Code สำหรับสแกนเข้างาน', icon: ConfirmationNumberOutlinedIcon, path: '/my-tickets' },
  history: { title: 'ประวัติการซื้อ', description: 'รายการสั่งซื้อและการชำระเงินที่ผ่านมา', icon: HistoryRoundedIcon, path: '/purchase-history' },
  profile: { title: 'แก้ไขข้อมูลส่วนตัว', description: 'จัดการข้อมูลส่วนตัวของคุณ', icon: EditOutlinedIcon, path: '/profile/edit' },
  password: { title: 'เปลี่ยนรหัสผ่าน', description: 'ตั้งรหัสผ่านใหม่เพื่อรักษาความปลอดภัยของบัญชี', icon: LockOutlinedIcon, path: '/change-password' },
} satisfies Record<AccountPageMode, { title: string; description: string; icon: typeof EditOutlinedIcon; path: string }>;

const emptyProfile: CustomerProfileInput = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', address: '', email: '',
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const datePart = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePart) return value;
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    : value;
};

const money = (value: number) => `${value.toLocaleString('th-TH')} บาท`;

export default function CustomerAccountPage({ mode }: { mode: AccountPageMode }) {
  const navigate = useNavigate();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [profile, setProfile] = useState<CustomerProfileInput>(emptyProfile);
  const [storeBookings, setStoreBookings] = useState<BookingRecord[]>(getBookingsSnapshot());
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Upload new slip dialog
  const [reuploadBookingId, setReuploadBookingId] = useState<string | null>(null);
  const [reuploadFileName, setReuploadFileName] = useState('');
  const [reuploadPreview, setReuploadPreview] = useState('');

  // Preview enlarged QR ticket dialog
  const [previewQrTicket, setPreviewQrTicket] = useState<{ code: string; qrCodeUrl: string; seatLabel: string; concertTitle: string } | null>(null);

  useEffect(() => {
    return subscribeBookings(() => {
      setStoreBookings([...getBookingsSnapshot()]);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const accountData = await customerAccountApi.getAccount();
        if (!active) return;
        setAccount(accountData);
        setProfile({
          firstName: accountData.firstName, lastName: accountData.lastName,
          dateOfBirth: accountData.dateOfBirth, gender: accountData.gender,
          phone: accountData.phone, address: accountData.address, email: accountData.email,
        });
        saveCustomerSession(accountData);

        // ดึงรายการจองจาก Database ผ่าน API
        const bookings = await bookingPaymentApi.getCustomerBookings(accountData.userId, accountData.email);
        if (active) setStoreBookings(bookings);
      } catch (error) {
        if (!active) return;
        if (error instanceof CustomerApiError && error.status === 401) {
          // If in guest mode, fall back to mock profile for booking showcase
          setAccount({
            userId: 'guest-1',
            firstName: 'สมชาย',
            lastName: 'ใจดี',
            dateOfBirth: '1995-01-01',
            gender: 'ชาย',
            phone: '081-234-5678',
            address: 'กรุงเทพฯ',
            email: 'somchai.j@example.com',
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [mode, navigate]);

  const handleResendTicket = async (booking: BookingRecord) => {
    await bookingPaymentApi.resendTickets(booking.id);
    setMessage({
      severity: 'success',
      text: `ส่งบัตรเข้าชม (รหัสและ QR Code เดิม) ไปยังอีเมล ${booking.customerEmail} อีกครั้งเรียบร้อยแล้ว`,
    });
  };

  const handleReuploadSubmit = async () => {
    if (!reuploadBookingId || !reuploadFileName) return;
    await bookingPaymentApi.reuploadSlip(reuploadBookingId, reuploadFileName, reuploadPreview || undefined);
    setReuploadBookingId(null);
    setReuploadFileName('');
    setReuploadPreview('');
    if (account) {
      const refreshed = await bookingPaymentApi.getCustomerBookings(account.userId, account.email);
      setStoreBookings(refreshed);
    }
    setMessage({
      severity: 'success',
      text: 'ส่งหลักฐานการชำระเงินใหม่เรียบร้อยแล้ว สถานะเปลี่ยนเป็น "รอตรวจสอบ"',
    });
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await customerAccountApi.updateProfile(profile);
      setAccount(updated);
      saveCustomerSession(updated);
      setMessage({ severity: 'success', text: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว' });
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'ไม่สามารถบันทึกโปรไฟล์ได้' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setMessage({ severity: 'error', text: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await customerAccountApi.changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      setMessage({ severity: 'success', text: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
    } finally {
      setSaving(false);
    }
  };

  const details = pageDetails[mode];
  const PageIcon = details.icon;
  const accountName = account ? `${account.firstName} ${account.lastName}`.trim() : 'สมชาย ใจดี';
  const avatarLabel = accountName.charAt(0).toLocaleUpperCase('th-TH') || 'O';

  // Extract issued tickets from store bookings (UP3)
  const issuedBookings = storeBookings.filter((b) => b.status === 'issued');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f8fc' }}>
      <CustomerHeader />
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
        {loading ? (
          <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}>
            <CircularProgress sx={{ color: '#FF5C58' }} />
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, overflow: 'hidden', borderRadius: 4, borderColor: '#e0e3ec', minHeight: 590 }}>
            <Box component="aside" sx={{ bgcolor: '#fff', borderRight: { md: '1px solid #e2e4eb' }, borderBottom: { xs: '1px solid #e2e4eb', md: 0 }, p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={1} sx={{ mb: 3, alignItems: 'center' }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: '#11366b', fontWeight: 800, fontSize: 24 }}>{avatarLabel}</Avatar>
                <Typography sx={{ fontWeight: 800, color: '#171d3b', textAlign: 'center' }}>{accountName}</Typography>
                <Typography variant="body2" sx={{ color: '#8a8fa1', textAlign: 'center', overflowWrap: 'anywhere' }}>{account?.email || 'somchai.j@example.com'}</Typography>
              </Stack>
              <List disablePadding>
                {(Object.keys(pageDetails) as AccountPageMode[]).map((itemMode, index) => {
                  const item = pageDetails[itemMode];
                  const ItemIcon = item.icon;
                  return (
                    <Box key={itemMode}>
                      {index === 2 && <Divider sx={{ my: 1.25 }} />}
                      <ListItemButton component={RouterLink} to={item.path} selected={mode === itemMode} sx={{ borderRadius: 2, gap: 1.5, minHeight: 46, color: '#34394d', '&.Mui-selected': { bgcolor: '#eef0f5', color: '#050C38' } }}>
                        <ItemIcon sx={{ fontSize: 20 }} />
                        <Typography sx={{ fontSize: '0.95rem' }}>{item.title}</Typography>
                      </ListItemButton>
                    </Box>
                  );
                })}
              </List>
            </Box>

            <Box component="main" sx={{ bgcolor: '#fff', p: { xs: 2.5, sm: 4, md: 5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <PageIcon sx={{ color: '#FF5C58', fontSize: 30 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: '#17203b', fontWeight: 800, fontSize: { xs: '1.55rem', md: '1.8rem' } }}>{details.title}</Typography>
                  <Typography sx={{ color: '#858a9c', fontSize: '0.92rem' }}>{details.description}</Typography>
                </Box>
              </Box>
              {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}

              {/* UP3 & UP5: บัตรของฉัน (My Tickets) */}
              {mode === 'tickets' && (
                issuedBookings.length === 0 ? (
                  <EmptyState icon={PageIcon} text="ยังไม่มีบัตรในบัญชีของคุณ" detail="เมื่อเจ้าหน้าที่อนุมัติการชำระเงินแล้ว E-Ticket พร้อม QR Code จะปรากฏที่หน้านี้" />
                ) : (
                  <Stack spacing={3}>
                    {issuedBookings.map((booking) => (
                      <Paper key={booking.id} variant="outlined" sx={{ p: 3, borderRadius: 3, borderColor: '#e0e3ec', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                          <Box>
                            <Typography variant="h6" sx={{ color: '#171d3b', fontWeight: 800 }}>{booking.concertTitle}</Typography>
                            <Typography variant="body2" sx={{ color: '#83889a' }}>รหัสการจอง {booking.id} · ออกบัตรเมื่อ {formatDate(booking.createdAt)}</Typography>
                          </Box>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Chip label="ออกบัตรแล้ว (พร้อมใช้งาน)" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700 }} />
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<SendOutlinedIcon />}
                              onClick={() => handleResendTicket(booking)}
                              sx={{ borderRadius: 2, textTransform: 'none', color: '#11366b', borderColor: '#11366b' }}
                            >
                              ขอส่งบัตรซ้ำทางอีเมล
                            </Button>
                          </Stack>
                        </Box>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} sx={{ color: '#555b70', mb: 2.5 }}>
                          <Typography variant="body2"><CalendarMonthOutlinedIcon sx={{ fontSize: 17, mr: 0.7, verticalAlign: 'middle' }} />{formatDate(booking.eventDate)}</Typography>
                          <Typography variant="body2"><LocationOnOutlinedIcon sx={{ fontSize: 17, mr: 0.7, verticalAlign: 'middle' }} />{booking.location || 'ฮอลล์จัดแสดง'}</Typography>
                          <Typography variant="body2">โซน {booking.zoneId} ({booking.tierName})</Typography>
                        </Stack>

                        <Divider sx={{ mb: 2.5 }} />

                        {/* Tickets with QR Code */}
                        {(() => {
                          const ticketsToRender = (booking.tickets && booking.tickets.length > 0)
                            ? booking.tickets
                            : Array.from({ length: booking.quantity || 1 }, (_, index) => {
                                const seatLabel = booking.seats?.[index] || `${booking.zoneId}-${String(index + 1).padStart(2, '0')}`;
                                const code = `TCK-${(booking.concertId || 'CONCERT').toUpperCase()}-${booking.zoneId}-${index + 1}-${booking.id.replace(/[^0-9]/g, '').slice(-4) || '0001'}`;
                                return {
                                  code,
                                  seatLabel,
                                  issuedAt: booking.createdAt,
                                  qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`OCTAVIA|${code}|${booking.concertTitle}|${booking.zoneId}|${seatLabel}|${booking.customerName}`)}`,
                                };
                              });

                          return (
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#171d3b', mb: 1.5 }}>
                                ตั๋วเข้าชมคอนเสิร์ต ({ticketsToRender.length} ใบ):
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(230px, 1fr))' }, gap: 2 }}>
                                {ticketsToRender.map((ticket) => (
                                  <Paper
                                    key={ticket.code}
                                    elevation={0}
                                    onClick={() => setPreviewQrTicket({
                                      code: ticket.code,
                                      qrCodeUrl: ticket.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ticket.code)}`,
                                      seatLabel: ticket.seatLabel,
                                      concertTitle: booking.concertTitle,
                                    })}
                                    sx={{
                                      p: 2,
                                      bgcolor: '#fbfcfe',
                                      border: '1.5px dashed #90caf9',
                                      borderRadius: 2.5,
                                      textAlign: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      '&:hover': {
                                        transform: 'translateY(-3px)',
                                        boxShadow: '0 6px 16px rgba(17, 54, 107, 0.12)',
                                        borderColor: '#11366b',
                                        bgcolor: '#ffffff',
                                      },
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.8 }}>
                                      <Chip label="พร้อมใช้งาน (Valid)" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
                                    </Box>
                                    <Box
                                      component="img"
                                      src={ticket.qrCodeUrl}
                                      alt="Ticket QR Code"
                                      sx={{ width: 140, height: 140, mx: 'auto', my: 0.8, p: 1, bgcolor: '#fff', borderRadius: 2, border: '1px solid #e0e3ec' }}
                                    />
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#11366b', letterSpacing: '0.5px' }}>{ticket.code}</Typography>
                                    <Typography variant="caption" sx={{ color: '#374151', fontWeight: 600, display: 'block', mt: 0.3 }}>
                                      ที่นั่ง: <strong>{ticket.seatLabel}</strong>
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#1976d2', fontSize: '0.72rem', mt: 0.8, display: 'block', fontWeight: 500 }}>
                                      🔍 คลิกที่รูปเพื่อขยาย QR Code สำหรับสแกน
                                    </Typography>
                                  </Paper>
                                ))}
                              </Box>
                            </Box>
                          );
                        })()}
                      </Paper>
                    ))}
                  </Stack>
                )
              )}

              {/* UP4: ประวัติการซื้อ (Purchase History & Payment Status) */}
              {mode === 'history' && (
                storeBookings.length === 0 ? (
                  <EmptyState icon={PageIcon} text="ยังไม่มีประวัติการซื้อ" detail="รายการสั่งซื้อและการชำระเงินจะแสดงที่หน้านี้" />
                ) : (
                  <Stack spacing={2.5}>
                    {storeBookings.map((booking) => (
                      <Paper key={booking.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: '#e3e6ee' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography sx={{ color: '#171d3b', fontWeight: 800, fontSize: '1.05rem' }}>{booking.concertTitle}</Typography>
                            <Typography variant="body2" sx={{ color: '#83889a' }}>รหัสการจอง: {booking.id} · จองเมื่อ {formatDate(booking.createdAt)}</Typography>
                            <Typography variant="body2" sx={{ color: '#555', mt: 0.5 }}>
                              โซน {booking.zoneId} ({booking.tierName}) · {booking.quantity} ที่นั่ง ({booking.seats?.join(', ') || '-'})
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: { sm: 'right' } }}>
                            <Typography sx={{ color: '#11366b', fontWeight: 800, fontSize: '1.15rem' }}>{money(booking.totalPrice)}</Typography>
                            <Box sx={{ mt: 0.5 }}>
                              {booking.status === 'issued' && (
                                <Chip label="ออกบัตรแล้ว" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700 }} />
                              )}
                              {booking.status === 'under_review' && (
                                <Chip label="รอตรวจสอบสลิป" size="small" sx={{ bgcolor: '#fff8e1', color: '#b78103', fontWeight: 700 }} />
                              )}
                              {booking.status === 'rejected' && (
                                <Chip label="ถูกปฏิเสธการชำระเงิน" size="small" sx={{ bgcolor: '#ffebee', color: '#c62828', fontWeight: 700 }} />
                              )}
                              {booking.status === 'pending_payment' && (
                                <Chip label="รอชำระเงิน" size="small" sx={{ bgcolor: '#ede7f6', color: '#512da8', fontWeight: 700 }} />
                              )}
                              {booking.status === 'expired' && (
                                <Chip label="หมดเวลาชำระเงิน" size="small" sx={{ bgcolor: '#f5f5f5', color: '#757575', fontWeight: 700 }} />
                              )}
                            </Box>
                          </Box>
                        </Box>

                        {/* Rejected Alert with Re-upload option */}
                        {booking.status === 'rejected' && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: '#fff5f5', borderRadius: 2, border: '1px solid #ffcdd2' }}>
                            <Typography variant="body2" sx={{ color: '#c62828', fontWeight: 700, mb: 0.5 }}>
                              ⚠️ เหตุผลที่ปฏิเสธ: {booking.payment?.rejectReason || 'หลักฐานไม่ถูกต้องหรือไม่ชัดเจน'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1.5 }}>
                              ท่านสามารถอัปโหลดภาพสลิปที่ถูกต้องใหม่เพื่อให้เจ้าหน้าที่ตรวจสอบอีกครั้ง
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              startIcon={<CloudUploadOutlinedIcon />}
                              onClick={() => {
                                setReuploadBookingId(booking.id);
                                setReuploadFileName('');
                                setReuploadPreview('');
                              }}
                              sx={{ borderRadius: 2, textTransform: 'none' }}
                            >
                              แนบสลิปใหม่
                            </Button>
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                )
              )}

              {/* Profile Mode */}
              {mode === 'profile' && (
                <Box component="form" onSubmit={saveProfile}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.25 }}>
                    <TextField label="ชื่อ" value={profile.firstName} onChange={(event) => setProfile((value) => ({ ...value, firstName: event.target.value }))} required />
                    <TextField label="นามสกุล" value={profile.lastName} onChange={(event) => setProfile((value) => ({ ...value, lastName: event.target.value }))} required />
                    <TextField label="อีเมล" type="email" value={profile.email} onChange={(event) => setProfile((value) => ({ ...value, email: event.target.value }))} required sx={{ gridColumn: { sm: '1 / -1' } }} />
                    <TextField select label="เพศ" value={profile.gender} onChange={(event) => setProfile((value) => ({ ...value, gender: event.target.value }))} required>
                      <MenuItem value="หญิง">หญิง</MenuItem><MenuItem value="ชาย">ชาย</MenuItem><MenuItem value="ไม่ระบุ">ไม่ระบุ</MenuItem>
                    </TextField>
                    <TextField label="วันเกิด" type="date" value={profile.dateOfBirth} onChange={(event) => setProfile((value) => ({ ...value, dateOfBirth: event.target.value }))} required slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField label="หมายเลขโทรศัพท์" value={profile.phone} onChange={(event) => setProfile((value) => ({ ...value, phone: event.target.value }))} required sx={{ gridColumn: { sm: '1 / -1' } }} />
                    <TextField label="ที่อยู่" value={profile.address} onChange={(event) => setProfile((value) => ({ ...value, address: event.target.value }))} multiline minRows={3} sx={{ gridColumn: { sm: '1 / -1' } }} />
                  </Box>
                  <Button type="submit" variant="contained" disabled={saving} sx={{ mt: 3, bgcolor: '#11366b', px: 4, borderRadius: 99, '&:hover': { bgcolor: '#0b2447' } }}>
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                  </Button>
                </Box>
              )}

              {/* Password Mode */}
              {mode === 'password' && (
                <Box component="form" onSubmit={changePassword} sx={{ maxWidth: 560 }}>
                  <Stack spacing={2.25}>
                    <TextField label="รหัสผ่านปัจจุบัน" type="password" value={passwords.current} onChange={(event) => setPasswords((value) => ({ ...value, current: event.target.value }))} required />
                    <TextField label="รหัสผ่านใหม่" type="password" value={passwords.next} onChange={(event) => setPasswords((value) => ({ ...value, next: event.target.value }))} required helperText="อย่างน้อย 8 ตัวอักษร" />
                    <TextField label="ยืนยันรหัสผ่านใหม่" type="password" value={passwords.confirm} onChange={(event) => setPasswords((value) => ({ ...value, confirm: event.target.value }))} required />
                    <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start', bgcolor: '#11366b', px: 4, borderRadius: 99, '&:hover': { bgcolor: '#0b2447' } }}>
                      {saving ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
                    </Button>
                  </Stack>
                </Box>
              )}
            </Box>
          </Paper>
        )}
      </Container>

      {/* Re-upload Slip Dialog */}
      <Dialog open={Boolean(reuploadBookingId)} onClose={() => setReuploadBookingId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#11366b' }}>แนบหลักฐานการโอนเงินใหม่</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            รหัสการจอง: <strong>{reuploadBookingId}</strong>
          </Typography>
          <Button
            component="label"
            variant="outlined"
            fullWidth
            startIcon={<CloudUploadOutlinedIcon />}
            sx={{ py: 1.5, borderRadius: 2, borderStyle: 'dashed', textTransform: 'none' }}
          >
            {reuploadFileName ? `เลือกไฟล์แล้ว: ${reuploadFileName}` : 'เลือกไฟล์ภาพสลิปใหม่'}
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setReuploadFileName(file.name);
                const reader = new FileReader();
                reader.onloadend = () => setReuploadPreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </Button>
          {reuploadPreview && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Box component="img" src={reuploadPreview} alt="Slip" sx={{ maxHeight: 150, maxWidth: '100%', borderRadius: 2 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setReuploadBookingId(null)} color="inherit">ยกเลิก</Button>
          <Button onClick={handleReuploadSubmit} variant="contained" disabled={!reuploadFileName} sx={{ bgcolor: '#11366b' }}>
            ยืนยันส่งสลิป
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Enlarged Preview Dialog สำหรับสแกนเข้างาน */}
      <Dialog
        open={Boolean(previewQrTicket)}
        onClose={() => setPreviewQrTicket(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4, p: 1 } } }}
      >
        {previewQrTicket && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
              OCTAVIA E-TICKET
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#11366b', mt: 0.5, mb: 0.5 }}>
              {previewQrTicket.concertTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
              ที่นั่ง: <strong>{previewQrTicket.seatLabel}</strong> · รหัสตั๋ว: <strong>{previewQrTicket.code}</strong>
            </Typography>
            <Box
              component="img"
              src={previewQrTicket.qrCodeUrl}
              alt="Enlarged QR Code"
              sx={{
                width: 240,
                height: 240,
                mx: 'auto',
                p: 2,
                bgcolor: '#fff',
                borderRadius: 3,
                border: '2px solid #cbd5e1',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              }}
            />
            <Alert severity="success" sx={{ mt: 2.5, textAlign: 'left', borderRadius: 2 }}>
              แสดง QR Code นี้แก่เจ้าหน้าที่ ณ ประตูทางเข้างาน (Gate Check-In) เพื่อสแกนเข้าชม
            </Alert>
            <Button
              fullWidth
              variant="contained"
              onClick={() => setPreviewQrTicket(null)}
              sx={{ mt: 2.5, bgcolor: '#050C38', py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: '1rem' }}
            >
              ปิดหน้าต่าง
            </Button>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}

function EmptyState({ icon: Icon, text, detail }: { icon: typeof EditOutlinedIcon; text: string; detail: string }) {
  return (
    <Box sx={{ minHeight: 310, display: 'grid', placeItems: 'center', textAlign: 'center', p: 4 }}>
      <Box>
        <Icon sx={{ fontSize: 68, color: '#c7cad5', mb: 1.5 }} />
        <Typography sx={{ color: '#272d51', fontWeight: 800, mb: 0.5 }}>{text}</Typography>
        <Typography sx={{ color: '#858a9c', fontSize: '0.92rem' }}>{detail}</Typography>
      </Box>
    </Box>
  );
}
