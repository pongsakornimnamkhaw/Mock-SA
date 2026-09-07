import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCustomerSession } from '@/utils/customerSession';

interface CustomerRouteGuardProps {
  children: ReactNode;
}

export default function CustomerRouteGuard({ children }: CustomerRouteGuardProps) {
  const session = getCustomerSession();
  const location = useLocation();

  if (!session) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} replace />;
  }

  return <>{children}</>;
}
