import { NextResponse } from "next/server";
import { serverApiUrl } from "@/lib/server-api-base";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId")?.trim();
  const qr = searchParams.get("qr")?.trim();

  if (!branchId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_BRANCH", message: "Missing branch." },
      { status: 400 }
    );
  }

  const q = new URLSearchParams({ branchId });
  if (qr) q.set("qr", qr);

  try {
    const res = await fetch(
      `${serverApiUrl("/api/public/attendance/context")}?${q.toString()}`,
      { cache: "no-store" }
    );
    const body = (await res.json()) as {
      data?: { ok: boolean; branch?: { id: string; name: string } };
      error?: { message?: string; code?: string };
    };

    if (!res.ok || !body.data?.ok || !body.data.branch) {
      return NextResponse.json(
        {
          ok: false,
          error: body.error?.code ?? "BRANCH_NOT_FOUND",
          message: body.error?.message ?? "Invalid branch or QR.",
        },
        { status: res.status >= 400 ? res.status : 404 }
      );
    }

    return NextResponse.json({ ok: true, branch: body.data.branch });
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
