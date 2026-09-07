import { createTheme } from '@mui/material/styles'

export const brand = {
  // พาเลตหลัก — ห้ามเพิ่มสีใหม่นอกห้าค่านี้
  navy: '#050C38',
  purple: '#6700A3',
  magenta: '#EE22FF',
  coral: '#FF5A57',
  white: '#FFFFFF',

  // ค่าที่เหลือได้จากการใส่ alpha ให้พาเลตหลักเท่านั้น
  panelTint: 'rgba(238, 34, 255, 0.08)',
  border: 'rgba(5, 12, 56, 0.10)',
  navyFaded: 'rgba(5, 12, 56, 0.25)',
  textMuted: 'rgba(5, 12, 56, 0.60)',
} as const

export const theme = createTheme({
  palette: {
    primary: { main: brand.coral, contrastText: brand.white },
    secondary: { main: brand.magenta, contrastText: brand.white },
    background: { default: brand.white, paper: brand.white },
    text: { primary: brand.navy, secondary: brand.textMuted },
  },
  typography: {
    fontFamily: '"Noto Sans Thai", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 700 },
    h2: { fontSize: '1.375rem', fontWeight: 700 },
    h3: { fontSize: '1.125rem', fontWeight: 700 },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, textTransform: 'none', fontWeight: 600 },
      },
    },
  },
})
