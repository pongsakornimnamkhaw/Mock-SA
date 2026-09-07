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
import { Dayjs } from 'dayjs';
import { concertApi, ConcertData, HistoryItem } from '@/api/concertApi';

const columns: GridColDef[] = [
  { field: 'seq', headerName: 'ลำดับ', width: 100, align: 'center', headerAlign: 'center' },
  { field: 'date', headerName: 'วันที่', width: 160 },
  { field: 'time', headerName: 'เวลา', width: 140 },
  { field: 'detail', headerName: 'รายละเอียดการแก้ไข', flex: 1, minWidth: 350 },
  { field: 'author', headerName: 'ผู้แก้ไข', width: 180 },
];

const EditHistoryPage = () => {
  const [concerts, setConcerts] = useState<ConcertData[]>([]);
  const [selectedConcert, setSelectedConcert] = useState('');
  const [filterDate, setFilterDate] = useState<Dayjs | null>(null);
  const [rows, setRows] = useState<GridRowsProp>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConcertsAndHistory();
  }, []);

  const loadConcertsAndHistory = async () => {
    try {
      const concertList = await concertApi.getConcerts();
      setConcerts(concertList);
      let initialConcertId = '';
      if (concertList.length > 0) {
        initialConcertId = concertList[0].concert_id;
        setSelectedConcert(initialConcertId);
      }
      fetchHistoryData(initialConcertId, null);
    } catch (err) {
      console.error('Failed to load concerts or history:', err);
    }
  };

  const fetchHistoryData = async (concertId: string, date: Dayjs | null) => {
    try {
      setLoading(true);
      const dateParam = date ? date.format('YYYY-MM-DD') : undefined;
      const historyList = await concertApi.getHistory(concertId || undefined, dateParam);

      const mappedRows = historyList.map((item: HistoryItem, idx: number) => ({
        id: item.id || `hist-${idx}`,
        seq: idx + 1,
        date: item.date,
        time: item.time,
        detail: item.detail,
        author: item.author || 'นภัส',
      }));

      setRows(mappedRows);
    } catch (err) {
      console.error('Failed to fetch history data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchHistoryData(selectedConcert, filterDate);
  };

  return (
    <Box sx={{ p: 4, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography sx={{ fontSize: '38px', fontWeight: 'bold', color: '#1a237e' }}>
        ประวัติการแก้ไข 
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
                onChange={(e) => setSelectedConcert(e.target.value as string)}
                sx={{ bgcolor: 'white', borderRadius: 1, fontSize: '18px' }}
              >
                <MenuItem value="">ทั้งหมด</MenuItem>
                {concerts.map((c) => (
                  <MenuItem key={c.concert_id} value={c.concert_id} sx={{ fontSize: '20px' }}>
                    {c.concert_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              sx={{ bgcolor: '#1a237e', '&:hover': { bgcolor: '#000051' }, borderRadius: 1, px: 4, fontSize: '20px' }}
            >
              {loading ? 'ค้นหา...' : 'ค้นหา'}
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}></Grid>

          <Grid size={{ xs: 12, sm: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' , color: '#1a237e', alignItems: 'center', fontSize: '22px',}}>
              วัน/เดือน/ปี
              <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4.5 }}>
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

      {/* Editable DataGrid Section */}
      <Paper sx={{ p: 3, bgcolor: '#e8f5e9', borderRadius: 3, flexGrow: 1 }}>
        <Box sx={{ height: 420, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pageSizeOptions={[5, 10]}
            initialState={{
              pagination: { paginationModel: { pageSize: 5 } },
            }}
            sx={{
              bgcolor: 'white',
              borderRadius: 2,
              fontSize: '22px',
              '& .MuiDataGrid-columnHeaders': {
                bgcolor: '#4caf50',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '22px'
              },
              '& .MuiDataGrid-columnHeader': {
                bgcolor: '#4caf50',
                color: 'white',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 'bold',
                fontSize: '22px'
              },
              '& .MuiDataGrid-cell': {
                fontSize: '20px'
              }
            }}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default EditHistoryPage;
