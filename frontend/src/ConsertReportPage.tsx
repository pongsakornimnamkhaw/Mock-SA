import { useEffect, useState } from 'react';
import type { ConcertItem } from './types/report';
import { reportApi } from './api/reportApi';
import { Header } from './components/compo_ConsertReport/Header';
import { FinishedConcertList } from './components/compo_ConsertReport/FinishedConcertList';
import { ConcertDetailReport } from './components/compo_ConsertReport/ConcertDetailReport';
import './ConsertReportPage.css';
import { Box, Typography } from '@mui/material';

export function ConsertReportPage() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedConcert, setSelectedConcert] = useState<ConcertItem | null>(null);
  const [concerts, setConcerts] = useState<ConcertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportApi.getConcerts()
      .then(setConcerts)
      .catch((err: Error) => setError(err.message))
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
      {/* Header */}
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedConcertId={selectedConcert ? selectedConcert.id : null}
        onBackClick={handleBackToList}
      />

      {/* Main Content */}
      <Box component="main" className="report-main-panel-standalone">
        {loading ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>กำลังโหลดข้อมูลรายงาน...</Box>
        ) : error ? (
          <Box sx={{ p: 5, textAlign: 'center', color: 'error.main' }}>{error}</Box>
        ) : selectedConcert ? (
          <ConcertDetailReport concert={selectedConcert} onBack={handleBackToList} />
        ) : (
          <FinishedConcertList
            concerts={concerts}
            searchTerm={searchTerm}
            onSelectConcert={handleSelectConcert}
          />
        )}
      </Box>

      {/* Footer */}
      <Box component="footer" className="report-footer">
        <Typography>© 2026 Octavia Co., Ltd. All rights reserved. | ระบบสรุปรายงานหลังจบคอนเสิร์ต (B6733377 ภูริชญา จันทร)</Typography>
      </Box>
    </Box>
  );
}

export default ConsertReportPage;
