import React from 'react';
import type { ConcertItem } from '../../types/report';

interface ConcertCardProps {
  concert: ConcertItem;
  onSelect: (concert: ConcertItem) => void;
}

export const ConcertCard: React.FC<ConcertCardProps> = ({ concert, onSelect }) => {
  const isChecking = concert.status === 'กำลังตรวจสอบข้อมูล';

  return (
    <div className="concert-card-item">
      {/* Poster Image */}
      <div className="concert-poster-wrapper">
        <img src={concert.poster} alt={concert.title} className="concert-poster-img" />
      </div>

      {/* Main Details */}
      <div className="concert-info-content">
        <h2 className="concert-title">
          ชื่องาน: <span>{concert.title}</span>
        </h2>

        <div className="info-line">
          <span className="info-label">วันที่จัด:</span>
          <span className="info-val font-semibold">{concert.date}</span>
        </div>

        <div className="info-line">
          <span className="info-label">รายได้ทั้งหมด:</span>
          <span className="info-val font-bold">{concert.revenue}</span>
        </div>

        <div className="info-line">
          <span className="info-label">จำนวนบัตรที่ขายได้:</span>
          <span className="info-val font-semibold">{concert.ticketsSold}</span>
        </div>

        {concert.location && (
          <div className="info-line location-line">
            <svg className="location-pin" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>{concert.location}</span>
          </div>
        )}
      </div>

      {/* Status Column */}
      <div className="concert-status-side">
        <div className="status-header-row">
          <span className="status-label">Status:</span>
          <span className={`status-badge-text ${isChecking ? 'checking' : 'completed'}`}>
            {concert.status}
          </span>
        </div>

        <div className="status-timestamp">
          • อัปเดตล่าสุด {concert.lastUpdate}
        </div>

        <button type="button" className="btn-detail-link" onClick={() => onSelect(concert)}>
          รายละเอียด &gt;
        </button>
      </div>
    </div>
  );
};
