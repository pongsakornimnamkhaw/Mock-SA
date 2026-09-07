import { Box, Typography, IconButton, Link } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
// import SearchIcon from '@mui/icons-material/Search';
// import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import TimerIcon from '@mui/icons-material/Timer';
import Logo from '@/components/common/Logo';
import { Link as RouterLink } from 'react-router-dom';
import { formatTime } from '@/components/SeatSelection/constants';

interface TopNavbarProps {
    id?: string;
    isLocked: boolean;
    timeLeft: number;
    handleCancelLock: () => void;
    onBack: () => void;
}

const TopNavbar = ({ id, isLocked, timeLeft, handleCancelLock, onBack }: TopNavbarProps) => {
    const timerColor = timeLeft <= 60 ? '#E53935' : timeLeft <= 120 ? '#FF9800' : '#43A047';

    return (
        <Box sx={{
            bgcolor: '#050C38',
            px: { xs: 2, md: 6 }, py: 1,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%', boxSizing: 'border-box'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => isLocked ? handleCancelLock() : onBack()} sx={{ color: '#ffffff' }}>
                    <ArrowBackIosNewIcon fontSize="small" />
                </IconButton>
                <Logo variant="OC2" width={75} />
                <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3.5, ml: 3 }}>
                    <Link component={RouterLink} to="/home" underline="none"
                        sx={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, '&:hover': { color: '#FF5C58' } }}>
                        หน้าแรก
                    </Link>
                    <Typography sx={{ color: '#aaaaaa', fontSize: '0.95rem' }}>&gt;</Typography>
                    <Link component={RouterLink} to={`/event/${id}/zones`} underline="none"
                        sx={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, '&:hover': { color: '#FF5C58' } }}>
                        เลือกโซน
                    </Link>
                    <Typography sx={{ color: '#aaaaaa', fontSize: '0.95rem' }}>&gt;</Typography>
                    <Typography sx={{ color: '#FF5C58', fontSize: '0.95rem', fontWeight: 500 }}>
                        {isLocked ? 'ชำระเงิน' : 'เลือกที่นั่ง'}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isLocked && (
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        bgcolor: timeLeft <= 60 ? 'rgba(229,57,53,0.2)' : 'rgba(255,152,0,0.2)',
                        borderRadius: '20px', px: 2, py: 0.5,
                        border: `1px solid ${timerColor}`,
                        animation: timeLeft <= 30 ? 'pulse 1s infinite' : 'none',
                        '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.6 },
                        },
                    }}>
                        <TimerIcon sx={{ color: timerColor, fontSize: 20 }} />
                        <Typography sx={{ color: timerColor, fontWeight: 'bold', fontSize: '1rem', fontFamily: 'monospace' }}>
                            {formatTime(timeLeft)}
                        </Typography>
                    </Box>
                )}
                {/* <IconButton sx={{ color: '#ffffff' }}><SearchIcon /></IconButton>
                <IconButton sx={{ color: '#ffffff' }}><NotificationsNoneIcon /></IconButton>
                <Button component={RouterLink} to="/login" variant="contained"
                    sx={{
                        bgcolor: '#FF5C58', color: '#ffffff', borderRadius: '20px',
                        px: 3, py: 0.7, fontSize: '0.9rem', fontWeight: 'bold',
                        textTransform: 'none', '&:hover': { bgcolor: '#e04f4a' }
                    }}>
                    เข้าสู่ระบบ
                </Button> */}
            </Box>
        </Box>
    );
};

export default TopNavbar;
