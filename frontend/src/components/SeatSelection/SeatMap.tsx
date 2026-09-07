import { Box, Typography } from '@mui/material';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import LockIcon from '@mui/icons-material/Lock';
import type { SeatData, ZoneInfo, SeatStatus } from '@/components/SeatSelection/types';

interface SeatMapProps {
    zone: string;
    zoneInfo: ZoneInfo;
    seats: SeatData[];
    isLocked: boolean;
    handleSeatClick: (seatId: string) => void;
}

const SeatMap = ({ zone, zoneInfo, seats, isLocked, handleSeatClick }: SeatMapProps) => {
    const rows = ['A', 'B', 'C', 'D', 'E'];

    const getSeatColor = (status: SeatStatus): string => {
        switch (status) {
            case 'available': return zoneInfo.color;
            case 'reserved': return '#616161';
            case 'selected': return '#2196F3';
            case 'locked': return '#FF9800';
            default: return zoneInfo.color;
        }
    };

    return (
        <Box sx={{ opacity: isLocked ? 0.6 : 1, transition: 'opacity 0.3s' }}>
            {/* Stage */}
            <Box sx={{
                bgcolor: '#37474f', color: '#ffffff',
                textAlign: 'center', py: 1.5,
                borderRadius: '8px 8px 0 0',
                fontSize: '1rem', fontWeight: 'bold',
                letterSpacing: '2px', mb: 3,
                width: '100%', maxWidth: '440px', mx: 'auto',
                boxShadow: '0 -4px 20px rgba(255, 255, 255, 0.1)',
            }}>
                Stage — โซน {zone}
            </Box>

            {/* ที่นั่ง */}
            {rows.map((row) => (
                <Box key={row} sx={{
                    display: 'flex', alignItems: 'center',
                    gap: '6px', mb: '6px', justifyContent: 'center'
                }}>
                    <Typography sx={{
                        color: '#aaaaaa', fontWeight: 'bold',
                        fontSize: '0.85rem', width: '20px', textAlign: 'center',
                    }}>
                        {row}
                    </Typography>

                    {seats.filter((s) => s.row === row).map((seat) => (
                        <Box
                            key={seat.id}
                            onClick={() => handleSeatClick(seat.id)}
                            sx={{
                                width: 44, height: 44,
                                bgcolor: getSeatColor(seat.status),
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: (seat.status === 'reserved' || seat.status === 'locked' || isLocked) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                opacity: seat.status === 'reserved' ? 0.4 : 1,
                                border: seat.status === 'selected' ? '2px solid #ffffff'
                                    : seat.status === 'locked' ? '2px solid #FF9800'
                                    : '2px solid transparent',
                                '&:hover': {
                                    transform: (seat.status === 'available' && !isLocked) ? 'scale(1.1)' : 'none',
                                },
                                '&:active': {
                                    transform: (seat.status === 'available' && !isLocked) ? 'scale(0.9)' : 'none',
                                },
                            }}
                        >
                            {seat.status === 'locked' ? (
                                <LockIcon sx={{ fontSize: 18, color: '#fff' }} />
                            ) : (
                                <EventSeatIcon sx={{
                                    fontSize: 18,
                                    color: seat.status === 'reserved' ? '#999' : '#fff',
                                }} />
                            )}
                            <Typography sx={{
                                fontSize: '0.55rem',
                                color: seat.status === 'reserved' ? '#999' : '#fff',
                                fontWeight: 'bold', lineHeight: 1,
                            }}>
                                {seat.id}
                            </Typography>
                        </Box>
                    ))}

                    <Typography sx={{
                        color: '#aaaaaa', fontWeight: 'bold',
                        fontSize: '0.85rem', width: '20px', textAlign: 'center',
                    }}>
                        {row}
                    </Typography>
                </Box>
            ))}

            {/* Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mt: 3 }}>
                {[
                    { color: zoneInfo.color, label: 'ว่าง', opacity: 1 },
                    { color: '#2196F3', label: 'เลือกแล้ว', opacity: 1 },
                    { color: '#FF9800', label: 'ล็อคชั่วคราว', opacity: 1 },
                    { color: '#616161', label: 'ถูกจองแล้ว', opacity: 0.4 },
                ].map((item) => (
                    <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 20, height: 20, bgcolor: item.color,
                            borderRadius: '4px', opacity: item.opacity,
                        }} />
                        <Typography sx={{ color: '#cccccc', fontSize: '0.8rem' }}>{item.label}</Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default SeatMap;
