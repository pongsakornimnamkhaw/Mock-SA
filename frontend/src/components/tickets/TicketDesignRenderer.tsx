import { Box } from '@mui/material';

export type TicketDesignSide = 'FRONT' | 'BACK';

export interface TicketDesignObject {
  id: string;
  kind: string;
  shape?: string;
  name?: string;
  color?: string;
  textColor?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  z?: number;
  side?: string;
  imageSrc?: string;
  fontSize?: number;
  aspectRatio?: number;
}

export interface TicketRenderData {
  concertTitle: string;
  code: string;
  customerName: string;
  zoneLabel: string;
  seatLabel: string;
  qrCodeUrl: string;
}

const designCache = new Map<string, Promise<TicketDesignObject[]>>();

export const clearTicketDesignCache = () => designCache.clear();

export const loadCachedTicketDesign = (concertId: string): Promise<TicketDesignObject[]> => {
  const cached = designCache.get(concertId);
  if (cached) return cached;

  const request = fetch(`/api/ticket-planning/concerts/${encodeURIComponent(concertId)}/ticket-design`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Ticket design API returned ${response.status}`);
      const payload = await response.json() as { objects?: TicketDesignObject[] };
      return Array.isArray(payload.objects) ? payload.objects : [];
    })
    .catch((error) => {
      designCache.delete(concertId);
      throw error;
    });

  designCache.set(concertId, request);
  return request;
};

export const resolveTicketText = (value: string, data: TicketRenderData) => {
  const replacements: Record<string, string> = {
    '{ชื่อคอนเสิร์ต}': data.concertTitle,
    '{รหัสบัตร}': data.code,
    '{ชื่อผู้ถือบัตร}': data.customerName,
    '{โซน}': data.zoneLabel,
    '{ที่นั่ง}': data.seatLabel,
  };
  return Object.entries(replacements).reduce(
    (text, [placeholder, replacement]) => text.split(placeholder).join(replacement),
    value,
  );
};

const shapeStyle = (item: TicketDesignObject) => {
  if (item.shape === 'circle') return { borderRadius: '50%' };
  if (item.shape === 'triangle') return { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' };
  return { borderRadius: '4px' };
};

export function TicketDesignRenderer({
  objects,
  side,
  data,
  interactive = false,
}: {
  objects: TicketDesignObject[];
  side: TicketDesignSide;
  data: TicketRenderData;
  interactive?: boolean;
}) {
  const visible = objects
    .filter((item) => (item.side || 'FRONT').toUpperCase() === side)
    .sort((left, right) => Number(left.z || 0) - Number(right.z || 0));

  return (
    <Box
      data-testid="ticket-design"
      sx={{
        position: 'relative', width: '100%', aspectRatio: '2.05 / 1', overflow: 'hidden',
        bgcolor: '#fff', borderRadius: 2, pointerEvents: interactive ? 'auto' : 'none',
      }}
    >
      {visible.map((item, index) => {
        const commonSx = {
          position: 'absolute' as const,
          left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, height: `${item.height}%`,
          transform: `translate(-50%, -50%) rotate(${item.rotation || 0}deg)`,
          zIndex: index + 1,
          overflow: 'hidden',
          ...shapeStyle(item),
        };

        if (item.kind === 'image') {
          return item.imageSrc ? (
            <Box key={item.id} sx={commonSx}>
              <Box component="img" src={item.imageSrc} alt={item.name || 'รูปภาพบนบัตร'} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            </Box>
          ) : null;
        }

        if (item.kind === 'qr') {
          return (
            <Box key={item.id} sx={{ ...commonSx, bgcolor: item.color || '#fff', p: '1.5%' }}>
              <Box component="img" src={data.qrCodeUrl} alt={`QR Code ตั๋ว ${data.code}`} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            </Box>
          );
        }

        if (item.kind === 'shape') {
          return <Box key={item.id} aria-hidden sx={{ ...commonSx, bgcolor: item.color || 'transparent' }} />;
        }

        return (
          <Box
            key={item.id}
            sx={{
              ...commonSx,
              bgcolor: item.color || 'transparent', color: item.textColor || '#071033',
              fontSize: `clamp(8px, ${(item.fontSize || 24) / 16}vw, ${item.fontSize || 24}px)`,
              fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', lineHeight: 1.15, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap',
            }}
          >
            {resolveTicketText(item.name || '', data)}
          </Box>
        );
      })}
    </Box>
  );
}
