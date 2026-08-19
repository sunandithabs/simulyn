'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api, onUnauthorized, setAccessToken } from '@/lib/api';
import type { AuthResponse, AuthUser, Role } from '@/lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const HOME_ROUTE: Record<Role, string> = {
  STUDENT: '/student',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const bootstrapped = useRef(false);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const result = await api.post<AuthResponse>('/auth/refresh', undefined, {
        retryOnUnauthorized: false,
      });
      setAccessToken(result.accessToken);
      setUser(result.user);
      return result.user;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // Restore the session on first paint using the httpOnly refresh cookie.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  // A failed refresh mid-session means the cookie is gone: send them to sign in.
  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setAccessToken(null);
    });
    return () => onUnauthorized(null);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    const result = await api.post<AuthResponse>('/auth/login', { username, password });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, setUser }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/**
 * Guards a role-specific area. Redirects to sign-in when signed out, to the
 * password change screen when one is pending, and home when the role is wrong.
 */
export function useRequireRole(role: Role): { user: AuthUser | null; ready: boolean } {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.mustChangePassword) {
      router.replace('/change-password');
      return;
    }
    if (user.role !== role) {
      router.replace(HOME_ROUTE[user.role]);
    }
  }, [user, loading, role, router]);

  return {
    user,
    ready: !loading && user !== null && user.role === role && !user.mustChangePassword,
  };
}
