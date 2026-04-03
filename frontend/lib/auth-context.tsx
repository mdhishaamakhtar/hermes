"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { api } from "./api";

interface User {
  id: number;
  email: string;
  displayName: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("hermes_token") : null,
  );
  // true only when a token exists and we're verifying it; false immediately otherwise
  const [isLoading, setIsLoading] = useState(
    () =>
      typeof window !== "undefined" && !!localStorage.getItem("hermes_token"),
  );

  const logout = useCallback(() => {
    localStorage.removeItem("hermes_token");
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("hermes_token", newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener("unauthorized", handleUnauthorized);

    const savedToken = localStorage.getItem("hermes_token");
    if (!savedToken) return; // isLoading already false from lazy init

    api
      .get<User>("/api/auth/me")
      .then((res) => {
        if (res.success) setUser(res.data);
        else logout();
      })
      .catch(logout)
      .finally(() => setIsLoading(false));

    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, [logout]);

  const value = useMemo(
    () => ({ user, token, login, logout, isLoading }),
    [user, token, login, logout, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
