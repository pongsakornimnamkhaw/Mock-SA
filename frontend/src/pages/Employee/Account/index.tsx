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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 860, mx: 'auto' }}>
      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 3 }}>
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
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 3,
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v: number) => setTab(v)}
            sx={{
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              px: 2,
              '& .MuiTab-root': { color: '#94a3b8', textTransform: 'none', fontWeight: 600 },
              '& .Mui-selected': { color: '#d63384' },
              '& .MuiTabs-indicator': { backgroundColor: '#d63384' },
            }}
          >
            <Tab label="โปรไฟล์" />
            <Tab label="ความปลอดภัย" />
            <Tab label="ประวัติการทำงานของฉัน" />
          </Tabs>

          <Box sx={{ p: { xs: 2, md: 3 } }}>
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
