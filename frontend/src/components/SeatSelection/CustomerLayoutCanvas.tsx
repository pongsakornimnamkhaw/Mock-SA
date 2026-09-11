import { Box, Typography } from '@mui/material';
import type { PlanningLayout, PlanningLayoutObject, PlanningZone, ZoneInventory } from '@/api/seatInventoryApi';
import type { SeatData, SeatStatus } from './types';
import { zoneDisplayState } from './customerSeatState';

type Props = {
    layout: PlanningLayout;
    inventories?: ZoneInventory[];
    mode: 'zones' | 'seats';
    selectedZoneId?: string;
    seats?: SeatData[];
    interactionLocked?: boolean;
    onZoneClick?: (zoneId: string) => void;
    onSeatClick?: (seatId: string) => void;
};

const shapeStyle = (shape?: string) => {
    if (shape === 'circle') return { borderRadius: '50%' };
    if (shape === 'triangle') return { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' };
    if (shape === 'line') return { borderRadius: 0 };
    return { borderRadius: '8px' };
};

const seatColor = (status: SeatStatus, zoneColor: string) => {
    if (status === 'selected') return '#2196F3';
    if (status === 'locked') return '#FF9800';
    if (status === 'held' || status === 'reserved' || status === 'disabled') return '#616161';
    return zoneColor;
};

const isSeatDisabled = (status: SeatStatus, interactionLocked?: boolean) => (
    Boolean(interactionLocked) || status === 'held' || status === 'reserved' || status === 'disabled' || status === 'locked'
);

const SeatButton = ({ seat, zoneColor, interactionLocked, onSeatClick, positioned = false }: {
    seat: SeatData;
    zoneColor: string;
    interactionLocked?: boolean;
    onSeatClick?: Props['onSeatClick'];
    positioned?: boolean;
}) => {
    const disabled = isSeatDisabled(seat.status, interactionLocked);
    return <Box component="button" type="button" disabled={disabled} aria-label={`ที่นั่ง ${seat.id}`}
        onClick={(event) => { event.stopPropagation(); onSeatClick?.(seat.id); }}
        sx={{
            position: positioned ? 'absolute' : 'relative',
            left: positioned ? `${seat.x}%` : undefined,
            top: positioned ? `${seat.y}%` : undefined,
            transform: positioned ? 'translate(-50%, -50%)' : undefined,
            width: { xs: 42, md: 48 }, height: { xs: 34, md: 38 }, justifySelf: 'center',
            borderRadius: '6px', p: 0,
            border: seat.status === 'selected' ? '2px solid #fff' : '1px solid rgba(255,255,255,.65)',
            bgcolor: seatColor(seat.status, zoneColor), color: '#fff', fontSize: { xs: 9, md: 11 }, fontWeight: 800,
            opacity: seat.status === 'held' || seat.status === 'reserved' || seat.status === 'disabled' ? .48 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer', zIndex: 5,
        }}>{seat.id}</Box>;
};

const ExpandedSeatGrid = ({ zone, seats, interactionLocked, onSeatClick }: {
    zone: PlanningZone;
    seats: SeatData[];
    interactionLocked?: boolean;
    onSeatClick?: Props['onSeatClick'];
}) => <Box data-testid="expanded-seat-grid" sx={{
    position: 'absolute', inset: 0, display: 'grid',
    gridTemplateColumns: {
        xs: 'repeat(5, minmax(42px, 1fr))',
        sm: 'repeat(8, minmax(42px, 1fr))',
        md: 'repeat(13, minmax(44px, 1fr))',
    },
    gridAutoRows: { xs: 34, md: 38 }, gap: { xs: 1.5, md: 2.25 },
    alignContent: 'center', justifyContent: 'center', p: { xs: 2, md: 4 }, overflow: 'auto',
}}>
    {seats.map((seat) => <SeatButton key={seat.seatId} seat={seat} zoneColor={zone.color || '#e62573'}
        interactionLocked={interactionLocked} onSeatClick={onSeatClick} />)}
</Box>;

const ObjectNode = ({ item }: { item: PlanningLayoutObject }) => (
    <Box sx={{
        position: 'absolute', left: `${item.x}%`, top: `${item.y}%`, width: `${item.width || 12}%`, height: `${item.height || 8}%`,
        transform: `translate(-50%, -50%) rotate(${item.rotation || 0}deg)`, zIndex: Number(item.z || 0) + 1,
        bgcolor: item.shape === 'line' ? item.color : item.color || 'transparent', color: item.textColor || '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...shapeStyle(item.shape),
    }}>
        {item.imageSrc ? <Box component="img" src={item.imageSrc} alt={item.name || 'วัตถุในผัง'} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : item.shape !== 'line' && <Typography sx={{ fontSize: item.fontSize || { xs: 10, md: 14 }, fontWeight: 700, textAlign: 'center' }}>{item.name}</Typography>}
    </Box>
);

const ZoneNode = ({ zone, inventory, mode, active, seats, interactionLocked, onZoneClick, onSeatClick }: {
    zone: PlanningZone;
    inventory?: ZoneInventory;
    mode: Props['mode'];
    active: boolean;
    seats: SeatData[];
    interactionLocked?: boolean;
    onZoneClick?: Props['onZoneClick'];
    onSeatClick?: Props['onSeatClick'];
}) => {
    const state = zoneDisplayState({ capacity: inventory?.capacity ?? zone.seatItems?.length ?? 0, available: inventory?.available ?? 0 });
    const zoneDisabled = mode === 'zones' && state.disabled;
    return (
        <Box
            component={mode === 'zones' ? 'button' : 'div'}
            type={mode === 'zones' ? 'button' : undefined}
            aria-disabled={zoneDisabled || undefined}
            onClick={mode === 'zones' && !zoneDisabled ? () => onZoneClick?.(zone.id) : undefined}
            sx={{
                position: 'absolute', left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width || 12}%`, height: `${zone.height || 12}%`,
                transform: `translate(-50%, -50%) rotate(${zone.rotation || 0}deg)`, zIndex: Number(zone.z || 0) + 1,
                border: active ? '3px solid #fff' : '2px solid rgba(255,255,255,.25)', p: 0, m: 0,
                bgcolor: zone.color || '#e62573', color: '#fff', cursor: mode === 'zones' && !zoneDisabled ? 'pointer' : 'default',
                opacity: zoneDisabled || (mode === 'seats' && !active) ? .38 : 1,
                filter: zoneDisabled ? 'grayscale(.85)' : 'none', transition: 'opacity .2s, transform .2s',
                '&:hover': mode === 'zones' && !zoneDisabled ? { boxShadow: `0 0 24px ${zone.color || '#fff'}`, transform: `translate(-50%, -50%) rotate(${zone.rotation || 0}deg) scale(1.03)` } : {},
                ...shapeStyle(zone.shape),
            }}
        >
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 10, md: 15 } }}>{zone.name || zone.type || zone.id}</Typography>
                {mode === 'zones' && <Typography sx={{ fontSize: { xs: 8, md: 11 } }}>{state.label}</Typography>}
                {mode === 'zones' && <Typography sx={{ fontSize: { xs: 8, md: 11 } }}>{Number(zone.zonePrice || 0).toLocaleString('th-TH')} บาท</Typography>}
            </Box>
            {mode === 'seats' && active && seats.map((seat) => {
                return <SeatButton key={seat.seatId} seat={seat} zoneColor={zone.color || '#e62573'}
                    interactionLocked={interactionLocked} onSeatClick={onSeatClick} positioned />;
            })}
        </Box>
    );
};

const CustomerLayoutCanvas = ({ layout, inventories = [], mode, selectedZoneId, seats = [], interactionLocked, onZoneClick, onSeatClick }: Props) => {
    if (mode === 'seats') {
        const selectedZone = layout.zones.find((zone) => zone.id === selectedZoneId);
        return <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Box sx={{ position: 'relative', width: '100%', minWidth: 700, aspectRatio: '16 / 9', border: '1px solid rgba(255,255,255,.14)', borderRadius: 3, bgcolor: 'rgba(5,12,56,.58)', overflow: 'hidden' }}>
                {selectedZone && seats.length > 0
                    ? <ExpandedSeatGrid zone={selectedZone} seats={seats} interactionLocked={interactionLocked} onSeatClick={onSeatClick} />
                    : <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#aaa' }}>ยังไม่มีที่นั่งในโซนนี้</Box>}
            </Box>
        </Box>;
    }

    const inventoryByID = new Map(inventories.map((item) => [item.zoneId, item]));
    const items = [
        ...layout.layoutObjects.map((item) => ({ kind: 'object' as const, z: item.z, item })),
        ...layout.zones.map((item) => ({ kind: 'zone' as const, z: item.z, item })),
    ].sort((left, right) => Number(left.z || 0) - Number(right.z || 0));

    return <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Box sx={{ position: 'relative', width: '100%', minWidth: 700, aspectRatio: '16 / 9', border: '1px solid rgba(255,255,255,.14)', borderRadius: 3, bgcolor: 'rgba(5,12,56,.58)', overflow: 'hidden' }}>
            {items.map((entry) => entry.kind === 'object'
                ? <ObjectNode key={`object-${entry.item.id}`} item={entry.item} />
                : <ZoneNode key={`zone-${entry.item.id}`} zone={entry.item} inventory={inventoryByID.get(entry.item.id)} mode={mode}
                    active={entry.item.id === selectedZoneId} seats={entry.item.id === selectedZoneId ? seats : []}
                    interactionLocked={interactionLocked} onZoneClick={onZoneClick} onSeatClick={onSeatClick} />)}
            {items.length === 0 && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#aaa' }}>ยังไม่มีผังที่นั่ง</Box>}
        </Box>
    </Box>;
};

export default CustomerLayoutCanvas;
