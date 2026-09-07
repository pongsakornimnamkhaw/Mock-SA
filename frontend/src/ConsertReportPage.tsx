import { useState } from 'react';
import type { ConcertItem } from './types/report';
import { finishedConcertsData } from './data/concerts';
import { Header } from './components/compo_ConsertReport/Header';
import { FinishedConcertList } from './components/compo_ConsertReport/FinishedConcertList';
import { ConcertDetailReport } from './components/compo_ConsertReport/ConcertDetailReport';
import './ConsertReportPage.css';
import { Box, Typography } from '@mui/material';

export function ConsertReportPage() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedConcert, setSelectedConcert] = useState<ConcertItem | null>(null);

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
        {selectedConcert ? (
          <ConcertDetailReport concert={selectedConcert} onBack={handleBackToList} />
        ) : (
          <FinishedConcertList
            concerts={finishedConcertsData}
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
