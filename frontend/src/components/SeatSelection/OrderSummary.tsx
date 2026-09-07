import { Box, Typography, Button, Paper, LinearProgress, FormControl, Select, MenuItem, Chip, CircularProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import type { EventData, ZoneInfo, SeatData } from '@/components/SeatSelection/types';
import { formatTime, LOCK_DURATION } from '@/components/SeatSelection/constants';
import type { CustomerPromotion } from '@/types/customerPromotion';
import { discountLabel } from '@/utils/customerPromotion';

interface OrderSummaryProps {
    event: EventData;
    zone: string;
    zoneInfo: ZoneInfo;
    activeSeats: SeatData[];
    selectedSeats: SeatData[];
    isLocked: boolean;
    timeLeft: number;
    totalPrice: number;
    finalPrice: number;
    discountAmount: number;
    eligiblePromotions: CustomerPromotion[];
    selectedPromotionId: string;
    promotionsLoading: boolean;
    promotionError: string;
    onPromotionChange: (promotionId: string) => void;
    handleLockSeats: () => void;
    handlePayment: () => void;
    handleCancelLock: () => void;
    onBack: () => void;
}

const OrderSummary = ({
    event, zone, zoneInfo, activeSeats, selectedSeats, isLocked, timeLeft, totalPrice,
    finalPrice, discountAmount, eligiblePromotions, selectedPromotionId,
    promotionsLoading, promotionError, onPromotionChange,
    handleLockSeats, handlePayment, handleCancelLock, onBack
}: OrderSummaryProps) => {
    const timerProgress = (timeLeft / LOCK_DURATION) * 100;
    const timerColor = timeLeft <= 60 ? '#E53935' : timeLeft <= 120 ? '#FF9800' : '#43A047';

    return (
        <Paper elevation={3} sx={{
            p: 3, borderRadius: '16px', bgcolor: '#ffffff',
            width: { xs: '100%', md: '300px' }, maxWidth: '320px',
        }}>
            {/* Timer Bar (แสดงเมื่อ Lock) */}
            {isLocked && (
                <Box sx={{ mb: 2 }}>
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 1, mb: 1,
                        justifyContent: 'space-between',
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LockIcon sx={{ fontSize: 16, color: '#FF9800' }} />
                            <Typography sx={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>
                                ที่นั่งถูกล็อคชั่วคราว
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontWeight: 'bold', fontSize: '1.1rem',
                            color: timerColor, fontFamily: 'monospace',
                        }}>
                            {formatTime(timeLeft)}
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={timerProgress}
                        sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: '#eee',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: timerColor,
                                borderRadius: 3,
                                transition: 'transform 1s linear',
                            },
                        }}
                    />
                    <Typography sx={{ fontSize: '0.7rem', color: '#999', mt: 0.5 }}>
                        กรุณาชำระเงินภายในเวลาที่กำหนด มิฉะนั้นที่นั่งจะถูกปลดล็อคอัตโนมัติ
                    </Typography>
                </Box>
            )}

            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#1a1a1a' }}>
                {isLocked ? '🔒 รอชำระเงิน' : 'สรุปรายการ'}
            </Typography>

            <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.9rem', color: '#666', mb: 0.5 }}>
                    🎵 {event.title}
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: '#666', mb: 0.5 }}>
                    📅 {event.eventDate}
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: '#666', mb: 0.5 }}>
                    📍 โซน {zone} ({zoneInfo.label})
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: '#666' }}>
                    💰 ราคา {zoneInfo.price.toLocaleString()} บาท/ที่นั่ง
                </Typography>
            </Box>

            <Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 2 }}>
                <Typography sx={{ fontWeight: 'bold', color: '#1a1a1a', mb: 1 }}>
                    {isLocked ? '🔒' : '💺'} ที่นั่งที่เลือก ({activeSeats.length} ที่นั่ง)
                </Typography>
                {activeSeats.length === 0 ? (
                    <Typography sx={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        ยังไม่ได้เลือกที่นั่ง
                    </Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {activeSeats.map((seat) => (
                            <Box key={seat.id} sx={{
                                bgcolor: isLocked ? '#FF9800' : '#2196F3',
                                color: '#ffffff',
                                px: 1.5, py: 0.3, borderRadius: '12px',
                                fontSize: '0.8rem', fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', gap: 0.3,
                            }}>
                                {isLocked && <LockIcon sx={{ fontSize: 12 }} />}
                                {seat.id}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>

            <Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <LocalOfferOutlinedIcon sx={{ color: '#d63384', fontSize: 19 }} />
                        <Typography sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>โปรโมชั่น</Typography>
                    </Box>
                    {selectedPromotionId && <Chip size="small" label="เลือกให้อัตโนมัติ" color="success" sx={{ height: 22, fontSize: '0.68rem' }} />}
                </Box>

                {promotionsLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#777', py: 1 }}>
                        <CircularProgress size={16} />
                        <Typography sx={{ fontSize: '0.78rem' }}>กำลังตรวจสอบโปรโมชั่น...</Typography>
                    </Box>
                ) : promotionError ? (
                    <Typography sx={{ color: '#d32f2f', fontSize: '0.75rem' }}>ตรวจสอบโปรโมชั่นไม่ได้</Typography>
                ) : eligiblePromotions.length === 0 ? (
                    <Typography sx={{ color: '#999', fontSize: '0.78rem' }}>
                        ยังไม่มีโปรโมชั่นที่ตรงกับยอดและโซนที่เลือก
                    </Typography>
                ) : (
                    <>
                        <FormControl fullWidth size="small">
                            <Select
                                value={selectedPromotionId}
                                onChange={(event) => onPromotionChange(event.target.value)}
                                displayEmpty
                                aria-label="เลือกโปรโมชั่น"
                                sx={{ fontSize: '0.8rem', bgcolor: '#fff8fb' }}
                            >
                                <MenuItem value=""><em>ไม่ใช้โปรโมชั่น</em></MenuItem>
                                {eligiblePromotions.map((promotion) => (
                                    <MenuItem key={promotion.promotion_id} value={promotion.promotion_id} sx={{ fontSize: '0.8rem' }}>
                                        {discountLabel(promotion)} · {promotion.discount.promo_code}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {selectedPromotionId && (
                            <Typography sx={{ color: '#2e7d32', fontSize: '0.72rem', mt: 0.75 }}>
                                ✓ ระบบเลือกโปรโมชั่นที่ประหยัดที่สุดให้แล้ว
                            </Typography>
                        )}
                    </>
                )}
            </Box>

            <Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 3 }}>
                {discountAmount > 0 && (
                    <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                            <Typography sx={{ color: '#666', fontSize: '0.85rem' }}>ราคาก่อนส่วนลด</Typography>
                            <Typography sx={{ color: '#666', fontSize: '0.85rem' }}>{totalPrice.toLocaleString()} บาท</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography sx={{ color: '#2e7d32', fontSize: '0.85rem', fontWeight: 'bold' }}>ส่วนลด</Typography>
                            <Typography sx={{ color: '#2e7d32', fontSize: '0.85rem', fontWeight: 'bold' }}>−{discountAmount.toLocaleString()} บาท</Typography>
                        </Box>
                    </>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1a1a1a' }}>
                        ยอดชำระ
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.3rem', color: '#E53935' }}>
                        {finalPrice.toLocaleString()} บาท
                    </Typography>
                </Box>
            </Box>

            {/* ปุ่ม: สลับตามสถานะ Lock */}
            {!isLocked ? (
                <>
                    <Button
                        variant="contained" fullWidth
                        onClick={handleLockSeats}
                        disabled={selectedSeats.length === 0}
                        sx={{
                            bgcolor: '#FF5C58', color: '#ffffff',
                            borderRadius: '25px', py: 1.5,
                            fontSize: '1rem', fontWeight: 'bold',
                            textTransform: 'none',
                            boxShadow: '0 4px 15px rgba(255, 92, 88, 0.4)',
                            '&:hover': { bgcolor: '#e04f4a' },
                            '&.Mui-disabled': { bgcolor: '#cccccc', color: '#888888' },
                        }}
                    >
                        {selectedSeats.length === 0
                            ? 'กรุณาเลือกที่นั่ง'
                            : 'ชำระเงิน'}
                    </Button>

                    <Button
                        variant="outlined" fullWidth
                        onClick={onBack}
                        sx={{
                            mt: 1.5, borderRadius: '25px', py: 1,
                            borderColor: '#cccccc', color: '#666666',
                            textTransform: 'none', fontSize: '0.9rem',
                            '&:hover': { borderColor: '#FF5C58', color: '#FF5C58' },
                        }}
                    >
                        ← กลับไปเลือกโซน
                    </Button>
                </>
            ) : (
                <>
                    <Button
                        variant="contained" fullWidth
                        onClick={handlePayment}
                        sx={{
                            bgcolor: '#43A047', color: '#ffffff',
                            borderRadius: '25px', py: 1.5,
                            fontSize: '1rem', fontWeight: 'bold',
                            textTransform: 'none',
                            boxShadow: '0 4px 15px rgba(67, 160, 71, 0.4)',
                            '&:hover': { bgcolor: '#388E3C' },
                        }}
                    >
                        ยืนยันชำระเงิน
                    </Button>

                    <Button
                        variant="outlined" fullWidth
                        onClick={handleCancelLock}
                        sx={{
                            mt: 1.5, borderRadius: '25px', py: 1,
                            borderColor: '#E53935', color: '#E53935',
                            textTransform: 'none', fontSize: '0.9rem',
                            '&:hover': { bgcolor: 'rgba(229,57,53,0.05)' },
                        }}
                    >
                        ยกเลิก
                    </Button>
                </>
            )}
        </Paper>
    );
};

export default OrderSummary;
