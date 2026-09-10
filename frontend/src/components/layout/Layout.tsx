import React from 'react';
import { Box } from '@mui/material';
import Sidebar, { SIDEBAR_WIDTH } from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = "ข้อมูลงานคอนเสิร์ต", 
  subtitle = "ข้อมูลทุกฝ่ายเชื่อมโยงกันแบบเรียลไทม์ · อัปเดตล่าสุด 22 ก.ค. 2569, 09:41 น.",
  showBack = true
}) => {
  return (
    <Box sx={{ width: 'flex', display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Sidebar />
      <Box
        sx={{
          flex: 1,
          ml: `${SIDEBAR_WIDTH}px`,
          minWidth: 0,
          maxWidth: `calc(100vw - ${SIDEBAR_WIDTH}px)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header title={title} subtitle={subtitle} showBack={showBack} />
        <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
