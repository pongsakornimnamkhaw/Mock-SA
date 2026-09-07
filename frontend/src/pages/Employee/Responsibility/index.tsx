import { useState, useEffect } from 'react';
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
  TableContainer,
  Tooltip,
  Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Dayjs } from 'dayjs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { concertApi, ConcertData, TaskData } from '@/api/concertApi';

const ResponsibilityPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [concert, setConcert] = useState('');
  const [taskName, setTaskName] = useState('');
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [department, setDepartment] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConcerts();
  }, []);

  useEffect(() => {
    if (concert) {
      loadTasks(concert);
    }
  }, [concert]);

  const loadConcerts = async () => {
    try {
      const data = await concertApi.getConcerts();
      setConcerts(data);
      if (data.length > 0 && !concert) {
        const initialId = data[0].concert_id;
        setConcert(initialId);
        loadTasks(initialId);
      }
    } catch (err) {
      console.error('Failed to load concerts:', err);
    }
  };

  const loadTasks = async (concertId: string) => {
    try {
      const data = await concertApi.getTasks(concertId);
      // Only keep tasks that are not finished on the active frontend screen
      const pendingTasks = data.filter((t) => t.task_status !== 'เสร็จสิ้น');
      setTasks(pendingTasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const handleSave = async () => {
    if (!concert || !taskName.trim() || !dueDate || !responsiblePerson.trim() || !department) {
      alert("บันทึกไม่สำเร็จ ข้อมูลไม่ถูกต้อง หรือกรอกไม่ครบถ้วน");
      return;
    }

    try {
      setLoading(true);
      await concertApi.createTask(concert, {
        task_name: taskName.trim(),
        actual_finish_date: dueDate.format('YYYY-MM-DD'),
        owner_task: responsiblePerson.trim(),
        department: department,
        more_info: extraInfo.trim(),
      });
      alert("บันทึกข้อมูลสำเร็จ");
      handleCancel();
      // Reload tasks
      loadTasks(concert);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + (err.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async (taskId?: string) => {
    if (!taskId) return;

    try {
      // 1. Send update to database to set status to 'เสร็จสิ้น'
      await concertApi.updateTaskStatus(taskId, 'เสร็จสิ้น');

      // 2. Remove from active frontend display immediately
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));

      alert("บันทึกสถานะเสร็จสิ้นเรียบร้อย (อัปเดตสถานะในฐานข้อมูลแล้ว)");
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ: " + (err.message || err));
    }
  };

  const handleCancel = () => {
    setTaskName('');
    setDueDate(null);
    setResponsiblePerson('');
    setDepartment('');
    setExtraInfo('');
  };

  return (
    <Box sx={{ p: 4, fontFamily: "'Noto Sans Thai'" }}>
      <Typography sx={{ fontWeight: 'bold', color: '#1a237e', mb: 3, fontSize: '38px' }}>
        ผู้รับผิดชอบคอนเสิร์ต
      </Typography>

      {/* Input Form Paper */}
      <Paper sx={{ p: 4, borderRadius: 3, backgroundColor: '#e8f5e9' }}>
        <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
          {/* คอนเสิร์ต */}
          <Grid size={{ xs: 12, sm: 1.7 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              คอนเสิร์ต
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.8 }}>
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={concert}
                onChange={(e) => setConcert(e.target.value as string)}
                sx={{ bgcolor: 'white', borderRadius: 1, fontSize: '18px' }}
              >
                <MenuItem value="" disabled sx={{ fontSize: '24px' }}>โปรดระบุคอนเสิร์ต</MenuItem>
                {concerts.map((c) => (
                  <MenuItem key={c.concert_id} value={c.concert_id} sx={{ fontSize: '20px' }}>
                    {c.concert_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* ชื่อภารกิจย่อย */}
          <Grid size={{ xs: 12, sm: 1.7 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ชื่อภารกิจย่อย 
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.8 }}>
            <TextField
              fullWidth
              placeholder="โปรดระบุภารกิจย่อยที่ต้องทำ"
              variant="outlined"
              size="small"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>

          {/* วันที่ต้องแล้วเสร็จ */}
          <Grid size={{ xs: 12, sm: 1.7 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              วันที่ต้องแล้วเสร็จ
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.8 }}>
            <DatePicker
              format="DD/MM/YYYY"
              value={dueDate}
              onChange={(newValue) => setDueDate(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { bgcolor: 'white', borderRadius: 1 }
                }
              }}
            />
          </Grid>

          {/* ฝ่าย + ผู้รับผิดชอบ (same row) */}
          <Grid size={{ xs: 12, sm: 1.7 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ฝ่าย
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 3.4 }}>
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={department}
                onChange={(e) => setDepartment(e.target.value as string)}
                sx={{ bgcolor: 'white', borderRadius: 1, fontSize: '18px' }}
              >
                <MenuItem value="" disabled sx={{ fontSize: '20px' }}>โปรดระบุฝ่าย</MenuItem>
                <MenuItem value="ฝ่ายการตลาด" sx={{ fontSize: '20px' }}>ฝ่ายการตลาด</MenuItem>
                <MenuItem value="ฝ่ายผลิต" sx={{ fontSize: '20px' }}>ฝ่ายผลิต</MenuItem>
                <MenuItem value="ฝ่ายเอกสาร" sx={{ fontSize: '20px' }}>ฝ่ายเอกสาร</MenuItem>
                <MenuItem value="ฝ่าย Production" sx={{ fontSize: '20px' }}>ฝ่าย Production</MenuItem>
                <MenuItem value="ฝ่ายสถานที่" sx={{ fontSize: '20px' }}>ฝ่ายสถานที่</MenuItem>
                <MenuItem value="ฝ่ายเทคนิค" sx={{ fontSize: '20px' }}>ฝ่ายเทคนิค</MenuItem>
                <MenuItem value="ฝ่ายดูแลศิลปิน" sx={{ fontSize: '20px' }}>ฝ่ายดูแลศิลปิน</MenuItem>
                <MenuItem value="ฝ่าย Sell" sx={{ fontSize: '20px' }}>ฝ่าย Sell</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 1.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e', alignItems: 'center', fontSize: '22px', whiteSpace: 'nowrap' }}>
              ผู้รับผิดชอบ
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4.35 }}>
            <TextField
              fullWidth
              placeholder="โปรดระบุผู้รับผิดชอบ"
              variant="outlined"
              size="small"
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            />
          </Grid>

          {/* เพิ่มเติม */}
          <Grid size={{ xs: 12, sm: 1.7 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              เพิ่มเติม
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 9.8 }}>
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
            {loading ? 'กำลังบันทึก...' : 'บันทึกผู้รับผิดชอบ'}
          </Button>
        </Box>
      </Paper>

      {/* Tasks Table (styled similarly to EditConcert) */}
      <Box sx={{ mt: 4 }}>
        <Typography sx={{ fontWeight: 'bold', color: '#1a237e', mb: 2, fontSize: '26px' }}>
          รายการภารกิจที่กำลังดำเนินการ
        </Typography>

        <Paper sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: 2 }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#4caf50' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '8%', textAlign: 'center', fontSize: '20px' }}>
                    ลำดับ
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '28%', textAlign: 'center', fontSize: '20px' }}>
                    ชื่อภารกิจย่อย
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '18%', textAlign: 'center', fontSize: '20px' }}>
                    ฝ่าย
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '16%', textAlign: 'center', fontSize: '20px' }}>
                    ผู้รับผิดชอบ
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '15%', textAlign: 'center', fontSize: '20px' }}>
                    กำหนดแล้วเสร็จ
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '15%', textAlign: 'center', fontSize: '20px' }}>
                    เสร็จสิ้น
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ bgcolor: '#dcedc8' }}>
                {tasks.length > 0 ? (
                  tasks.map((task, index) => (
                    <TableRow
                      key={task.task_id || index}
                      sx={{
                        '&:nth-of-type(even)': { bgcolor: '#c5e1a5' },
                        '&:hover': { bgcolor: '#e0f2f1' }
                      }}
                    >
                      <TableCell sx={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                        {index + 1}
                      </TableCell>
                      <TableCell sx={{ fontSize: '18px' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '18px' }}>
                          {task.task_name}
                        </Typography>
                        {task.more_info && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
                            {task.more_info}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontSize: '18px' }}>
                        <Chip
                          label={task.department}
                          size="small"
                          sx={{ bgcolor: 'white', color: '#1a237e', fontWeight: 'bold', fontSize: '15px' }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontSize: '18px' }}>
                        {task.owner_task}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontSize: '18px' }}>
                        {task.actual_finish_date}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Tooltip title="กดติ๊กเพื่อบันทึกว่างานนี้เสร็จสิ้นแล้ว">
                          <Button
                            variant="contained"
                            size="small"
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleMarkCompleted(task.task_id)}
                            sx={{
                              bgcolor: '#2e7d32',
                              color: 'white',
                              fontWeight: 'bold',
                              borderRadius: 2,
                              fontSize: '16px',
                              px: 2,
                              py: 0.5,
                              '&:hover': { bgcolor: '#1b5e20' }
                            }}
                          >
                            เสร็จแล้ว
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary', fontSize: '18px' }}>
                      ไม่มีรายการภารกิจที่ค้างอยู่ หรือทุกภารกิจเสร็จสิ้นแล้ว
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
};

export default ResponsibilityPage;
