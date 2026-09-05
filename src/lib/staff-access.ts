import { PERMISSION_KEYS } from "@/lib/permission-keys";

export type StaffAccessLevel = "withEditAccess" | "withoutEditAccess";

const MODULE_KEYS = new Set<string>(PERMISSION_KEYS);

function expandLegacyBaseKeys(perms: string[]): string[] {
  const out = new Set<string>();
  for (const perm of perms) {
    if (MODULE_KEYS.has(perm)) {
      out.add(`${perm}_CREATE`);
      out.add(`${perm}_VIEW`);
      out.add(`${perm}_EDIT`);
    } else {
      out.add(perm);
    }
  }
  return [...out];
}

/** Infer access level from stored permission keys (best-effort). */
export function deriveStaffAccessLevel(permissions: string[] | undefined): StaffAccessLevel {
  const perms = permissions ?? [];
  if (perms.some((p) => p.endsWith("_EDIT"))) return "withEditAccess";
  if (perms.some((p) => MODULE_KEYS.has(p))) return "withEditAccess";
  return "withoutEditAccess";
}

import { getDefaultModuleKeysForRole } from "@/lib/staff-role-defaults";
import type { UserRole } from "@/types";

/**
 * Map the simplified access choice onto the existing permissions array shape.
 * Uses granular CREATE / VIEW / EDIT keys only — no API contract changes.
 */
export function permissionsForStaffAccessLevel(
  current: string[] | undefined,
  level: StaffAccessLevel,
  role?: UserRole
): string[] {
  let basePerms = current ?? [];
  // If the user has no permissions (e.g. legacy or cleared), applying "With Edit Access"
  // should bootstrap them with their role defaults so they don't get stuck with nothing.
  if (basePerms.length === 0 && role) {
    const defaultModules = getDefaultModuleKeysForRole(role);
    basePerms = defaultModules.flatMap(m => [`${m}_CREATE`, `${m}_VIEW`]);
  }

  const expanded = expandLegacyBaseKeys(basePerms).filter((p) => !p.endsWith("_DELETE"));

  if (level === "withoutEditAccess") {
    return expanded.filter((p) => !p.endsWith("_EDIT") && !MODULE_KEYS.has(p));
  }

  const next = new Set(expanded.filter((p) => !MODULE_KEYS.has(p)));
  const modules = new Set<string>();
  for (const perm of next) {
    const match = /^(.+)_(CREATE|VIEW|EDIT)$/.exec(perm);
    if (match?.[1]) modules.add(match[1]);
  }
  for (const mod of modules) {
    if (next.has(`${mod}_CREATE`) || next.has(`${mod}_VIEW`)) {
      next.add(`${mod}_EDIT`);
    }
  }
  return [...next];
}
