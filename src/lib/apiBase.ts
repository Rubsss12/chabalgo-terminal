/**
 * Resolves the backend API base URL.
 *
 * Priority:
 *   1. NEXT_PUBLIC_API_URL env var (if set at build time)
 *   2. Auto-detect:
 *      - On localhost → http://localhost:8000 (local dev backend)
 *      - On any other host → /api (Vercel rewrites this to the Python function)
 *
 * This means the build works on Vercel, GitHub Pages, or any custom domain
 * without needing the env var to be set.
 */
export const API_BASE: string = (() => {
  const envVar = process.env.NEXT_PUBLIC_API_URL;
  if (envVar) return envVar;

  if (typeof window === "undefined") {
    // SSR / build time — fall back to localhost (only matters for local dev)
    return "http://localhost:8000";
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.")) {
    return "http://localhost:8000";
  }

  // Production: any other hostname → use relative /api path
  // (Vercel rewrites /api/* to the Python function; for GH Pages users would
  //  need to set NEXT_PUBLIC_API_URL explicitly to a deployed backend URL)
  return "/api";
})();
