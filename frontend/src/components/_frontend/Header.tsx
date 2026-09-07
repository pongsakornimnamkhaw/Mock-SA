import React from 'react';
import { Link } from 'react-router-dom';
import logo2Img from '../../assets/logo2.png';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <Link to="/home" className="header-logo">
        <div className="logo-badge">
          <img src={logo2Img} alt="Octavia Logo" className="logo-img" />
        </div>
        <span className="logo-text">Octavia</span>
      </Link>

      <nav>
        <ul className="nav-menu">
          <li className="nav-item"><Link to="/home">หน้าแรก</Link></li>
          <li className="nav-item"><Link to="/home">ทุกงานแสดง</Link></li>
          <li className="nav-item active"><Link to="/contact">ติดต่อเรา</Link></li>
        </ul>
      </nav>

      <Link className="btn-login" to="/login">
        เข้าสู่ระบบ
      </Link>
    </header>
  );
};
