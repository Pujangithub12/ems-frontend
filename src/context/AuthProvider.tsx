import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import api, { setActiveOrganizationId } from "../api/axios";
import {
  getOrganizations,
  getCurrentOrganization,
  switchOrganization,
  createOrganization as createOrganizationService,
  updateOrganization as updateOrganizationService,
  deleteOrganization as deleteOrganizationService,
} from "../features/settings/api/organizations.api";

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
  /** Non-null for accounts created via an accepted organization invite — they're
   * permanently locked to this one organization (see backend authMiddleware). */
  homeOrganizationId?: number | null;
} | null;

export type Organization = {
  id: number;
  name: string;
  description?: string;
  /** Postal address, phone, email, and website — used e.g. on generated Purchase Order PDFs' letterhead/customer box. */
  address?: string | null;
  contact?: string | null;
  email?: string | null;
  website?: string | null;
  createdAt: string;
};

export type OrganizationContactDetails = {
  address?: string;
  contact?: string;
  email?: string;
  website?: string;
};

type AuthContextType = {
  user: User;
  organization: Organization | null;
  organizations: Organization[];
  login: (credentials: { email: string; password: string }) => Promise<void>;
  /** Self-service signup step 1: sends a 6-digit OTP to the given email. No account is created yet. */
  registerStart: (details: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  /** Self-service signup step 2: confirms the OTP, creating the account (as super_admin) plus a brand-new organization it owns, then logs it in. */
  registerVerify: (details: { email: string; otp: string }) => Promise<Organization>;
  /** Accepts an organization invite: sets a password + the invitee's own profile details, creates the account (with the invite's name/email/role), joins the organization, and logs it in. */
  acceptInvite: (
    token: string,
    password: string,
    profile: { phoneNumber: string; address: string; jobPosition: string },
  ) => Promise<Organization>;
  /** Forgot-password step 1: emails a 6-digit OTP if the address has an account (response is generic either way). */
  forgotPasswordStart: (email: string) => Promise<void>;
  /** Forgot-password step 2: confirms the OTP, sets the new password, and logs the user in. */
  forgotPasswordReset: (details: { email: string; otp: string; newPassword: string }) => Promise<void>;
  logout: () => void;
  /** Syncs context + the outgoing API header to the given organization (already known locally). Call after navigating the URL to that organization's id. */
  selectOrganization: (organizationId: number) => Organization | null;
  createOrganization: (
    name: string,
    description?: string,
    details?: OrganizationContactDetails,
  ) => Promise<Organization | null>;
  updateOrganization: (
    organizationId: number,
    name: string,
    description?: string,
    details?: OrganizationContactDetails,
  ) => Promise<void>;
  deleteOrganization: (
    organizationId: number,
    confirmName: string,
  ) => Promise<Organization | null>;
  loading: boolean;
  /** Merges fresh fields (e.g. after a profile edit) into the local user state without a refetch. */
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
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

  const fetchOrganizationsAndCurrent = async () => {
    try {
      // Also re-fetch /api/me here: login/registerVerify/acceptInvite/
      // forgotPasswordReset no longer return `role` on their own response
      // (role only makes sense once an organization is resolved, which happens
      // inside authMiddleware — the same place /api/me runs through). This
      // is what keeps user.role accurate after those actions.
      const [validOrganizations, current, meRes] = await Promise.all([
        getOrganizations(),
        getCurrentOrganization(),
        api.get("/api/me"),
      ]);
      setOrganizations(validOrganizations);
      setOrganization(current);
      setActiveOrganizationId(current?.id ?? null);
      setUser(meRes.data.user ?? null);
    } catch (err) {
      console.error("Failed to fetch organizations", err);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get("/api/me");
        // Only update state if login() hasn't already handled it
        if (!didLoginRef.current) {
          setUser(res.data.user);
          await fetchOrganizationsAndCurrent();
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
    await fetchOrganizationsAndCurrent();
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
  }): Promise<Organization> => {
    didLoginRef.current = true;
    const res = await api.post("/api/register/verify", details);
    const { user: u, organization: ws } = res.data;
    setUser(u || null);
    await fetchOrganizationsAndCurrent();
    setLoading(false);
    return ws;
  };

  const acceptInvite = async (
    token: string,
    password: string,
    profile: { phoneNumber: string; address: string; jobPosition: string },
  ): Promise<Organization> => {
    didLoginRef.current = true;
    const res = await api.post(`/api/invites/${token}/accept`, { password, ...profile });
    const { user: u, organization: ws } = res.data;
    setUser(u || null);
    await fetchOrganizationsAndCurrent();
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
    await fetchOrganizationsAndCurrent();
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
    setOrganization(null);
    setOrganizations([]);
    setActiveOrganizationId(null);
  };

  // Called by DashboardLayout when the URL's :organizationId no longer matches
  // the active one. Synchronous: updates the outgoing request header and the
  // display context immediately, then fires off a best-effort cookie sync
  // (used as the default organization for requests that can't set headers).
  const selectOrganization = (organizationId: number): Organization | null => {
    const target = organizations.find((w) => w.id === organizationId) ?? null;
    if (!target) return null;

    setOrganization(target);
    setActiveOrganizationId(target.id);
    // Role is scoped per organization now, so switching organizations can change
    // it — re-fetch /api/me (it'll pick up the new X-Workspace-Id header,
    // set just above) and refresh the stored role. Without this, role-gated
    // UI would keep showing the previous organization's role until a reload.
    switchOrganization(target.id)
      .then(() => api.get("/api/me"))
      .then((res) => setUser(res.data.user ?? null))
      .catch((err) => {
        console.error("Failed to persist organization switch", err);
      });

    return target;
  };

  const createOrganization = async (
    name: string,
    description?: string,
    details?: OrganizationContactDetails,
  ): Promise<Organization | null> => {
    try {
      const newOrganization = await createOrganizationService(name, description, details);
      setOrganizations((prev) => [...prev, newOrganization]);
      return newOrganization;
    } catch (err) {
      console.error("Failed to create organization", err);
      return null;
    }
  };

  const updateOrganization = async (
    organizationId: number,
    name: string,
    description?: string,
    details?: OrganizationContactDetails,
  ) => {
    const updated = await updateOrganizationService(organizationId, name, description, details);
    setOrganizations((prev) => prev.map((w) => (w.id === organizationId ? updated : w)));
    if (organization?.id === organizationId) {
      setOrganization(updated);
    }
  };

  const deleteOrganization = async (
    organizationId: number,
    confirmName: string,
  ): Promise<Organization | null> => {
    const result = await deleteOrganizationService(organizationId, confirmName);
    await fetchOrganizationsAndCurrent();
    // The organization the caller should be moved to (backend only returns this
    // when the deleted organization was the caller's active one).
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        organizations,
        login,
        registerStart,
        registerVerify,
        acceptInvite,
        forgotPasswordStart,
        forgotPasswordReset,
        logout,
        selectOrganization,
        createOrganization,
        updateOrganization,
        deleteOrganization,
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

