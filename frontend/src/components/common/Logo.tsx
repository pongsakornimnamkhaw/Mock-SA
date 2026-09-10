import { Logo1, Logo2 } from '@/assets/logo'

const LogoMap = {
    OC1: Logo1,
    OC2: Logo2,
};

type LogoVariant = keyof typeof LogoMap;  // Define a type for the logo variants

interface LogoProps {
    variant: LogoVariant;
    width?: number | string;
}

const Logo =({ variant = 'OC1', width = 200} : LogoProps) => {
    const logoSrc = LogoMap[variant]; 
    
    return (
        <img
            src =  {logoSrc}
            alt = "Octavia"
            width = {width}
            style = {{ height: 'auto' }}
        />
    );
};

export default Logo
