import { useRef, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  FormControl,
  Grid,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload,
  Description as DescriptionIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { concertApi, ConcertData, DocumentItem } from '@/api/concertApi';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';

const DocumentsPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [concertName, setConcertName] = useState('');
  const [category, setCategory] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConcerts();
  }, []);

  useEffect(() => {
    if (concertName) {
      loadDocuments(concertName);
    }
  }, [concertName]);

  const loadConcerts = async () => {
    try {
      const data = await concertApi.getConcerts();
      setConcerts(data);
      if (data.length > 0 && !concertName) {
        const initialId = data[0].concert_id;
        setConcertName(initialId);
        loadDocuments(initialId);
      }
    } catch (err) {
      console.error('Failed to load concerts:', err);
    }
  };

  const loadDocuments = async (concertId: string) => {
    try {
      const docs = await concertApi.getDocuments(concertId);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setDocuments([]);
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.pdf', '.docx', '.csv', '.xlsx'];
    const isValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidExtension) {
      alert('อนุญาตเฉพาะไฟล์ .pdf, .docx, .csv และ .xlsx เท่านั้น');
      return;
    }

    // Check file size (max 1 GB)
    const maxSizeBytes = 1024 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert('ขนาดไฟล์ต้องไม่เกิน 1 GB');
      return;
    }

    setDocumentFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSave = async () => {
    if (!concertName || !category || !documentTitle.trim() || !documentFile) {
      alert("บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง หรือกรอกไม่ครบถ้วน");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('category', category);

      let finalDocName = documentTitle.trim();
      const dotIndex = documentFile.name.lastIndexOf('.');
      if (dotIndex !== -1) {
        const ext = documentFile.name.substring(dotIndex);
        if (!finalDocName.toLowerCase().endsWith(ext.toLowerCase())) {
          finalDocName += ext;
        }
      }

      formData.append('document_name', finalDocName);
      formData.append('document_file', documentFile);

      await concertApi.uploadDocument(concertName, formData);
      alert("บันทึกข้อมูลสำเร็จ");
      handleCancel();
      // Reload documents for this concert
      loadDocuments(concertName);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + (err.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDocument = (doc: DocumentItem) => {
    const fileUrl = doc.file_url || `http://localhost:8080/api/documents/${doc.document_id}/file`;
    window.open(fileUrl, '_blank');
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    try {
      setLoading(true);
      await concertApi.deleteDocument(documentToDelete.document_id);
      setDocuments((prev) => prev.filter((d) => d.document_id !== documentToDelete.document_id));
      alert("ลบเอกสารสำเร็จ");
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบเอกสาร: " + (err.message || err));
    } finally {
      setLoading(false);
      setDocumentToDelete(null);
    }
  };

  const handleCancel = () => {
    setCategory('');
    setDocumentTitle('');
    setDocumentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Find selected concert name
  const currentConcertObj = concerts.find((c) => c.concert_id === concertName);
  const currentConcertDisplay = currentConcertObj ? currentConcertObj.concert_name : concertName;

  return (
    <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai'" }}>
      <Typography sx={{ fontWeight: 'bold', color: '#1a237e', mb: 4, fontSize: '38px' }}>
        แนบเอกสารเกี่ยวกับคอนเสิร์ต
      </Typography>

      {/* Form Upload Paper */}
      <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#C5EDE8' }}>
        <Grid container spacing={3} sx={{ alignItems: 'center' }}>

          {/* 1. ชื่อคอนเสิร์ต */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
              ชื่อคอนเสิร์ต
              <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={concertName}
                onChange={(e) => setConcertName(e.target.value as string)}
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

          {/* 2. หมวดหมู่ */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
              หมวดหมู่
              <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={category}
                onChange={(e) => setCategory(e.target.value as string)}
                sx={{ bgcolor: 'white', borderRadius: 1, fontSize: '18px' }}
              >
                <MenuItem value="" disabled sx={{ fontSize: '20px' }}>โปรดระบุหมวดหมู่</MenuItem>
                <MenuItem value="เอกสารขอเข้าใช้สถานที่" sx={{ fontSize: '20px' }}>เอกสารขอเข้าใช้สถานที่</MenuItem>
                <MenuItem value="สัญญาผู้สนับสนุน" sx={{ fontSize: '20px' }}>สัญญาผู้สนับสนุน</MenuItem>
                <MenuItem value="สัญญาการจ้างศิลปิน" sx={{ fontSize: '20px' }}>สัญญาการจ้างศิลปิน</MenuItem>
                <MenuItem value="เอกสารฝ่าย Production" sx={{ fontSize: '20px' }}>เอกสารฝ่าย Production</MenuItem>
                <MenuItem value="ใบเสร็จ/ใบกำกับภาษี" sx={{ fontSize: '20px' }}>ใบเสร็จ/ใบกำกับภาษี</MenuItem>
                <MenuItem value="แผนงานและผังจัดงาน" sx={{ fontSize: '20px' }}>แผนงานและผังจัดงาน</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* 3. หัวข้อเอกสาร */}
          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
              หัวข้อเอกสาร
              <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="โปรดระบุหัวข้อเอกสาร"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>

          {/* 4. แนบเอกสาร */}
          <Grid size={{ xs: 12, sm: 1.5 }} sx={{ alignSelf: 'flex-start', pt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '22px' }}>
              แนบเอกสาร
              <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 10 }}>
            <Box
              onClick={handleChooseFile}
              sx={{
                border: '2px dashed #90caf9',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: '#1976d2',
                  bgcolor: '#f5f7fa',
                },
              }}
            >
              <CloudUpload sx={{ fontSize: 52, color: '#90caf9', mb: 1.5 }} />
              {documentFile ? (
                <>
                  <Typography sx={{ fontWeight: 600, color: '#1a237e', fontSize: '20px' }}>
                    {documentFile.name}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: '16px' }}>
                    {formatFileSize(documentFile.size)} (คลิกเพื่อเปลี่ยนไฟล์)
                  </Typography>
                </>
              ) : (
                <Typography color="textSecondary" sx={{ fontSize: '16px' }}>
                  เฉพาะไฟล์ .pdf , .docx , .csv และ .xlsx เท่านั้น และขนาดไฟล์ไม่เกิน 1 GB
                </Typography>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.csv,.xlsx"
                hidden
                onChange={handleFileChange}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
          <Button
            onClick={handleCancel}
            disabled={loading}
            variant="contained"
            sx={{ bgcolor: '#ef5350', '&:hover': { bgcolor: '#d32f2f' }, px: 4, borderRadius: 1, textTransform: 'none', fontSize: '22px' }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            variant="contained"
            sx={{ bgcolor: '#47921E', '&:hover': { bgcolor: '#388e3c' }, px: 4, borderRadius: 1, textTransform: 'none', fontSize: '22px' }}
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
          </Button>
        </Box>
      </Paper>

      {/* Documents Table for the Selected Concert */}
      <Box sx={{ mt: 4 }}>
        <Typography sx={{ fontWeight: 'bold', color: '#1a237e', mb: 2, fontSize: '26px' }}>
          รายการเอกสารที่แนบไว้: {currentConcertDisplay}
        </Typography>

        <Paper sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: 2 }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#4caf50' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '8%', textAlign: 'center', fontSize: '20px' }}>
                    ลำดับ
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '20%', textAlign: 'center', fontSize: '20px' }}>
                    หมวดหมู่
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '47%', textAlign: 'center', fontSize: '20px' }}>
                    หัวข้อเอกสาร
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '25%', textAlign: 'center', fontSize: '20px' }}>
                    การจัดการ
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ bgcolor: '#dcedc8' }}>
                {documents.length > 0 ? (
                  documents.map((doc, index) => (
                    <TableRow
                      key={doc.document_id || index}
                      sx={{
                        '&:nth-of-type(even)': { bgcolor: '#c5e1a5' },
                        '&:hover': { bgcolor: '#e0f2f1' }
                      }}
                    >
                      <TableCell sx={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                        {index + 1}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontSize: '18px' }}>
                        <Chip
                          label={doc.category}
                          size="small"
                          sx={{ bgcolor: 'white', color: '#1a237e', fontWeight: 'bold', fontSize: '15px' }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', px: 3 }}>
                        <Tooltip title="คลิกเพื่อเปิดดูไฟล์">
                          <Box
                            onClick={() => handleOpenDocument(doc)}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1,
                              cursor: 'pointer',
                              maxWidth: '100%',
                              mx: 'auto',
                              '&:hover': { color: '#1a237e', textDecoration: 'underline' }
                            }}
                          >
                            <DescriptionIcon sx={{ color: '#1a237e', flexShrink: 0 }} />
                            <Typography
                              sx={{
                                fontWeight: 600,
                                fontSize: '18px',
                                textAlign: 'center',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere'
                              }}
                            >
                              {doc.document_name}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<OpenInNewIcon />}
                            onClick={() => handleOpenDocument(doc)}
                            sx={{
                              bgcolor: '#1a237e',
                              color: 'white',
                              fontWeight: 'bold',
                              borderRadius: 2,
                              fontSize: '15px',
                              px: 1.8,
                              py: 0.5,
                              '&:hover': { bgcolor: '#0d47a1' }
                            }}
                          >
                            เปิดดูไฟล์
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDocumentToDelete(doc)}
                            sx={{
                              bgcolor: '#ef5350',
                              color: 'white',
                              fontWeight: 'bold',
                              borderRadius: 2,
                              fontSize: '15px',
                              px: 1.8,
                              py: 0.5,
                              '&:hover': { bgcolor: '#d32f2f' }
                            }}
                          >
                            ลบ
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary', fontSize: '18px' }}>
                      ยังไม่มีเอกสารแนบสำหรับคอนเสิร์ตนี้ สามารถกรอกแบบฟอร์มด้านบนเพื่อแนบเอกสารได้
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
      <ConfirmDeleteDialog
        open={documentToDelete !== null}
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={confirmDeleteDocument}
        loading={loading}
      />
    </Box>
  );
};

export default DocumentsPage;
