import { apiClient } from "@/lib/api-client";
import type { AuthSession } from "@/types";

export async function loginAdmin(email: string, password: string): Promise<AuthSession> {
  return apiClient.post<AuthSession>("/api/auth/login", { email, password });
}

export async function getMe() {
  return apiClient.get<AuthSession["user"]>("/api/auth/me");
}
