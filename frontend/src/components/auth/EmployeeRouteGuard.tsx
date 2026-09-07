import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getEmployeeSession } from '@/utils/employeeSession';

interface EmployeeRouteGuardProps {
  children: ReactNode;
}

export default function EmployeeRouteGuard({ children }: EmployeeRouteGuardProps) {
  const session = getEmployeeSession();
  const location = useLocation();

  if (!session) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/employee/login?redirect=${returnUrl}`} replace />;
  }

  return <>{children}</>;
}
