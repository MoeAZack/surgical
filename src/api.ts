// Centralized API client: attaches the session token, surfaces auth expiry,
// and distinguishes network/offline failures from server errors.

const TOKEN_KEY = "surgical_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function getToken(): string | null {
  return token;
}

export function setToken(t: string | null): void {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class AuthError extends Error {}
export class OfflineError extends Error {}

/** Fetch a JSON API route with the bearer token attached. Throws OfflineError
 *  when the network is unreachable and AuthError on 401. */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(path, { ...opts, headers });
  } catch {
    throw new OfflineError("Network unavailable");
  }

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent("surgical_auth_expired"));
    throw new AuthError("Session expired. Please sign in again.");
  }
  return res;
}

/** Convenience: apiFetch + JSON parse, throwing the server error message. */
export async function apiJson(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await apiFetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function jsonBody(body: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export async function login(key: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Login failed.");
  setToken(data.token);
}

export function logout(): void {
  setToken(null);
}
