"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { AppDataSync } from "@/components/layout/app-data-sync";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword === true);
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      await useAuthStore.getState().ensureValidSession();
      if (!cancelled) setSessionChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  useEffect(() => {
    if (!authReady || !sessionChecked) return;
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [authReady, sessionChecked, isAuthenticated, router]);

  useEffect(() => {
    if (!authReady || !sessionChecked || !isAuthenticated) return;
    if (!mustChangePassword) return;
    void router.replace("/change-password");
  }, [authReady, sessionChecked, isAuthenticated, mustChangePassword, router]);

  const runBootstrap = useAppBootstrapStore((s) => s.run);
  const resetBootstrap = useAppBootstrapStore((s) => s.reset);
  const bootstrapError = useAppBootstrapStore((s) => s.error);

  useEffect(() => {
    if (authReady && sessionChecked && !isAuthenticated) {
      resetBootstrap();
    }
  }, [authReady, sessionChecked, isAuthenticated, resetBootstrap]);

  useEffect(() => {
    if (!authReady || !sessionChecked || !isAuthenticated) return;
    void runBootstrap();
  }, [authReady, sessionChecked, isAuthenticated, runBootstrap]);

  useEffect(() => {
    if (!bootstrapError) return;
    toast.error(bootstrapError, {
      id: "bootstrap-load-error",
      duration: 10_000,
      description:
        "Production: check NEXT_PUBLIC_API_URL (API origin only, no /api) and FRONTEND_ORIGIN on Render. Wait ~60s if Render was asleep.",
    });
  }, [bootstrapError]);

  if (!authReady || !sessionChecked || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pl-0 transition-[padding] duration-300 md:pl-[260px]">
        <Header />
        <main
          ref={mainScrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 md:p-6 [scrollbar-gutter:stable]"
        >
          {bootstrapError ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
            >
              <p className="font-medium text-destructive">Could not load data from the API</p>
              <p className="mt-1 text-muted-foreground">{bootstrapError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void runBootstrap()}
              >
                Retry
              </Button>
            </div>
          ) : null}
          <AppDataSync />
          {children}
        </main>
        <ScrollToTopButton scrollContainerRef={mainScrollRef} />
      </div>
    </div>
  );
}
