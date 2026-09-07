import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button } from '@mui/material';

interface ExpiredDialogProps {
    open: boolean;
    onClose: () => void;
}

const ExpiredDialog = ({ open, onClose }: ExpiredDialogProps) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            slotProps={{ paper: { style: { borderRadius: '16px', padding: '8px' } } }}
        >
            <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', color: '#E53935' }}>
                ⏰ หมดเวลาชำระเงิน
            </DialogTitle>
            <DialogContent>
                <Typography sx={{ textAlign: 'center', color: '#666' }}>
                    ที่นั่งของคุณถูกปลดล็อคเนื่องจากไม่ได้ชำระเงินภายในเวลาที่กำหนด
                    กรุณาเลือกที่นั่งใหม่อีกครั้ง
                </Typography>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                    variant="contained"
                    onClick={onClose}
                    sx={{
                        bgcolor: '#FF5C58', borderRadius: '25px',
                        px: 4, fontWeight: 'bold', textTransform: 'none',
                        '&:hover': { bgcolor: '#e04f4a' },
                    }}
                >
                    เลือกที่นั่งใหม่
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExpiredDialog;
