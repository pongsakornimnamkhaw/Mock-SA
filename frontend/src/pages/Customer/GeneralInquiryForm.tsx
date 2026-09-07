import React, { useState } from 'react';
import type { GeneralInquiryFormData } from '../../types/contact';
import { Box, Button, TextField, Typography } from '@mui/material';

export const GeneralInquiryForm: React.FC = () => {
  const [formData, setFormData] = useState<GeneralInquiryFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert('ส่งคำถามของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับทางอีเมล');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <Box component="section" className="panel-section active">
      <Typography className="section-label">ติดต่อเรา</Typography>
      <Typography component="h1" className="section-heading">สอบถามข้อมูลทั่วไป</Typography>

      <Box component="form" className="form-grid" onSubmit={handleSubmit}>
        <Box className="form-group">
          <TextField
            label="ชื่อผู้สอบถาม"
            placeholder="ระบุชื่อของคุณ"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            fullWidth
            size="small"
          />
        </Box>

        <Box className="form-group">
          <TextField
            type="email"
            label="อีเมลตอบกลับ"
            placeholder="yourname@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            fullWidth
            size="small"
          />
        </Box>

        <Box className="form-group full-width">
          <TextField
            label="เรื่องที่ต้องการสอบถาม"
            placeholder="พิมพ์ข้อความคำถามของคุณที่นี่..."
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            required
            fullWidth
            multiline
            minRows={5}
          />
        </Box>

        <Button type="submit" variant="contained" className="btn-submit">ส่งคำถาม</Button>
      </Box>
    </Box>
  );
};
