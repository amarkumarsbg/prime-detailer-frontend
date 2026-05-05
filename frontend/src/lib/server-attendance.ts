import { Redis } from "@upstash/redis";
import { applyPunchToRecords } from "@/lib/attendance-punch-logic";
import type { AttendanceRecord, User, UserRole } from "@/types";
import { format } from "date-fns";

function serverClock(now: Date): { date: string; timeStr: string } {
  return { date: format(now, "yyyy-MM-dd"), timeStr: format(now, "HH:mm") };
}

function mergeClock(
  now: Date,
  clientLocalDate?: string,
  clientLocalTime?: string
): { date: string; timeStr: string } {
  const fallback = serverClock(now);
  const dateOk =
    typeof clientLocalDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(clientLocalDate.trim());
  const timeOk =
    typeof clientLocalTime === "string" &&
    /^\d{1,2}:\d{2}$/.test(clientLocalTime.trim());
  return {
    date: dateOk ? clientLocalDate!.trim() : fallback.date,
    timeStr: timeOk ? padHhMm(clientLocalTime!.trim()) : fallback.timeStr,
  };
}

function padHhMm(t: string): string {
  const [h, m] = t.split(":");
  if (h == null || m == null) return t;
  return `${h.padStart(2, "0")}:${m}`;
}

const REDIS_KEY = "attendance:records:v1";

const globalForAttendance = globalThis as unknown as {
  __serverAttendanceRecords?: AttendanceRecord[];
};

let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

/** No demo seed — records come from punches only (or Redis restore). */
const EMPTY_SEED: AttendanceRecord[] = [];

function getMutableRecords(): AttendanceRecord[] {
  if (!globalForAttendance.__serverAttendanceRecords) {
    globalForAttendance.__serverAttendanceRecords = [...EMPTY_SEED];
  }
  return globalForAttendance.__serverAttendanceRecords;
}

async function readRecords(): Promise<AttendanceRecord[]> {
  const r = getRedis();
  if (!r) {
    return [...getMutableRecords()];
  }
  const raw = await r.get(REDIS_KEY);
  if (raw == null || raw === "") {
    return [...EMPTY_SEED];
  }
  if (Array.isArray(raw)) {
    return raw as AttendanceRecord[];
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as AttendanceRecord[];
      return Array.isArray(parsed) ? parsed : [...EMPTY_SEED];
    } catch {
      return [...EMPTY_SEED];
    }
  }
  return [...EMPTY_SEED];
}

async function writeRecords(records: AttendanceRecord[]): Promise<void> {
  const r = getRedis();
  if (!r) {
    globalForAttendance.__serverAttendanceRecords = records;
    return;
  }
  await r.set(REDIS_KEY, JSON.stringify(records));
}

export async function getServerAttendanceRecords(): Promise<AttendanceRecord[]> {
  return readRecords();
}

export async function resetServerAttendanceToSeed(): Promise<void> {
  const next = [...EMPTY_SEED];
  await writeRecords(next);
}

export async function serverPunch(
  staffId: string,
  branchId: string,
  now = new Date(),
  /** Resolved staff from DB (dashboard / punch UI) — required when no local seed list exists. */
  snapshot?: { name: string; role: UserRole },
  clientClock?: { clientLocalDate?: string; clientLocalTime?: string }
) {
  let staffMember: User | undefined;
  if (snapshot) {
    staffMember = {
      id: staffId,
      name: snapshot.name,
      email: "",
      phone: "",
      role: snapshot.role,
      branchId,
      isActive: true,
    };
  }
  if (!staffMember || !staffMember.isActive) {
    return { ok: false as const, error: "INACTIVE" as const };
  }
  if (staffMember.branchId !== branchId) {
    return { ok: false as const, error: "WRONG_BRANCH" as const };
  }

  const current = await readRecords();
  const clock = mergeClock(now, clientClock?.clientLocalDate, clientClock?.clientLocalTime);
  const out = applyPunchToRecords(current, staffMember, branchId, clock);
  if (!out.ok) {
    return out;
  }
  await writeRecords(out.nextRecords);
  return {
    ok: true as const,
    kind: out.kind,
    time: out.time,
    record: out.record,
  };
}
