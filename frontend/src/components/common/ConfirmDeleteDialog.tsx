import { Box, Button, Dialog, DialogContent, Typography } from '@mui/material';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  message?: string;
  loading?: boolean;
}

export default function ConfirmDeleteDialog({
  open,
  onCancel,
  onConfirm,
  message = 'คุณยืนยันที่จะลบข้อมูลหรือไม่',
  loading = false,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '38px',
            overflow: 'hidden',
            m: 2,
          },
        },
      }}
    >
      <Box sx={{ bgcolor: '#ff5c5c', color: '#fff', py: 2.25, textAlign: 'center' }}>
        <Typography sx={{ fontSize: { xs: '1.8rem', sm: '2.15rem' }, fontWeight: 700 }}>
          คำเตือน
        </Typography>
      </Box>

      <DialogContent sx={{ px: { xs: 3, sm: 5 }, pt: 6, pb: 3.5 }}>
        <Typography sx={{ textAlign: 'center', color: '#161616', fontSize: { xs: '1.15rem', sm: '1.45rem' }, mb: 6 }}>
          {message}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 2, sm: 4 } }}>
          <Button
            variant="contained"
            onClick={onCancel}
            disabled={loading}
            sx={{
            bgcolor: '#7d7d7d',
              minWidth: 135,
              borderRadius: '12px',
              fontSize: '1.15rem',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#696969', boxShadow: 'none' },
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            disabled={loading}
            sx={{
              bgcolor: '#ff343b',
              minWidth: 135,
              borderRadius: '12px',
              fontSize: '1.15rem',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#e82d34', boxShadow: 'none' },
            }}
          >
            {loading ? 'กำลังลบ...' : 'ยืนยัน'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
