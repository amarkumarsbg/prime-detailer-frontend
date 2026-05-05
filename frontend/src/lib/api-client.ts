import { useAuthStore } from "@/store/auth-store";
import { buildApiUrl } from "./api-base";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: {
    data: T | null;
    error: { message?: string; code?: string } | null;
  };
  try {
    body = text ? (JSON.parse(text) as typeof body) : { data: null, error: { message: "Empty response" } };
  } catch {
    const hint =
      res.status >= 500
        ? " Server may be waking up (Render free tier) — wait ~60s and retry. Also verify NEXT_PUBLIC_API_URL has no trailing /api."
        : "";
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new ApiError(
      res.status,
      preview ? `${preview}${hint}` : `Non-JSON response (${res.status}).${hint}`
    );
  }
  if (!res.ok || body.error) {
    throw new ApiError(
      res.status,
      body.error?.message ?? res.statusText ?? "Request failed",
      body.error?.code
    );
  }
  return body.data as T;
}

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().accessToken;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseResponse<T>(res);
}
