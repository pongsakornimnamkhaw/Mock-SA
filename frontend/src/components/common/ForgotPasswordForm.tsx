import { useState } from 'react'
import { Box, Button, TextField } from '@mui/material' 
import EmailIcon from '@mui/icons-material/Email'

const ForgotPasswordForm = () => {
    const [email, setEmail] = useState('')
    const handleSumit = (e: React.FormEvent) => {
        e.preventDefault()
        console.log('Reset Password:', email)
    };

    return (
        <Box component="form" onSubmit={handleSumit} sx={{ width: '100%' }}>
            <Box 
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 3,
                }}
            >
                <EmailIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="อีเมล"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    sx={{ 
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f5f5f5',   
                                borderRadius: '15px', 
                            },
                        }}
                />
            </Box>

            <Button variant="contained" type="submit"  
                sx={{ 
                    bgcolor: '#FF5A57', 
                    borderRadius: '15px', 
                    fontSize: '18px', 
                    py: 1.5,
                    width: '80%',
                    display: 'flex',
                    justifyContent: 'center',
                    mx: 'auto',
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: '#050C38' }
                }}
            >
                ยืนยันอีเมล
            </Button>
        </Box>
    );
};

export default ForgotPasswordForm