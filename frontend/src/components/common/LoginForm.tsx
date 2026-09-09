import { useState} from 'react'
import { Box, Button, TextField, IconButton, InputAdornment, Link} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const LogginFrom = () => { //React.FC || () =>  identify that this is a functional component
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();  //no refresh page
        console.log('Login:', { email, password });  //API call
    };

    return (
        // component="form" is form for send data to backend
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
                fullWidth  //input field take full width
                label = "อีเมล"
                value = {email} //value is the value of the input field
                onChange = { (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value) } //onChange is the event that is triggered when the value of the input field changes
                sx = {{mb: 2, '& .MuiOutlinedInput-root' : {
                    bgcolor: '#f5f5f5',
                    borderRadius: '15px',
                },
            }}
            />

            <TextField
                fullWidth
                label = "รหัสผ่าน"
                type = {showPassword ? 'text' : 'password'} //show password or hide password
                value = {password}
                onChange = { (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value) }
                sx = {{'& .MuiOutlinedInput-root' : {
                    bgcolor: '#f5f5f5',
                    borderRadius: '15px',
                    },
                }}
                slotProps = {{
                    input: {
                        //endAdornment is the icon that is displayed at the end of the input field
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                    {showPassword ? <VisibilityOff /> : <Visibility />}

                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3, mt: 1 , fontSize: '16px'}}>
                <Link component={RouterLink} to="/forgot-password" underline="hover" sx={{ color: '#000000'}}>
                    ลืมรหัสผ่าน
                </Link>
            </Box>

            <Button type="submit" variant="contained"
                    sx={{
                        bgcolor: '#FF5A57',
                        borderRadius: '15px',
                        width: '80%',
                        py: 1.5,
                        display: 'flex',
                        fontWeight: 'bold',
                        fontSize: '18px',
                        justifyContent: 'center',
                        mx: 'auto',
                        '&:hover': { bgcolor: '#050C38' }
                    }}
                >
                เข้าสู่ระบบ
            </Button>
        </Box>
    );
};
export default LogginFrom;