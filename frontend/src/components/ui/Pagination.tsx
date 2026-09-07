// src/components/ui/Pagination.tsx
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 4) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
      <IconButton
        size="small"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        sx={{ border: '1px solid #e2e8f0', borderRadius: 2, width: 30, height: 30 }}
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>

      {getPageNumbers().map((page, idx) =>
        page === '...' ? (
          <Typography key={`dot-${idx}`} sx={{ px: 0.5, color: '#94a3b8', fontSize: '0.85rem' }}>
            ...
          </Typography>
        ) : (
          <Button
            key={page}
            size="small"
            variant={currentPage === page ? 'contained' : 'outlined'}
            onClick={() => onPageChange(page as number)}
            sx={{
              minWidth: 30,
              height: 30,
              p: 0,
              fontSize: '0.82rem',
              borderRadius: 2,
              borderColor: '#e2e8f0',
              color: currentPage === page ? '#fff' : '#475569',
              ...(currentPage === page
                ? { background: 'linear-gradient(135deg, #d63384, #b5206a)', border: 'none' }
                : {}),
            }}
          >
            {page}
          </Button>
        )
      )}

      <IconButton
        size="small"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        sx={{ border: '1px solid #e2e8f0', borderRadius: 2, width: 30, height: 30 }}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
