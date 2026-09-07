import { Dialog, DialogContent, Box, Typography, Button, Paper } from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import { formatTime } from '@/components/SeatSelection/constants';

interface QRCodeDialogProps {
    open: boolean;
    onClose: () => void;
    totalPrice: number;
    timeLeft: number;
    onSimulateSuccess: () => void;
}

const QRCodeDialog = ({ open, onClose, totalPrice, timeLeft, onSimulateSuccess }: QRCodeDialogProps) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            slotProps={{
                paper: { 
                    style: { 
                        borderRadius: '24px', 
                        maxWidth: '420px', 
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
                pt: 3.5, pb: 2.5,
                position: 'relative'
            }}>
                <Typography sx={{ fontWeight: '900', fontSize: '1.4rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Thai QR Payment
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', opacity: 0.8, mt: 0.5 }}>
                    สแกนเพื่อชำระเงิน (Scan to Pay)
                </Typography>
                {/* Decorative curve at bottom */}
                <Box sx={{
                    position: 'absolute', bottom: -1, left: 0, right: 0, height: '20px',
                    background: '#f8f9fa', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'
                }} />
            </Box>

            <DialogContent sx={{ px: 4, pb: 4, pt: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* QR Code Container */}
                <Paper elevation={4} sx={{ 
                    p: 2, mb: 3, borderRadius: '16px', bgcolor: '#fff',
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <Box component="img" 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Payment_${totalPrice}`}
                        alt="QR Code"
                        sx={{ width: 200, height: 200 }}
                    />
                </Paper>

                {/* Timer */}
                <Box sx={{ 
                    display: 'flex', alignItems: 'center', gap: 1, mb: 3,
                    bgcolor: timeLeft <= 60 ? 'rgba(229,57,53,0.1)' : 'rgba(25,118,210,0.1)', 
                    px: 3, py: 1, borderRadius: '20px'
                }}>
                    <TimerIcon sx={{ color: timeLeft <= 60 ? '#E53935' : '#1976d2', fontSize: 20 }} />
                    <Typography sx={{ 
                        fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace',
                        color: timeLeft <= 60 ? '#E53935' : '#1976d2'
                    }}>
                        {formatTime(timeLeft)}
                    </Typography>
                </Box>
                
                {/* Amount & Recipient Details */}
                <Box sx={{ width: '100%', mb: 3, p: 2, bgcolor: '#ffffff', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                    {/* <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ color: '#666', fontSize: '0.9rem' }}>ร้านค้า</Typography>
                        <Typography sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>Neon Tickets Co., Ltd.</Typography>
                    </Box> */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, pt: 1 }}>
                        <Typography sx={{ color: '#666', fontSize: '0.9rem' }}>จำนวนเงิน</Typography>
                        <Typography sx={{ fontWeight: '900', fontSize: '1.5rem', color: '#11366b' }}>
                            {totalPrice.toLocaleString()} ฿
                        </Typography>
                    </Box>
                </Box>

                <Button onClick={onSimulateSuccess} variant="contained" fullWidth sx={{
                    bgcolor: '#43A047', color: '#ffffff', borderRadius: '12px', py: 1.2,
                    fontWeight: 'bold', textTransform: 'none', boxShadow: '0 4px 12px rgba(67, 160, 71, 0.3)',
                    '&:hover': { bgcolor: '#388E3C' }
                }}>
                    เสร็จสิ้น
                </Button>
            </DialogContent>
        </Dialog>
    );
};

export default QRCodeDialog;
