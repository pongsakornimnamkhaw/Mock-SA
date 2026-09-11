import { Box, Container, Stepper, Step, StepLabel } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Types & Constants
import type { EventData, SeatData, ZoneInfo } from '@/components/SeatSelection/types';
import { LOCK_DURATION, STEPS } from '@/components/SeatSelection/constants';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import { formatThaiDate } from '@/utils/customerPromotion';
import type { CustomerPromotion } from '@/types/customerPromotion';
import { calculateDiscount, filterEligiblePromotions, type PromotionOrder } from '@/utils/seatPromotion';
import { bookingPaymentApi } from '@/api/bookingPaymentApi';
import { seatInventoryApi, SeatHoldConflictError, type PlanningLayout } from '@/api/seatInventoryApi';
import { getCustomerSession } from '@/utils/customerSession';
import { posterForConcert } from '@/utils/customerConcertCard';

// Sub-components
import TopNavbar from '@/components/SeatSelection/TopNavbar';
import ConcertInfoCard from '@/components/SeatSelection/ConcertInfoCard';
import CustomerLayoutCanvas from '@/components/SeatSelection/CustomerLayoutCanvas';
import { mergeSeatInventory } from '@/components/SeatSelection/customerSeatState';
import OrderSummary from '@/components/SeatSelection/OrderSummary';
import QRCodeDialog from '@/components/SeatSelection/dialogs/QRCodeDialog';
import SuccessDialog from '@/components/SeatSelection/dialogs/SuccessDialog';
import ExpiredDialog from '@/components/SeatSelection/dialogs/ExpiredDialog';
import { ErrorAlert } from '@/components/ErrorAlert';

const SeatSelectionPage = () => {
    const navigate = useNavigate();
    const { id, zone } = useParams<{ id: string; zone: string }>();
    const [event, setEvent] = useState<EventData>({ title: '', image: '', eventDate: '' });
    const [layout, setLayout] = useState<PlanningLayout>({ zones: [], layoutObjects: [] });
    const selectedZone = layout.zones.find((item) => item.id === zone);
    const zoneInfo = useMemo<ZoneInfo>(() => ({
        price: Number(selectedZone?.zonePrice || 0),
        color: selectedZone?.color || '#e62573',
        label: selectedZone?.name || selectedZone?.type || zone || 'โซน',
    }), [selectedZone, zone]);

    const [seats, setSeats] = useState<SeatData[]>([]);
    const [bookingError, setBookingError] = useState('');
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
    const [holdToken, setHoldToken] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const holdTokenRef = useRef('');

    useEffect(() => {
        if (!id) return;
        let active = true;
        Promise.all([customerPromotionApi.getConcert(id), seatInventoryApi.getLayout(id)]).then(([{ data }, plan]) => {
            if (!active) return;
            const date = data.end_date && data.end_date !== data.start_date ? `${formatThaiDate(data.start_date)} – ${formatThaiDate(data.end_date)}` : formatThaiDate(data.start_date);
            setEvent({ title: data.concert_name, image: posterForConcert(data), eventDate: date, location: data.location, openTime: data.start_time ? `${data.start_time.slice(0, 5)} น.` : undefined });
            setLayout(plan);
        }).catch((reason) => active && setBookingError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดผังที่นั่งได้'));
        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        if (!id || !zone) return;
        let active = true;
        const refresh = () => seatInventoryApi.listSeats(id, zone, holdTokenRef.current || undefined)
            .then((rows) => {
                if (!active) return;
                setSeats((current) => mergeSeatInventory(rows, current));
            })
            .catch((reason) => active && setBookingError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดที่นั่งได้'));
        refresh();
        const poller = window.setInterval(refresh, 5000);
        return () => { active = false; window.clearInterval(poller); };
    }, [id, zone]);

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
    const handleLockSeats = async () => {
        if (selectedSeats.length === 0) {
            alert('กรุณาเลือกที่นั่งอย่างน้อย 1 ที่นั่ง');
            return;
        }
        if (!id || !zone) return;
        setBookingError('');
        try {
            const hold = await seatInventoryApi.createHold(id, zone, selectedSeats.map((seat) => seat.seatId));
            holdTokenRef.current = hold.holdToken;
            setHoldToken(hold.holdToken);
            setSeats((current) => current.map((seat) => ({ ...seat, status: seat.status === 'selected' ? 'locked' : seat.status })));
            setIsLocked(true);
            setTimeLeft(Math.max(1, Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1000)));
            setActiveStep(2);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : 'ไม่สามารถล็อกที่นั่งได้';
            setBookingError(reason instanceof SeatHoldConflictError && reason.unavailableSeats.length ? `${message} กรุณาเลือกใหม่` : message);
            const rows = await seatInventoryApi.listSeats(id, zone).catch(() => []);
            setSeats((current) => mergeSeatInventory(rows, current));
        }
    };

    // ========== หมดเวลา Lock ==========
    const handleLockExpired = () => {
        const token = holdTokenRef.current;
        holdTokenRef.current = '';
        setHoldToken('');
        if (token) void seatInventoryApi.releaseHold(token).catch(() => undefined);
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
    const handleCancelLock = async () => {
        clearTimer();
        const token = holdTokenRef.current;
        holdTokenRef.current = '';
        setHoldToken('');
        if (token) await seatInventoryApi.releaseHold(token).catch(() => undefined);
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

    const handleBackToZones = async () => {
        if (isLocked) await handleCancelLock();
        navigate(`/event/${id}/zones`);
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
        setBookingError('');
        const session = getCustomerSession();
        const seatLabels = activeSeats.map((s) => s.id);
        try {
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
                holdToken,
            });

            clearTimer();
            holdTokenRef.current = '';
            setHoldToken('');
            setSeats((current) => current.map((seat) => ({ ...seat, status: seat.status === 'locked' ? 'reserved' : seat.status })));
            setIsLocked(false);
            setShowQRDialog(false);
            setLatestBookingId(record.id);
            setShowSuccessDialog(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึกการจองได้';
            setBookingError(message);
            // ที่นั่งอาจถูกคนอื่นชิงไป — ดึงผังล่าสุดมาแสดงใหม่
            if (id && zone) {
                const rows = await seatInventoryApi.listSeats(id, zone, holdTokenRef.current || undefined).catch(() => []);
                setSeats((current) => mergeSeatInventory(rows, current));
            }
        }
    };

    // ========== คลิกเลือกที่นั่ง ==========
    const handleSeatClick = (seatId: string) => {
        if (isLocked) return;
        setSeats((prev) =>
            prev.map((seat) => {
                if (seat.id !== seatId) return seat;
                if (seat.status === 'reserved' || seat.status === 'locked' || seat.status === 'held' || seat.status === 'disabled') return seat;
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
                onBack={handleBackToZones}
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

                {bookingError && <ErrorAlert message={bookingError} />}

                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 4, justifyContent: 'center',
                    alignItems: { xs: 'center', md: 'flex-start' }
                }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <CustomerLayoutCanvas layout={layout} mode="seats" selectedZoneId={zone} seats={seats}
                            interactionLocked={isLocked} onSeatClick={handleSeatClick} />
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mt: 2 }}>
                            {[
                                { color: zoneInfo.color, label: 'ว่าง', opacity: 1 },
                                { color: '#2196F3', label: 'เลือกแล้ว', opacity: 1 },
                                { color: '#FF9800', label: 'ล็อกของคุณ', opacity: 1 },
                                { color: '#616161', label: 'ไม่ว่าง / ถูกล็อก', opacity: .48 },
                            ].map((item) => <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 20, height: 20, bgcolor: item.color, borderRadius: 1, opacity: item.opacity }} /><Box sx={{ color: '#ccc', fontSize: 13 }}>{item.label}</Box></Box>)}
                        </Box>
                    </Box>

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
                        onBack={handleBackToZones}
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
