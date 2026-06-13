import type {
  JobCard,
  Part,
  ServiceCatalogItem,
  ServiceConsumption,
  VehicleSegment,
} from "@/types";

import {
  hasDualUnitPart,
  quantityToCanonicalSecondary,
} from "@/lib/inventory/multi-unit";

export type ConsumptionDeduction = {
  partId: string;
  ml?: number;
  /** Canonical secondary-unit deduction (PCS, GM, etc.). */
  secondaryUnits?: number;
  /** Primary-unit count for simple single-unit parts. */
  primaryCount?: number;
  /** Original consumption unit for audit display. */
  displayUnit?: string;
  displayQuantity?: number;
};

const ML_UNITS = new Set(["ML", "L", "LITRE", "LITRES"]);
const COUNT_UNITS = new Set([
  "NOS",
  "SET",
  "KIT",
  "PIECE",
  "PIECES",
  "PCS",
  "ROLL",
]);

function normalizeUnit(unit: string): string {
  return unit.trim().toUpperCase();
}

/** Quantity to use for a job on this line given the vehicle segment. */
export function consumptionQuantityForSegment(
  line: ServiceConsumption,
  segment: VehicleSegment
): number {
  const o = line.segmentQuantities?.[segment];
  if (o != null && Number.isFinite(o)) return o;
  return line.quantityPerCar;
}

/** Worst-case quantity for stock planning (max of default and all segment overrides). */
export function maxConsumptionQuantityForLine(line: ServiceConsumption): number {
  let m = line.quantityPerCar;
  const seg = line.segmentQuantities;
  if (seg) {
    for (const v of Object.values(seg)) {
      if (typeof v === "number" && Number.isFinite(v)) m = Math.max(m, v);
    }
  }
  return m;
}

/** Convert a single consumption line to ml and/or count deduction. */
export function consumptionLineToDeduction(
  line: ServiceConsumption,
  quantity: number = line.quantityPerCar
): ConsumptionDeduction {
  const u = normalizeUnit(line.unit);
  if (u === "L" || u === "LITRE" || u === "LITRES") {
    return {
      partId: line.partId,
      ml: quantity * 1000,
    };
  }
  if (u === "ML") {
    return { partId: line.partId, ml: quantity };
  }
  if (COUNT_UNITS.has(u) || !ML_UNITS.has(u)) {
    return { partId: line.partId, primaryCount: quantity };
  }
  return { partId: line.partId, primaryCount: quantity };
}

/** Build deduction from a job-card part line using part unit conversion. */
export function jobCardPartToDeduction(
  part: Part,
  quantity: number,
  unit: string
): ConsumptionDeduction {
  const canonical = quantityToCanonicalSecondary(part, quantity, unit);
  if (part.stockQuantityMl != null && part.primaryUnit === "Litre") {
    return {
      partId: part.id,
      ml: canonical,
      displayUnit: unit,
      displayQuantity: quantity,
    };
  }
  if (hasDualUnitPart(part)) {
    return {
      partId: part.id,
      secondaryUnits: canonical,
      displayUnit: unit,
      displayQuantity: quantity,
    };
  }
  return {
    partId: part.id,
    primaryCount: quantity,
    displayUnit: unit,
    displayQuantity: quantity,
  };
}

function mergeDeductions(lines: ConsumptionDeduction[]): ConsumptionDeduction[] {
  const byPart = new Map<
    string,
    { ml: number; secondaryUnits: number; primaryCount: number; displayUnit?: string; displayQuantity?: number }
  >();
  for (const line of lines) {
    const cur = byPart.get(line.partId) ?? { ml: 0, secondaryUnits: 0, primaryCount: 0 };
    if (line.ml != null) cur.ml += line.ml;
    if (line.secondaryUnits != null) cur.secondaryUnits += line.secondaryUnits;
    if (line.primaryCount != null) cur.primaryCount += line.primaryCount;
    if (line.displayUnit) cur.displayUnit = line.displayUnit;
    if (line.displayQuantity != null) cur.displayQuantity = (cur.displayQuantity ?? 0) + line.displayQuantity;
    byPart.set(line.partId, cur);
  }
  const out: ConsumptionDeduction[] = [];
  for (const [partId, v] of byPart) {
    const o: ConsumptionDeduction = { partId };
    if (v.ml > 0) o.ml = v.ml;
    if (v.secondaryUnits > 0) o.secondaryUnits = v.secondaryUnits;
    if (v.primaryCount > 0) o.primaryCount = v.primaryCount;
    if (v.displayUnit) o.displayUnit = v.displayUnit;
    if (v.displayQuantity != null && v.displayQuantity > 0) o.displayQuantity = v.displayQuantity;
    if (o.ml != null || o.secondaryUnits != null || o.primaryCount != null) out.push(o);
  }
  return out;
}

/** All consumption lines for services on a job card (catalog + manual parts lookup). */
export function deductionsForJob(
  job: JobCard,
  catalog: ServiceCatalogItem[],
  parts: Part[] = []
): ConsumptionDeduction[] {
  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const partsById = new Map(parts.map((p) => [p.id, p]));
  const raw: ConsumptionDeduction[] = [];

  const segment = job.vehicleSegment;

  for (const svc of job.services) {
    const item = catalogById.get(svc.serviceCatalogId);
    if (!item?.consumptionProfile?.length) continue;
    for (const line of item.consumptionProfile) {
      if (line.requiredPart === false) continue;
      const qty = consumptionQuantityForSegment(line, segment);
      const part = partsById.get(line.partId);
      if (part) {
        raw.push(jobCardPartToDeduction(part, qty, line.unit));
      } else {
        raw.push(consumptionLineToDeduction(line, qty));
      }
    }
  }

  for (const partLine of job.parts ?? []) {
    if (!partLine.partId || partLine.quantity <= 0) continue;
    const part = partsById.get(partLine.partId);
    if (part) {
      raw.push(jobCardPartToDeduction(part, partLine.quantity, partLine.unit));
      continue;
    }
    raw.push(
      consumptionLineToDeduction(
        {
          partId: partLine.partId,
          partName: partLine.name,
          quantityPerCar: partLine.quantity,
          unit: partLine.unit,
        },
        partLine.quantity
      )
    );
  }

  return mergeDeductions(raw);
}

/** ML consumed per car for one part on a given service (single-service bottleneck). */
export function mlPerCarForPartOnService(
  partId: string,
  service: ServiceCatalogItem
): number {
  if (!service.consumptionProfile) return 0;
  let total = 0;
  for (const line of service.consumptionProfile) {
    if (line.partId !== partId) continue;
    const d = consumptionLineToDeduction(line, maxConsumptionQuantityForLine(line));
    if (d.ml != null) total += d.ml;
  }
  return total;
}

/** Cars serviceable for one part limited by that part only (floor). */
export function carsPossibleForPartAndService(
  part: Part,
  service: ServiceCatalogItem
): number {
  const ml = part.stockQuantityMl;
  if (ml == null || ml <= 0) return 0;
  const per = mlPerCarForPartOnService(part.id, service);
  if (per <= 0) return 0;
  return Math.floor(ml / per);
}

/** Minimum cars across all ml-consuming parts in a service (bottleneck). */
export function carsPossibleBottleneck(
  partsById: Map<string, Part>,
  service: ServiceCatalogItem
): number {
  if (!service.consumptionProfile?.length) return Infinity;
  let minCars = Infinity;
  for (const line of service.consumptionProfile) {
    const d = consumptionLineToDeduction(line, maxConsumptionQuantityForLine(line));
    if (d.ml == null) continue;
    const p = partsById.get(line.partId);
    const ml = p?.stockQuantityMl;
    if (ml == null || ml <= 0) {
      minCars = 0;
      break;
    }
    const per = d.ml;
    minCars = Math.min(minCars, Math.floor(ml / per));
  }
  return minCars === Infinity ? 0 : minCars;
}
