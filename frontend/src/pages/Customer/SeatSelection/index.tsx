import { Box, Container, Stepper, Step, StepLabel } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';

// Types & Constants
import type { SeatData } from '@/components/SeatSelection/types';
import { eventsMap, zonePriceMap, LOCK_DURATION, STEPS, generateSeats } from '@/components/SeatSelection/constants';

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
    const event = (id && eventsMap[id]) ? eventsMap[id] : eventsMap['2'];
    const zoneInfo = (zone && zonePriceMap[zone]) ? zonePriceMap[zone] : zonePriceMap['A1'];

    const [seats, setSeats] = useState<SeatData[]>(generateSeats);
    const [isLocked, setIsLocked] = useState(false);
    const [timeLeft, setTimeLeft] = useState(LOCK_DURATION);
    const [showExpiredDialog, setShowExpiredDialog] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [showQRDialog, setShowQRDialog] = useState(false);
    const [activeStep, setActiveStep] = useState(1);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const selectedSeats = seats.filter((s) => s.status === 'selected');
    const lockedSeats = seats.filter((s) => s.status === 'locked');
    const activeSeats = isLocked ? lockedSeats : selectedSeats;
    const totalPrice = activeSeats.length * zoneInfo.price;

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

    // ========== จำลองการชำระเงินสำเร็จ ==========
    const handleSimulateScanSuccess = () => {
        clearTimer();
        setSeats((prev) =>
            prev.map((seat) => ({
                ...seat,
                status: seat.status === 'locked' ? 'reserved' : seat.status,
            }))
        );
        setIsLocked(false);
        setShowQRDialog(false);
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
                totalPrice={totalPrice}
                timeLeft={timeLeft}
                onSimulateSuccess={handleSimulateScanSuccess}
            />

            <SuccessDialog 
                open={showSuccessDialog}
                event={event}
                zone={zone || ''}
                zoneInfo={zoneInfo}
                totalPrice={totalPrice}
                onHomeClick={() => navigate('/home')}
            />
        </Box>
    );
};

export default SeatSelectionPage;
