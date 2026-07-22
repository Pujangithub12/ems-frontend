import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import api, { setActiveWorkspaceId } from "../api/axios";
import {
  getWorkspaces,
  getCurrentWorkspace,
  switchWorkspace,
  createWorkspace as createWorkspaceService,
  updateWorkspace as updateWorkspaceService,
  deleteWorkspace as deleteWorkspaceService,
} from "../features/settings/api/workspaces.api";

export type User = {
  id: string;
  fullName?: string;
  email?: string;
  role?: string;
  phoneNumber?: string;
  address?: string;
  jobPosition?: string;
  joinDate?: string;
  createdAt?: string;
  /** Non-null for accounts created via an accepted workspace invite — they're
   * permanently locked to this one workspace (see backend authMiddleware). */
  homeWorkspaceId?: number | null;
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
  login: (credentials: { email: string; password: string }) => Promise<void>;
  /** Self-service signup step 1: sends a 6-digit OTP to the given email. No account is created yet. */
  registerStart: (details: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  /** Self-service signup step 2: confirms the OTP, creating the account (as super_admin) plus a brand-new workspace it owns, then logs it in. */
  registerVerify: (details: { email: string; otp: string }) => Promise<Workspace>;
  /** Accepts a workspace invite: sets a password, creates the account with the invite's details/role, joins the workspace, and logs it in. */
  acceptInvite: (token: string, password: string) => Promise<Workspace>;
  /** Forgot-password step 1: emails a 6-digit OTP if the address has an account (response is generic either way). */
  forgotPasswordStart: (email: string) => Promise<void>;
  /** Forgot-password step 2: confirms the OTP, sets the new password, and logs the user in. */
  forgotPasswordReset: (details: { email: string; otp: string; newPassword: string }) => Promise<void>;
  logout: () => void;
  /** Syncs context + the outgoing API header to the given workspace (already known locally). Call after navigating the URL to that workspace's id. */
  selectWorkspace: (workspaceId: number) => Workspace | null;
  createWorkspace: (name: string, description?: string) => Promise<Workspace | null>;
  updateWorkspace: (
    workspaceId: number,
    name: string,
    description?: string,
  ) => Promise<void>;
  deleteWorkspace: (
    workspaceId: number,
    confirmName: string,
  ) => Promise<Workspace | null>;
  loading: boolean;
  /** Merges fresh fields (e.g. after a profile edit) into the local user state without a refetch. */
  updateUser: (user: User) => void;
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
  const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

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
      // Also re-fetch /api/me here: login/registerVerify/acceptInvite/
      // forgotPasswordReset no longer return `role` on their own response
      // (role only makes sense once a workspace is resolved, which happens
      // inside authMiddleware — the same place /api/me runs through). This
      // is what keeps user.role accurate after those actions.
      const [validWorkspaces, current, meRes] = await Promise.all([
        getWorkspaces(),
        getCurrentWorkspace(),
        api.get("/api/me"),
      ]);
      setWorkspaces(validWorkspaces);
      setWorkspace(current);
      setActiveWorkspaceId(current?.id ?? null);
      setUser(meRes.data.user ?? null);
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

  const login = async (credentials: { email: string; password: string }) => {
    // Mark that we've logged in so the concurrent checkAuth won't overwrite us
    didLoginRef.current = true;
    const res = await api.post("/api/login", credentials);
    const { user: u } = res.data;
    setUser(u || null);
    await fetchWorkspacesAndCurrent();
    // Ensure loading is false so DashboardLayout doesn't show the spinner
    setLoading(false);
  };

  const registerStart = async (details: {
    fullName: string;
    email: string;
    password: string;
  }) => {
    await api.post("/api/register/start", details);
  };

  const registerVerify = async (details: {
    email: string;
    otp: string;
  }): Promise<Workspace> => {
    didLoginRef.current = true;
    const res = await api.post("/api/register/verify", details);
    const { user: u, workspace: ws } = res.data;
    setUser(u || null);
    await fetchWorkspacesAndCurrent();
    setLoading(false);
    return ws;
  };

  const acceptInvite = async (token: string, password: string): Promise<Workspace> => {
    didLoginRef.current = true;
    const res = await api.post(`/api/invites/${token}/accept`, { password });
    const { user: u, workspace: ws } = res.data;
    setUser(u || null);
    await fetchWorkspacesAndCurrent();
    setLoading(false);
    return ws;
  };

  const forgotPasswordStart = async (email: string) => {
    await api.post("/api/forgot-password/start", { email });
  };

  const forgotPasswordReset = async (details: {
    email: string;
    otp: string;
    newPassword: string;
  }) => {
    didLoginRef.current = true;
    const res = await api.post("/api/forgot-password/reset", details);
    const { user: u } = res.data;
    setUser(u || null);
    await fetchWorkspacesAndCurrent();
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
    setActiveWorkspaceId(null);
  };

  // Called by DashboardLayout when the URL's :workspaceId no longer matches
  // the active one. Synchronous: updates the outgoing request header and the
  // display context immediately, then fires off a best-effort cookie sync
  // (used as the default workspace for requests that can't set headers).
  const selectWorkspace = (workspaceId: number): Workspace | null => {
    const target = workspaces.find((w) => w.id === workspaceId) ?? null;
    if (!target) return null;

    setWorkspace(target);
    setActiveWorkspaceId(target.id);
    // Role is scoped per workspace now, so switching workspaces can change
    // it — re-fetch /api/me (it'll pick up the new X-Workspace-Id header,
    // set just above) and refresh the stored role. Without this, role-gated
    // UI would keep showing the previous workspace's role until a reload.
    switchWorkspace(target.id)
      .then(() => api.get("/api/me"))
      .then((res) => setUser(res.data.user ?? null))
      .catch((err) => {
        console.error("Failed to persist workspace switch", err);
      });

    return target;
  };

  const createWorkspace = async (
    name: string,
    description?: string,
  ): Promise<Workspace | null> => {
    try {
      const newWorkspace = await createWorkspaceService(name, description);
      setWorkspaces((prev) => [...prev, newWorkspace]);
      return newWorkspace;
    } catch (err) {
      console.error("Failed to create workspace", err);
      return null;
    }
  };

  const updateWorkspace = async (
    workspaceId: number,
    name: string,
    description?: string,
  ) => {
    const updated = await updateWorkspaceService(workspaceId, name, description);
    setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? updated : w)));
    if (workspace?.id === workspaceId) {
      setWorkspace(updated);
    }
  };

  const deleteWorkspace = async (
    workspaceId: number,
    confirmName: string,
  ): Promise<Workspace | null> => {
    const result = await deleteWorkspaceService(workspaceId, confirmName);
    await fetchWorkspacesAndCurrent();
    // The workspace the caller should be moved to (backend only returns this
    // when the deleted workspace was the caller's active one).
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        workspaces,
        login,
        registerStart,
        registerVerify,
        acceptInvite,
        forgotPasswordStart,
        forgotPasswordReset,
        logout,
        selectWorkspace,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        loading,
        updateUser: setUser,
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

