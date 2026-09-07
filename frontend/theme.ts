import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1a1a2e', // dark navy blue
    },
    secondary: {
      main: '#e91e8c', // pink-purple
    },
    success: {
      main: '#4caf50', // green
    },
    error: {
      main: '#ef5350', // red
    },
    warning: {
      main: '#ff9800', // orange
    },
    info: {
      main: '#2196f3', // blue
    },
    text: {
      primary: '#0d1b5e', // headings
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
    fontSize: 18,
    h1: { fontSize: '28px', fontWeight: 'bold' },
    h2: { fontSize: '28px', fontWeight: 'bold' },
    h3: { fontSize: '28px', fontWeight: 'bold' },
    h4: { fontSize: '28px', fontWeight: 'bold' },
    h5: { fontSize: '28px', fontWeight: 'bold' },
    h6: { fontSize: '28px', fontWeight: 'bold' },
    subtitle1: { fontSize: '18px', fontWeight: 'bold' },
    subtitle2: { fontSize: '14px', fontWeight: 'bold' },
    body1: { fontSize: '18px' },
    body2: { fontSize: '18px' },
    button: { fontSize: '18px', textTransform: 'none' },
    caption: { fontSize: '14px' },
    overline: { fontSize: '14px' },
  },
  components: {
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '18px',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: '18px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '18px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '18px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '14px',
        },
      },
    },
  },
});

export default theme;
