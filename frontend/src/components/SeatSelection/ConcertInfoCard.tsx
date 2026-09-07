import { Box, Typography, Paper } from '@mui/material';
import type { EventData } from '@/components/SeatSelection/types';

interface ConcertInfoCardProps {
    event: EventData;
}

const ConcertInfoCard = ({ event }: ConcertInfoCardProps) => {
    return (
        <Paper elevation={2} sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            gap: 2.5,
            p: 2.5,
            mb: 4,
            borderRadius: '14px',
            bgcolor: '#ffffff',
        }}>
            <Box component="img" src={event.image} alt={event.title}
                sx={{
                    width: '70px', height: '90px', objectFit: 'cover',
                    borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    flexShrink: 0,
                }}
            />
            <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '1.15rem', color: '#1a1a1a', mb: 0.3 }}>
                    {event.title} · Live in Concert
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#555', mb: 0.2 }}>
                    📅 {event.eventDate} {event.openTime ? `· ${event.openTime}` : ''}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>
                    📍 {event.location || '-'}
                </Typography>
            </Box>
            {event.prices && (
                <Box sx={{
                    bgcolor: '#FF5C58', color: '#ffffff',
                    borderRadius: '8px', px: 2, py: 0.8,
                    fontWeight: 'bold', fontSize: '0.85rem',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(255, 92, 88, 0.3)',
                }}>
                    {event.prices}
                </Box>
            )}
        </Paper>
    );
};

export default ConcertInfoCard;
