import { Box } from '@mui/material'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { Sounds, Pulse, Flux, Starlight} from '@/assets/posterSlide'

const slidesData = [
    {
        image: Sounds,
        // title: 'หัวข้อสไลด์ที่ 1',
        // desc: 'รายละเอียดสไลด์ที่ 1',
    },
    {
        image: Pulse,
        // title: 'หัวข้อสไลด์ที่ 2',
        // desc: 'รายละเอียดสไลด์ที่ 2',
    },
    {
        image: Flux,
        // title: 'หัวข้อสไลด์ที่ 3',
        // desc: 'รายละเอียดสไลด์ที่ 3',
    },
    {
        image: Starlight,
        // title: 'หัวข้อสไลด์ที่ 3',
        // desc: 'รายละเอียดสไลด์ที่ 3',
    },
];

const MySlider = () => {
    return (
        <Box
            sx={{
                width: '100%',
                // ===== ปุ่มลูกศร =====
                '& .swiper-button-next, & .swiper-button-prev': {
                    color: '#fff',
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    transition: 'background 0.3s ease',
                    '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    },
                    '&::after': {
                        fontSize: 18,
                        fontWeight: 'bold',
                    },
                },
                '& .swiper-button-prev': {
                    left: '20px',
                },
                '& .swiper-button-next': {
                    right: '20px',
                },
                // ===== Pagination Dots =====
                '& .swiper-pagination': {
                    bottom: '16px',
                },
                '& .swiper-pagination-bullet': {
                    width: 10,
                    height: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    opacity: 1,
                    transition: 'background 0.3s ease, transform 0.3s ease',
                },
                '& .swiper-pagination-bullet-active': {
                    backgroundColor: '#fff',
                    transform: 'scale(1.3)',
                },
            }}
        >
            <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                slidesPerView={1}
                navigation
                pagination={{ clickable: true }}
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                loop={true}
            >
                {slidesData.map((slide, index) => (
                    <SwiperSlide key={index}>
                        <Box
                            sx={{
                                position: 'relative',
                                backgroundImage: `url("${slide.image}")`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundColor: '#1a1a2e',
                                minHeight: '450px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: 'white',
                                '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 1,
                                },
                            }}
                        >
                            {/* <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', p: 4 }}>
                                <Typography variant="h3" sx={{ fontWeight: 'bold' }} gutterBottom>
                                    {slide.title}
                                </Typography>
                                <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
                                    {slide.desc}
                                </Typography>
                                <Button variant="contained" color="primary" size="large">
                                    ซื้อบัตร
                                </Button>
                            </Box> */}
                        </Box>
                    </SwiperSlide>
                ))}
            </Swiper>
        </Box>
    );
};

export default MySlider;
