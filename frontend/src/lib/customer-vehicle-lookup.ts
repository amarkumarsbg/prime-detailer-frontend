import type { Customer, Vehicle } from "@/types";
import {
  normalizeRegistrationNumber,
  sanitizeVehicleRegistrationInput,
} from "@/lib/vehicle-registration";

export function computeCustomerLookupMatches(
  queryRaw: string,
  customers: Customer[],
  vehicles: Vehicle[],
  maxResults = 15
): Customer[] {
  const q = queryRaw.trim();
  if (!q) return [];

  const ql = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  const compactDigitOnly = /^\d+$/.test(q.replace(/\s/g, ""));
  const matches: Customer[] = [];
  const seen = new Set<string>();

  const push = (cust: Customer | undefined) => {
    if (!cust || seen.has(cust.id)) return;
    seen.add(cust.id);
    matches.push(cust);
  };

  if (digits.length >= 10) {
    const p10 = digits.slice(-10);
    push(customers.find((c) => c.phone.replace(/\D/g, "").slice(-10) === p10));
  } else if (compactDigitOnly && digits.length >= 4 && digits.length < 10) {
    for (const c of customers) {
      if (c.phone.replace(/\D/g, "").includes(digits)) push(c);
    }
  }

  const hasLetters = /[a-zA-Z]/.test(q);
  if (hasLetters && ql.length >= 2) {
    for (const c of customers) {
      if (c.name.toLowerCase().includes(ql)) push(c);
    }
  }

  const regSan = sanitizeVehicleRegistrationInput(q);
  const regNorm = normalizeRegistrationNumber(regSan);
  const regSearch =
    regNorm.length >= 3 || (hasLetters && regSan.replace(/\s/g, "").length >= 2);
  if (regSearch) {
    for (const v of vehicles) {
      const vn = normalizeRegistrationNumber(v.registrationNumber);
      const hitReg =
        (regNorm.length >= 3 && vn.includes(regNorm)) ||
        v.registrationNumber.toLowerCase().includes(ql);
      if (hitReg) push(customers.find((x) => x.id === v.customerId));
    }
  }

  return matches.slice(0, maxResults);
}

export function queryLooksLikeVehicleReg(queryRaw: string): boolean {
  const q = queryRaw.trim();
  if (!q) return false;
  const hasLetter = /[a-zA-Z]/i.test(q);
  const regSan = sanitizeVehicleRegistrationInput(q);
  const regCompact = normalizeRegistrationNumber(regSan).replace(/-/g, "");
  return hasLetter && /\d/.test(q) && regCompact.length >= 6;
}
