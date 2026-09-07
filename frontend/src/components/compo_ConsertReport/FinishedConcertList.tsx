import React from 'react';
import type { ConcertItem } from '../../types/report';
import { ConcertCard } from './ConcertCard';

interface FinishedConcertListProps {
  concerts: ConcertItem[];
  searchTerm: string;
  onSelectConcert: (concert: ConcertItem) => void;
}

export const FinishedConcertList: React.FC<FinishedConcertListProps> = ({
  concerts,
  searchTerm,
  onSelectConcert,
}) => {
  const filteredConcerts = concerts.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.date.includes(searchTerm) ||
    c.status.includes(searchTerm)
  );

  return (
    <div className="finished-concerts-list-view">
      {filteredConcerts.length === 0 ? (
        <div className="no-data-box">
          <p>ไม่พบรายการคอนเสิร์ตที่ค้นหา "{searchTerm}"</p>
        </div>
      ) : (
        filteredConcerts.map((concert) => (
          <ConcertCard key={concert.id} concert={concert} onSelect={onSelectConcert} />
        ))
      )}
    </div>
  );
};
