import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { employeeAuthApi } from '@/api/employeeAuthApi';
import { clearEmployeeSession, getEmployeeSession, saveEmployeeSession } from '@/utils/employeeSession';
import { getCustomerSession } from '@/utils/customerSession';
import { effectiveFeatureAccess, effectiveModulePermissions, hasModuleAccess, type AccessLevel, type BackofficeFeature, type BackofficeModule } from '@/access/backofficeAccess';

interface EmployeeRouteGuardProps {
  children: ReactNode;
  module?: BackofficeModule;
  feature?: BackofficeFeature;
  required?: Extract<AccessLevel, 'view' | 'edit'>;
}

export default function EmployeeRouteGuard({ children, module, feature, required = 'view' }: EmployeeRouteGuardProps) {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    employeeAuthApi.getMe().then((session) => {
      if (!active) return;

      if (session) {
        saveEmployeeSession(session);
        setAuthenticated(true);
        return;
      }

      clearEmployeeSession();
      setAuthenticated(false);
    });

    return () => {
      active = false;
    };
  }, []);

  // Do not render protected content while the server-side session is being checked.
  if (authenticated === null) return null;

  if (!authenticated) {
    if (getCustomerSession()) {
      return <Navigate to="/home" replace />;
    }
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/employee/login?redirect=${returnUrl}`} replace />;
  }

  const session = getEmployeeSession();
  if (feature && session && !hasModuleAccess({ dashboard: effectiveFeatureAccess(session.role, session.jobRole, session.department, feature) }, 'dashboard', required)) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#050C38', mb: 1 }}>ไม่มีสิทธิ์เข้าถึงส่วนนี้</Typography>
          <Typography color="text.secondary">กรุณาติดต่อผู้ดูแลระบบหากต้องการใช้งานหน้านี้</Typography>
        </Box>
      </Box>
    );
  }
  if (module && session) {
    const permissions = effectiveModulePermissions(session.role, session.department, session.modulePermissions, session.jobRole);
    if (!hasModuleAccess(permissions, module, required)) {
      return (
        <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', p: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#050C38', mb: 1 }}>ไม่มีสิทธิ์เข้าถึงส่วนนี้</Typography>
            <Typography color="text.secondary">กรุณาติดต่อผู้ดูแลระบบหากต้องการใช้งานโมดูลนี้</Typography>
          </Box>
        </Box>
      );
    }
  }

  return <>{children}</>;
}
