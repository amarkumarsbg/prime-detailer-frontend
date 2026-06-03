import { NextResponse } from "next/server";
import { serverApiUrl } from "@/lib/server-api-base";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

type ResolvedStaff = {
  id: string;
  name: string;
  role: UserRole;
  branchId: string;
};

export async function POST(request: Request) {
  let pin = "";
  let branchId = "";
  try {
    const body = (await request.json()) as { pin?: string; branchId?: string };
    pin = (body.pin ?? "").trim();
    branchId = (body.branchId ?? "").trim();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  if (!pin || !branchId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS", message: "PIN and branch are required." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(serverApiUrl("/api/public/attendance/resolve-pin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, branchId }),
      cache: "no-store",
    });
    const body = (await res.json()) as {
      data?: { ok: boolean; staff?: ResolvedStaff };
      error?: { message?: string; code?: string };
    };

    if (!res.ok || !body.data?.ok || !body.data.staff) {
      return NextResponse.json(
        {
          ok: false,
          error: body.error?.code ?? "INVALID_PIN",
          message: body.error?.message ?? "PIN not recognized.",
        },
        { status: res.status >= 400 ? res.status : 404 }
      );
    }

    return NextResponse.json({ ok: true, staff: body.data.staff });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "NETWORK",
        message: "Could not reach the server. Check that the API is running.",
      },
      { status: 502 }
    );
  }
}
