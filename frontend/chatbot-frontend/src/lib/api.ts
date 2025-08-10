// src/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwt");
}
export function logout() {
  if (typeof window !== "undefined") localStorage.removeItem("jwt");
}

// 3) Generic fetch that auto-attaches Authorization: Bearer <token>
async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  // If caller didn't set a Content-Type, assume JSON
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    if (res.status === 401) localStorage.removeItem("jwt"); // token stale/invalid
    throw new Error(await res.text());
  }
  // FastAPI /chat returns 201 Created + JSON — res.ok covers it
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// 4) Types matched to your FastAPI Pydantic models
export type ChatOut = {
  id: number;
  message: string;
  reply: string;
  timestamp: string; // ISO string; comes from DB row
};

// 5) /login expects *form-encoded* fields (OAuth2PasswordRequestForm)
export async function login(username: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json(); // { access_token, token_type: "bearer" }
  if (typeof window !== "undefined") localStorage.setItem("jwt", data.access_token);
  return data as { access_token: string; token_type: "bearer" };
}

// 6) Fetch this user’s chat history
export async function getChatLogs(): Promise<ChatOut[]> {
  return apiFetch<ChatOut[]>("/chat/logs");
}

// 7) Send a message; backend returns the whole row (id, message, reply, timestamp)
export async function sendMessage(message: string): Promise<ChatOut> {
  return apiFetch<ChatOut>("/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
