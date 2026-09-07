import React, { useState, useRef } from 'react';
import type { TicketingSubTab } from '../../types/contact';
import Box from '@mui/material/Box';

interface TicketingSupportProps {
  subTab?: TicketingSubTab;
}

export const TicketingSupport: React.FC<TicketingSupportProps> = ({ subTab = 'request' }) => {
  // Form 1: คำขอนำไปจำหน่าย (Request) State
  const [concertName, setConcertName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [seatZone, setSeatZone] = useState('โซน A');
  const [seatCount, setSeatCount] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);

  // Form 2: สรุปผลการจำหน่าย (Summary) State
  const [priceTier1, setPriceTier1] = useState('0.00');
  const [salesCount1, setSalesCount1] = useState('0');
  const [priceTier2, setPriceTier2] = useState('0.00');
  const [salesCount2, setSalesCount2] = useState('0');
  const [totalSold, setTotalSold] = useState('');
  const [totalRemaining, setTotalRemaining] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setContractFile(e.target.files[0]);
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concertName.trim()) {
      alert('กรุณากรอกชื่องานคอนเสิร์ต');
      return;
    }
    alert(`ยืนยันคำขอนำไปจำหน่ายสำหรับงาน "${concertName}" เรียบร้อยแล้ว`);
  };

  const handleSummarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('ยืนยันสรุปผลการจำหน่ายเรียบร้อยแล้ว');
  };

  const handleSales1Change = (val: string) => {
    setSalesCount1(val);
    const count1 = parseInt(val || '0', 10) || 0;
    const count2 = parseInt(salesCount2 || '0', 10) || 0;
    setTotalSold((count1 + count2).toString());
  };

  const handleSales2Change = (val: string) => {
    setSalesCount2(val);
    const count1 = parseInt(salesCount1 || '0', 10) || 0;
    const count2 = parseInt(val || '0', 10) || 0;
    setTotalSold((count1 + count2).toString());
  };

  if (subTab === 'summary') {
    return (
      <Box component="section" className="panel-section active ticketing-container">
        {/* Top Header */}
        <div className="ticketing-header">
          <h1 className="ticketing-title">สรุปผลการจำหน่าย</h1>
          <button type="button" className="btn-confirm-pill" onClick={handleSummarySubmit}>
            ยืนยัน
          </button>
        </div>

        <hr className="ticketing-divider" />

        {/* Form 2: สรุปผลการจำหน่าย */}
        <form onSubmit={handleSummarySubmit} className="ticketing-form-content">
          {/* Row 1 */}
          <div className="ticketing-grid-row">
            <div className="ticketing-field-group">
              <label className="ticketing-label">ราคาบัตร</label>
              <div className="ticketing-input-wrapper">
                <input
                  type="text"
                  className="ticketing-input"
                  value={priceTier1}
                  onChange={(e) => setPriceTier1(e.target.value)}
                  placeholder="0.00"
                />
                <span className="ticketing-unit">บาท</span>
              </div>
            </div>

            <div className="ticketing-field-group">
              <label className="ticketing-label">ยอดจำหน่ายบัตร</label>
              <div className="ticketing-input-wrapper">
                <input
                  type="text"
                  className="ticketing-input"
                  value={salesCount1}
                  onChange={(e) => handleSales1Change(e.target.value)}
                  placeholder="0"
                />
                <span className="ticketing-unit">ใบ</span>
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="ticketing-grid-row">
            <div className="ticketing-field-group">
              <label className="ticketing-label">ราคาบัตร</label>
              <div className="ticketing-input-wrapper">
                <input
                  type="text"
                  className="ticketing-input"
                  value={priceTier2}
                  onChange={(e) => setPriceTier2(e.target.value)}
                  placeholder="0.00"
                />
                <span className="ticketing-unit">บาท</span>
              </div>
            </div>

            <div className="ticketing-field-group">
              <label className="ticketing-label">ยอดจำหน่ายบัตร</label>
              <div className="ticketing-input-wrapper">
                <input
                  type="text"
                  className="ticketing-input"
                  value={salesCount2}
                  onChange={(e) => handleSales2Change(e.target.value)}
                  placeholder="0"
                />
                <span className="ticketing-unit">ใบ</span>
              </div>
            </div>
          </div>

          {/* Row 3 */}
          <div className="ticketing-grid-row" style={{ marginTop: '24px' }}>
            <div className="ticketing-field-group">
              <label className="ticketing-label">จำนวนบัตรที่ขายได้</label>
              <div className="ticketing-input-wrapper">
                <input
                  type="text"
                  className="ticketing-input"
                  value={totalSold}
                  onChange={(e) => setTotalSold(e.target.value)}
                  placeholder=""
                />
                <span className="ticketing-unit">ใบ</span>
              </div>
            </div>

            <div className="ticketing-field-group">
              <label className="ticketing-label">จำนวนบัตรที่เหลือ</label>
              <div className="ticketing-input-wrapper">
                <input
                  type="text"
                  className="ticketing-input"
                  value={totalRemaining}
                  onChange={(e) => setTotalRemaining(e.target.value)}
                  placeholder=""
                />
                <span className="ticketing-unit">ใบ</span>
              </div>
            </div>
          </div>
        </form>
      </Box>
    );
  }

  // SubTab === 'request' (คำขอนำไปจำหน่าย)
  return (
    <Box component="section" className="panel-section active ticketing-container">
      {/* Top Header */}
      <div className="ticketing-header">
        <h1 className="ticketing-title">คำขอนำไปจำหน่าย</h1>
        <button type="button" className="btn-confirm-pill" onClick={handleRequestSubmit}>
          ยืนยัน
        </button>
      </div>

      <hr className="ticketing-divider" />

      {/* Form 1: คำขอนำไปจำหน่าย */}
      <form onSubmit={handleRequestSubmit} className="ticketing-form-content">
        {/* Row 1: ชื่องานคอนเสิร์ต */}
        <div className="ticketing-field-group full-width">
          <label className="ticketing-label">ชื่องานคอนเสิร์ต</label>
          <input
            type="text"
            className="ticketing-input concert-input"
            value={concertName}
            onChange={(e) => setConcertName(e.target.value)}
            placeholder="ระบุชื่องาน..."
          />
        </div>

        {/* Row 2: วัน/เดือน/ปี & เวลา */}
        <div className="ticketing-grid-row">
          <div className="ticketing-field-group">
            <label className="ticketing-label">วัน/เดือน/ปี</label>
            <div className="ticketing-input-wrapper icon-right">
              <input
                type="text"
                className="ticketing-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="00/00/00"
              />
              <svg
                className="calendar-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>

          <div className="ticketing-field-group">
            <label className="ticketing-label">เวลา</label>
            <input
              type="text"
              className="ticketing-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="00.00"
            />
          </div>
        </div>

        {/* Row 3: เลือกโซนที่นั่ง & กรอกจำนวนที่นั่ง */}
        <div className="ticketing-grid-row">
          <div className="ticketing-field-group">
            <label className="ticketing-label">เลือกโซนที่นั่ง</label>
            <select
              className="ticketing-select"
              value={seatZone}
              onChange={(e) => setSeatZone(e.target.value)}
            >
              <option value="โซน A">โซน A</option>
              <option value="โซน B">โซน B</option>
              <option value="โซน C">โซน C</option>
              <option value="โซน VIP">โซน VIP</option>
            </select>
          </div>

          <div className="ticketing-field-group">
            <label className="ticketing-label">กรอกจำนวนที่นั่ง</label>
            <input
              type="text"
              className="ticketing-input"
              value={seatCount}
              onChange={(e) => setSeatCount(e.target.value)}
              placeholder="00..."
            />
          </div>
        </div>

        {/* Row 4: หนังสือสัญญา : */}
        <div className="ticketing-field-group full-width upload-section" style={{ marginTop: '16px' }}>
          <label className="ticketing-label" style={{ marginBottom: '8px' }}>
            หนังสือสัญญา :
          </label>

          <div className="contract-upload-box" onClick={() => fileInputRef.current?.click()}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.csv,.xlsx"
              style={{ display: 'none' }}
            />
            <div className="upload-box-content">
              <p className="upload-file-types">
                เฉพาะไฟล์ .pdf , .docx , .csv และ .xlsx เท่านั้น และขนาดไฟล์ไม่เกิน 1 GB
              </p>
              {contractFile ? (
                <div className="selected-file-badge">
                  📄 {contractFile.name} ({(contractFile.size / (1024 * 1024)).toFixed(1)} MB)
                </div>
              ) : (
                <div className="upload-icon-wrapper">
                  <svg
                    width="44"
                    height="44"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="M12 12v9" />
                    <path d="m8 17 4 4 4-4" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Box>
  );
};

