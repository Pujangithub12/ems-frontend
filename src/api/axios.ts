import axios from "axios";

const rawBase = import.meta.env.VITE_API_BASE_URL;
let API_BASE = rawBase ?? "http://localhost:3000";

// Normalize common shorthand values like ":4000" or "//host:port"
if (typeof window !== "undefined") {
  try {
    if (API_BASE.startsWith(":")) {
      API_BASE = `${window.location.protocol}//${window.location.hostname}${API_BASE}`;
      console.warn(`[api] Resolved VITE_API_BASE_URL shorthand to ${API_BASE}`);
    } else if (API_BASE.startsWith("//")) {
      API_BASE = `${window.location.protocol}${API_BASE}`;
      console.warn(`[api] Resolved VITE_API_BASE_URL to ${API_BASE}`);
    }
  } catch (e) {
    // ignore in non-browser contexts
  }
}

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're already on a login page or checking initial auth
      const isLoginPath = window.location.pathname.startsWith("/login");
      const isMePath = error.config.url?.includes("/api/me");

      if (!isLoginPath && !isMePath) {
        window.location.href = "/login/user";
      }
    }
    return Promise.reject(error);
  },
);

// Expose debug info in development to help trace connection errors
if (import.meta.env.DEV && typeof window !== "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.__API_BASE = API_BASE;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.__API = api;
    console.info(`[api] axios baseURL = ${API_BASE || "(relative)"}`);
  } catch (e) {
    // ignore
  }
}

export default api;
