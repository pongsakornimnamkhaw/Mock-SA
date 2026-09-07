// src/theme/theme.ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#d63384',
      light: '#e85fa0',
      dark: '#b5206a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',
      light: '#9b5cf6',
      dark: '#5b21b6',
    },
    success: { main: '#22c55e' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    background: {
      default: '#f4f5f7',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans Thai", "Roboto", "Helvetica", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, padding: '7px 20px', fontSize: '0.875rem' },
      },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 6, fontWeight: 600, fontSize: '0.75rem' } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: '#f8fafc',
            fontWeight: 600,
            color: '#64748b',
            fontSize: '0.8rem',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 0 },
          '&:hover': { backgroundColor: '#fdf2f8' },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          minWidth: 80,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
  },
});
