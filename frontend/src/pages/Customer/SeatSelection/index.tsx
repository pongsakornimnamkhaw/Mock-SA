import { Box, Container, Stepper, Step, StepLabel } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Types & Constants
import type { SeatData } from '@/components/SeatSelection/types';
import { eventsMap, zonePriceMap, LOCK_DURATION, STEPS, generateSeats } from '@/components/SeatSelection/constants';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import { formatThaiDate } from '@/utils/customerPromotion';
import type { CustomerPromotion } from '@/types/customerPromotion';
import { calculateDiscount, filterEligiblePromotions, type PromotionOrder } from '@/utils/seatPromotion';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';
import { getCustomerSession } from '@/utils/customerSession';
import { pulse } from '@/assets/Poster';

// Sub-components
import TopNavbar from '@/components/SeatSelection/TopNavbar';
import ConcertInfoCard from '@/components/SeatSelection/ConcertInfoCard';
import SeatMap from '@/components/SeatSelection/SeatMap';
import OrderSummary from '@/components/SeatSelection/OrderSummary';
import QRCodeDialog from '@/components/SeatSelection/dialogs/QRCodeDialog';
import SuccessDialog from '@/components/SeatSelection/dialogs/SuccessDialog';
import ExpiredDialog from '@/components/SeatSelection/dialogs/ExpiredDialog';

const SeatSelectionPage = () => {
    const navigate = useNavigate();
    const { id, zone } = useParams<{ id: string; zone: string }>();
    const [event, setEvent] = useState(() => (id && eventsMap[id]) ? eventsMap[id] : eventsMap['2']);
    const zoneInfo = (zone && zonePriceMap[zone]) ? zonePriceMap[zone] : zonePriceMap['A1'];

    const [seats, setSeats] = useState<SeatData[]>(generateSeats);
    const [isLocked, setIsLocked] = useState(false);
    const [timeLeft, setTimeLeft] = useState(LOCK_DURATION);
    const [showExpiredDialog, setShowExpiredDialog] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [showQRDialog, setShowQRDialog] = useState(false);
    const [latestBookingId, setLatestBookingId] = useState<string>('');
    const [activeStep, setActiveStep] = useState(1);
    const [promotions, setPromotions] = useState<CustomerPromotion[]>([]);
    const [promotionsLoading, setPromotionsLoading] = useState(true);
    const [promotionError, setPromotionError] = useState('');
    const [selectedPromotionId, setSelectedPromotionId] = useState('');
    const [promotionSelectionTouched, setPromotionSelectionTouched] = useState(false);
    const [redeemedPromotions, setRedeemedPromotions] = useState<CustomerPromotion[]>([]);
    const [codeValue, setCodeValue] = useState('');
    const [codeError, setCodeError] = useState('');
    const [codeSuccess, setCodeSuccess] = useState('');
    const [codeSubmitting, setCodeSubmitting] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!id || eventsMap[id]) {
            if (id && eventsMap[id]) setEvent(eventsMap[id]);
            return;
        }
        let active = true;
        customerPromotionApi.getConcert(id).then(({ data }) => {
            if (!active) return;
            const date = data.end_date && data.end_date !== data.start_date
                ? `${formatThaiDate(data.start_date)} – ${formatThaiDate(data.end_date)}`
                : formatThaiDate(data.start_date);
            setEvent({
                title: data.concert_name,
                image: data.poster_data || pulse,
                eventDate: date,
                location: data.location,
                openTime: data.start_time ? `${data.start_time.slice(0, 5)} น.` : undefined,
            });
        }).catch(() => {
            // Keep the fallback card; seat inventory/payment are still simulated.
        });
        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        let active = true;
        setPromotionsLoading(true);
        setPromotionError('');
        setSelectedPromotionId('');
        setPromotionSelectionTouched(false);
        setRedeemedPromotions([]);
        setCodeValue('');
        setCodeError('');
        setCodeSuccess('');
        customerPromotionApi.list().then(({ data }) => {
            if (active) setPromotions(data);
        }).catch((reason) => {
            if (!active) return;
            setPromotions([]);
            setPromotionError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดโปรโมชั่นได้');
        }).finally(() => {
            if (active) setPromotionsLoading(false);
        });
        return () => { active = false; };
    }, [id, zone]);

    const selectedSeats = seats.filter((s) => s.status === 'selected');
    const lockedSeats = seats.filter((s) => s.status === 'locked');
    const activeSeats = isLocked ? lockedSeats : selectedSeats;
    const totalPrice = activeSeats.length * zoneInfo.price;
    const promotionOrder = useMemo<PromotionOrder>(() => ({
        concertId: id || '',
        concertName: event.title,
        zoneId: zone || '',
        zoneLabel: zoneInfo.label,
        total: totalPrice,
    }), [event.title, id, totalPrice, zone, zoneInfo.label]);

    const eligiblePromotions = useMemo(
        () => filterEligiblePromotions(promotions, promotionOrder),
        [promotions, promotionOrder],
    );

    // โค้ดที่แลกไว้แล้วอาจใช้ไม่ได้ถ้าลูกค้าเอาที่นั่งออกจนยอดต่ำกว่าขั้นต่ำ
    const activeRedeemedPromotions = useMemo(
        () => redeemedPromotions.filter((promotion) => totalPrice >= promotion.discount.minimum_order
            && promotion.validity.remaining_quota > 0),
        [redeemedPromotions, totalPrice],
    );

    const droppedRedeemedCode = activeRedeemedPromotions.length < redeemedPromotions.length;

    const selectablePromotions = useMemo(() => {
        const merged: CustomerPromotion[] = [];
        for (const promotion of [...activeRedeemedPromotions, ...eligiblePromotions]) {
            if (!merged.some((option) => option.promotion_id === promotion.promotion_id)) {
                merged.push(promotion);
            }
        }
        return merged.sort((left, right) => calculateDiscount(right, totalPrice) - calculateDiscount(left, totalPrice));
    }, [activeRedeemedPromotions, eligiblePromotions, totalPrice]);

    useEffect(() => {
        if (selectedPromotionId && selectablePromotions.some((promotion) => promotion.promotion_id === selectedPromotionId)) return;
        if (!promotionSelectionTouched && selectablePromotions.length > 0) {
            setSelectedPromotionId(selectablePromotions[0].promotion_id);
            return;
        }
        setSelectedPromotionId('');
    }, [selectablePromotions, promotionSelectionTouched, selectedPromotionId]);

    const selectedPromotion = selectablePromotions.find((promotion) => promotion.promotion_id === selectedPromotionId) ?? null;
    const discountAmount = selectedPromotion ? calculateDiscount(selectedPromotion, totalPrice) : 0;
    const finalPrice = Math.max(0, totalPrice - discountAmount);

    const handlePromotionChange = (promotionId: string) => {
        setPromotionSelectionTouched(true);
        setSelectedPromotionId(promotionId);
        setCodeError('');
    };

    const handleApplyCode = async () => {
        const code = codeValue.trim();
        if (!code || codeSubmitting) return;
        setCodeSubmitting(true);
        setCodeError('');
        setCodeSuccess('');
        try {
            const { data } = await customerPromotionApi.redeem({ ...promotionOrder, code });
            setRedeemedPromotions((previous) => [
                data.promotion,
                ...previous.filter((promotion) => promotion.promotion_id !== data.promotion.promotion_id),
            ]);
            setPromotionSelectionTouched(true);
            setSelectedPromotionId(data.promotion.promotion_id);
            setCodeSuccess(`ใช้โค้ด ${data.promotion.discount.promo_code} แล้ว`);
            setCodeValue('');
        } catch (reason) {
            setCodeError(reason instanceof Error ? reason.message : 'ใช้รหัสโปรโมชั่นนี้ไม่ได้');
        } finally {
            setCodeSubmitting(false);
        }
    };

    // ========== Countdown Timer ==========
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (isLocked) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearTimer();
                        handleLockExpired();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearTimer();
    }, [isLocked, clearTimer]);

    // ========== Lock ที่นั่งชั่วคราว ==========
    const handleLockSeats = () => {
        if (selectedSeats.length === 0) {
            alert('กรุณาเลือกที่นั่งอย่างน้อย 1 ที่นั่ง');
            return;
        }
        setSeats((prev) =>
            prev.map((seat) => ({
                ...seat,
                status: seat.status === 'selected' ? 'locked' : seat.status,
            }))
        );
        setIsLocked(true);
        setTimeLeft(LOCK_DURATION);
        setActiveStep(2); // ไปขั้นตอนชำระเงิน
    };

    // ========== หมดเวลา Lock ==========
    const handleLockExpired = () => {
        setSeats((prev) =>
            prev.map((seat) => ({
                ...seat,
                status: seat.status === 'locked' ? 'available' : seat.status,
            }))
        );
        setIsLocked(false);
        setActiveStep(1);
        setShowExpiredDialog(true);
    };

    // ========== ยกเลิก Lock ==========
    const handleCancelLock = () => {
        clearTimer();
        setSeats((prev) =>
            prev.map((seat) => ({
                ...seat,
                status: seat.status === 'locked' ? 'available' : seat.status,
            }))
        );
        setIsLocked(false);
        setTimeLeft(LOCK_DURATION);
        setActiveStep(1);
    };

    // ========== ยืนยันชำระเงิน (เปิด QR) ==========
    const handlePayment = () => {
        setShowQRDialog(true);
    };

    // ========== จัดการส่งหลักฐานชำระเงินและบันทึกการจอง (UP1) ==========
    const handleSubmitPayment = async (paymentData: {
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        slipFileName: string;
        slipDataUrl?: string;
    }) => {
        clearTimer();
        setSeats((prev) =>
            prev.map((seat) => ({
                ...seat,
                status: seat.status === 'locked' ? 'reserved' : seat.status,
            }))
        );
        setIsLocked(false);
        setShowQRDialog(false);

        const session = getCustomerSession();
        const seatLabels = activeSeats.map((s) => s.id);
        const record = await bookingPaymentApi.createBooking({
            concertId: id || '2',
            concertTitle: event.title,
            eventDate: event.eventDate,
            location: event.location,
            zoneId: zone || 'A1',
            tierName: zoneInfo.label,
            seats: seatLabels,
            quantity: activeSeats.length,
            unitPrice: zoneInfo.price,
            discountAmount: discountAmount,
            totalPrice: finalPrice,
            customerName: paymentData.customerName,
            customerEmail: paymentData.customerEmail,
            customerPhone: paymentData.customerPhone,
            userId: session?.userId,
            slipFileName: paymentData.slipFileName,
            slipDataUrl: paymentData.slipDataUrl,
        });

        setLatestBookingId(record.id);
        setShowSuccessDialog(true);
    };

    // ========== คลิกเลือกที่นั่ง ==========
    const handleSeatClick = (seatId: string) => {
        if (isLocked) return;
        setSeats((prev) =>
            prev.map((seat) => {
                if (seat.id !== seatId) return seat;
                if (seat.status === 'reserved' || seat.status === 'locked') return seat;
                return {
                    ...seat,
                    status: seat.status === 'selected' ? 'available' : 'selected',
                };
            })
        );
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: '#0a0a1a',
            background: 'radial-gradient(ellipse at 0% 50%, rgba(100, 40, 200, 0.35) 0%, transparent 50%), radial-gradient(ellipse at 100% 50%, rgba(60, 30, 180, 0.35) 0%, transparent 50%), radial-gradient(ellipse at 50% 0%, rgba(140, 50, 220, 0.15) 0%, transparent 40%), #0a0a1a',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <TopNavbar 
                id={id} 
                isLocked={isLocked} 
                timeLeft={timeLeft} 
                handleCancelLock={handleCancelLock}
                onBack={() => navigate(`/event/${id}/zones`)}
            />

            <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
                <Box sx={{ mb: 4 }}>
                    <ConcertInfoCard event={event} />
                    <Stepper activeStep={activeStep} alternativeLabel sx={{
                        mt: 2,
                        '& .MuiStepLabel-label': { color: '#aaaaaa', fontSize: '0.85rem' },
                        '& .MuiStepLabel-label.Mui-active': { color: '#ffffff', fontWeight: 'bold' },
                        '& .MuiStepLabel-label.Mui-completed': { color: '#43A047' },
                        '& .MuiStepIcon-root': { color: '#555555' },
                        '& .MuiStepIcon-root.Mui-active': { color: '#FF5C58' },
                        '& .MuiStepIcon-root.Mui-completed': { color: '#43A047' },
                    }}>
                        {STEPS.map((label) => (
                            <Step key={label}><StepLabel>{label}</StepLabel></Step>
                        ))}
                    </Stepper>
                </Box>

                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 4, justifyContent: 'center',
                    alignItems: { xs: 'center', md: 'flex-start' }
                }}>
                    <SeatMap 
                        zone={zone || ''} 
                        zoneInfo={zoneInfo} 
                        seats={seats} 
                        isLocked={isLocked} 
                        handleSeatClick={handleSeatClick} 
                    />

                    <OrderSummary 
                        event={event}
                        zone={zone || ''}
                        zoneInfo={zoneInfo}
                        activeSeats={activeSeats}
                        selectedSeats={selectedSeats}
                        isLocked={isLocked}
                        timeLeft={timeLeft}
                        totalPrice={totalPrice}
                        finalPrice={finalPrice}
                        discountAmount={discountAmount}
                        promotion={{
                            eligiblePromotions,
                            redeemedPromotions: activeRedeemedPromotions,
                            selectedPromotionId,
                            autoSelected: !promotionSelectionTouched && selectedPromotionId !== '',
                            loading: promotionsLoading,
                            loadError: promotionError,
                            codeValue,
                            codeError: codeError || (droppedRedeemedCode ? 'ยอดสั่งซื้อตอนนี้ไม่ถึงขั้นต่ำของโค้ดที่กรอกไว้' : ''),
                            codeSuccess,
                            codeSubmitting,
                            disabled: isLocked,
                            onSelect: handlePromotionChange,
                            onCodeChange: setCodeValue,
                            onCodeSubmit: handleApplyCode,
                        }}
                        handleLockSeats={handleLockSeats}
                        handlePayment={handlePayment}
                        handleCancelLock={handleCancelLock}
                        onBack={() => navigate(`/event/${id}/zones`)}
                    />
                </Box>
            </Container>

            <ExpiredDialog 
                open={showExpiredDialog} 
                onClose={() => setShowExpiredDialog(false)} 
            />

            <QRCodeDialog 
                open={showQRDialog}
                onClose={() => setShowQRDialog(false)}
                totalPrice={finalPrice}
                timeLeft={timeLeft}
                onSubmitPayment={handleSubmitPayment}
            />

            <SuccessDialog 
                open={showSuccessDialog}
                event={event}
                zone={zone || ''}
                zoneInfo={zoneInfo}
                totalPrice={finalPrice}
                bookingId={latestBookingId}
                onHomeClick={() => navigate('/home')}
            />
        </Box>
    );
};

export default SeatSelectionPage;
