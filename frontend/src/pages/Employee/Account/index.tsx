import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { EmployeeProfile } from '@/api/employeeAccountApi';
import { employeeAccountApi } from '@/api/employeeAccountApi';
import ProfileTab from './ProfileTab';
import SecurityTab from './SecurityTab';
import ActivityTab from './ActivityTab';

export default function EmployeeAccountPage() {
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeAccountApi
      .getProfile()
      .then(setProfile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'โหลดข้อมูลล้มเหลว'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ color: '#1e293b', fontWeight: 800, mb: 3 }}>
        บัญชีของฉัน
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: '#d63384' }} />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      )}

      {!loading && !error && profile && (
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #f1f5f9',
            borderRadius: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v: number) => setTab(v)}
            sx={{
              borderBottom: '1px solid #e2e8f0',
              px: 3,
              pt: 1,
              '& .MuiTab-root': {
                color: '#64748b',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                minHeight: 48,
              },
              '& .Mui-selected': { color: '#d63384' },
              '& .MuiTabs-indicator': { backgroundColor: '#d63384', height: 3 },
            }}
          >
            <Tab label="โปรไฟล์" />
            <Tab label="ความปลอดภัย" />
            <Tab label="ประวัติการทำงานของฉัน" />
          </Tabs>

          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            {tab === 0 && (
              <ProfileTab profile={profile} onProfileUpdated={setProfile} />
            )}
            {tab === 1 && <SecurityTab />}
            {tab === 2 && <ActivityTab />}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
