import { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Chip, IconButton, Menu, MenuItem, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate } from 'react-router-dom';
import { celestial, flux, pulse, starlight } from '@/assets/poster';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';

const statusOptions = [
  { label: 'ทั้งหมด', emoji: '✨' }, { label: 'วางแผน', emoji: '📝' },
  { label: 'ยืนยันแล้ว', emoji: '✅' }, { label: 'เลื่อนการจัด', emoji: '⏳' },
  { label: 'ยกเลิกการจัด', emoji: '❌' }, { label: 'กำลังแสดง', emoji: '🎤' },
  { label: 'เสร็จสิ้น', emoji: '🏁' },
] as const;

const concertData = [
  { id: 1, title: 'Neon Flux Festival 2024', date: '16–18 สิงหาคม 2569', time: '18.00–23.00 น.', artists: 'Tilly Birds, Three Man Down', venue: 'Metroplex Arena', status: 'ยืนยันแล้ว', poster: flux, updated: '22 ก.ค. 2569, 09.41 น.' },
  { id: 2, title: 'NEON PULSE', date: '28 ตุลาคม 2569', time: '19.00–23.30 น.', artists: 'NEON PULSE, Violette Wautier', venue: 'THE Arena LONDON', status: 'กำลังแสดง', poster: pulse, updated: '21 ก.ค. 2569, 16.20 น.' },
  { id: 3, title: 'Celestial Sounds', date: '26 ตุลาคม 2569', time: '20.00–23.00 น.', artists: 'The Starcasters, Aurora Impulse', venue: 'THE Aurora Concert Hall', status: 'วางแผน', poster: celestial, updated: '20 ก.ค. 2569, 13.15 น.' },
  { id: 4, title: 'Star Light Festival', date: '23–25 พฤศจิกายน 2569', time: '17.00–24.00 น.', artists: 'Midnight Avenue, Blue Nova', venue: 'Cyberport Mainstage', status: 'เลื่อนการจัด', poster: starlight, updated: '18 ก.ค. 2569, 10.30 น.' },
  { id: 5, title: 'Acoustic Sessions: Bangkok', date: '14 ธันวาคม 2569', time: '18.30–22.00 น.', artists: 'Polycat, Ink Waruntorn', venue: 'Lido Connect', status: 'ยกเลิกการจัด', poster: celestial, updated: '15 ก.ค. 2569, 08.45 น.' },
];

const statusStyle: Record<string, { bg: string; color: string }> = {
  วางแผน: { bg: '#fff8cc', color: '#b77900' }, ยืนยันแล้ว: { bg: '#d9f7df', color: '#258218' },
  เลื่อนการจัด: { bg: '#f2e4fb', color: '#7b1fa2' }, ยกเลิกการจัด: { bg: '#ffe1e5', color: '#c62828' },
  กำลังแสดง: { bg: '#e1efff', color: '#1565c0' }, เสร็จสิ้น: { bg: '#e6e8ec', color: '#46505a' },
};

const ConcertSearchPage = () => {
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState(concertData);
  const [inputValue, setInputValue] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ทั้งหมด');
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [concertToDelete, setConcertToDelete] = useState<(typeof concertData)[number] | null>(null);

  const results = concerts.filter((concert) => {
    const keyword = inputValue.trim().toLocaleLowerCase('th');
    const matchesText = !keyword || `${concert.title} ${concert.artists} ${concert.venue}`.toLocaleLowerCase('th').includes(keyword);
    return matchesText && (selectedStatus === 'ทั้งหมด' || concert.status === selectedStatus);
  });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 4, maxWidth: 980, mx: 'auto' }}>
        <TextField fullWidth value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="ค้นหาชื่อคอนเสิร์ต ศิลปิน หรือสถานที่"
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#777' }} /></InputAdornment> } }}
          sx={{ bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 3, minHeight: 56, fontSize: '18px' } }} />
        <Button aria-label="กรองตามสถานะคอนเสิร์ต" aria-haspopup="menu" aria-expanded={filterAnchor ? 'true' : undefined} onClick={(event) => setFilterAnchor(event.currentTarget)}
          variant="outlined" sx={{ minWidth: 130, minHeight: 56, flexShrink: 0, borderRadius: 3, bgcolor: selectedStatus === 'ทั้งหมด' ? '#fff' : '#fce4ec', borderColor: '#1a237e', color: '#1a237e', fontSize: '18px', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#fce4ec', borderColor: '#1a237e' } }}>ตัวกรอง</Button>
        <Menu anchorEl={filterAnchor} open={Boolean(filterAnchor)} onClose={() => setFilterAnchor(null)} slotProps={{ paper: { sx: { mt: 1, minWidth: 230, borderRadius: 3, p: 0.5 } } }}>
          {statusOptions.map((option) => (
            <MenuItem key={option.label} selected={selectedStatus === option.label} onClick={() => {
              setFilterAnchor(null);
              if (option.label === 'เสร็จสิ้น') {
                navigate('/report');
                return;
              }
              setSelectedStatus(option.label);
            }} sx={{ gap: 1.25, borderRadius: 2, py: 1, fontSize: '17px' }}>
              <Box component="span" sx={{ width: 27, textAlign: 'center' }}>{option.emoji}</Box><Box component="span" sx={{ flex: 1 }}>{option.label}</Box>
              {selectedStatus === option.label && <CheckIcon sx={{ color: '#e91e63', fontSize: 20 }} />}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography sx={{ fontWeight: 800, color: '#10163e', fontSize: { xs: '26px', md: '32px' } }}>ผลการค้นหาคอนเสิร์ตทั้งหมด</Typography>
        <Chip label={`${results.length} งาน`} sx={{ bgcolor: '#fce4ec', color: '#ad1457', fontSize: '16px', fontWeight: 700 }} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {results.map((concert) => {
          const colors = statusStyle[concert.status];
          return (
            <Paper key={concert.id} variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, bgcolor: '#fff', borderColor: '#e1e5ec', borderRadius: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px minmax(0, 1fr)', md: '150px minmax(0, 1fr) 330px' }, gap: 2.5, alignItems: 'center', boxShadow: '0 3px 10px rgba(15, 23, 42, 0.05)' }}>
              <Box component="img" src={concert.poster} alt={concert.title} sx={{ width: 150, height: 180, borderRadius: 2.5, objectFit: 'cover', justifySelf: { xs: 'center', sm: 'start' } }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.65 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '21px', color: '#11183f' }}>ชื่องาน: <Box component="span" sx={{ color: '#ff4774' }}>{concert.title}</Box></Typography>
                <Typography sx={{ fontSize: '18px' }}><strong>วันที่จัด:</strong> {concert.date}</Typography>
                <Typography sx={{ fontSize: '18px' }}><strong>เวลา:</strong> {concert.time}</Typography>
                <Typography sx={{ fontSize: '18px' }}><strong>ศิลปินที่เชิญ:</strong> {concert.artists}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, color: '#53627a' }}><LocationOnOutlinedIcon sx={{ color: '#ff4774' }} /><Typography sx={{ fontSize: '17px', fontWeight: 700 }}>{concert.venue}</Typography></Box>
              </Box>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' }, justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography sx={{ fontSize: '17px', fontWeight: 800 }}>สถานะ:</Typography><Chip label={concert.status} sx={{ bgcolor: colors.bg, color: colors.color, fontWeight: 800, fontSize: '16px' }} /></Box>
                <Typography sx={{ color: '#68758b', fontSize: '15px' }}>• อัปเดตล่าสุด {concert.updated}</Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  <IconButton title="แก้ไขข้อมูลคอนเสิร์ต" aria-label={`แก้ไข ${concert.title}`} onClick={() => navigate('/edit-concert', { state: { concert } })} sx={{ color: '#3b921c' }}><EditIcon /></IconButton>
                  <IconButton title="ลบข้อมูลคอนเสิร์ต" aria-label={`ลบ ${concert.title}`} onClick={() => setConcertToDelete(concert)} sx={{ color: '#ef4444' }}><DeleteIcon /></IconButton>
                  <IconButton title="แนบเอกสาร" aria-label={`เอกสาร ${concert.title}`} onClick={() => navigate('/documents', { state: { concert } })} sx={{ color: '#626775' }}><DescriptionOutlinedIcon /></IconButton>
                  <IconButton title="ผู้รับผิดชอบ" aria-label={`เพิ่มผู้รับผิดชอบ ${concert.title}`} onClick={() => navigate('/responsibility', { state: { concert } })} sx={{ color: '#071044' }}><PersonAddAltOutlinedIcon /></IconButton>
                </Box>
              </Box>
            </Paper>
          );
        })}
        {results.length === 0 && <Paper variant="outlined" sx={{ p: 6, borderRadius: 4, textAlign: 'center', color: 'text.secondary' }}><Typography sx={{ fontSize: '18px' }}>ไม่พบคอนเสิร์ตที่ตรงกับคำค้นหาและสถานะที่เลือก</Typography></Paper>}
      </Box>

      <ConfirmDeleteDialog
        open={Boolean(concertToDelete)}
        message={concertToDelete ? `คุณยืนยันที่จะลบคอนเสิร์ต “${concertToDelete.title}” หรือไม่` : undefined}
        onCancel={() => setConcertToDelete(null)}
        onConfirm={() => {
          if (concertToDelete) {
            setConcerts((current) => current.filter((concert) => concert.id !== concertToDelete.id));
          }
          setConcertToDelete(null);
        }}
      />
    </Box>
  );
};

export default ConcertSearchPage;
