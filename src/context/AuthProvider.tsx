import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import api from "../api/axios";

export type User = {
  id: string;
  fullName?: string;
  email?: string;
  role?: string;
} | null;

export type Workspace = {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
};

type AuthContextType = {
  user: User;
  workspace: Workspace | null;
  workspaces: Workspace[];
  login: (credentials: {
    email: string;
    password: string;
    role?: string;
  }) => Promise<void>;
  logout: () => void;
  switchWorkspace: (workspaceId: number) => Promise<void>;
  createWorkspace: (name: string, description?: string) => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  // FIX 2: Track whether login() has already run so the background checkAuth
  // on mount cannot overwrite a just-completed login with a stale null.
  // Without this, the sequence is:
  //   1. Mount → checkAuth() starts (async, cookie not yet set)
  //   2. login() succeeds → setUser(admin)
  //   3. checkAuth() finishes → GET /api/me returns 401 (cookie race) → setUser(null)  ← kicks user out
  const didLoginRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const INACTIVITY_TIMEOUT = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT) as unknown as number;
    }
  };

  const handleUserActivity = () => {
    resetInactivityTimer();
  };

  const fetchWorkspacesAndCurrent = async () => {
    try {
      const [workspacesRes, currentRes] = await Promise.all([
        api.get("/api/workspaces"),
        api.get("/api/workspaces/current"),
      ]);
      // Filter out any null/undefined workspaces from the response
      const validWorkspaces = workspacesRes.data.workspaces.filter(
        (w: any): w is Workspace => w !== null && w !== undefined,
      );
      setWorkspaces(validWorkspaces);
      setWorkspace(currentRes.data.workspace);
    } catch (err) {
      console.error("Failed to fetch workspaces", err);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get("/api/me");
        // Only update state if login() hasn't already handled it
        if (!didLoginRef.current) {
          setUser(res.data.user);
          await fetchWorkspacesAndCurrent();
        }
      } catch {
        if (!didLoginRef.current) {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      // Reset timer when user is authenticated
      resetInactivityTimer();
      // Add event listeners for user activity
      const events = [
        "mousedown",
        "mousemove",
        "keydown",
        "scroll",
        "click",
        "touchstart",
      ];
      events.forEach((event) => {
        window.addEventListener(event, handleUserActivity);
      });
      return () => {
        // Clean up event listeners
        events.forEach((event) => {
          window.removeEventListener(event, handleUserActivity);
        });
        // Clear timer
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      };
    } else {
      // Clear timer when user is not authenticated
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    }
  }, [user]);

  const login = async (credentials: {
    email: string;
    password: string;
    role?: string;
  }) => {
    // Mark that we've logged in so the concurrent checkAuth won't overwrite us
    didLoginRef.current = true;
    const res = await api.post("/api/login", credentials);
    const { user: u } = res.data;
    setUser(u || null);
    await fetchWorkspacesAndCurrent();
    // Ensure loading is false so DashboardLayout doesn't show the spinner
    setLoading(false);
  };

  const logout = async () => {
    didLoginRef.current = false;
    try {
      await api.post("/api/logout");
    } catch (err) {
      console.error("Logout failed", err);
    }
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
  };

  const switchWorkspace = async (workspaceId: number) => {
    try {
      // 1. First update state INSTANTLY with the local workspace
      const targetWorkspace = workspaces.find((w) => w.id === workspaceId);
      if (targetWorkspace) {
        setWorkspace(targetWorkspace);
      }

      // 2. Then call API to sync with server
      const res = await api.post("/api/workspaces/switch", { workspaceId });

      // 3. Finally sync with server response
      setWorkspace(res.data.workspace);
    } catch (err) {
      console.error("Failed to switch workspace", err);
    }
  };

  const createWorkspace = async (name: string, description?: string) => {
    try {
      const res = await api.post("/api/workspaces", { name, description });
      const newWorkspace = res.data.workspace;
      setWorkspaces([...workspaces, newWorkspace]);
      await switchWorkspace(newWorkspace.id);
    } catch (err) {
      console.error("Failed to create workspace", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        workspaces,
        login,
        logout,
        switchWorkspace,
        createWorkspace,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

// import React, { createContext, useContext, useState, useEffect } from "react";
// import api from "../api/axios";

// type User = { id: string; fullName?: string; email?: string; role?: string } | null;

// type AuthContextType = {
//   user: User;
//   login: (credentials: {
//     email: string;
//     password: string;
//     role?: string;
//   }) => Promise<void>;
//   logout: () => void;
//   loading: boolean;
// };

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
//   children,
// }) => {
//   const [user, setUser] = useState<User>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const checkAuth = async () => {
//       try {
//         const res = await api.get("/api/me");
//         setUser(res.data.user);
//       } catch (e) {
//         setUser(null);
//       } finally {
//         setLoading(false);
//       }
//     };
//     checkAuth();
//   }, []);

//   const login = async (credentials: {
//     email: string;
//     password: string;
//     role?: string;
//   }) => {
//     const res = await api.post("/api/login", credentials);
//     const { user: u } = res.data;
//     setUser(u || null);
//   };

//   const logout = async () => {
//     try {
//       await api.post("/api/logout");
//     } catch (e) {
//       console.error("Logout failed", e);
//     }
//     setUser(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, login, logout, loading }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error("useAuth must be used within AuthProvider");
//   return ctx;
// };
