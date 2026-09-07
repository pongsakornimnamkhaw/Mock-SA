import type { SystemStyleObject } from '@mui/system';
import type { Theme } from '@mui/material/styles';

// Match ArtistDashboard and the shared artist/performance Header.
export const promotionFontSizes = {
  body: '1.125rem', // 18px
  secondary: '0.875rem', // 14px
  heading: '1.75rem', // 28px
} as const;

export const promotionTitleSx = {
  fontSize: { xs: '2rem', lg: '3rem' },
  fontWeight: 700,
  lineHeight: 1.2,
  color: '#0d1b5e',
} as const;

export const promotionPageSx: SystemStyleObject<Theme> = {
  fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
  fontSize: promotionFontSizes.body,
  lineHeight: 1.6,
  // Keep native text and nested labels consistent despite global page CSS.
  '& *': { fontFamily: 'inherit' },
  '& .MuiButton-root, & .MuiTab-root, & .MuiInputBase-root, & .MuiTableCell-root': {
    fontSize: promotionFontSizes.body,
  },
  '& .MuiButton-root, & .MuiTab-root': {
    fontWeight: 700,
    lineHeight: 1.5,
    textTransform: 'none',
  },
  '& .MuiTableCell-head': { fontWeight: 700 },
  '& .MuiChip-root': {
    fontSize: promotionFontSizes.secondary,
    fontWeight: 700,
    minHeight: 28,
    height: 'auto',
  },
  '& .MuiChip-label': { py: 0.25 },
};
