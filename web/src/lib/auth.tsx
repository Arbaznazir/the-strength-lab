"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, clearToken, getToken, setToken } from "./api";
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
    try {
      // Cookie session and/or memory bearer — always try /me
      const t = getToken();
      const data = await apiFetch<MeResponse>("/me", t ? { token: t } : {});
      if (t) setTokenState(t);
      setUser(data.user);
      setUnreadAlerts(data.unreadAlerts);
      setUnreadMessages(data.unreadMessages);
    } catch {
      clearToken();
      setTokenState(null);
      setUser(null);
      setUnreadAlerts(0);
      setUnreadMessages(0);
    } finally {
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
    void apiFetch("/auth/logout", { method: "POST", auth: false }).catch(() => undefined);
    clearToken();
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
