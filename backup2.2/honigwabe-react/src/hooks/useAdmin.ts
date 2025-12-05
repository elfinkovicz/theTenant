import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { jwtDecode } from 'jwt-decode';

interface CognitoToken {
  sub: string;
  email: string;
  'cognito:groups'?: string | string[];
  'custom:role'?: string;
}

export function useAdmin() {
  const { accessToken, isAuthenticated } = useAuthStore();

  const isAdmin = useMemo(() => {
    if (!isAuthenticated || !accessToken) {
      return false;
    }

    try {
      const decoded = jwtDecode<CognitoToken>(accessToken);
      const groups = decoded['cognito:groups'];
      
      if (!groups) {
        return false;
      }

      // Groups can be a string or array
      const groupArray = typeof groups === 'string' ? [groups] : groups;
      return groupArray.includes('admins');
    } catch (error) {
      console.error('Error decoding token:', error);
      return false;
    }
  }, [accessToken, isAuthenticated]);

  return { isAdmin };
}
