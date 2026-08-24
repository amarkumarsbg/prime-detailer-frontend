"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAttendanceStore } from "@/store/attendance-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, LogIn, LogOut, AlertCircle, Loader2 } from "lucide-react";
import type { UserRole } from "@/types";

type ResolvedStaff = {
  id: string;
  name: string;
  role: UserRole;
  branchId: string;
};

type ContextState =
  | { status: "loading" }
  | { status: "ready"; branch: { id: string; name: string } }
  | { status: "error"; message: string };

export function PunchForm() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get("branchId")?.trim() ?? "";
  const qrToken = searchParams.get("qr")?.trim() ?? "";

  const punch = useAttendanceStore((s) => s.punch);

  const [ctx, setCtx] = useState<ContextState>({ status: "loading" });
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<
    { kind: "checkIn" | "checkOut"; time: string; name: string } | null
  >(null);

  useEffect(() => {
    if (!branchId) {
      setCtx({
        status: "error",
        message: "Missing branch. Scan the QR code at your branch to open this page.",
      });
      return;
    }

    let cancelled = false;
    setCtx({ status: "loading" });
    const q = new URLSearchParams({ branchId });
    if (qrToken) q.set("qr", qrToken);

    fetch(`/api/attendance/context?${q.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          branch?: { id: string; name: string };
        };
        if (cancelled) return;
        if (data.ok && data.branch) {
          setCtx({ status: "ready", branch: data.branch });
        } else {
          setCtx({
            status: "error",
            message: data.message ?? "Invalid branch or QR code.",
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCtx({
          status: "error",
          message:
            "Could not reach the server. Check Wi‑Fi and that the app is running.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, qrToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLastSuccess(null);

    if (ctx.status !== "ready") return;
    if (!pin.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/resolve-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, branchId: ctx.branch.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        staff?: ResolvedStaff;
      };

      if (!data.ok || !data.staff) {
        setLocalError(data.message ?? "PIN not recognized.");
        return;
      }

      const staff = data.staff;
      const result = await punch({
        staff: {
          id: staff.id,
          name: staff.name,
          email: "",
          phone: "",
          role: staff.role,
          branchId: staff.branchId,
          isActive: true,
        },
        branchId: ctx.branch.id,
      });

      if (!result.ok) {
        if (result.error === "WRONG_BRANCH") {
          setLocalError("You are not assigned to this branch.");
        } else if (result.error === "INACTIVE") {
          setLocalError("Your account is inactive. Contact a manager.");
        } else if (result.error === "NETWORK") {
          setLocalError(
            "Could not reach the server. Check Wi‑Fi and that the app is running."
          );
        } else {
          setLocalError("Something went wrong. Try again.");
        }
        return;
      }

      setLastSuccess({ kind: result.kind, time: result.time, name: staff.name });
      setPin("");
    } catch {
      setLocalError(
        "Could not reach the server. Check Wi‑Fi and that the app is running."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (ctx.status === "loading") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Checking branch…</p>
      </div>
    );
  }

  if (ctx.status === "error") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <p className="text-center text-sm text-muted-foreground max-w-sm">
          {ctx.message}
        </p>
      </div>
    );
  }

  const canSubmit = pin.trim().length > 0 && !submitting;

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6 pb-10">
      <div className="text-center space-y-1">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <QrCode className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">{ctx.branch.name}</p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-lg">Enter your PIN</CardTitle>
          <CardDescription>
            One tap records check-in or check-out automatically based on your last punch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="••••"
                className="text-center text-lg tracking-[0.3em]"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                disabled={submitting}
              />
            </div>
            {localError && (
              <p className="text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                {localError}
              </p>
            )}
            <Button type="submit" className="w-full h-12 text-base" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Punching…
                </>
              ) : (
                "Punch"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {lastSuccess && (
        <Card
          className={
            lastSuccess.kind === "checkIn"
              ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20"
          }
        >
          <CardContent className="flex items-start gap-3 pt-6">
            {lastSuccess.kind === "checkIn" ? (
              <LogIn className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <LogOut className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {lastSuccess.kind === "checkIn" ? "Checked in" : "Checked out"}
              </p>
              <p className="text-sm text-muted-foreground">
                {lastSuccess.name} · {lastSuccess.time}
              </p>
              <p className="text-[11px] text-muted-foreground pt-1 leading-snug">
                Synced to the server — the attendance screen on the shop PC updates within a few
                seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
