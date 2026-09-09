import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Chip,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { flux } from '@/assets/poster';

const SearchConcertPage = () => {
  return (
    <Box sx={{ p: 4, minHeight: '100vh' }}>
      {/* Top Search Section */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <TextField 
          fullWidth 
          placeholder="Neon Flux Festival"
          slotProps={{
            input: {
              startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: '24px' }} />
            }
          }}
          sx={{ bgcolor: 'white', borderRadius: 1, '& .MuiOutlinedInput-root': { fontSize: '18px' } }}
        />
        <Button 
          variant="contained" 
          sx={{ 
            bgcolor: '#1a237e', 
            '&:hover': { bgcolor: '#000051' },
            borderRadius: 5,
            px: 4,
            fontSize: '18px'
          }}
        >
          ค้นหา
        </Button>
      </Box>

      {/* Results Section */}
      <Typography sx={{ fontWeight: 'bold', mb: 2, fontSize: '28px', color: '#1a1a2e' }}>
        ผลการค้นหาคอนเสิร์ตทั้งหมด
      </Typography>

      <Paper sx={{ p: 3, bgcolor: '#fce4ec', borderRadius: 3, display: 'flex', gap: 3, position: 'relative' }}>
        {/* Poster Image */}
        <Box 
          component="img"
          src={flux}
          alt="Neon Flux Festival"
          sx={{ 
            width: 120, 
            height: 150, 
            borderRadius: 2, 
            objectFit: 'cover',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            flexShrink: 0
          }} 
        />

        {/* Concert Details */}
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 1 }}>
          <Typography sx={{ fontWeight: 'bold', fontSize: '18px' }}>ชื่องาน: Neon Flux Festival 2024</Typography>
          <Typography sx={{ fontSize: '18px' }}>วันที่จัด: 16-18 สิงหาคม 2569</Typography>
          <Typography sx={{ fontSize: '18px' }}>เวลา:</Typography>
          <Typography sx={{ fontSize: '18px' }}>ศิลปินที่เชิญ:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <LocationOnIcon fontSize="small" sx={{ mr: 0.5, color: '#d32f2f', fontSize: '20px' }} />
            <Typography sx={{ fontSize: '18px', fontWeight: 'bold' }}>Metroplex Arena</Typography>
          </Box>
        </Box>

        {/* Right Actions & Status */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Chip label="ยืนยันแล้ว" color="success" sx={{ fontWeight: 'bold', fontSize: '14px' }} />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton sx={{ color: '#4caf50' }}>
              <EditIcon />
            </IconButton>
            <IconButton sx={{ color: '#ef5350' }}>
              <DeleteIcon />
            </IconButton>
            <IconButton sx={{ color: 'gray' }}>
              <DescriptionIcon />
            </IconButton>
            <IconButton sx={{ color: 'gray' }}>
              <PersonAddIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default SearchConcertPage;
