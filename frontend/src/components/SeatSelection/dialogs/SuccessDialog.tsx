import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { EventData, ZoneInfo } from '@/components/SeatSelection/types';

interface SuccessDialogProps {
    open: boolean;
    event: EventData;
    zone: string;
    zoneInfo: ZoneInfo;
    totalPrice: number;
    onHomeClick: () => void;
}

const SuccessDialog = ({ open, event, zone, zoneInfo, totalPrice: _totalPrice, onHomeClick }: SuccessDialogProps) => {
    return (
        <Dialog
            open={open}
            onClose={() => {}}
            slotProps={{ paper: { sx: { borderRadius: '20px', padding: '16px', width: '100%', maxWidth: '500px' } } }}
        >
            <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', color: '#43A047', fontSize: '1.8rem', pt: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: '#43A047', display: 'block', mx: 'auto', mb: 2 }} />
                ชำระเงินสำเร็จ!
            </DialogTitle>
            <DialogContent sx={{ px: 4 }}>
                <Typography sx={{ textAlign: 'center', color: '#555', mb: 1.5, fontSize: '1.1rem' }}>
                    🎵 {event.title}
                </Typography>
                <Typography sx={{ textAlign: 'center', color: '#555', mb: 1.5, fontSize: '1.1rem' }}>
                    📅 {event.eventDate}
                </Typography>
                <Typography sx={{ textAlign: 'center', color: '#555', mb: 3, fontSize: '1.1rem' }}>
                    📍 โซน {zone} ({zoneInfo.label})
                </Typography>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                <Button
                    variant="contained"
                    onClick={onHomeClick}
                    sx={{
                        bgcolor: '#43A047', borderRadius: '25px',
                        px: 5, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'none',
                        '&:hover': { bgcolor: '#388E3C' },
                    }}
                >
                    กลับหน้าแรก
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SuccessDialog;
