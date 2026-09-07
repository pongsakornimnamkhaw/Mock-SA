import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button, Box, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { EventData, ZoneInfo } from '@/components/SeatSelection/types';
import { useNavigate } from 'react-router-dom';

interface SuccessDialogProps {
    open: boolean;
    event: EventData;
    zone: string;
    zoneInfo: ZoneInfo;
    totalPrice: number;
    bookingId?: string;
    onHomeClick: () => void;
}

const SuccessDialog = ({ open, event, zone, zoneInfo, totalPrice, bookingId, onHomeClick }: SuccessDialogProps) => {
    const navigate = useNavigate();

    return (
        <Dialog
            open={open}
            onClose={() => {}}
            slotProps={{ paper: { sx: { borderRadius: '20px', padding: '16px', width: '100%', maxWidth: '500px' } } }}
        >
            <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', color: '#2e7d32', fontSize: '1.6rem', pt: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 60, color: '#2e7d32', display: 'block', mx: 'auto', mb: 1.5 }} />
                ส่งหลักฐานเรียบร้อยแล้ว!
            </DialogTitle>
            <DialogContent sx={{ px: 4, textAlign: 'center' }}>
                <Box sx={{ mb: 2 }}>
                    <Chip 
                        label="สถานะ: รอเจ้าหน้าที่ตรวจสอบ (Under Review)" 
                        sx={{ bgcolor: '#fff8e1', color: '#b78103', fontWeight: 700, px: 1, py: 0.5 }} 
                    />
                </Box>
                {bookingId && (
                    <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                        รหัสการจอง: <strong>{bookingId}</strong>
                    </Typography>
                )}
                <Typography sx={{ color: '#333', fontWeight: 700, mb: 1, fontSize: '1.1rem' }}>
                    🎵 {event.title}
                </Typography>
                <Typography sx={{ color: '#555', mb: 1, fontSize: '0.95rem' }}>
                    📅 {event.eventDate}
                </Typography>
                <Typography sx={{ color: '#555', mb: 1.5, fontSize: '0.95rem' }}>
                    📍 โซน {zone} ({zoneInfo.label})
                </Typography>
                <Typography sx={{ color: '#11366b', fontWeight: 800, fontSize: '1.15rem', mb: 1 }}>
                    ยอดชำระ: {totalPrice.toLocaleString()} ฿
                </Typography>
                <Typography variant="caption" sx={{ color: '#777', display: 'block' }}>
                    *เจ้าหน้าที่ฝ่ายขายจะทำการตรวจสอบสลิป เมื่ออนุมัติแล้วระบบจะจัดส่ง E-Ticket พร้อม QR Code ไปยังอีเมลของท่านทันที
                </Typography>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', gap: 1.5, pb: 3, pt: 1 }}>
                <Button
                    variant="outlined"
                    onClick={onHomeClick}
                    sx={{
                        borderRadius: '25px', px: 3, py: 1, fontWeight: 'bold', textTransform: 'none',
                        borderColor: '#999', color: '#555'
                    }}
                >
                    กลับหน้าแรก
                </Button>
                <Button
                    variant="contained"
                    onClick={() => navigate('/purchase-history')}
                    sx={{
                        bgcolor: '#11366b', borderRadius: '25px',
                        px: 3.5, py: 1, fontSize: '0.95rem', fontWeight: 'bold', textTransform: 'none',
                        '&:hover': { bgcolor: '#0b2447' },
                    }}
                >
                    ติดตามสถานะการจอง
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SuccessDialog;
