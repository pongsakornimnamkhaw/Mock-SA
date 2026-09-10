import React from 'react';
import type { ConcertItem, SponsorItem, AdPackage, ZoneSummary, SponsorSummary } from '../../types/report';
import { ConcertCard } from './ConcertCard';

interface ConcertDetailReportProps {
  concert: ConcertItem;
  onBack: () => void;
}

export const ConcertDetailReport: React.FC<ConcertDetailReportProps> = ({ concert }) => {
  return (
    <div className="concert-detail-report-view">
      {/* Top Overview Card */}
      <ConcertCard concert={concert} onSelect={() => {}} />

      {/* Section 1: ผู้สนับสนุน & สัญญา */}
      {concert.sponsors && concert.sponsors.length > 0 && (
        <div className="sponsors-section-box">
          {concert.sponsors.map((sponsor: SponsorItem, index: number) => (
            <div key={index} className="sponsor-detail-card">
              <h3 className="sponsor-header-name">
                ผู้สนับสนุน: <span>{sponsor.companyName}</span>
              </h3>

              <div className="sponsor-card-grid">
                {/* Package Table */}
                <div className="package-table-wrapper">
                  <div className="table-title">แพ็คเกจที่ร่วมรายการ</div>
                  <table className="package-table">
                    <thead>
                      <tr>
                        <th>ชนิดป้าย</th>
                        <th>ขนาดป้าย</th>
                        <th>จำนวนป้าย</th>
                        <th>ราคา(บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sponsor.packages.map((pkg: AdPackage, pIdx: number) => (
                        <tr key={pIdx}>
                          <td>{pkg.adType}</td>
                          <td>{pkg.size}</td>
                          <td>{pkg.count}</td>
                          <td>{pkg.price.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Brand Logo Box */}
                <div className="sponsor-brand-box">
                  <div className="brand-title-label">เครื่องหมายการค้า</div>
                  <div
                    className="brand-logo-circle"
                    style={{ backgroundColor: sponsor.logoBgColor || '#0284c7' }}
                  >
                    <svg className="brand-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span className="brand-logo-text">{sponsor.companyName}</span>
                  </div>
                </div>

                {/* Contract Document Card */}
                <div className="contract-file-box">
                  <div className="contract-title-label">เอกสารสัญญา</div>
                  <div
                    className="pdf-document-card"
                    onClick={() => alert(`กำลังเปิดไฟล์เอกสาร ${sponsor.contractFileName}`)}
                  >
                    <div className="pdf-icon-box">
                      <svg viewBox="0 0 24 24" fill="#ef4444">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                      </svg>
                    </div>
                    <span className="pdf-filename">{sponsor.contractFileName}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section 2: แผนผังที่นั่ง & สรุปยอดขาย */}
      <div className="seating-report-box">
        <h3 className="seating-section-title">แผนผังที่นั่ง</h3>

        <div className="seating-layout-container">
          {/* Main Stage & Grid */}
          <div className="seating-stage-wrapper">
            <div className="stage-banner-bar">State</div>

            <div className="seats-grid-layout">
              {/* Row 1: Red Zones (A1, A2) */}
              <div className="seats-row zone-row-red">
                <div className="seat-block red-block">A1</div>
                <div className="seat-block red-block">A2</div>
              </div>

              {/* Row 2: Green Zones (B1, B2, B3, B4) */}
              <div className="seats-row zone-row-green">
                <div className="seat-block green-block">B1</div>
                <div className="seat-block green-block">B2</div>
                <div className="seat-block green-block">B3</div>
                <div className="seat-block green-block">B4</div>
              </div>

              {/* Row 3: Yellow Zones (C1, C2, C3, C4) */}
              <div className="seats-row zone-row-yellow">
                <div className="seat-block yellow-block">C1</div>
                <div className="seat-block yellow-block">C2</div>
                <div className="seat-block yellow-block">C3</div>
                <div className="seat-block yellow-block">C4</div>
              </div>
            </div>
          </div>

          {/* Legend Column */}
          <div className="seating-legend-column">
            <div className="legend-row-item">
              <div className="legend-color-pill red-pill">1,000 ที่นั่ง</div>
              <div className="legend-price-text">2,000 บ.</div>
            </div>
            <div className="legend-row-item">
              <div className="legend-color-pill green-pill">2,000 ที่นั่ง</div>
              <div className="legend-price-text">1,500 บ.</div>
            </div>
            <div className="legend-row-item">
              <div className="legend-color-pill yellow-pill">2,000 ที่นั่ง</div>
              <div className="legend-price-text">1,000 บ.</div>
            </div>
          </div>
        </div>

        {/* Section 3: Summary Cards (Ticket Sales & Sponsors) */}
        <div className="summary-cards-grid">
          {/* Card 1: รวมยอดขายบัตร */}
          <div className="summary-card card-ticket-green">
            <h4 className="summary-card-title">รวมยอดขายบัตร</h4>
            <div className="summary-rows-list">
              {concert.seatingSummary && concert.seatingSummary.length > 0 ? (
                concert.seatingSummary.map((item: ZoneSummary, idx: number) => (
                  <div key={idx} className="summary-data-row">
                    <span className="row-zone-name font-bold">{item.zone}</span>
                    <span className="row-seats-count">{item.seatsSold}</span>
                    <span className="row-revenue-val font-bold">{item.revenue}</span>
                  </div>
                ))
              ) : (
                <div className="summary-data-row">
                  <span>ไม่มีข้อมูล</span>
                </div>
              )}
            </div>
            <hr className="summary-card-divider" />
            <div className="summary-card-total">
              <span>รวมทั้งหมด</span>
              <strong>{concert.totalTicketRevenue || concert.revenue}</strong>
            </div>
          </div>

          {/* Card 2: รวมยอดผู้สนับสนุน */}
          <div className="summary-card card-sponsor-pink">
            <h4 className="summary-card-title">รวมยอดผู้สนับสนุน</h4>
            <div className="summary-rows-list">
              {concert.sponsorSummary && concert.sponsorSummary.length > 0 ? (
                concert.sponsorSummary.map((item: SponsorSummary, idx: number) => (
                  <div key={idx} className="summary-data-row">
                    <span className="row-sponsor-name font-bold">{item.name}</span>
                    <span className="row-sponsor-amount font-bold">{item.amount}</span>
                  </div>
                ))
              ) : (
                <div className="summary-data-row">
                  <span>ไม่มีข้อมูลผู้สนับสนุน</span>
                </div>
              )}
            </div>
            <hr className="summary-card-divider" />
            <div className="summary-card-total">
              <span>รวมทั้งหมด</span>
              <strong>{concert.totalSponsorRevenue || '0 บาท'}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
