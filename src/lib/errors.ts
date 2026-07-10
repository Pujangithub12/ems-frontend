import axios from "axios";

/**
 * Extracts a user-facing message from an API error, in one axios-aware place
 * instead of each call site repeating `err?.response?.data?.message || err.message || fallback`.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
