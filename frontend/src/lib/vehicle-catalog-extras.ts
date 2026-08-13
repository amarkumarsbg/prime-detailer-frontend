import type { VehicleSegment } from "@/types";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";

/** Case-insensitive brand name already present in a sorted/list UI source. */
export function isBrandNameTaken(brands: string[], name: string): boolean {
  const t = name.trim().toLowerCase();
  if (!t) return false;
  return brands.some((b) => b.toLowerCase() === t);
}

export function appendExtraBrand(extraBrands: string[], name: string): string[] {
  const t = name.trim();
  if (!t || isBrandNameTaken(extraBrands, t)) return extraBrands;
  return [...extraBrands, t];
}

export function appendExtraModel(
  extraByBrand: Record<string, string[]>,
  brandName: string,
  modelName: string
): Record<string, string[]> {
  const brand = brandName.trim();
  const model = modelName.trim();
  if (!brand || !model) return extraByBrand;
  const list = extraByBrand[brand] ?? [];
  if (list.some((m) => m.toLowerCase() === model.toLowerCase())) return extraByBrand;
  return { ...extraByBrand, [brand]: [...list, model] };
}

/** Ensure brand exists in the settings-backed vehicle catalog. Returns canonical name. */
export function ensureCatalogBrand(name: string): string {
  const t = name.trim();
  if (!t) return t;
  const { brands, addBrand } = useVehicleCatalogStore.getState();
  const existing = brands.find((b) => b.name.toLowerCase() === t.toLowerCase());
  if (existing) return existing.name;
  addBrand(t);
  return t;
}

/** Ensure model exists under brand in the settings-backed vehicle catalog. */
export function ensureCatalogModel(
  brandName: string,
  modelName: string,
  segment: VehicleSegment
): void {
  const brand = ensureCatalogBrand(brandName);
  const model = modelName.trim();
  if (!brand || !model) return;
  const { brands, addModel } = useVehicleCatalogStore.getState();
  const row = brands.find((b) => b.name.toLowerCase() === brand.toLowerCase());
  if (!row) return;
  if (row.models.some((m) => m.name.toLowerCase() === model.toLowerCase())) return;
  addModel(row.id, model, segment);
}
