import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '../providers/TenantProvider';
import { useAdmin } from '../hooks/useAdmin';

interface SuspendedTenantGuardProps {
  children: React.ReactNode;
}

// Pages that are allowed even when suspended
const ALLOWED_PATHS = ['/tenant', '/login', '/register', '/legal', '/confirm-email', '/forgot-password'];

export function SuspendedTenantGuard({ children }: SuspendedTenantGuardProps) {
  const { isSuspended } = useTenant();
  const { isActualAdmin, isLoading: isAdminLoading } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('SuspendedTenantGuard check:', { 
      isSuspended, 
      isActualAdmin, 
      isAdminLoading,
      pathname: location.pathname 
    });
    
    // Wait for admin status to load
    if (isAdminLoading) {
      return;
    }
    
    // Only redirect admins of suspended tenants
    if (isSuspended && isActualAdmin) {
      const isAllowedPath = ALLOWED_PATHS.some(path => 
        location.pathname === path || location.pathname.startsWith(path + '/')
      );
      
      console.log('Suspended tenant admin detected, isAllowedPath:', isAllowedPath);
      
      if (!isAllowedPath) {
        console.log('Redirecting to /tenant');
        // Redirect to tenant page where they can see billing info
        navigate('/tenant', { replace: true });
      }
    }
  }, [isSuspended, isActualAdmin, isAdminLoading, location.pathname, navigate]);

  return <>{children}</>;
}
