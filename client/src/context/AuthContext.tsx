/*
  AuthContext.tsx — Global authentication provider component.
  Manages HTTP-only cookie-based session lifecycle and exposes user state, login, and logout.
*/

import React, { useEffect, useState, useCallback } from 'react';
import { api, type UserProfile } from '../services/api';
import { AuthContext } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const meRes = await api.auth.getMe();
      if (meRes.ok && meRes.data?.user) {
        setUser(meRes.data.user);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      const refreshRes = await api.auth.refresh();
      if (refreshRes.ok) {
        const retryMe = await api.auth.getMe();
        if (retryMe.ok && retryMe.data?.user) {
          setUser(retryMe.data.user);
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }
      }

      setUser(null);
      setIsAuthenticated(false);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const meRes = await api.auth.getMe();
        if (cancelled) return;
        if (meRes.ok && meRes.data?.user) {
          setUser(meRes.data.user);
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }

        const refreshRes = await api.auth.refresh();
        if (cancelled) return;
        if (refreshRes.ok) {
          const retryMe = await api.auth.getMe();
          if (cancelled) return;
          if (retryMe.ok && retryMe.data?.user) {
            setUser(retryMe.data.user);
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        }

        setUser(null);
        setIsAuthenticated(false);
      } catch {
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    if (res.ok && res.data?.user) {
      setUser(res.data.user);
      setIsAuthenticated(true);
      return { ok: true };
    }
    return { ok: false, error: res.error || 'Login failed' };
  };

  const register = async (email: string, password: string, username: string) => {
    const res = await api.auth.register(email, password, username);
    if (res.ok && res.data?.user) {
      setUser(res.data.user);
      setIsAuthenticated(true);
      return { ok: true };
    }
    return { ok: false, error: res.error || 'Registration failed' };
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
