import { NextResponse } from "next/server";
import {
  getServerAttendanceRecords,
  resetServerAttendanceToSeed,
} from "@/lib/server-attendance";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await getServerAttendanceRecords();
  return NextResponse.json({ records });
}

export async function DELETE() {
  await resetServerAttendanceToSeed();
  const records = await getServerAttendanceRecords();
  return NextResponse.json({ ok: true, records });
}
