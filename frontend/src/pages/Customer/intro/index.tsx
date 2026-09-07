import { Box, Typography, Button, Container, Link} from '@mui/material';
import Logo from '@/components/common/Logo';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

const IntroPage = () => {
    const navigate = useNavigate();

    const handleNext = () => {
        navigate('/home'); // กดแล้วเปลี่ยนไปหน้า Home (/home)
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ 
                bgcolor: '#050C38', 
                px: { md: 10 }, 
                display: 'flex', 
                alignItems: 'center',
                gap: 5,
                width: '100%',
                boxSizing: 'border-box'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Logo variant="OC2" width={75} />
                </Box>
                
                <Box sx={{ display: 'flex', gap: 3.5 }}>
                    <Link 
                        component={RouterLink}
                        to="/home"
                        sx={{ color: '#ffffff', 
                        fontSize: '0.95rem', 
                        cursor: 'pointer', 
                        fontWeight: 500, 
                        '&:hover': { color: '#FF5C58' } 
                        }}
                    >
                        หน้าแรก
                    </Link>

                    <Link 
                        component={RouterLink}
                        to="/home" 
                        sx={{ color: '#ffffff', 
                        fontSize: '0.95rem', 
                        cursor: 'pointer', 
                        fontWeight: 500, 
                        '&:hover': { color: '#FF5C58' } 
                        }}
                    >
                        ทุกงานแสดง
                    </Link>

                    <Link 
                        component={RouterLink}
                        to="/contact"
                        sx={{ color: '#ffffff', 
                        fontSize: '0.95rem', 
                        cursor: 'pointer', 
                        fontWeight: 500, 
                        '&:hover': { color: '#FF5C58' } 
                        }}
                    >
                        ติดต่อเรา
                    </Link>

                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ my: 4, flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', px: { xs: 2, md: 4 } }}>
                <Box sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '1100px',
                    minHeight: { md: '540px' },
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 40px 100px 15px rgba(41, 39, 39, 0.85), 0 0 60px 15px rgba(24, 25, 26, 0.9)',
                    backgroundImage: 'url("https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1200")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    p: 4
                }}>
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        bgcolor: 'rgba(0, 0, 0, 0.35)',
                        zIndex: 1
                    }} />

                    <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
                        <Typography variant="h4" sx={{ 
                            color: '#ffffff', 
                            fontWeight: 'bold', 
                            fontSize: { xs: '1.6rem', md: '2.3rem' },
                            textShadow: '2px 2px 10px rgba(0,0,0,0.9)',
                            letterSpacing: '0.5px'
                        }}>
                            ไม่พลาดทุกบีทสำคัญ <br />จองบัตรคอนเสิร์ตที่คุณรักก่อนใคร
                        </Typography>

                        <Typography sx={{ 
                            color: '#e0e0e0', 
                            fontSize: { xs: '0.95rem', md: '1.2rem' },
                            maxWidth: '720px',
                            lineHeight: 1.6,
                            textShadow: '1px 1px 6px rgba(0,0,0,0.9)',
                            fontWeight: 300
                        }}>
                            รวมทุกเทศกาลดนตรี คอนเสิร์ตใหญ่ และ <strong>Live House</strong> สุดมันส์ไว้ในที่เดียว<br />
                            เตรียมตัวไปร้องเพลงให้สุดเสียงกับศิลปินคนโปรดของคุณ
                        </Typography>

                        <Button 
                            onClick={handleNext}
                            variant="contained" 
                            sx={{
                                bgcolor: '#FF5C58',
                                color: '#ffffff',
                                borderRadius: '30px',
                                px: 4.5,
                                py: 1.2,
                                fontSize: '1.05rem',
                                fontWeight: 'bold',
                                textTransform: 'none',
                                mt: 3,
                                boxShadow: '0 4px 15px rgba(255, 92, 88, 0.4)',
                                '&:hover': {
                                    bgcolor: '#e04f4a',
                                    boxShadow: '0 6px 20px rgba(255, 92, 88, 0.6)',
                                }
                            }}
                        >
                            ถัดไป
                        </Button>
                    </Box>
                </Box>
            </Container>
        </Box>
    );  
};

export default IntroPage;
