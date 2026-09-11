import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { employeeAuthApi } from '@/api/employeeAuthApi';
import { clearEmployeeSession, saveEmployeeSession } from '@/utils/employeeSession';

interface EmployeeRouteGuardProps {
  children: ReactNode;
}

export default function EmployeeRouteGuard({ children }: EmployeeRouteGuardProps) {
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
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/employee/login?redirect=${returnUrl}`} replace />;
  }

  return <>{children}</>;
}
