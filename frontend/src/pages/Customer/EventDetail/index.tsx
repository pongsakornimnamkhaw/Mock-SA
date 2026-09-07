import { Box, Typography, Button, Container, Link, IconButton, Paper, Grid } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PaidIcon from '@mui/icons-material/Paid';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import Logo from '@/components/common/Logo';
import { useNavigate, Link as RouterLink, useParams } from 'react-router-dom';
import { pulse, flux, celestial, starlight } from '@/assets/Poster';

// Mock event data map
const eventsMap: Record<string, {
    title: string;
    image: string;
    eventDate: string;
    saleDate: string;
    location: string;
    price: string;
    openTime: string;
    status: string;
    description: string;
}> = {
    '1': {
        title: 'Neon Flux Festival 2024',
        image: flux,
        eventDate: 'วันที่ 16-18 สิงหาคม 2024',
        saleDate: 'วันที่ 1-10 สิงหาคม 2024',
        location: 'ศูนย์การค้าสยามพารากอน กรุงเทพมหานคร',
        price: '3,500 / 2,500 / 1,800 / 1,200',
        openTime: '17:00 น.',
        status: 'เปิดจำหน่ายบัตรแล้ว',
        description: '🔥 พร้อมหลอมละลายไปกับบีทสุดมันส์กันยัง?\nเตรียมปลดปล่อยพลังไปกับเทศกาลดนตรีอิเล็กทรอนิกส์ที่ใหญ่ที่สุดแห่งปี! ยกทัพดีเจและศิลปินระดับโลกมาระเบิดความมันส์ 3 วันเต็ม พร้อมระบบแสง สี เสียง ที่จะทำให้ขนลุกตั้งแต่เพลงแรกยันเพลงสุดท้าย 🎆\n\n📅 16-18 สิงหาคม 2024\n📍 ศูนย์การค้าสยามพารากอน กรุงเทพมหานคร\n🚪 ประตูเปิด 17:00 น.\n🎫 บัตรเริ่มต้น 1,200 บาท\n\nชวนแก๊งมาได้เลย ยิ่งเยอะยิ่งมันส์! 🤙',
    },
    '2': {
        title: 'Neon Pulse',
        image: pulse,
        eventDate: 'วันที่ 28 ตุลาคม 2024',
        saleDate: 'วันที่ 1-15 ตุลาคม 2024',
        location: 'ชั้น 3 The Mall Korat นครราชสีมา',
        price: '2,500 / 2,000 / 1,500 / 1,000',
        openTime: '18:30 น.',
        status: 'ซื้อแล้วตอนนี้',
        description: '💓 ครั้งนี้หัวใจจะเต้นแรงกว่าเดิม...\nคอนเสิร์ตเดี่ยวที่จะทำให้ทุกจังหวะหัวใจสั่นไหวไปพร้อมกัน! Neon Pulse พาคุณดำดิ่งสู่โชว์สุดอลังการ แสงนีออนกระทบจังหวะเพลง เตรียมเสียงร้องตามให้ดี เพราะคืนนี้ต้องมีเพลงโปรดของคุณแน่นอน 🎤✨\n\n📅 28 ตุลาคม 2024\n📍 ชั้น 3 The Mall Korat นครราชสีมา\n🚪 ประตูเปิด 18:30 น.\n🎫 บัตรเริ่มต้น 1,000 บาท\n\nใครอยู่โคราชห้ามพลาดนะ มางานนี้รับรองคุ้ม! 🔥',
    },
    '3': {
        title: 'Celestial Sounds',
        image: celestial,
        eventDate: 'วันที่ 26 ตุลาคม 2024',
        saleDate: 'วันที่ 5-20 ตุลาคม 2024',
        location: 'ลานเฉลิมพระเกียรติ เชียงใหม่',
        price: '2,800 / 2,200 / 1,600 / 1,000',
        openTime: '18:00 น.',
        status: 'เปิดจำหน่ายบัตรแล้ว',
        description: '🌌 คืนนี้...เสียงเพลงจะพาเราไปถึงดวงดาว\nลองจินตนาการดูสิ ฟังเพลงสดๆ ท่ามกลางลมหนาวเชียงใหม่ ใต้ท้องฟ้าเต็มไปด้วยดวงดาว ✨ Celestial Sounds คืองานที่จะทำให้คุณขนลุกทั้งจากเสียงเพลงและบรรยากาศ ไม่ว่าจะมาคนเดียว มากับเพื่อน หรือมากับคนพิเศษ คืนนี้จะกลายเป็นความทรงจำที่ลืมไม่ลง 🌙\n\n📅 26 ตุลาคม 2024\n📍 ลานเฉลิมพระเกียรติ เชียงใหม่\n🚪 ประตูเปิด 18:00 น.\n🎫 บัตรเริ่มต้น 1,000 บาท\n\nแพ็คเสื้อกันหนาวมาด้วยนะ แล้วเจอกัน! 🧥',
    },
    '4': {
        title: 'Starlight Festival',
        image: starlight,
        eventDate: 'วันที่ 23-25 สิงหาคม 2024',
        saleDate: 'วันที่ 1-15 สิงหาคม 2024',
        location: 'ขอนแก่น ฮอลล์ ขอนแก่น',
        price: '3,000 / 2,200 / 1,500',
        openTime: '17:30 น.',
        status: 'เปิดจำหน่ายบัตรแล้ว',
        description: '⭐ 3 วัน 3 คืน กับเทศกาลดนตรีที่สว่างที่สุดในอีสาน!\nStarlight Festival ยกขบวนศิลปินป๊อปและร็อกตัวท็อปของไทยมาเสิร์ฟความมันส์ถึงขอนแก่น! 3 วันเต็มกับเวทีดนตรีสดที่จะทำให้คุณกระโดดจนขาสั่น พร้อมโซนอาหารและกิจกรรมสนุกๆ ตลอดทั้งงาน 🎸🍕\n\n📅 23-25 สิงหาคม 2024\n📍 ขอนแก่น ฮอลล์ ขอนแก่น\n🚪 ประตูเปิด 17:30 น.\n🎫 บัตรเริ่มต้น 1,500 บาท\n\nบอกเลย งานนี้ถ้าไม่มา จะเสียใจ! ชวนเพื่อนมาให้ครบแก๊ง 🙌',
    },
};

const EventDetailPage = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    // Fallback to event '2' (Neon Pulse) as shown in the mockup design
    const event = (id && eventsMap[id]) ? eventsMap[id] : eventsMap['2'];

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {/* Top Navbar */}
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
                        <Link 
                            component={RouterLink}
                            to="/home"
                            underline="none"
                            sx={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, '&:hover': { color: '#FF5C58' } }}
                        >
                            หน้าแรก
                        </Link>
                        <Link 
                            component={RouterLink}
                            to="/events"
                            underline="none"
                            sx={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, '&:hover': { color: '#FF5C58' } }}
                        >
                            ทุกงานแสดง
                        </Link>
                        <Link 
                            component={RouterLink}
                            to="/contact"
                            underline="none"
                            sx={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, '&:hover': { color: '#FF5C58' } }}
                        >
                            ติดต่อเรา
                        </Link>
                    </Box>
                </Box>

                {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton sx={{ color: '#ffffff' }}>
                        <SearchIcon />
                    </IconButton>
                    <IconButton sx={{ color: '#ffffff' }}>
                        <NotificationsNoneIcon />
                    </IconButton>
                    <Button 
                        component={RouterLink}
                        to="/login"
                        variant="contained"
                        sx={{
                            bgcolor: '#FF5C58',
                            color: '#ffffff',
                            borderRadius: '20px',
                            px: 3,
                            py: 0.7,
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            textTransform: 'none',
                            '&:hover': { bgcolor: '#e04f4a' }
                        }}
                    >
                        เข้าสู่ระบบ
                    </Button>
                </Box> */}
            </Box>

            {/* Banner Section with Light Pink Background */}
            <Box sx={{ bgcolor: '#FDECEF', py: 5, px: { xs: 2, md: 8 } }}>
                <Container maxWidth="xl">
                    <Grid container sx={{spacing:4, alignItemsL:"flex-start"}}>
                        {/* Left Column: Poster & Buy Ticket Button */}
                        <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box 
                                component="img"
                                src={event.image}
                                alt={event.title}
                                sx={{
                                    width: '100%',
                                    maxWidth: '260px',
                                    height: '340px',
                                    objectFit: 'cover',
                                    borderRadius: '16px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                }}
                            />
                            <Button 
                                variant="contained"
                                onClick={() => navigate(`/event/${id}/zones`)}
                                sx={{
                                    bgcolor: '#FF5C58',
                                    color: '#ffffff',
                                    borderRadius: '25px',
                                    px: 5,
                                    py: 1,
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                    mt: 3,
                                    boxShadow: '0 4px 15px rgba(255, 92, 88, 0.4)',
                                    '&:hover': { bgcolor: '#e04f4a' }
                                }}
                            >
                                ซื้อบัตร
                            </Button>
                        </Grid>

                        {/* Right Column: Event Title & Details Info Card */}
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Typography variant="h4" sx={{ color: '#1A1A1A', fontWeight: 'bold', mb: 3 }}>
                                {event.title}
                            </Typography>

                            {/* White Info Card */}
                            <Paper 
                                elevation={0} 
                                sx={{ 
                                    p: 3.5, 
                                    borderRadius: '20px', 
                                    bgcolor: '#FFFFFF',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                    maxWidth: '720px'
                                }}
                            >
                                <Grid container spacing={3}>
                                    {/* Column 1 */}
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        {/* วันที่แสดง */}
                                        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
                                            <CalendarTodayIcon sx={{ color: '#555', mt: 0.3 }} />
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#777', display: 'block', fontSize: '0.75rem' }}>
                                                    วันที่แสดง
                                                </Typography>
                                                <Typography sx={{ fontWeight: 'bold', color: '#1A1A1A', fontSize: '0.95rem' }}>
                                                    {event.eventDate}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* สถานที่แสดง */}
                                        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
                                            <LocationOnIcon sx={{ color: '#555', mt: 0.3 }} />
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#777', display: 'block', fontSize: '0.75rem' }}>
                                                    สถานที่แสดง
                                                </Typography>
                                                <Typography sx={{ fontWeight: 'bold', color: '#1A1A1A', fontSize: '0.95rem' }}>
                                                    {event.location}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* ประตูเปิด */}
                                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                            <AccessTimeIcon sx={{ color: '#555', mt: 0.3 }} />
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#777', display: 'block', fontSize: '0.75rem' }}>
                                                    ประตูเปิด
                                                </Typography>
                                                <Typography sx={{ fontWeight: 'bold', color: '#1A1A1A', fontSize: '0.95rem' }}>
                                                    {event.openTime}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>

                                    {/* Column 2 */}
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        {/* วันที่เปิดจำหน่าย */}
                                        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
                                            <EditCalendarIcon sx={{ color: '#555', mt: 0.3 }} />
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#777', display: 'block', fontSize: '0.75rem' }}>
                                                    วันที่เปิดจำหน่าย
                                                </Typography>
                                                <Typography sx={{ fontWeight: 'bold', color: '#1A1A1A', fontSize: '0.95rem' }}>
                                                    {event.saleDate}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* ราคา */}
                                        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
                                            <PaidIcon sx={{ color: '#555', mt: 0.3 }} />
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#777', display: 'block', fontSize: '0.75rem' }}>
                                                    ราคา
                                                </Typography>
                                                <Typography sx={{ fontWeight: 'bold', color: '#1A1A1A', fontSize: '0.95rem' }}>
                                                    {event.price}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* สถานะของบัตร */}
                                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                            <ConfirmationNumberIcon sx={{ color: '#555', mt: 0.3 }} />
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#777', display: 'block', fontSize: '0.75rem' }}>
                                                    สถานะของบัตร
                                                </Typography>
                                                <Typography sx={{ fontWeight: 'bold', color: '#1A1A1A', fontSize: '0.95rem' }}>
                                                    {event.status}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Description Section */}
            <Container maxWidth="xl" sx={{ py: 6, px: { xs: 2, md: 8 } }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1A1A1A', mb: 3 }}>
                    รายละเอียด
                </Typography>
                <Typography sx={{ color: '#444444', lineHeight: 1.8, fontSize: '1rem', maxWidth: '900px', whiteSpace: 'pre-line' }}>
                    {event.description}
                </Typography>
            </Container>
        </Box>
    );
};

export default EventDetailPage;
