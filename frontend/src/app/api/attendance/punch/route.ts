import { NextResponse } from "next/server";
import { serverApiUrl } from "@/lib/server-api-base";

export const dynamic = "force-dynamic";

/** Public proxy: staff punch from their phone (no login). Persists in Postgres via the backend. */
export async function POST(request: Request) {
  let body: {
    staffId?: string;
    branchId?: string;
    clientLocalDate?: string;
    clientLocalTime?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const { staffId, branchId, clientLocalDate, clientLocalTime } = body ?? {};
  if (!staffId || !branchId) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  try {
    const res = await fetch(serverApiUrl("/api/public/attendance/punch"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, branchId, clientLocalDate, clientLocalTime }),
      cache: "no-store",
    });
    const data = (await res.json()) as {
      data?: {
        ok: boolean;
        kind?: "checkIn" | "checkOut";
        time?: string;
        record?: unknown;
      };
      error?: { code?: string };
    };

    if (!res.ok || !data.data?.ok) {
      return NextResponse.json({
        ok: false,
        error: data.error?.code ?? "SERVER",
      });
    }

    const d = data.data;
    return NextResponse.json({
      ok: true,
      kind: d.kind,
      time: d.time,
      record: d.record,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "NETWORK" }, { status: 502 });
  }
}
