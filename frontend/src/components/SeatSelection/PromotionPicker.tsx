import type { FormEvent } from 'react';
import { Box, Typography, FormControl, Select, MenuItem, TextField, Button, Chip, CircularProgress } from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import type { CustomerPromotion } from '@/types/customerPromotion';
import { discountLabel } from '@/utils/customerPromotion';

export interface PromotionPickerProps {
    /** โปรโมชั่นที่ระบบจับคู่ให้เองจากคอนเสิร์ต/โซน/ยอดปัจจุบัน */
    eligiblePromotions: CustomerPromotion[];
    /** โปรโมชั่นที่ลูกค้ากรอกรหัสเข้ามาเองและผ่านการตรวจจาก backend แล้ว */
    redeemedPromotions: CustomerPromotion[];
    selectedPromotionId: string;
    autoSelected: boolean;
    loading: boolean;
    loadError: string;
    codeValue: string;
    codeError: string;
    codeSuccess: string;
    codeSubmitting: boolean;
    disabled: boolean;
    onSelect: (promotionId: string) => void;
    onCodeChange: (value: string) => void;
    onCodeSubmit: () => void;
}

const PromotionPicker = ({
    eligiblePromotions, redeemedPromotions, selectedPromotionId, autoSelected,
    loading, loadError, codeValue, codeError, codeSuccess, codeSubmitting, disabled,
    onSelect, onCodeChange, onCodeSubmit,
}: PromotionPickerProps) => {
    const options: CustomerPromotion[] = [];
    for (const promotion of [...redeemedPromotions, ...eligiblePromotions]) {
        if (!options.some((option) => option.promotion_id === promotion.promotion_id)) {
            options.push(promotion);
        }
    }

    const canSubmitCode = !disabled && !codeSubmitting && codeValue.trim() !== '';

    const handleSubmit = (formEvent: FormEvent) => {
        formEvent.preventDefault();
        if (canSubmitCode) onCodeSubmit();
    };

    return (
        <Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <LocalOfferOutlinedIcon sx={{ color: '#d63384', fontSize: 19 }} />
                    <Typography sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>โปรโมชั่น</Typography>
                </Box>
                {autoSelected && selectedPromotionId !== '' && (
                    <Chip size="small" label="เลือกให้อัตโนมัติ" color="success" sx={{ height: 22, fontSize: '0.68rem' }} />
                )}
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#777', py: 1 }}>
                    <CircularProgress size={16} />
                    <Typography sx={{ fontSize: '0.78rem' }}>กำลังตรวจสอบโปรโมชั่น...</Typography>
                </Box>
            ) : (
                <FormControl fullWidth size="small">
                    <Select
                        value={selectedPromotionId}
                        onChange={(changeEvent) => onSelect(changeEvent.target.value)}
                        displayEmpty
                        disabled={disabled}
                        inputProps={{ 'aria-label': 'เลือกโปรโมชั่น' }}
                        sx={{ fontSize: '0.8rem', bgcolor: '#fff8fb' }}
                    >
                        <MenuItem value=""><em>ไม่ใช้โปรโมชั่น</em></MenuItem>
                        {options.map((promotion) => (
                            <MenuItem key={promotion.promotion_id} value={promotion.promotion_id} sx={{ fontSize: '0.8rem' }}>
                                {discountLabel(promotion)} · {promotion.discount.promo_code}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {!loading && loadError !== '' && (
                <Typography sx={{ color: '#d32f2f', fontSize: '0.72rem', mt: 0.75 }}>
                    โหลดรายการโปรโมชั่นไม่ได้ กรอกรหัสโปรโมชั่นเองได้ด้านล่าง
                </Typography>
            )}

            {!loading && loadError === '' && options.length === 0 && (
                <Typography sx={{ color: '#999', fontSize: '0.72rem', mt: 0.75 }}>
                    ยังไม่มีโปรโมชั่นที่ตรงกับยอดและโซนที่เลือก — ถ้ามีรหัสส่วนลด กรอกได้เลย
                </Typography>
            )}

            {!loading && autoSelected && selectedPromotionId !== '' && (
                <Typography sx={{ color: '#2e7d32', fontSize: '0.72rem', mt: 0.75 }}>
                    ✓ ระบบเลือกโปรโมชั่นที่ประหยัดที่สุดให้แล้ว
                </Typography>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <TextField
                    label="รหัสโปรโมชั่น"
                    size="small"
                    fullWidth
                    value={codeValue}
                    disabled={disabled}
                    onChange={(changeEvent) => onCodeChange(changeEvent.target.value)}
                    slotProps={{ htmlInput: { maxLength: 40, autoCapitalize: 'characters', spellCheck: false } }}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                />
                <Button
                    type="submit"
                    variant="outlined"
                    disabled={!canSubmitCode}
                    sx={{
                        whiteSpace: 'nowrap', borderRadius: '8px', textTransform: 'none',
                        borderColor: '#d63384', color: '#d63384',
                        '&:hover': { borderColor: '#b02a6b', bgcolor: 'rgba(214,51,132,0.05)' },
                    }}
                >
                    {codeSubmitting ? <CircularProgress size={16} /> : 'ใช้โค้ด'}
                </Button>
            </Box>

            {codeError !== '' && (
                <Typography sx={{ color: '#d32f2f', fontSize: '0.72rem', mt: 0.75 }}>{codeError}</Typography>
            )}
            {codeError === '' && codeSuccess !== '' && (
                <Typography sx={{ color: '#2e7d32', fontSize: '0.72rem', mt: 0.75 }}>{codeSuccess}</Typography>
            )}
        </Box>
    );
};

export default PromotionPicker;
