import React, { useState } from 'react';
import type { SponsorSubTab, AdRequestRow, TimelineStep } from '../../types/contact';
import { StatusTimeline } from '../../components/_frontend/StatusTimeline';
import banner1 from '../../assets/banner1.jpg';
import banner2 from '../../assets/banner2.jpg';
import Box from '@mui/material/Box';

interface SponsorFormProps {
  subTab: SponsorSubTab;
}

export const SponsorForm: React.FC<SponsorFormProps> = ({ subTab }) => {
  const [companyName, setCompanyName] = useState('');
  const [adRequests, setAdRequests] = useState<AdRequestRow[]>([
    { id: '1', type: 'ป้ายแขวนเสา', size: 'Size M: 70 x 300 ซม.', quantity: 1 },
  ]);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  const sponsorTimelineSteps: TimelineStep[] = [
    { id: 1, title: 'ส่งข้อมูลสำเร็จ', time: '15.32 น. 20/7/2025', status: 'completed' },
    { id: 2, title: 'กำลังตรวจสอบข้อมูล', time: '16.20 น. 20/7/2025', status: 'completed' },
    { id: 3, title: 'ตรวจสอบข้อมูลเสร็จสิ้น', time: '17.30 น. 20/7/2025', status: 'current' },
    { id: 4, title: 'รอเงินอนุมัติ', status: 'pending' },
    { id: 5, title: 'เสร็จสิ้น', status: 'pending' },
  ];

  const handleAddRow = () => {
    const newRow: AdRequestRow = {
      id: Date.now().toString(),
      type: 'โปสเตอร์ตั้งรอบ',
      size: 'Size A1: 59.4 x 84.1 ซม.',
      quantity: 1,
    };
    setAdRequests([...adRequests, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (adRequests.length > 1) {
      setAdRequests(adRequests.filter((r) => r.id !== id));
    }
  };

  const handleRowChange = (id: string, field: keyof AdRequestRow, value: any) => {
    setAdRequests(
      adRequests.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`ส่งคำขอลงโฆษณาสำหรับบริษัท "${companyName || 'ผู้ประกอบการ'}" เรียบร้อยแล้ว!`);
  };

  if (subTab === 'status') {
    return (
      <StatusTimeline
        title="สถานะคำขอลงโฆษณา"
        steps={sponsorTimelineSteps}
      />
    );
  }

  return (
    <Box component="section" className="panel-section active">
      <h1 className="section-heading" style={{ fontSize: '1.35rem', marginBottom: '24px', textAlign: 'left' }}>
        คำขอลงโฆษณา
      </h1>

      {/* Part 1: Rate Card / Banner Types Details */}
      <div className="rate-card-box">
        <h3 className="sub-title-badge">ชนิดป้ายโฆษณา</h3>
        <div className="rate-card-content">
          <div className="rate-card-item">
            <div className="rate-img-box">
              <img src={banner1} alt="ป้ายแขวนเสาและโปสเตอร์" />
            </div>
            <div className="rate-details">
              <h4>ป้ายแขวนเสา</h4>
              <p>Size S: 60 x 200 ซม. (สูงจากพื้น ~2.5 เมตร) <span>2,500 บาท/ป้าย</span></p>
              <p>Size M: 70 x 300 ซม. (สูงจากพื้น ~3.5 เมตร) <span>4,500 บาท/ป้าย</span></p>
              <p>Size L: 100 x 400 ซม. (สูงจากพื้น ~4.5 เมตร) <span>6,500 บาท/ป้าย</span></p>

              <h4 style={{ marginTop: '12px' }}>โปสเตอร์ตั้งรอบ</h4>
              <p>Size A1: 59.4 x 84.1 ซม. <span>2,500 บาท/ป้าย</span></p>
              <p>Size A0: 84.1 x 118.9 ซม. <span>4,500 บาท/ป้าย</span></p>
              <p>Size L: 100 x 150 ซม. <span>6,500 บาท/ป้าย</span></p>
            </div>
          </div>

          <div className="rate-card-item" style={{ marginTop: '20px' }}>
            <div className="rate-img-box">
              <img src={banner2} alt="สแตนดี้และป้ายไฟ" />
            </div>
            <div className="rate-details">
              <h4>สแตนดี้ตั้งพื้นกระจกโค้ง</h4>
              <p>Standard: 80 x 200 ซม. <span>15,500 บาท/ป้าย</span></p>
              <p>Wide: 100 x 200 ซม. หรือ 120 x 200 ซม. <span>35,500 บาท/ป้าย</span></p>

              <h4 style={{ marginTop: '12px' }}>ป้ายไฟกล่องสี่เหลี่ยมติดผนังพร้อมสปอตไลท์</h4>
              <p>Size M: 90 x 120 ซม. <span>20,000 บาท/ป้าย</span></p>
              <p>Size L: 120 x 180 ซม. <span>30,000 บาท/ป้าย</span></p>
              <p>Size XL: 150 x 200 ซม. <span>50,000 บาท/ป้าย</span></p>

              <h4 style={{ marginTop: '12px' }}>ป้ายไฟตั้งพื้นแบบกล่อง</h4>
              <p>Medium Stand: 60 x 120 ซม. (สูงจากพื้น ~150 ซม.) <span>30,000 บาท/ป้าย</span></p>
              <p>Standard Stand: 80 x 160 ซม. (สูงจากพื้น ~180 ซม.) <span>45,000 บาท/ป้าย</span></p>
              <p>Large Stand: 100 x 200 ซม. (สูงจากพื้น ~220 ซม.) <span>65,000 บาท/ป้าย</span></p>
            </div>
          </div>
        </div>
      </div>

      <hr className="divider" style={{ margin: '32px 0' }} />

      {/* Part 2: Form submission */}
      <form onSubmit={handleSubmit} className="ad-request-form">
        {/* Company Name */}
        <div className="form-row-inline" style={{ marginBottom: '20px' }}>
          <label className="inline-label">ชื่อบริษัท :</label>
          <input
            type="text"
            className="form-input"
            style={{ maxWidth: '420px' }}
            placeholder="ภาษาไทย (ภาษาอังกฤษ)..."
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>

        {/* Ad Requests List */}
        <div className="ad-section-box">
          <label className="inline-label" style={{ marginBottom: '12px', display: 'block' }}>
            รายละเอียดโฆษณา :
          </label>

          {adRequests.map((row) => (
            <div key={row.id} className="ad-request-row">
              <div className="form-group-sm">
                <label>เลือกชนิดป้าย :</label>
                <select
                  className="form-select-sm"
                  value={row.type}
                  onChange={(e) => handleRowChange(row.id, 'type', e.target.value)}
                >
                  <option>ป้ายแขวนเสา</option>
                  <option>โปสเตอร์ตั้งรอบ</option>
                  <option>สแตนดี้ตั้งพื้นกระจกโค้ง</option>
                  <option>ป้ายไฟกล่องสี่เหลี่ยมติดผนังพร้อมสปอตไลท์</option>
                  <option>ป้ายไฟตั้งพื้นแบบกล่อง</option>
                </select>
              </div>

              <div className="form-group-sm">
                <label>ขนาดป้าย :</label>
                <select
                  className="form-select-sm"
                  value={row.size}
                  onChange={(e) => handleRowChange(row.id, 'size', e.target.value)}
                >
                  <option>Size S: 60 x 200 ซม.</option>
                  <option>Size M: 70 x 300 ซม.</option>
                  <option>Size L: 100 x 400 ซม.</option>
                  <option>Size A1: 59.4 x 84.1 ซม.</option>
                  <option>Size A0: 84.1 x 118.9 ซม.</option>
                  <option>Standard: 80 x 200 ซม.</option>
                  <option>Size XL: 150 x 200 ซม.</option>
                </select>
              </div>

              <div className="form-group-sm">
                <label>จำนวนป้าย :</label>
                <input
                  type="number"
                  min="1"
                  className="form-input-sm"
                  style={{ width: '80px' }}
                  value={row.quantity}
                  onChange={(e) =>
                    handleRowChange(row.id, 'quantity', parseInt(e.target.value) || 1)
                  }
                />
              </div>

              {adRequests.length > 1 && (
                <button
                  type="button"
                  className="btn-remove-row"
                  onClick={() => handleRemoveRow(row.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button type="button" className="btn-add-more" onClick={handleAddRow}>
            Add +
          </button>
        </div>

        {/* Upload Logo File */}
        <div className="upload-box-wrapper" style={{ marginTop: '24px' }}>
          <label className="inline-label">โลโก้บริษัท :</label>
          <div className="file-drop-zone">
            <input
              type="file"
              id="logo-upload"
              accept=".pdf,.docx,.csv,.xlsx,image/*"
              style={{ display: 'none' }}
              onChange={(e) => setLogoFile(e.target.files ? e.target.files[0] : null)}
            />
            <label htmlFor="logo-upload" className="drop-zone-content">
              <svg className="upload-cloud-icon" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
              </svg>
              <p>เฉพาะไฟล์ .pdf, .docx, .csv และ .xlsx เท่านั้น และขนาดไม่เกิน 1 GB</p>
              {logoFile && <span className="file-selected-name">เลือกไฟล์แล้ว: {logoFile.name}</span>}
            </label>
          </div>
        </div>

        {/* Upload Agreement File */}
        <div className="upload-box-wrapper" style={{ marginTop: '24px' }}>
          <label className="inline-label">เอกสารข้อตกลง :</label>
          <div className="file-drop-zone">
            <input
              type="file"
              id="doc-upload"
              accept=".pdf,.docx,.csv,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
            />
            <label htmlFor="doc-upload" className="drop-zone-content">
              <svg className="upload-cloud-icon" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
              </svg>
              <p>เฉพาะไฟล์ .pdf, .docx, .csv และ .xlsx เท่านั้น และขนาดไม่เกิน 1 GB</p>
              {docFile && <span className="file-selected-name">เลือกไฟล์แล้ว: {docFile.name}</span>}
            </label>
          </div>
        </div>

        {/* Part 3: Confirm Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '36px' }}>
          <button type="submit" className="btn-confirm">
            ยืนยัน
          </button>
        </div>
      </form>
    </Box>
  );
};
