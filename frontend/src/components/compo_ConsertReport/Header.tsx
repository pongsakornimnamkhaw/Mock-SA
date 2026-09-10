import React from 'react';
import Box from '@mui/material/Box';
import NotificationBell from '../Notification/NotificationBell';

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedConcertId: string | null;
  onBackClick: () => void;
  concertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchTerm,
  onSearchChange,
  selectedConcertId,
  onBackClick,
  concertCount,
}) => {
  return (
    <Box component="header" className="report-header">
      <Box className="header-left">
        {selectedConcertId && (
          <button type="button" className="btn-back-pill" onClick={onBackClick}>
            ← ย้อนกลับ
          </button>
        )}

        <div className="page-heading-group">
          <h1 className="header-page-title">รายการคอนเสิร์ต</h1>
          <span className="total-badge-pill">
            <span className="red-dot"></span>
            คอนเสิร์ตทั้งหมด <strong>{concertCount} งาน</strong>
          </span>
        </div>
      </Box>

      <Box className="header-right">
        {/* Search Bar */}
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="ค้นหาคอนเสิร์ต"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <NotificationBell />

        {/* User Profile Avatar */}
        <div className="user-profile-avatar">
          <div className="avatar-circle">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        </div>
      </Box>
    </Box>
  );
};
