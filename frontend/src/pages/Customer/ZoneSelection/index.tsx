import { Box, Typography, Container, Link, IconButton, Paper, Stepper, Step, StepLabel } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import Logo from '@/components/common/Logo';
import { useNavigate, Link as RouterLink, useParams } from 'react-router-dom';
import { pulse, flux, celestial, starlight } from '@/assets/poster';
import { useState } from 'react';

// ข้อมูลคอนเสิร์ต (Mock)
const eventsMap: Record<string, { title: string; image: string; eventDate: string }> = {
    '1': { title: 'Neon Flux Festival 2024', image: flux, eventDate: '16-18 สิงหาคม 2024' },
    '2': { title: 'Neon Pulse', image: pulse, eventDate: '26 ตุลาคม 2024' },
    '3': { title: 'Celestial Sounds', image: celestial, eventDate: '26 ตุลาคม 2024' },
    '4': { title: 'Starlight Festival', image: starlight, eventDate: '23-25 สิงหาคม 2024' },
};

// ข้อมูลโซนที่นั่ง
const zonesData = [
    { id: 'A1', row: 'A', color: '#E53935', hoverColor: '#FF5252', price: 2000, gridCol: '2 / 3', gridRow: '2 / 3' },
    { id: 'A2', row: 'A', color: '#E53935', hoverColor: '#FF5252', price: 2000, gridCol: '3 / 4', gridRow: '2 / 3' },
    { id: 'B1', row: 'B', color: '#43A047', hoverColor: '#66BB6A', price: 1500, gridCol: '1 / 2', gridRow: '3 / 4' },
    { id: 'B2', row: 'B', color: '#43A047', hoverColor: '#66BB6A', price: 1500, gridCol: '2 / 3', gridRow: '3 / 4' },
    { id: 'B3', row: 'B', color: '#43A047', hoverColor: '#66BB6A', price: 1500, gridCol: '3 / 4', gridRow: '3 / 4' },
    { id: 'B4', row: 'B', color: '#43A047', hoverColor: '#66BB6A', price: 1500, gridCol: '4 / 5', gridRow: '3 / 4' },
    { id: 'C1', row: 'C', color: '#FDD835', hoverColor: '#FFEE58', price: 1000, gridCol: '1 / 2', gridRow: '4 / 5' },
    { id: 'C2', row: 'C', color: '#FDD835', hoverColor: '#FFEE58', price: 1000, gridCol: '2 / 3', gridRow: '4 / 5' },
    { id: 'C3', row: 'C', color: '#FDD835', hoverColor: '#FFEE58', price: 1000, gridCol: '3 / 4', gridRow: '4 / 5' },
    { id: 'C4', row: 'C', color: '#FDD835', hoverColor: '#FFEE58', price: 1000, gridCol: '4 / 5', gridRow: '4 / 5' },
];

const priceLegend = [
    { color: '#E53935', label: 'โซน A', price: '2,000 บ.' },
    { color: '#43A047', label: 'โซน B', price: '1,500 บ.' },
    { color: '#FDD835', label: 'โซน C', price: '1,000 บ.' },
];

const steps = ['เลือกโซนบัตร', 'เลือกที่นั่ง', 'ชำระเงิน'];

const ZoneSelectionPage = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const event = (id && eventsMap[id]) ? eventsMap[id] : eventsMap['2'];
    const [hoveredZone, setHoveredZone] = useState<string | null>(null);
    const [selectedZone, setSelectedZone] = useState<string | null>(null);

    const handleZoneClick = (zoneId: string) => {
        setSelectedZone(zoneId);
        navigate(`/event/${id}/seats/${zoneId}`);
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: '#0a0a1a',
            background: 'radial-gradient(ellipse at 0% 50%, rgba(100, 40, 200, 0.35) 0%, transparent 50%), radial-gradient(ellipse at 100% 50%, rgba(60, 30, 180, 0.35) 0%, transparent 50%), radial-gradient(ellipse at 50% 0%, rgba(140, 50, 220, 0.15) 0%, transparent 40%), #0a0a1a',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* ========== Top Navbar ========== */}
            <Box sx={{
                bgcolor: '#050C38',
                px: { xs: 2, md: 6 },
                py: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => navigate(-1)} sx={{ color: '#ffffff' }}>
                        <ArrowBackIosNewIcon fontSize="small" />
                    </IconButton>
                    <Logo variant="OC2" width={75} />
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3.5, ml: 3 }}>
                        <Link component={RouterLink} to="/home" underline="none"
                            sx={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, '&:hover': { color: '#FF5C58' } }}>
                            หน้าแรก
                        </Link>
                        <Typography sx={{ color: '#aaaaaa', fontSize: '0.95rem' }}>&gt;</Typography>
                        <Typography sx={{ color: '#FF5C58', fontSize: '0.95rem', fontWeight: 500 }}>
                            เลือกรอบการแสดง
                        </Typography>
                    </Box>
                </Box>

                {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton sx={{ color: '#ffffff' }}><SearchIcon /></IconButton>
                    <IconButton sx={{ color: '#ffffff' }}><NotificationsNoneIcon /></IconButton>
                    <Button component={RouterLink} to="/login" variant="contained"
                        sx={{
                            bgcolor: '#FF5C58', color: '#ffffff', borderRadius: '20px',
                            px: 3, py: 0.7, fontSize: '0.9rem', fontWeight: 'bold',
                            textTransform: 'none', '&:hover': { bgcolor: '#e04f4a' }
                        }}>
                        เข้าสู่ระบบ
                    </Button>
                </Box> */}
            </Box>

            {/* ========== Main Content ========== */}
            <Container maxWidth="xl" sx={{ py: 4, flex: 1 }}>
                {/* Header: โปสเตอร์ + ข้อมูลงาน + Stepper */}
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 4, mb: 4,
                    alignItems: { md: 'center' }
                }}>
                    <Typography variant="h4" sx={{
                        color: '#ffffff', fontWeight: 'bold',
                        fontSize: { xs: '1.4rem', md: '1.8rem' },
                        minWidth: '180px', lineHeight: 1.3
                    }}>
                        เลือกรอบ &amp;<br />โซนการแสดง
                    </Typography>

                    <Box component="img" src={event.image} alt={event.title}
                        sx={{
                            width: '100px', height: '140px', objectFit: 'cover',
                            borderRadius: '12px', boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
                        }}
                    />

                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 'bold', mb: 0.5 }}>
                            {event.title}
                        </Typography>
                        <Link component={RouterLink} to={`/event/${id}`} underline="hover"
                            sx={{ color: '#FF5C58', fontSize: '0.9rem', mb: 2, display: 'inline-block' }}>
                            รายละเอียด &gt;
                        </Link>

                        <Stepper activeStep={0} alternativeLabel sx={{
                            mt: 2,
                            '& .MuiStepLabel-label': { color: '#aaaaaa', fontSize: '0.85rem' },
                            '& .MuiStepLabel-label.Mui-active': { color: '#ffffff', fontWeight: 'bold' },
                            '& .MuiStepLabel-label.Mui-completed': { color: '#43A047' },
                            '& .MuiStepIcon-root': { color: '#555555' },
                            '& .MuiStepIcon-root.Mui-active': { color: '#FF5C58' },
                            '& .MuiStepIcon-root.Mui-completed': { color: '#43A047' },
                        }}>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                            <Typography sx={{ color: '#cccccc', fontSize: '0.95rem' }}>รอบการแสดง</Typography>
                            <Box sx={{
                                bgcolor: '#1a237e', border: '1px solid #3949ab',
                                borderRadius: '30px', px: 4, py: 1,
                            }}>
                                <Typography sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {event.eventDate}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                <Typography sx={{ color: '#cccccc', textAlign: 'center', mb: 3, fontSize: '1rem' }}>
                    กรุณาเลือกโซนที่นั่ง
                </Typography>

                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 4, justifyContent: 'center',
                    alignItems: { xs: 'center', md: 'flex-start' }
                }}>
                    {/* ========== แผนผังโซนที่นั่ง ========== */}
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 90px)',
                        gridTemplateRows: 'auto repeat(3, 80px)',
                        gap: '10px',
                        justifyContent: 'center',
                    }}>
                        {/* Stage */}
                        <Box sx={{
                            gridColumn: '1 / 5', gridRow: '1 / 2',
                            display: 'flex', justifyContent: 'center', mb: 1,
                        }}>
                            <Box sx={{
                                bgcolor: '#37474f', color: '#ffffff',
                                textAlign: 'center', py: 1.5, px: 6,
                                borderRadius: '8px 8px 0 0',
                                fontSize: '1rem', fontWeight: 'bold',
                                letterSpacing: '2px',
                                boxShadow: '0 -4px 20px rgba(255, 255, 255, 0.1)',
                                width: '200px',
                            }}>
                                Stage
                            </Box>
                        </Box>

                        {/* โซนที่นั่ง */}
                        {zonesData.map((zone) => (
                            <Box
                                key={zone.id}
                                onClick={() => handleZoneClick(zone.id)}
                                onMouseEnter={() => setHoveredZone(zone.id)}
                                onMouseLeave={() => setHoveredZone(null)}
                                sx={{
                                    gridColumn: zone.gridCol,
                                    gridRow: zone.gridRow,
                                    bgcolor: hoveredZone === zone.id || selectedZone === zone.id
                                        ? zone.hoverColor : zone.color,
                                    borderRadius: '10px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease',
                                    transform: hoveredZone === zone.id ? 'scale(1.08)' : 'scale(1)',
                                    boxShadow: hoveredZone === zone.id
                                        ? `0 0 20px ${zone.hoverColor}80, 0 8px 25px rgba(0,0,0,0.3)`
                                        : '0 4px 12px rgba(0,0,0,0.3)',
                                    border: selectedZone === zone.id ? '3px solid #ffffff' : '2px solid transparent',
                                    '&:active': { transform: 'scale(0.95)' },
                                }}
                            >
                                <Typography sx={{
                                    color: zone.row === 'C' ? '#333333' : '#ffffff',
                                    fontWeight: 'bold', fontSize: '1.1rem',
                                    textShadow: zone.row === 'C' ? 'none' : '1px 1px 3px rgba(0,0,0,0.5)',
                                    userSelect: 'none',
                                }}>
                                    {zone.id}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* ========== การ์ดราคา ========== */}
                    <Paper elevation={3} sx={{
                        p: 3, borderRadius: '16px', bgcolor: '#ffffff',
                        width: { xs: '100%', md: '280px' }, maxWidth: '300px',
                    }}>
                        <Box component="img" src={event.image} alt={event.title}
                            sx={{
                                width: '100%', height: '200px', objectFit: 'cover',
                                borderRadius: '12px', mb: 2,
                            }}
                        />
                        {priceLegend.map((item) => (
                            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                                <Box sx={{
                                    width: 40, height: 24, bgcolor: item.color,
                                    borderRadius: '6px', flexShrink: 0,
                                }} />
                                <Typography sx={{ color: '#333', fontSize: '0.95rem', fontWeight: 500 }}>
                                    {item.label} — {item.price}
                                </Typography>
                            </Box>
                        ))}
                    </Paper>
                </Box>
            </Container>
        </Box>
    );
};

export default ZoneSelectionPage;
