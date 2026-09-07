import { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, Grid, Select, MenuItem, FormControl, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { artistApi, type ArtistData, type InvitationData } from '@/api/artistApi';

const InvitationPage = () => {
  const [selectedArtist, setSelectedArtist] = useState('');
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);

  useEffect(() => { artistApi.getArtists().then(setArtists).catch((error) => alert(error.message)); }, []);
  useEffect(() => {
    if (!selectedArtist) { setInvitations([]); return; }
    artistApi.getInvitations(selectedArtist).then(setInvitations).catch((error) => alert(error.message));
  }, [selectedArtist]);

  const handleCancel = () => {
    setSelectedArtist('');
  };

  const handleSave = async () => {
    if (!selectedArtist) {
      alert("บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง");
    } else {
      try { await artistApi.updateInvitations(selectedArtist, invitations.map((row) => ({ concert_id: row.concert_id, status: row.invitation_status }))); alert("บันทึกข้อมูลสำเร็จ"); } catch (error) { alert(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    }
  };

  const renderTableBody = () => {
    if (invitations.length) return invitations.map((row, index) => (
      <TableRow key={row.concert_id}>
        <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>{row.concert_name}</TableCell>
        <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>{row.start_date}{row.end_date !== row.start_date ? ` - ${row.end_date}` : ''}</TableCell>
        <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>{row.start_time?.slice(0,5)} - {row.end_time?.slice(0,5)}</TableCell>
        <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>{row.location}</TableCell>
        <TableCell sx={{ border: '1px solid #e0e0e0' }}><FormControl fullWidth size="small"><Select value={row.invitation_status} onChange={(e) => setInvitations((prev) => prev.map((item, i) => i === index ? { ...item, invitation_status: e.target.value } : item))}><MenuItem value="รอการตอบรับ">รอการตอบรับ</MenuItem><MenuItem value="เข้าร่วม">เข้าร่วม</MenuItem><MenuItem value="ปฏิเสธ">ปฏิเสธ</MenuItem></Select></FormControl></TableCell>
      </TableRow>
    ));

    return (
      <>
        <TableRow>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
        </TableRow>
        <TableRow>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
          <TableCell sx={{ textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' }}>&nbsp;</TableCell>
        </TableRow>
      </>
    );
  };

  return (
    <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai'" }}>
      <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e', mb: 3 }}>
        รายการคำเชิญ
      </Typography>

      <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#C9E2FF' }}>
        <Grid container spacing={3} sx={{ mb: 4, alignItems: 'center' }}>
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant= "body2" sx={{ fontWeight: 'bold', fontSize: '22px', color: '#1a237e' }}>
              ชื่อศิลปิน 
               <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <FormControl fullWidth size="small">
              <Select
                value={selectedArtist}
                onChange={(e) => setSelectedArtist(e.target.value)}
                displayEmpty
                sx={{ backgroundColor: 'white' }}
              >
                <MenuItem value="" disabled>เลือกศิลปิน</MenuItem>
                {artists.map((item) => <MenuItem key={item.artist_id} value={item.artist_id}>{item.artist_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Table sx={{ bgcolor: 'white', border: '1px solid #e0e0e0' }}>
          <TableHead sx={{ backgroundColor: '#ffffff' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' ,bgcolor: '#FFF5C3' }}>ชื่อคอนเสิร์ต</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' ,bgcolor: '#FFF5C3'}}>วันที่</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' ,bgcolor: '#FFF5C3'}}>ระยะเวลา</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' ,bgcolor: '#FFF5C3'}}>สถานที่</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', fontSize: '22px', border: '1px solid #e0e0e0' ,bgcolor: '#FFF5C3'}}>การตอบรับ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {renderTableBody()}
          </TableBody>
        </Table>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
          <Button
            variant="contained"
            onClick={handleCancel}
            sx={{
              backgroundColor: '#ef5350',
              '&:hover': { backgroundColor: '#d32f2f' },
              px: 4,
              borderRadius: 1,
              textTransform: 'none',
              fontSize: '22px'
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            sx={{
              backgroundColor: '#47921E',
              '&:hover': { backgroundColor: '#388e3c' },
              px: 4,
              borderRadius: 1,
              textTransform: 'none',
              fontSize: '22px'
            }}
          >
            บันทึกข้อมูล
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default InvitationPage;
