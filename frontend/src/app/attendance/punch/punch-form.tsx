"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBranchStore } from "@/store/branch-store";
import { useAttendanceStore } from "@/store/attendance-store";
import { useStaffStore } from "@/store/staff-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, LogIn, LogOut, AlertCircle } from "lucide-react";

export function PunchForm() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get("branchId") ?? "";
  const qrToken = searchParams.get("qr");
  const branches = useBranchStore((s) => s.branches);

  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<
    | { kind: "checkIn"; time: string; name: string }
    | { kind: "checkOut"; time: string; name: string }
    | null
  >(null);

  const punch = useAttendanceStore((s) => s.punch);
  const findByAttendancePin = useStaffStore((s) => s.findByAttendancePin);

  const branch = useMemo(
    () => branches.find((b) => b.id === branchId),
    [branches, branchId]
  );

  const qrValid =
    !qrToken || (branch?.qrCodeId != null && branch.qrCodeId === qrToken);

  const canSubmit = Boolean(branch && qrValid && pin.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLastSuccess(null);

    if (!branch) {
      setLocalError("Invalid branch. Use the QR code from your store.");
      return;
    }
    if (!qrValid) {
      setLocalError("This QR link is not valid for this branch.");
      return;
    }

    const staff = findByAttendancePin(pin);
    if (!staff) {
      setLocalError("PIN not recognized. Ask your manager if you forgot your PIN.");
      return;
    }

    const result = await punch({ staff, branchId: branch.id });
    if (!result.ok) {
      if (result.error === "NETWORK") {
        setLocalError("Could not reach the server. Check Wi‑Fi and that the app is running.");
        return;
      }
      if (result.error === "SERVER") {
        setLocalError("Something went wrong. Try again.");
        return;
      }
      if (result.error === "WRONG_BRANCH") {
        setLocalError("You are not assigned to this branch.");
      } else {
        setLocalError("Your account is inactive. Contact a manager.");
      }
      return;
    }

    if (result.kind === "checkIn") {
      setLastSuccess({
        kind: "checkIn",
        time: result.time,
        name: staff.name,
      });
    } else {
      setLastSuccess({
        kind: "checkOut",
        time: result.time,
        name: staff.name,
      });
    }
    setPin("");
  };

  if (!branchId) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <p className="text-center text-sm text-muted-foreground max-w-sm">
          Missing branch. Scan the QR code at your branch to open this page.
        </p>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <p className="text-center text-sm text-muted-foreground max-w-sm">
          Unknown branch. Use the QR code from your store.
        </p>
      </div>
    );
  }

  if (!qrValid) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <p className="text-center text-sm text-muted-foreground max-w-sm">
          This QR link is not valid for this branch.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6 pb-10">
      <div className="text-center space-y-1">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <QrCode className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">{branch.name}</p>
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
              />
            </div>
            {localError && (
              <p className="text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                {localError}
              </p>
            )}
            <Button type="submit" className="w-full h-12 text-base" disabled={!canSubmit}>
              Punch
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
