import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, Grid, Select, MenuItem, FormControl, Radio, RadioGroup, FormControlLabel } from '@mui/material';
import { artistApi, type ArtistData } from '@/api/artistApi';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';

const ArtistInfoPage = () => {
  const [activeTab, setActiveTab] = useState<'add' | 'edit'>('add');
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const loadArtists = async () => { try { setArtists(await artistApi.getArtists()); } catch (error) { alert(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ'); } };
  useEffect(() => { void loadArtists(); }, []);

  // Add mode states
  const [artistName, setArtistName] = useState('');
  const [artistType, setArtistType] = useState('เดี่ยว');
  const [label, setLabel] = useState('');
  const [contact, setContact] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Edit mode states
  const [selectedArtist, setSelectedArtist] = useState('');
  const [editArtistType, setEditArtistType] = useState('เดี่ยว');
  const [editLabel, setEditLabel] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editCoordinator, setEditCoordinator] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    const selected = artists.find((item) => item.artist_id === selectedArtist);
    if (selected) {
      setEditArtistType(selected.artist_type || 'เดี่ยว'); setEditLabel(selected.record_label); setEditContact(selected.official_contact);
      setEditCoordinator(selected.coordinator_name || ''); setEditPhone(selected.coordinator_phone || ''); setEditEmail(selected.coordinator_email || '');
    } else {
      setEditArtistType('เดี่ยว');
      setEditLabel('');
      setEditContact('');
      setEditCoordinator('');
      setEditPhone('');
      setEditEmail('');
    }
  }, [selectedArtist, artists]);

  const handleSave = async () => {
    if (!artistName || !artistType || !label || !contact || !coordinator || !phone || !email) {
      alert("บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง");
    } else {
      try { await artistApi.createArtist({ artist_name: artistName, artist_type: artistType, record_label: label, official_contact: contact, coordinator_name: coordinator, coordinator_phone: phone, coordinator_email: email, more_info: '-', status: 'ใช้งาน' }); await loadArtists(); handleCancel(); alert("บันทึกข้อมูลสำเร็จ"); } catch (error) { alert(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    }
  };

  const handleUpdate = async () => {
    if (!selectedArtist || !editArtistType || !editLabel || !editContact || !editCoordinator || !editPhone || !editEmail) {
      alert("บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง");
    } else {
      const current = artists.find((item) => item.artist_id === selectedArtist);
      try { await artistApi.updateArtist(selectedArtist, { ...current, artist_type: editArtistType, record_label: editLabel, official_contact: editContact, coordinator_name: editCoordinator, coordinator_phone: editPhone, coordinator_email: editEmail }); await loadArtists(); alert("อัพเดตข้อมูลสำเร็จ"); } catch (error) { alert(error instanceof Error ? error.message : 'อัปเดตไม่สำเร็จ'); }
    }
  };

  const handleCancel = () => {
    setArtistName('');
    setArtistType('เดี่ยว');
    setLabel('');
    setContact('');
    setCoordinator('');
    setPhone('');
    setEmail('');
  };

  const handleEditCancel = () => {
    setSelectedArtist('');
    setEditArtistType('เดี่ยว');
    setEditLabel('');
    setEditContact('');
    setEditCoordinator('');
    setEditPhone('');
    setEditEmail('');
  };

  const handleDelete = () => {
    if (!selectedArtist) return;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await artistApi.deleteArtist(selectedArtist);
      await loadArtists();
      handleEditCancel();
      alert("ลบข้อมูลสำเร็จ");
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ลบข้อมูลไม่สำเร็จ');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Box sx={{ p: 4, fontFamily: "Noto Sans Thai" }}>
      <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e', mb: 3 }}>
        จัดการข้อมูลศิลปิน
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant={activeTab === 'add' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('add')}
          sx={{
            bgcolor: activeTab === 'add' ? '#1a237e' : 'transparent',
            color: activeTab === 'add' ? 'white' : '#1a237e',
            borderRadius: '20px',
            textTransform: 'none',
            px: 3,
            py: 1,
            fontWeight: 'bold',
            fontSize: '22px',
            borderColor: '#6700A3',
            '&:hover': {
              bgcolor: activeTab === 'add' ? '#6700A3' : 'rgba(26, 35, 126, 0.04)',
            }
          }}
        >
          เพิ่มศิลปิน
        </Button>
        <Button
          variant={activeTab === 'edit' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('edit')}
          sx={{
            bgcolor: activeTab === 'edit' ? '#e91e63' : 'transparent',
            color: activeTab === 'edit' ? 'white' : '#e91e63',
            borderRadius: '20px',
            textTransform: 'none',
            px: 3,
            py: 1,
            fontWeight: 'bold',
            fontSize: '22px',
            borderColor: '#e91e63',
            '&:hover': {
              bgcolor: activeTab === 'edit' ? '#e91e63' : 'rgba(233, 30, 99, 0.04)',
            }
          }}
        >
          แก้ไขข้อมูลศิลปิน
        </Button>
      </Box>

      {activeTab === 'add' && (
        <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#F7DCF3' }}>
          <Grid container spacing={3} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ชื่อศิลปิน
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุชื่อศิลปิน"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ประเภทศิลปิน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10 }}>
              <FormControl component="fieldset">
                <RadioGroup row value={artistType} onChange={(e) => setArtistType(e.target.value)}>
                  <FormControlLabel value="เดี่ยว" control={<Radio />} label="ประเภทเดี่ยว" />
                  <FormControlLabel value="วง" control={<Radio />} label="ประเภทวง" />
                </RadioGroup>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15}}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ค่ายเพลงหรือสังกัดศิลปิน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุค่ายเพลงหรือสังกัดศิลปิน"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ช่องทางติดต่อ Official
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุช่องทางติดต่อ"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ผู้ประสานงาน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุชื่อผู้ประสานงาน"
                value={coordinator}
                onChange={(e) => setCoordinator(e.target.value)}
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
               เบอร์โทรผู้ประสานงาน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุหมายเลขโทรศัพท์"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
               E-mail ผู้ประสานงาน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุ E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
            <Button
              onClick={handleCancel}
              sx={{
                bgcolor: '#ef5350',
                color: 'white',
                '&:hover': { bgcolor: '#d32f2f' },
                px: 4,
                py: 1,
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '22px'
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              sx={{
                bgcolor: '#47921E',
                color: 'white',
                '&:hover': { bgcolor: '#388e3c' },
                px: 4,
                py: 1,
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '22px'
              }}
            >
              บันทึกข้อมูล
            </Button>
          </Box>
        </Paper>
      )}

      {activeTab === 'edit' && (
        <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#FFDAED' }}>
          <Grid container spacing={3} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ชื่อศิลปิน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10 }}>
              <FormControl fullWidth size="small">
                <Select
                  value={selectedArtist}
                  onChange={(e) => setSelectedArtist(e.target.value as string)}
                  displayEmpty
                  sx={{ bgcolor: selectedArtist ? '#FFFFFF' : 'white', borderRadius: 1 }}
                >
                  <MenuItem value="" disabled>เลือกศิลปิน</MenuItem>
                  {artists.map((item) => <MenuItem key={item.artist_id} value={item.artist_id}>{item.artist_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ประเภทศิลปิน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 10 }}>
              <FormControl component="fieldset">
                <RadioGroup row value={editArtistType} onChange={(e) => setEditArtistType(e.target.value)}>
                  <FormControlLabel value="เดี่ยว" control={<Radio />} label="ประเภทเดี่ยว" />
                  <FormControlLabel value="วง" control={<Radio />} label="ประเภทวง" />
                </RadioGroup>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ค่ายเพลงหรือสังกัดศิลปิน
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุค่ายเพลงหรือสังกัดศิลปิน"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                sx={{ bgcolor: selectedArtist ? '#FFFFFF' : 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ช่องทางติดต่อ Official
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุช่องทางติดต่อ"
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
                sx={{ bgcolor: selectedArtist ? '#FFFFFF' : 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                ผู้ประสานงาน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุชื่อผู้ประสานงาน"
                value={editCoordinator}
                onChange={(e) => setEditCoordinator(e.target.value)}
                sx={{ bgcolor: selectedArtist ? '#FFFFFF' : 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              เบอร์โทรผู้ประสานงาน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุหมายเลขโทรศัพท์"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                sx={{ bgcolor: selectedArtist ? '#FFFFFF' : 'white', borderRadius: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 2.15 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
                 E-mail ผู้ประสานงาน
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 9.35 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="โปรดระบุ E-mail"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                sx={{ bgcolor: selectedArtist ? '#FFFFFF' : 'white', borderRadius: 1 }}
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
            <Button
              onClick={handleDelete}
              sx={{
                bgcolor: '#ef5350',
                color: 'white',
                '&:hover': { bgcolor: '#d32f2f' },
                px: 4,
                py: 1,
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '22px'
              }}
            >
              ลบข้อมูล
            </Button>
            <Button
              onClick={handleEditCancel}
              sx={{
                bgcolor: '#FF8D28',
                color: 'white',
                '&:hover': { bgcolor: '#FF8D28' },
                px: 4,
                py: 1,
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '22px'
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleUpdate}
              sx={{
                bgcolor: '#47921E',
                color: 'white',
                '&:hover': { bgcolor: '#47921E' },
                px: 4,
                py: 1,
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '22px'
              }}
            >
              อัพเดตข้อมูล
            </Button>
          </Box>
        </Paper>
      )}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </Box>
  );
};

export default ArtistInfoPage;
