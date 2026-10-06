import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { api, getStoredToken, storeToken, removeToken, getStoredUser, storeUser, ApiError } from '../services/api';

interface RegisterPayload {
  name: string;
  identifier: string; // USN or Faculty ID
  email: string;
  role: Role;
  department: string;
  semester?: number;
  designation?: string;
  facultyCode?: string;
  parentName?: string;
  parentContact?: string;
  parentEmail?: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (role: Role, identifier: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  isStudent: boolean;
  isFaculty: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Restore session from token on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<{ user: User }>('/auth/me');
        if (isMounted) {
          setUser(response.user);
          storeUser(response.user);
        }
      } catch (err: any) {
        console.warn('Session restoration failed:', err.message);
        if (isMounted) {
          removeToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initSession();

    const handleAuthExpired = () => {
      setToken(null);
      setUser(null);
      setError('Your attendance session expired. Please log in again.');
    };

    window.addEventListener('gec:auth_expired', handleAuthExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('gec:auth_expired', handleAuthExpired);
    };
  }, []);

  const login = async (role: Role, identifier: string, password: string): Promise<User> => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.post<{ token: string; user: User }>('/auth/login', {
        role,
        identifier: identifier.trim().toUpperCase(),
        password,
      });

      storeToken(response.token);
      storeUser(response.user);
      setToken(response.token);
      setUser(response.user);
      return response.user;
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please verify credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.post<{ token: string; user: User }>('/auth/register', {
        ...payload,
        identifier: payload.identifier.trim().toUpperCase(),
      });

      storeToken(response.token);
      storeUser(response.user);
      setToken(response.token);
      setUser(response.user);
      return response.user;
    } catch (err: any) {
      const msg = err.message || 'Registration failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout').catch(() => {});
      }
    } finally {
      removeToken();
      setToken(null);
      setUser(null);
      setError(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get<{ user: User }>('/auth/me');
      setUser(response.user);
      storeUser(response.user);
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const isStudent = user?.role === 'student';
  const isFaculty = user?.role === 'faculty';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser,
        clearError,
        isStudent,
        isFaculty,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
