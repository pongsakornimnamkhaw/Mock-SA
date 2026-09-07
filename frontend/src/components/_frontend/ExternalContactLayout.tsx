import { Outlet, useLocation } from 'react-router-dom';
import CustomerHeader from '../common/CustomerHeader';
import { Sidebar } from './Sidebar';
import '../../App.css';
import Box from '@mui/material/Box';

export default function ExternalContactLayout() {
  const { pathname } = useLocation();
  const isTicketingPage = pathname === '/contact/ticketing' || pathname === '/contact/ticketing/summary';

  return (
    <Box className={`external-contact${isTicketingPage ? ' ticketing-page' : ''}`}>
      <Box className="app-container">
        <CustomerHeader />
        <Box component="main" className="main-wrapper">
          <Box className="content-card">
            <Sidebar />
            <Box className="main-content">
              <Outlet />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
