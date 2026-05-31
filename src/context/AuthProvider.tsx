import React, { createContext, useContext, useState } from "react";
import api from "../api/axios";

type User = { id: string; name?: string; role?: string } | null;

type AuthContextType = {
  user: User;
  login: (credentials: {
    email: string;
    password: string;
    role?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User>(null);

  const login = async (credentials: {
    email: string;
    password: string;
    role?: string;
  }) => {
    const res = await api.post("/api/login", credentials);
    const { token, user: u } = res.data;
    if (token) {
      try {
        localStorage.setItem("auth:token", token);
      } catch (e) {
        // ignore
      }
    }
    setUser(u || null);
  };

  const logout = () => {
    try {
      localStorage.removeItem("auth:token");
    } catch (e) {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
