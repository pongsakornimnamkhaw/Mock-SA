import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  Button,
  FormControl,
  Grid,
  Paper,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRowsProp } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Dayjs } from 'dayjs';
import { concertApi, ConcertData } from '@/api/concertApi';
import { artistApi } from '@/api/artistApi';

const initialRows: GridRowsProp = [];

const columns: GridColDef[] = [
  { field: 'seq', headerName: 'ลำดับ', width: 100, align: 'center', headerAlign: 'center', editable: false },
  { field: 'date', headerName: 'วันที่', width: 160, editable: false },
  { field: 'time', headerName: 'เวลา', width: 140, editable: false },
  { field: 'detail', headerName: 'รายละเอียดการแก้ไข', flex: 1, minWidth: 300, editable: false },
  { field: 'author', headerName: 'ผู้แก้ไข', width: 180, editable: false },
];

const ArtistEditHistoryPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [selectedConcert, setSelectedConcert] = useState('');
  const [filterDate, setFilterDate] = useState<Dayjs | null>(null);
  const [rows, setRows] = useState<GridRowsProp>(initialRows);

  useEffect(() => {
    loadConcerts();
  }, []);

  const handleSearch = async () => {
    if (!selectedConcert) { alert('กรุณาเลือกคอนเสิร์ต'); return; }
    try {
      const items: any = await artistApi.getHistory(selectedConcert, filterDate?.format('YYYY-MM-DD') || '');
      setRows(items.map((item: any, index: number) => ({ id: item.history_id, seq: index + 1, date: new Date(item.created_at).toLocaleDateString('th-TH'), time: new Date(item.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), detail: item.description, author: 'ระบบ' })));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ค้นหาประวัติไม่สำเร็จ');
    }
  };

  const loadConcerts = async () => {
    try {
      const list = await concertApi.getConcerts();
      setConcerts(list);
      if (list.length > 0 && !selectedConcert) {
        setSelectedConcert(list[0].concert_id);
      }
    } catch (err) {
      console.error('Failed to load concerts:', err);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 4, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Page Title */}
        <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e' }}>
          ประวัติการแก้ไข (ศิลปิน)
        </Typography>

        {/* Search Section */}
        <Paper sx={{ p: 3, bgcolor: '#fce4ec', borderRadius: 3 }}>
          <Grid container spacing={2.5} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              ชื่อคอนเสิร์ต
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4.5 }}>
              <FormControl fullWidth size="small">
                <Select
                  displayEmpty
                  value={selectedConcert}
                  onChange={(e) => setSelectedConcert(e.target.value)}
                  sx={{ bgcolor: 'white', borderRadius: 1, fontSize: '24px' }}
                >
                  <MenuItem value="" disabled sx={{ fontSize: '24px' }}>โปรดระบุคอนเสิร์ต</MenuItem>
                  {concerts.map((c) => (
                    <MenuItem key={c.concert_id} value={c.concert_id} sx={{ fontSize: '24px' }}>
                      {c.concert_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <Button variant="contained" onClick={handleSearch} sx={{ bgcolor: '#1a237e', '&:hover': { bgcolor: '#000051' }, borderRadius: 1, px: 4, fontSize: '20px' }}>
                ค้นหา
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}></Grid>

            <Grid size={{ xs: 12, sm: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              วัน/เดือน/ปี
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <DatePicker
                format="DD/MM/YYYY"
                value={filterDate}
                onChange={(newValue) => setFilterDate(newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    sx: { bgcolor: 'white', borderRadius: 1 }
                  }
                }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Read-only history table */}
        <Paper sx={{ p: 3, bgcolor: '#e8f5e9', borderRadius: 3, flexGrow: 1 }}>
          <Box sx={{ height: 420, width: '100%' }}>
            <DataGrid
              rows={rows}
              columns={columns}
              isCellEditable={() => false}
              disableRowSelectionOnClick
              pageSizeOptions={[5, 10]}
              initialState={{
                pagination: { paginationModel: { pageSize: 5 } },
              }}
              sx={{
                bgcolor: 'white',
                borderRadius: 2,
                fontSize: '24px',
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: '#4caf50',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '24px'
                },
                '& .MuiDataGrid-columnHeader': {
                  bgcolor: '#4caf50',
                  color: 'white',
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 'bold',
                  fontSize: '24px'
                },
                '& .MuiDataGrid-cell': {
                  fontSize: '24px'
                },
              }}
            />
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default ArtistEditHistoryPage;
