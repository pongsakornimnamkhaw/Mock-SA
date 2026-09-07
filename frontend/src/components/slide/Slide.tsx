import { Box } from '@mui/material'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { Sounds, Pulse, Flux, Starlight} from '@/assets/posterSlide'
import { Link as RouterLink } from 'react-router-dom'

const slidesData = [
    {
        image: Sounds,
        eventId: '3',
        title: 'Celestial Sounds',
    },
    {
        image: Pulse,
        eventId: '2',
        title: 'Neon Pulse',
    },
    {
        image: Flux,
        eventId: '1',
        title: 'Neon Flux Festival 2024',
    },
    {
        image: Starlight,
        eventId: '4',
        title: 'Starlight Festival',
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
                {slidesData.map((slide) => (
                    <SwiperSlide key={slide.eventId}>
                        <Box
                            component={RouterLink}
                            to={`/event/${slide.eventId}`}
                            aria-label={`ดูรายละเอียด ${slide.title}`}
                            sx={{
                                position: 'relative',
                                display: 'flex',
                                backgroundImage: `url("${slide.image}")`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundColor: '#1a1a2e',
                                minHeight: '450px',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: 'white',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                outline: 'none',
                                '&:focus-visible': {
                                    boxShadow: 'inset 0 0 0 4px #FF5C58',
                                },
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
                        />
                    </SwiperSlide>
                ))}
            </Swiper>
        </Box>
    );
};

export default MySlider;
