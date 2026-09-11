import { Box, Typography, Container, Link, IconButton, Paper, Stepper, Step, StepLabel, CircularProgress } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import Logo from '@/components/common/Logo';
import { useNavigate, Link as RouterLink, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import { formatThaiDate } from '@/utils/customerPromotion';
import { seatInventoryApi, type PlanningLayout, type ZoneInventory } from '@/api/seatInventoryApi';
import type { EventData } from '@/components/SeatSelection/types';
import CustomerLayoutCanvas from '@/components/SeatSelection/CustomerLayoutCanvas';
import { zoneDisplayState } from '@/components/SeatSelection/customerSeatState';
import { ErrorAlert } from '@/components/ErrorAlert';
import { posterForConcert } from '@/utils/customerConcertCard';

const steps = ['เลือกโซนบัตร', 'เลือกที่นั่ง', 'ชำระเงิน'];

const ZoneSelectionPage = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [event, setEvent] = useState<EventData | null>(null);
    const [layout, setLayout] = useState<PlanningLayout>({ zones: [], layoutObjects: [] });
    const [inventories, setInventories] = useState<ZoneInventory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        let active = true;
        setLoading(true);
        setError('');
        Promise.all([customerPromotionApi.getConcert(id), seatInventoryApi.getLayout(id)])
            .then(([{ data }, plan]) => {
                if (!active) return;
                const date = data.end_date && data.end_date !== data.start_date
                    ? `${formatThaiDate(data.start_date)} – ${formatThaiDate(data.end_date)}`
                    : formatThaiDate(data.start_date);
                setEvent({ title: data.concert_name, image: posterForConcert(data), eventDate: date, location: data.location, openTime: data.start_time ? `${data.start_time.slice(0, 5)} น.` : undefined });
                setLayout(plan);
            })
            .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดผังที่นั่งได้'))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        if (!id) return;
        let active = true;
        const refresh = () => seatInventoryApi.listZones(id)
            .then((items) => active && setInventories(items))
            .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดสถานะโซนได้'));
        refresh();
        const timer = window.setInterval(refresh, 5000);
        return () => { active = false; window.clearInterval(timer); };
    }, [id]);

    const inventoryByID = useMemo(() => new Map(inventories.map((item) => [item.zoneId, item])), [inventories]);
    const openZone = (zoneId: string) => {
        const inventory = inventoryByID.get(zoneId);
        const state = zoneDisplayState({ capacity: inventory?.capacity ?? 0, available: inventory?.available ?? 0 });
        if (!state.disabled) navigate(`/event/${id}/seats/${zoneId}`);
    };

    return <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a1a', background: 'radial-gradient(ellipse at 0% 50%, rgba(100,40,200,.35), transparent 50%), radial-gradient(ellipse at 100% 50%, rgba(60,30,180,.35), transparent 50%), #0a0a1a' }}>
        <Box sx={{ bgcolor: '#050C38', px: { xs: 2, md: 6 }, py: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate(-1)} sx={{ color: '#fff' }}><ArrowBackIosNewIcon fontSize="small" /></IconButton>
            <Logo variant="OC2" width={75} />
            <Link component={RouterLink} to="/home" underline="none" sx={{ color: '#fff', ml: 3 }}>หน้าแรก</Link>
            <Typography sx={{ color: '#aaa' }}>&gt;</Typography><Typography sx={{ color: '#FF5C58' }}>เลือกโซนการแสดง</Typography>
        </Box>
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {error && <ErrorAlert message={error} />}
            {loading ? <Box sx={{ minHeight: 400, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                    {event?.image && <Box component="img" src={event.image} alt={event.title} sx={{ width: 86, height: 120, objectFit: 'cover', borderRadius: 2 }} />}
                    <Box sx={{ flex: 1 }}><Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>{event?.title}</Typography><Typography sx={{ color: '#ccc' }}>{event?.eventDate}</Typography></Box>
                    <Stepper activeStep={0} alternativeLabel sx={{ flex: 1, '& .MuiStepLabel-label': { color: '#aaa' }, '& .MuiStepLabel-label.Mui-active': { color: '#fff' }, '& .MuiStepIcon-root.Mui-active': { color: '#FF5C58' } }}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
                </Box>
                <Typography sx={{ color: '#ddd', textAlign: 'center', mb: 2 }}>กรุณาเลือกโซนที่นั่ง</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 310px' }, gap: 3, alignItems: 'start' }}>
                    <CustomerLayoutCanvas layout={layout} inventories={inventories} mode="zones" onZoneClick={openZone} />
                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>ราคาและสถานะโซน</Typography>
                        {layout.zones.length === 0 && <Typography color="text.secondary">ยังไม่มีโซนที่นั่ง</Typography>}
                        {layout.zones.map((zone) => {
                            const inventory = inventoryByID.get(zone.id);
                            const state = zoneDisplayState({ capacity: inventory?.capacity ?? 0, available: inventory?.available ?? 0 });
                            return <Box key={zone.id} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 1.5, alignItems: 'center', py: 1.2, opacity: state.disabled ? .48 : 1, borderBottom: '1px solid #eee' }}>
                                <Box sx={{ width: 18, height: 18, bgcolor: zone.color, borderRadius: 1, filter: state.disabled ? 'grayscale(1)' : 'none' }} />
                                <Box><Typography sx={{ fontWeight: 700 }}>{zone.name || zone.type || zone.id}</Typography><Typography variant="caption" color="text.secondary">{state.label}</Typography></Box>
                                <Typography sx={{ fontWeight: 700 }}>{Number(zone.zonePrice || 0).toLocaleString('th-TH')} ฿</Typography>
                            </Box>;
                        })}
                    </Paper>
                </Box>
            </>}
        </Container>
    </Box>;
};

export default ZoneSelectionPage;
