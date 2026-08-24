"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, isAdminRole } from "@/store/auth-store";

export function useRequireAuth() {
  const { user, isAuthenticated, hydrate } = useAuthStore();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    hydrate();
    setChecked(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated || !isAdminRole(user?.role)) {
      router.replace("/login");
    }
  }, [checked, isAuthenticated, user, router]);

  return { user, ready: checked && isAuthenticated && isAdminRole(user?.role) };
}
