import React, { useState } from 'react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert(`เข้าสู่ระบบสำเร็จในชื่อ ${email}`);
    onClose();
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">
          &times;
        </button>
        <h2 className="modal-title">เข้าสู่ระบบ Octavia</h2>
        <p className="modal-subtitle">กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งานระบบ</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">อีเมล</label>
            <input
              type="email"
              className="form-input"
              placeholder="user@octavia.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">รหัสผ่าน</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-submit" style={{ width: '100%' }}>
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};
