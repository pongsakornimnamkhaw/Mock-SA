import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { EmployeeActivity } from '@/api/employeeAccountApi';
import { employeeAccountApi } from '@/api/employeeAccountApi';
import Pagination from '@/components/ui/Pagination';

const bangkokFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatBangkok(iso: string): string {
  const parts = bangkokFmt.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')} น.`;
}

export default function ActivityTab() {
  const [activities, setActivities] = useState<EmployeeActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    employeeAccountApi
      .getActivity({ page, pageSize })
      .then((res) => {
        if (!active) return;
        setActivities(res.data);
        setTotal(res.total);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'โหลดข้อมูลล้มเหลว');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 2 }}>
        ประวัติการทำงานของฉัน
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#d63384' }} />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      )}

      {!loading && !error && activities.length === 0 && (
        <Typography sx={{ color: '#94a3b8', textAlign: 'center', py: 6 }}>
          ไม่พบประวัติการทำงาน
        </Typography>
      )}

      {!loading && !error && activities.length > 0 && (
        <>
          <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['เวลา', 'การกระทำ', 'โมดูล', 'เป้าหมาย'].map((h) => (
                    <TableCell key={h} sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.08)' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {activities.map((a) => (
                  <TableRow key={a.logId} sx={{ '&:hover': { background: 'rgba(255,255,255,0.04)' } }}>
                    <TableCell sx={{ color: '#cbd5e1', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                      {formatBangkok(a.createdAt)}
                    </TableCell>
                    <TableCell sx={{ color: '#fff', fontSize: '0.85rem', borderColor: 'rgba(255,255,255,0.06)' }}>
                      {a.action}
                    </TableCell>
                    <TableCell sx={{ color: '#cbd5e1', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.06)' }}>
                      {a.module}
                    </TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontSize: '0.78rem', borderColor: 'rgba(255,255,255,0.06)' }}>
                      {a.targetId ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 1 }}>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </Box>
        </>
      )}
    </Box>
  );
}
