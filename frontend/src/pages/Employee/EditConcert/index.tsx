import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { Dayjs } from 'dayjs';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import { concertApi, ConcertData } from '@/api/concertApi';
import { pulse, flux, celestial, starlight } from '@/assets/Poster';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';

const fallbackImages: Record<string, string> = {
  "CC0001": pulse,
  "CC0002": flux,
  "CC0003": celestial,
  "Riverside Sound Festival": pulse,
  "Neon Nights Vol.3": flux,
  "Acoustic Sessions: Bangkok": celestial,
};

const parseTimeString = (timeStr?: string): Dayjs | null => {
  if (!timeStr) return null;
  // Handle formats like "18:00" or "18:00:00"
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return dayjs().hour(hours).minute(minutes).second(0);
    }
  }
  return null;
};

const EditConcertPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [selectedConcert, setSelectedConcert] = useState('');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [artistInput, setArtistInput] = useState('');
  const [artistList, setArtistList] = useState<string[]>([]);
  const [extraInfo, setExtraInfo] = useState('');
  const [posterName, setPosterName] = useState('');
  const [posterPreview, setPosterPreview] = useState<string>('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load concerts on mount
  useEffect(() => {
    loadConcertList();
  }, []);

  const loadConcertList = async () => {
    try {
      const data = await concertApi.getConcerts();
      setConcerts(data);
      if (data.length > 0 && !selectedConcert) {
        handleSelectConcert(data[0].concert_id, data);
      }
    } catch (err) {
      console.error('Failed to load concerts:', err);
    }
  };

  const handleSelectConcert = async (concertId: string, currentList = concerts) => {
    setSelectedConcert(concertId);
    if (!concertId) return;

    try {
      const concert = await concertApi.getConcert(concertId);
      if (concert) {
        setStartDate(concert.start_date ? dayjs(concert.start_date) : null);
        setEndDate(concert.end_date ? dayjs(concert.end_date) : null);
        setVenue(concert.location || '');
        setStartTime(parseTimeString(concert.start_time));
        setEndTime(parseTimeString(concert.end_time));
        setExtraInfo(concert.more_info || '');
        setArtistList(concert.artists || []);
        setPosterName(concert.poster_name || 'Poster.png');
        setPosterFile(null);

        if (concert.poster_data) {
          setPosterPreview(`data:image/jpeg;base64,${concert.poster_data}`);
        } else if (fallbackImages[concert.concert_id] || fallbackImages[concert.concert_name]) {
          setPosterPreview(fallbackImages[concert.concert_id] || fallbackImages[concert.concert_name]);
        } else {
          setPosterPreview(starlight);
        }
      }
    } catch {
      // Fallback from list
      const c = currentList.find((item) => item.concert_id === concertId);
      if (c) {
        setStartDate(c.start_date ? dayjs(c.start_date) : null);
        setEndDate(c.end_date ? dayjs(c.end_date) : null);
        setVenue(c.location || '');
        setStartTime(parseTimeString(c.start_time));
        setEndTime(parseTimeString(c.end_time));
        setExtraInfo(c.more_info || '');
        setArtistList(c.artists || []);
        setPosterName(c.poster_name || 'Poster.png');
        setPosterFile(null);
        setPosterPreview(fallbackImages[c.concert_id] || fallbackImages[c.concert_name] || starlight);
      }
    }
  };

  const handleAddArtist = () => {
    const trimmed = artistInput.trim();
    if (trimmed && !artistList.includes(trimmed)) {
      setArtistList([...artistList, trimmed]);
      setArtistInput('');
    }
  };

  const handleDeleteArtist = (artistToRemove: string) => {
    setArtistList(artistList.filter((a) => a !== artistToRemove));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPosterFile(file);
      setPosterName(file.name);
      setPosterPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdate = async () => {
    if (!selectedConcert) {
      alert('โปรดเลือกคอนเสิร์ตที่ต้องการแก้ไข');
      return;
    }

    try {
      setLoading(true);
      const payload: Partial<ConcertData> = {
        start_date: startDate ? startDate.format('YYYY-MM-DD') : '',
        end_date: endDate ? endDate.format('YYYY-MM-DD') : '',
        location: venue,
        start_time: startTime ? startTime.format('HH:mm:ss') : '',
        end_time: endTime ? endTime.format('HH:mm:ss') : '',
        more_info: extraInfo,
        artists: artistList,
        poster_name: posterName,
      };

      if (posterFile) {
        // Read file as base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          payload.poster_data = base64String;
          await concertApi.updateConcert(selectedConcert, payload);
          alert('อัพเดตข้อมูลสำเร็จ');
          setLoading(false);
        };
        reader.readAsDataURL(posterFile);
        return;
      }

      await concertApi.updateConcert(selectedConcert, payload);
      alert('อัพเดตข้อมูลสำเร็จ');
    } catch (err: any) {
      alert(`อัปเดตไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (selectedConcert) {
      handleSelectConcert(selectedConcert);
    }
  };

  const handleDeleteConcert = () => {
    if (!selectedConcert) {
      alert('โปรดเลือกคอนเสิร์ตที่ต้องการลบ');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmDeleteConcert = async () => {
    try {
      setLoading(true);
      await concertApi.deleteConcert(selectedConcert);
      alert('ลบคอนเสิร์ตสำเร็จ');
      // Reload concert list and reset selection
      const data = await concertApi.getConcerts();
      setConcerts(data);
      if (data.length > 0) {
        handleSelectConcert(data[0].concert_id, data);
      } else {
        setSelectedConcert('');
        setStartDate(null);
        setEndDate(null);
        setStartTime(null);
        setEndTime(null);
        setVenue('');
        setExtraInfo('');
        setArtistList([]);
        setPosterName('');
        setPosterPreview('');
      }
    } catch (err: any) {
      alert(`ลบไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ fontWeight: 'bold', color: '#1a237e', mb: 3, fontSize: '38px' }}>
        แก้ไขข้อมูลคอนเสิร์ต
      </Typography>

      {/* Form Container */}
      <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#fce4ec' }}>
        <Grid container spacing={3} sx={{ alignItems: 'center' }}>
          {/* ชื่อคอนเสิร์ต */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              ชื่อคอนเสิร์ต
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <FormControl fullWidth size="small">
              <Select
                value={selectedConcert}
                onChange={(e) => handleSelectConcert(e.target.value as string)}
                displayEmpty
                sx={{ bgcolor: 'white', borderRadius: 1, fontSize: '18px' }}
              >
                <MenuItem value="" disabled sx={{ fontSize: '18px' }}>โปรดระบุชื่อคอนเสิร์ต</MenuItem>
                {concerts.map((c) => (
                  <MenuItem key={c.concert_id} value={c.concert_id} sx={{ fontSize: '18px' }}>
                    {c.concert_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* วัน/เดือน/ปี */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              วัน/เดือน/ปี
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <DatePicker
                format="DD/MM/YYYY"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
                ถึง
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
              <DatePicker
                format="DD/MM/YYYY"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
            </Box>
          </Grid>

          {/* เวลา */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              เวลา
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TimePicker
                ampm={false}
                format="HH:mm"
                value={startTime}
                onChange={(newValue) => setStartTime(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { bgcolor: 'white', borderRadius: 1, minWidth: 140 }
                  }
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
                ถึง
                <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
              <TimePicker
                ampm={false}
                format="HH:mm"
                value={endTime}
                onChange={(newValue) => setEndTime(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { bgcolor: 'white', borderRadius: 1, minWidth: 140 }
                  }
                }}
              />
            </Box>
          </Grid>

          {/* สถานที่ */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              สถานที่
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <TextField
              fullWidth
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="โปรดระบุสถานที่"
              variant="outlined"
              size="small"
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>

          {/* ศิลปินที่เชิญ */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              ศิลปิน
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                placeholder="โปรดระบุชื่อศิลปิน"
                variant="outlined"
                size="small"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddArtist();
                  }
                }}
                sx={{ maxWidth: 300, bgcolor: 'white', borderRadius: 1 }}
              />
              <IconButton onClick={handleAddArtist} sx={{ color: '#4caf50' }}>
                <AddCircleIcon fontSize="large" />
              </IconButton>
            </Box>
          </Grid>

          {/* แนบโปสเตอร์ */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              แนบโปสเตอร์
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {/* Image Preview Thumbnail */}
              {posterPreview && (
                <Box
                  onClick={() => setOpenImageDialog(true)}
                  sx={{
                    width: 70,
                    height: 70,
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: 2,
                    cursor: 'pointer',
                    border: '2px solid #1a237e',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'scale(1.05)', opacity: 0.9 }
                  }}
                  title="คลิกเพื่อดูรูปภาพขนาดเต็ม"
                >
                  <Box
                    component="img"
                    src={posterPreview}
                    alt="โปสเตอร์"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              )}

              {/* File name box */}
              <Typography
                onClick={() => posterPreview && setOpenImageDialog(true)}
                sx={{
                  bgcolor: 'white',
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  fontSize: '18px',
                  cursor: posterPreview ? 'pointer' : 'default',
                  textDecoration: posterPreview ? 'underline' : 'none',
                  color: posterPreview ? '#1a237e' : 'inherit',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                {posterName || 'Poster.png'}
              </Typography>

              {/* View Full Image Button */}
              {posterPreview && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={() => setOpenImageDialog(true)}
                  sx={{
                    borderColor: '#1a237e',
                    color: '#1a237e',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    bgcolor: 'white',
                    '&:hover': { bgcolor: '#e8eaf6' }
                  }}
                >
                  ดูรูปภาพ
                </Button>
              )}

              {/* Change Image Button */}
              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  bgcolor: '#3949ab',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  '&:hover': { bgcolor: '#283593' }
                }}
              >
                เปลี่ยนรูปภาพ
              </Button>
            </Box>
          </Grid>

          {/* เพิ่มเติม */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', }}>
              เพิ่มเติม
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="ไม่จำเป็นต้องระบุ"
              variant="outlined"
              value={extraInfo}
              onChange={(e) => setExtraInfo(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>
        </Grid>

        {/* Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleDeleteConcert}
            disabled={loading || !selectedConcert}
            startIcon={<DeleteIcon />}
            sx={{ bgcolor: '#ff383e', '&:hover': { bgcolor: '#e52f35' }, borderRadius: 1, px: 3, fontSize: '20px' }}
          >
            ลบคอนเสิร์ต
          </Button>
          <Button
            variant="contained"
            onClick={handleCancel}
            sx={{ bgcolor: '#ff8a24', '&:hover': { bgcolor: '#e8791d' }, borderRadius: 1, px: 3, fontSize: '20px' }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={loading}
            sx={{ bgcolor: '#3c941f', '&:hover': { bgcolor: '#327d19' }, borderRadius: 1, px: 3, fontSize: '20px' }}
          >
            {loading ? 'กำลังบันทึก...' : 'อัพเดตข้อมูล'}
          </Button>
        </Box>
      </Paper>

      {/* Artist Table */}
      <Paper sx={{ mt: 3, borderRadius: 0, overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#4caf50' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '20%', textAlign: 'center', fontSize: '22px' }}>
                ลำดับ
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '60%', textAlign: 'center', fontSize: '22px' }}>
                ชื่อศิลปิน
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '20%', textAlign: 'center', fontSize: '22px' }}>
                จัดการ
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ bgcolor: '#dcedc8' }}>
            {artistList.length > 0 ? (
              artistList.map((artist, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ textAlign: 'center', fontSize: '20px' }}>{index + 1}</TableCell>
                  <TableCell sx={{ textAlign: 'center', fontSize: '20px' }}>{artist}</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <IconButton
                      onClick={() => handleDeleteArtist(artist)}
                      sx={{ color: '#ef5350', bgcolor: 'transparent', '&:hover': { bgcolor: '#ffcdd2' } }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} sx={{ textAlign: 'center', py: 3, color: 'text.secondary', fontSize: '18px' }}>
                  ยังไม่มีรายชื่อศิลปิน
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Image Preview Full Dialog */}
      <Dialog
        open={openImageDialog}
        onClose={() => setOpenImageDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#1a237e', color: 'white' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            โปสเตอร์คอนเสิร์ต: {posterName || 'รูปภาพโปสเตอร์'}
          </Typography>
          <IconButton
            onClick={() => setOpenImageDialog(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#111' }}>
          {posterPreview ? (
            <Box
              component="img"
              src={posterPreview}
              alt="โปสเตอร์คอนเสิร์ต"
              sx={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: 2,
                boxShadow: 3
              }}
            />
          ) : (
            <Typography sx={{ color: 'white', py: 8 }}>ไม่มีรูปภาพโปสเตอร์</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Button
            variant="contained"
            onClick={() => fileInputRef.current?.click()}
            startIcon={<CloudUploadIcon />}
            sx={{ bgcolor: '#3949ab', color: 'white' }}
          >
            เปลี่ยนรูปภาพใหม่
          </Button>
          <Button
            onClick={() => setOpenImageDialog(false)}
            sx={{ color: '#1a237e', fontWeight: 'bold' }}
          >
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDeleteConcert}
        loading={loading}
      />
    </Box>
  );
};

export default EditConcertPage;
