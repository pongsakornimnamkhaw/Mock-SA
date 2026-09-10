import { useEffect, useState } from 'react';
import type { ConcertItem } from './types/report';
import { reportApi } from './api/reportApi';
import { FinishedConcertList } from './components/compo_ConsertReport/FinishedConcertList';
import { ConcertDetailReport } from './components/compo_ConsertReport/ConcertDetailReport';
import { finishedConcertsData } from './data/concerts';
import './ConsertReportPage.css';
import { Box, Chip, InputAdornment, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export function ConsertReportPage() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedConcert, setSelectedConcert] = useState<ConcertItem | null>(null);
  const [concerts, setConcerts] = useState<ConcertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportApi.getConcerts()
      .then((items) => setConcerts(items.length > 0 ? items : finishedConcertsData))
      .catch(() => setConcerts(finishedConcertsData))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectConcert = (concert: ConcertItem) => {
    setSelectedConcert(concert);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setSelectedConcert(null);
  };

  return (
    <Box className="report-app-container-no-sidebar">
      {/* Main Content */}
      <Box component="main" className="report-main-panel-standalone">
        {loading ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>กำลังโหลดข้อมูลรายงาน...</Box>
        ) : selectedConcert ? (
          <ConcertDetailReport concert={selectedConcert} onBack={handleBackToList} />
        ) : (
          <>
            <Box sx={{ maxWidth: 980, mx: 'auto', mb: 4 }}>
              <TextField
                fullWidth
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ค้นหาชื่อคอนเสิร์ต วันที่ หรือสถานะ"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#777' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 3, minHeight: 56, fontSize: '18px' } }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Typography sx={{ fontWeight: 800, color: '#10163e', fontSize: { xs: '26px', md: '32px' } }}>
                รายการคอนเสิร์ตที่เสร็จสิ้นแล้ว
              </Typography>
              <Chip label={`${concerts.length} งาน`} sx={{ bgcolor: '#fce4ec', color: '#ad1457', fontSize: '16px', fontWeight: 700 }} />
            </Box>

            <FinishedConcertList
              concerts={concerts}
              searchTerm={searchTerm}
              onSelectConcert={handleSelectConcert}
            />
          </>
        )}
      </Box>
    </Box>
  );
}

export default ConsertReportPage;
