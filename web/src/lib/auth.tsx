"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getToken, setToken } from "./api";
import type { AuthResponse, MeResponse, UserPublic } from "./types";

type AuthContextValue = {
  user: UserPublic | null;
  token: string | null;
  unreadAlerts: number;
  unreadMessages: number;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  const applyAuth = useCallback((nextToken: string, nextUser: UserPublic) => {
    setToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
  }, []);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setTokenState(null);
      setUnreadAlerts(0);
      setUnreadMessages(0);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<MeResponse>("/me", { token: t });
      setTokenState(t);
      // Always trust /me — role and other fields must stay in sync with the server.
      setUser(data.user);
      setUnreadAlerts(data.unreadAlerts);
      setUnreadMessages(data.unreadMessages);
    } catch {
      setToken(null);
      setTokenState(null);
      setUser(null);
      setUnreadAlerts(0);
      setUnreadMessages(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (!getToken()) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (loginName: string, password: string) => {
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: { login: loginName, password },
        auth: false,
      });
      applyAuth(data.token, data.user);
      await refresh();
    },
    [applyAuth, refresh],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const data = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: { username, email, password },
        auth: false,
      });
      applyAuth(data.token, data.user);
      await refresh();
    },
    [applyAuth, refresh],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    setUnreadAlerts(0);
    setUnreadMessages(0);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      unreadAlerts,
      unreadMessages,
      loading,
      login,
      register,
      logout,
      refresh,
    }),
    [
      user,
      token,
      unreadAlerts,
      unreadMessages,
      loading,
      login,
      register,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
