import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  IconButton,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Dayjs } from 'dayjs';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import { concertApi } from '@/api/concertApi';

const AddConcertPage = () => {
  const [concertName, setConcertName] = useState('');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [artistInput, setArtistInput] = useState('');
  const [artistList, setArtistList] = useState<string[]>([]);
  const [extraInfo, setExtraInfo] = useState('');
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>('');
  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowTypes = ["image/jpeg", "image/png"];
    if (!allowTypes.includes(file.type)) {
      alert("อนุญาตเฉพาะไฟล์ .jpg .jpeg และ .png");
      return;
    }

    setPoster(file);
    setPosterPreview(URL.createObjectURL(file));
  };

  const handleAddArtist = () => {
    const trimmed = artistInput.trim();
    if (trimmed && !artistList.includes(trimmed)) {
      setArtistList([...artistList, trimmed]);
      setArtistInput('');
    }
  };

  const handleRemoveArtist = (artistToRemove: string) => {
    setArtistList(artistList.filter((a) => a !== artistToRemove));
  };

  const handleSave = async () => {
    const effectiveArtists = [...artistList];
    const trimmed = artistInput.trim();
    if (trimmed && !effectiveArtists.includes(trimmed)) {
      effectiveArtists.push(trimmed);
    }

    if (!concertName || !startDate || !endDate || !venue || !startTime || !endTime || effectiveArtists.length === 0) {
      alert("กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('concert_name', concertName);
      formData.append('start_date', startDate.format('YYYY-MM-DD'));
      formData.append('end_date', endDate.format('YYYY-MM-DD'));
      formData.append('location', venue);
      formData.append('start_time', startTime.format('HH:mm:ss'));
      formData.append('end_time', endTime.format('HH:mm:ss'));
      formData.append('more_info', extraInfo);
      formData.append('artists', effectiveArtists.join(','));

      if (poster) {
        formData.append('poster', poster);
        formData.append('poster_name', poster.name);
      }

      await concertApi.createConcert(formData);
      alert("บันทึกข้อมูลสำเร็จ");

      // Reset form
      handleCancel();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setConcertName('');
    setStartDate(null);
    setEndDate(null);
    setVenue('');
    setStartTime(null);
    setEndTime(null);
    setArtistInput('');
    setArtistList([]);
    setExtraInfo('');
    setPoster(null);
    setPosterPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai'" }}>
      <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e', mb: 3 }}>
        เพิ่มข้อมูลคอนเสิร์ต
      </Typography>

      <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#EFF6FF' }}>
        <Grid container spacing={3} sx={{ alignItems: 'center' }}>
          {/* ชื่อคอนเสิร์ต */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ชื่อคอนเสิร์ต
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <TextField
              fullWidth
              placeholder="โปรดระบุชื่อคอนเสิร์ต"
              variant="outlined"
              size="small"
              value={concertName}
              onChange={(e) => setConcertName(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>

          {/* วัน/เดือน/ปี */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
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
              <Typography variant="body2" sx={{fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>ถึง</Typography>
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

          {/* สถานที่ */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              สถานที่
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <TextField
              fullWidth
              placeholder="โปรดระบุสถานที่"
              variant="outlined"
              size="small"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 2 }}
            />
          </Grid>

          {/* เวลา */}
          <Grid size={{ xs: 8, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
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

          {/* ศิลปินที่เชิญ */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ศิลปินที่เชิญ
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: artistList.length > 0 ? 1 : 0 }}>
              <TextField
                placeholder="โปรดระบุชื่อศิลปิน"
                variant="outlined"
                size="medium"
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
            {artistList.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {artistList.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    onDelete={() => handleRemoveArtist(a)}
                    color="primary"
                    sx={{ fontSize: '16px', py: 1 }}
                  />
                ))}
              </Stack>
            )}
          </Grid>

          {/* แนบโปสเตอร์ */}
          <Grid size={{ xs: 12, sm: 1.5 }} sx={{ alignSelf: 'flex-start', pt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              แนบโปสเตอร์
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <Box
              onClick={handleChooseFile}
              sx={{
                border: '2px dashed #b0bec5',
                borderRadius: 2,
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#ffffff',
                cursor: 'pointer',
                minHeight: 140,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: '#1976d2',
                  bgcolor: '#f5f7fa',
                },
              }}
            >
              {poster && posterPreview ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Box
                    component="img"
                    src={posterPreview}
                    alt="โปสเตอร์ที่เลือก"
                    sx={{
                      width: 100,
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: 2,
                      boxShadow: 2,
                      mb: 1
                    }}
                  />
                  <Typography sx={{ fontWeight: 600, color: '#1a237e', fontSize: '22px' }}>
                    {poster.name}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: '18px' }}>
                    {(poster.size / 1024).toFixed(2)} KB (คลิกเพื่อเปลี่ยนรูปภาพ)
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenImageDialog(true);
                    }}
                    sx={{ mt: 1, borderColor: '#1a237e', color: '#1a237e', fontWeight: 'bold' }}
                  >
                    ดูรูปภาพขนาดเต็ม
                  </Button>
                </Box>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 44, color: '#90a4ae', mb: 1 }} />
                  <Typography color="text.secondary" sx={{ fontSize: '20px' }}>
                    เฉพาะไฟล์ .jpg, .jpeg และ .png เท่านั้น
                  </Typography>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                hidden
                onChange={handleFileChange}
              />
            </Box>
          </Grid>

          {/* เพิ่มเติม */}
          <Grid size={{ xs: 12, sm: 1.5 }} sx={{ alignSelf: 'flex-start', pt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              เพิ่มเติม
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="ไม่จำเป็นต้องระบุ"
              variant="outlined"
              value={extraInfo}
              onChange={(e) => setExtraInfo(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>
        </Grid>

        {/* Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
          <Button onClick={handleCancel} disabled={loading} variant="contained" sx={{ backgroundColor: '#ef5350', '&:hover': { backgroundColor: '#d32f2f' }, px: 4, borderRadius: 1, textTransform: 'none', fontSize: '22px' }}>
            ยกเลิก
          </Button>
          <Button onClick={handleSave} disabled={loading} variant="contained" sx={{ backgroundColor: '#47921E', '&:hover': { backgroundColor: '#388e3c' }, px: 4, borderRadius: 1, textTransform: 'none', fontSize: '22px' }}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
        </Box>
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
            โปสเตอร์คอนเสิร์ต: {poster?.name || 'รูปภาพโปสเตอร์'}
          </Typography>
          <IconButton
            onClick={() => setOpenImageDialog(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#111' }}>
          {posterPreview && (
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
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Button
            onClick={() => setOpenImageDialog(false)}
            sx={{ color: '#1a237e', fontWeight: 'bold' }}
          >
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AddConcertPage;
