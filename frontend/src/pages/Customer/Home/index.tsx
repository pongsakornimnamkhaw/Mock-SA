import { Box } from '@mui/material';
import Slide from '@/components/slide/Slide';
import EventList from '@/components/posterShow/posterShow';
import CustomerHeader from '@/components/common/CustomerHeader';
import { pulse, celestial } from '@/assets/poster';

const comingSoonPosters = [
    { id: 'coming-soon-1', image: pulse, title: 'Neon Pulse' },
    { id: 'coming-soon-2', image: celestial, title: 'Celestial Sounds' },
];

const HomePage = () => {
    return(
        <Box sx={{ minHeight: '100vh', bgcolor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <CustomerHeader />
        
        <Box sx={{
                background: 'radial-gradient(circle, rgba(33,150,243,0.15) 0%, #000000 70%)',
                display: 'flex',
                justifyContent: 'center',
                py: 4,           
          }}>
            <Box sx={{ 
                width: '100%', 
                maxWidth: '900px', 
                mx: 'auto',         
                borderRadius: '15px',   
                overflow: 'hidden',  
                boxShadow: '0 0 60px rgba(33, 150, 243, 0.4)',
            }}>
                <Slide />
            </Box> 
        </Box>

        
        <Box>
            <EventList title="หน้าแรก" comingSoon={comingSoonPosters} />
        </Box>
        
    </Box>
    );
};

export default HomePage;
