import axios from "axios";

const rawBase = import.meta.env.VITE_API_BASE_URL;
let API_BASE = rawBase ?? "";

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

// Attach token from localStorage if present
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("auth:token");
    if (raw && config.headers) {
      config.headers.Authorization = `Bearer ${raw}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

export default api;
