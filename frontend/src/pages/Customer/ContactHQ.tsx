import React, { useState } from 'react';
import mapImg from '../../assets/map.jpg';
import { Box, Button, Divider, Link, Typography } from '@mui/material';

export const ContactHQ: React.FC = () => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopy = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <Box component="section" className="panel-section active" id="panel-hq">
      <Typography className="section-label">ติดต่อเรา</Typography>
      <Typography component="h1" className="section-heading">สำนักงานใหญ่ บริษัท อ็อคตาเวีย</Typography>

      <div className="contact-info-card">
        <h3 className="info-subtitle">Octavia คอลเซ็นเตอร์</h3>
        
        <div className="info-row">
          <strong>โทร :</strong>
          <Link href="tel:+66888888888" className="action-link">+66(0) 88-888-8888</Link>
          <Button
            className="copy-btn"
            onClick={() => handleCopy('+66888888888', 'phone')}
          >
            {copiedPhone ? 'คัดลอกแล้ว!' : 'คัดลอก'}
          </Button>
        </div>

        <div className="info-row">
          <strong>อีเมล :</strong>
          <Link href="mailto:EDITOR@OCTAVIA88.com" className="action-link">EDITOR@OCTAVIA88.com</Link>
          <Button
            className="copy-btn"
            onClick={() => handleCopy('EDITOR@OCTAVIA88.com', 'email')}
          >
            {copiedEmail ? 'คัดลอกแล้ว!' : 'คัดลอก'}
          </Button>
        </div>
      </div>

      <Divider className="divider" />

      <div className="address-container">
        <div className="address-row">
          <span className="address-label">ที่อยู่</span>
          <span className="address-value">00000 อาคารสุรนารี ชั้น 38 , ถนนพระอินทร์ 9 , ประเทศไทย</span>
        </div>

        {/* Location Map Card */}
        <div className="map-card">
          <div className="map-image-wrapper">
            <img src={mapImg} alt="แผนที่ตั้ง Octavia Campus" className="map-image" />
            
            <div className="map-pin-overlay" title="Octavia Campus Location">
              <div className="pin-icon"></div>
              <div className="pin-badge">OCTAVIA CAMPUS</div>
            </div>
          </div>

          <div className="map-actions">
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>📍 พิกัด: 13.7563, 100.5018</span>
            <Link
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="map-action-btn"
            >
              <span>เปิดใน Google Maps</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </Box>
  );
};
