/**
 * M8 — Authentication context for the Appointment AI frontend.
 *
 * Cookie-based session management:
 * - The auth JWT lives ONLY in the HttpOnly cookie (`auth_token`).
 * - JavaScript never reads or writes the token.
 * - Authentication state is verified via GET /api/auth/me.
 *
 * The AuthProvider wraps the entire app (see app/layout.tsx). Consumers
 * use the `useAuth()` hook.
 */
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { api, ApiError } from '@/lib/api';
import type { User, LoginInput, SignupInput } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  /** True during the initial session-restoration check. */
  isRestoring: boolean;
  login: (data: LoginInput) => Promise<void>;
  signup: (data: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Calls GET /auth/me to restore session from the HttpOnly cookie.
   * Sets user or null; always clears `isRestoring`.
   */
  const restoreSession = async () => {
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  const login = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const res = await api.login(data);
      setUser(res.user);
      // Re-check to make sure the cookie was set correctly.
      await restoreSession();
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupInput) => {
    setIsLoading(true);
    try {
      const res = await api.signup(data);
      setUser(res.user);
      await restoreSession();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Cookie might already be gone; ignore.
    } finally {
      setUser(null);
      setIsRestoring(false);
    }
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    isRestoring,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook for consuming auth state.
 * Throws if used outside of AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/**
 * Hook that provides a typed reference to the API error.
 */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}