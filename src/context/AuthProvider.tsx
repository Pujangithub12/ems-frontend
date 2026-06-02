import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

type User = { id: string; fullName?: string; email?: string; role?: string } | null;

type AuthContextType = {
  user: User;
  login: (credentials: {
    email: string;
    password: string;
    role?: string;
  }) => Promise<void>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get("/api/me");
        setUser(res.data.user);
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (credentials: {
    email: string;
    password: string;
    role?: string;
  }) => {
    const res = await api.post("/api/login", credentials);
    const { user: u } = res.data;
    setUser(u || null);
  };

  const logout = async () => {
    try {
      await api.post("/api/logout");
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
