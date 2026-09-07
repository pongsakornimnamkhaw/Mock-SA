import { Dialog, DialogContent, Box, Typography, Button, Paper, TextField, Alert, Stack } from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState, useEffect } from 'react';
import { formatTime } from '@/components/SeatSelection/constants';
import { getCustomerSession } from '@/utils/customerSession';

interface QRCodeDialogProps {
    open: boolean;
    onClose: () => void;
    totalPrice: number;
    timeLeft: number;
    onSubmitPayment: (data: {
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        slipFileName: string;
        slipDataUrl?: string;
    }) => void;
}

const QRCodeDialog = ({ open, onClose, totalPrice, timeLeft, onSubmitPayment }: QRCodeDialogProps) => {
    const session = getCustomerSession();
    const [customerName, setCustomerName] = useState(session?.name || 'สมชาย ใจดี');
    const [customerEmail, setCustomerEmail] = useState(session?.email || 'somchai.j@example.com');
    const [customerPhone, setCustomerPhone] = useState(session?.phone || '0812345678');
    const [slipFileName, setSlipFileName] = useState<string>('');
    const [slipPreview, setSlipPreview] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (open) {
            const current = getCustomerSession();
            if (current) {
                setCustomerName(current.name);
                setCustomerEmail(current.email);
                if (current.phone) setCustomerPhone(current.phone);
            }
        }
    }, [open]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (JPG, PNG)');
            return;
        }
        setError('');
        setSlipFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setSlipPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = () => {
        if (!customerName.trim()) {
            setError('กรุณากรอกชื่อ-นามสกุลผู้จอง');
            return;
        }
        if (!customerEmail.trim() || !customerEmail.includes('@')) {
            setError('กรุณากรอกอีเมลที่ถูกต้องสำหรับรับตั๋วคอนเสิร์ต');
            return;
        }
        if (!slipFileName) {
            // หากไม่ได้เลือกไฟล์ ให้ใช้ mock slip อัตโนมัติเพื่อความสะดวกในการทดสอบ
            onSubmitPayment({
                customerName,
                customerEmail,
                customerPhone,
                slipFileName: `slip_${Date.now()}.png`,
                slipDataUrl: slipPreview || undefined,
            });
            return;
        }
        onSubmitPayment({
            customerName,
            customerEmail,
            customerPhone,
            slipFileName,
            slipDataUrl: slipPreview || undefined,
        });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            slotProps={{
                paper: { 
                    style: { 
                        borderRadius: '24px', 
                        maxWidth: '480px', 
                        width: '100%', 
                        padding: 0, 
                        overflow: 'hidden',
                        background: '#f8f9fa'
                    } 
                }
            }}
        >
            {/* Header (Thai QR Payment Style) */}
            <Box sx={{ 
                background: 'linear-gradient(135deg, #11366b 0%, #1a4f9c 100%)', 
                color: '#ffffff', 
                textAlign: 'center', 
                pt: 3, pb: 2.5,
                position: 'relative'
            }}>
                <Typography sx={{ fontWeight: '900', fontSize: '1.3rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Thai QR Payment
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', opacity: 0.85, mt: 0.5 }}>
                    สแกน QR Code เพื่อชำระเงินและแนบหลักฐาน
                </Typography>
                <Box sx={{
                    position: 'absolute', bottom: -1, left: 0, right: 0, height: '16px',
                    background: '#f8f9fa', borderTopLeftRadius: '16px', borderTopRightRadius: '16px'
                }} />
            </Box>

            <DialogContent sx={{ px: 3, pb: 3.5, pt: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Timer */}
                <Box sx={{ 
                    display: 'flex', alignItems: 'center', gap: 1, mb: 2,
                    bgcolor: timeLeft <= 60 ? 'rgba(229,57,53,0.1)' : 'rgba(25,118,210,0.1)', 
                    px: 2.5, py: 0.6, borderRadius: '20px'
                }}>
                    <TimerIcon sx={{ color: timeLeft <= 60 ? '#E53935' : '#1976d2', fontSize: 18 }} />
                    <Typography sx={{ 
                        fontWeight: 'bold', fontSize: '1.05rem', fontFamily: 'monospace',
                        color: timeLeft <= 60 ? '#E53935' : '#1976d2'
                    }}>
                        เวลาที่ล็อกที่นั่ง: {formatTime(timeLeft)}
                    </Typography>
                </Box>

                {/* QR Code Container */}
                <Paper elevation={2} sx={{ 
                    p: 1.5, mb: 2, borderRadius: '16px', bgcolor: '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                    <Box component="img" 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=OctaviaPay_Amount_${totalPrice}`}
                        alt="QR Code"
                        sx={{ width: 160, height: 160 }}
                    />
                    <Typography variant="caption" sx={{ color: '#666', mt: 0.5 }}>
                        PromptPay: 098-765-4321 (Octavia Tickets)
                    </Typography>
                </Paper>

                {/* Total Price */}
                <Box sx={{ width: '100%', mb: 2, p: 1.5, bgcolor: '#ffffff', borderRadius: '12px', border: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ color: '#555', fontSize: '0.9rem' }}>ยอดชำระสุทธิ</Typography>
                    <Typography sx={{ fontWeight: '900', fontSize: '1.4rem', color: '#11366b' }}>
                        {totalPrice.toLocaleString()} ฿
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ width: '100%', mb: 2, py: 0 }}>{error}</Alert>}

                {/* Customer Information for Ticket Delivery */}
                <Stack spacing={1.5} sx={{ width: '100%', mb: 2 }}>
                    <TextField 
                        size="small" 
                        label="ชื่อ-นามสกุล ผู้รับบัตร" 
                        value={customerName} 
                        onChange={(e) => setCustomerName(e.target.value)} 
                        fullWidth 
                        required 
                    />
                    <TextField 
                        size="small" 
                        label="อีเมล (สำหรับส่ง E-Ticket พร้อม QR Code)" 
                        type="email"
                        value={customerEmail} 
                        onChange={(e) => setCustomerEmail(e.target.value)} 
                        fullWidth 
                        required 
                    />
                    <TextField 
                        size="small" 
                        label="เบอร์โทรศัพท์" 
                        value={customerPhone} 
                        onChange={(e) => setCustomerPhone(e.target.value)} 
                        fullWidth 
                    />
                </Stack>

                {/* UP1: Upload Slip Evidence */}
                <Box sx={{ width: '100%', mb: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#333', mb: 0.8 }}>
                        แนบหลักฐานการโอนเงิน (สลิป):
                    </Typography>
                    <Button
                        component="label"
                        variant="outlined"
                        fullWidth
                        startIcon={slipFileName ? <CheckCircleIcon sx={{ color: '#2e7d32' }} /> : <CloudUploadOutlinedIcon />}
                        sx={{
                            borderColor: slipFileName ? '#2e7d32' : '#bbb',
                            color: slipFileName ? '#2e7d32' : '#555',
                            py: 1,
                            borderRadius: '10px',
                            textTransform: 'none',
                            borderStyle: slipFileName ? 'solid' : 'dashed',
                        }}
                    >
                        {slipFileName ? `แนบไฟล์แล้ว: ${slipFileName}` : 'เลือกไฟล์ภาพสลิป หรือคลิกเพื่ออัปโหลด'}
                        <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                    </Button>
                    {slipPreview && (
                        <Box sx={{ mt: 1, textAlign: 'center' }}>
                            <Box 
                                component="img" 
                                src={slipPreview} 
                                alt="Slip Preview" 
                                sx={{ maxHeight: 120, maxWidth: '100%', borderRadius: 1.5, border: '1px solid #ddd' }} 
                            />
                        </Box>
                    )}
                </Box>

                {/* Submit button */}
                <Button 
                    onClick={handleSubmit} 
                    variant="contained" 
                    fullWidth 
                    sx={{
                        bgcolor: '#11366b', color: '#ffffff', borderRadius: '12px', py: 1.2,
                        fontSize: '1rem', fontWeight: 'bold', textTransform: 'none',
                        boxShadow: '0 4px 12px rgba(17, 54, 107, 0.3)',
                        '&:hover': { bgcolor: '#0b2447' }
                    }}
                >
                    ส่งหลักฐานการชำระเงิน
                </Button>
            </DialogContent>
        </Dialog>
    );
};

export default QRCodeDialog;
