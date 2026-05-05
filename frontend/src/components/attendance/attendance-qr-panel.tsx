"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import QRCode from "react-qr-code";
import { useBranchStore } from "@/store/branch-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode } from "lucide-react";

function buildPunchUrl(origin: string, branchId: string, qr?: string): string {
  const u = new URL("/attendance/punch", origin);
  u.searchParams.set("branchId", branchId);
  if (qr) u.searchParams.set("qr", qr);
  return u.toString();
}

/** Accepts `http://192.168.1.5:3000` or `192.168.1.5:3000` */
function normalizeOrigin(input: string): string {
  const s = input.trim();
  if (!s) return "";
  try {
    const u = new URL(s.includes("://") ? s : `http://${s}`);
    return u.origin;
  } catch {
    return "";
  }
}

function useWindowOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
}

function isLocalhostOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const h = new URL(origin).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

type AttendanceQrPanelProps = {
  defaultBranchId: string;
};

export function AttendanceQrPanel({ defaultBranchId }: AttendanceQrPanelProps) {
  const branches = useBranchStore((s) => s.branches);
  const [branchId, setBranchId] = useState(defaultBranchId);
  const branchSelectOptions = useMemo(() => {
    const active = branches.filter((b) => b.isActive);
    const sel = branches.find((b) => b.id === branchId);
    if (sel && !sel.isActive && !active.some((b) => b.id === sel.id)) {
      return [sel, ...active];
    }
    return active;
  }, [branches, branchId]);
  const windowOrigin = useWindowOrigin();
  const isLocalhost = isLocalhostOrigin(windowOrigin);

  const envOrigin =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
      ? normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
      : "";

  /** Set in .env.local while testing on phone: http://192.168.x.x:3000 */
  const devLanOrigin =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEV_LAN_ORIGIN
      ? normalizeOrigin(process.env.NEXT_PUBLIC_DEV_LAN_ORIGIN)
      : "";

  const effectiveOrigin = useMemo(() => {
    if (envOrigin) return envOrigin;
    // localhost QR is wrong for phones unless NEXT_PUBLIC_DEV_LAN_ORIGIN is set
    if (devLanOrigin && (windowOrigin === "" || isLocalhost)) {
      return devLanOrigin;
    }
    return windowOrigin;
  }, [envOrigin, devLanOrigin, windowOrigin, isLocalhost]);

  const branch = useMemo(
    () => branches.find((b) => b.id === branchId),
    [branches, branchId]
  );

  const punchUrl = useMemo(() => {
    if (!effectiveOrigin || !branch) return "";
    return buildPunchUrl(effectiveOrigin, branch.id, branch.qrCodeId);
  }, [effectiveOrigin, branch]);

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <QrCode className="w-4 h-4" />
          Store QR (PIN punch)
        </CardTitle>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {branchSelectOptions.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center w-full max-w-[220px] mx-auto aspect-square rounded-lg border border-border bg-white p-3">
          {punchUrl ? (
            <QRCode
              value={punchUrl}
              size={180}
              level="M"
              className="h-auto w-full max-h-[180px]"
            />
          ) : (
            <div className="text-xs text-muted-foreground text-center p-4">
              Generating QR…
            </div>
          )}
        </div>
        <p className="text-xs text-center text-muted-foreground leading-relaxed">
          Staff scan this code once at the branch, enter their PIN, and punch in or out
          automatically.
        </p>
      </CardContent>
    </Card>
  );
}
