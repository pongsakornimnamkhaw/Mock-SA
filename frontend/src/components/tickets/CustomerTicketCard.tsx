import { useEffect, useState } from 'react';
import { Box } from '@mui/material';

import TicketStub, { type TicketStubProps } from '@/components/tickets/TicketStub';
import {
  TicketDesignRenderer,
  loadCachedTicketDesign,
  type TicketDesignObject,
  type TicketRenderData,
} from '@/components/tickets/TicketDesignRenderer';

export interface CustomerTicketPreview {
  objects: TicketDesignObject[];
  data: TicketRenderData;
  concertId: string;
}

interface CustomerTicketCardProps extends Omit<TicketStubProps, 'onOpenQr'> {
  customerName: string;
  onOpen: (preview: CustomerTicketPreview) => void;
}

export default function CustomerTicketCard({
  concertId,
  concertTitle,
  customerName,
  eventDate,
  location,
  zoneLabel,
  code,
  seatLabel,
  qrCodeUrl,
  onOpen,
}: CustomerTicketCardProps) {
  const [objects, setObjects] = useState<TicketDesignObject[] | null>(null);

  useEffect(() => {
    let active = true;
    setObjects(null);
    loadCachedTicketDesign(concertId)
      .then((loaded) => { if (active) setObjects(loaded); })
      .catch(() => { if (active) setObjects([]); });
    return () => { active = false; };
  }, [concertId]);

  const data: TicketRenderData = {
    concertTitle,
    code,
    customerName,
    zoneLabel,
    seatLabel,
    qrCodeUrl,
  };
  const open = () => onOpen({ objects: objects || [], data, concertId });

  if (objects === null) {
    return <Box role="status" aria-label="กำลังโหลดแบบบัตร" sx={{ minHeight: 176, borderRadius: 3, bgcolor: '#f5f6fa' }} />;
  }

  if (objects.length === 0) {
    return (
      <TicketStub
        concertId={concertId}
        concertTitle={concertTitle}
        eventDate={eventDate}
        location={location}
        zoneLabel={zoneLabel}
        code={code}
        seatLabel={seatLabel}
        qrCodeUrl={qrCodeUrl}
        onOpenQr={open}
      />
    );
  }

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`เปิดบัตร ${code}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      sx={{
        cursor: 'pointer', borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e4eb',
        boxShadow: '0 10px 26px rgba(17,54,107,0.12)', transition: 'transform .2s ease',
        '&:hover': { transform: 'translateY(-3px)' },
      }}
    >
      <TicketDesignRenderer objects={objects} side="FRONT" data={data} />
    </Box>
  );
}
