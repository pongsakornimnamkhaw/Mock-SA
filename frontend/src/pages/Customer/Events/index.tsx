import { Box } from '@mui/material';
import CustomerHeader from '@/components/common/CustomerHeader';
import EventList from '@/components/posterShow/posterShow';

export default function EventsPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fff' }}>
      <CustomerHeader />
      <EventList title="ทุกงานแสดง" />
    </Box>
  );
}
