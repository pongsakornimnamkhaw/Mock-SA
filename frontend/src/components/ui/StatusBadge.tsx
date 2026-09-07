// src/components/ui/StatusBadge.tsx
import Chip from '@mui/material/Chip';
import type { PromotionStatus, ApprovalStatus } from '../../types/promotion';

type Status = PromotionStatus | ApprovalStatus;

const CONFIG: Record<Status, { label: string; color: 'success' | 'error' | 'default' | 'warning' }> = {
  active:   { label: 'กำลังใช้งาน', color: 'success' },
  expired:  { label: 'หมดอายุ',     color: 'error' },
  draft:    { label: 'แบบร่าง',     color: 'default' },
  pending:  { label: 'รอการอนุมัติ', color: 'warning' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  rejected: { label: 'ปฏิเสธ',     color: 'error' },
};

export default function StatusBadge({ status }: { status: Status }) {
  const cfg = CONFIG[status] ?? { label: status, color: 'default' };
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      sx={{ fontWeight: 700, fontSize: '0.72rem', px: 0.5 }}
    />
  );
}
