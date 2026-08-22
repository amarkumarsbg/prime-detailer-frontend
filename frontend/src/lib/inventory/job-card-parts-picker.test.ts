import { describe, expect, it } from "vitest";
import {
  selectedLinesFromJobParts,
  buildJobCardPartItems,
  jobCardPartsSubtotal,
} from "../../components/job-cards/job-card-parts-picker";
import {
  quantityToCanonicalSecondary,
  getUnitPrice,
  validateStockConsumption,
} from "./multi-unit";
import type { Part, JobCardPartItem } from "@/types";

const mockPart = {
  id: "part-brush",
  name: "brush",
  sku: "brush",
  category: "Detailing",
  quantity: 0, // 0 primary packs
  primaryUnit: "Pack",
  secondaryUnit: "PCS",
  conversionFactor: 10,
  unitPrice: 2000, // 2000 per Pack
  unitPriceSecondary: 200, // 200 per PCS
  stockQuantitySecondary: 7, // 7 PCS available (which is 0.7 Pack)
  isActive: true,
  usedIn: ["DIRECT_SALE"],
} as Part;

describe("Job Card Parts Integration", () => {
  describe("selectedLinesFromJobParts", () => {
    it("maps JobCardPartItem array to SelectedPartLine array", () => {
      const parts: JobCardPartItem[] = [
        {
          id: "jp-jc1-part-brush",
          jobCardId: "jc1",
          partId: "part-brush",
          name: "brush",
          sku: "brush",
          quantity: 2,
          unit: "PCS",
          unitPrice: 200,
          lineTotal: 400,
        },
      ];
      const lines = selectedLinesFromJobParts(parts);
      expect(lines).toEqual([
        { partId: "part-brush", quantity: 2, unit: "PCS" },
      ]);
    });
  });

  describe("buildJobCardPartItems", () => {
    it("builds JobCardPartItem array with correct unit price and line totals", () => {
      const lines = [
        { partId: "part-brush", quantity: 2, unit: "PCS" },
        { partId: "part-brush", quantity: 1, unit: "Pack" },
      ];
      const items = buildJobCardPartItems("jc1", lines, [mockPart]);
      expect(items).toHaveLength(2);
      
      // First item: 2 PCS @ 200 = 400
      expect(items[0]).toEqual({
        id: "jp-jc1-part-brush",
        jobCardId: "jc1",
        partId: "part-brush",
        name: "brush",
        sku: "brush",
        quantity: 2,
        unit: "PCS",
        unitPrice: 200,
        lineTotal: 400,
      });

      // Second item: 1 Pack @ 2000 = 2000
      expect(items[1]).toEqual({
        id: "jp-jc1-part-brush",
        jobCardId: "jc1",
        partId: "part-brush",
        name: "brush",
        sku: "brush",
        quantity: 1,
        unit: "Pack",
        unitPrice: 2000,
        lineTotal: 2000,
      });
    });
  });

  describe("jobCardPartsSubtotal", () => {
    it("calculates the correct subtotal of all parts", () => {
      const parts: JobCardPartItem[] = [
        {
          id: "jp-jc1-part-brush",
          jobCardId: "jc1",
          partId: "part-brush",
          name: "brush",
          sku: "brush",
          quantity: 2,
          unit: "PCS",
          unitPrice: 200,
          lineTotal: 400,
        },
        {
          id: "jp-jc1-part-brush",
          jobCardId: "jc1",
          partId: "part-brush",
          name: "brush",
          sku: "brush",
          quantity: 1,
          unit: "Pack",
          unitPrice: 2000,
          lineTotal: 2000,
        },
      ];
      const total = jobCardPartsSubtotal(parts);
      expect(total).toBe(2400);
    });
  });

  describe("Unit Conversion and Stock Validation", () => {
    it("correctly converts quantities to canonical secondary units", () => {
      // 1 Pack = 10 PCS
      expect(quantityToCanonicalSecondary(mockPart, 1, "Pack")).toBe(10);
      // 1 PCS = 1 PCS
      expect(quantityToCanonicalSecondary(mockPart, 1, "PCS")).toBe(1);
    });

    it("correctly resolves unit prices", () => {
      expect(getUnitPrice(mockPart, "Pack")).toBe(2000);
      expect(getUnitPrice(mockPart, "PCS")).toBe(200);
    });

    it("correctly validates stock consumption", () => {
      // Stock is 7 PCS (0.7 Pack)
      
      // 1. Part quantity within available stock (e.g., 5 PCS) -> should be OK
      const checkWithin = validateStockConsumption(mockPart, 5, "PCS");
      expect(checkWithin.ok).toBe(true);

      // 2. Part quantity greater than stock (e.g., 8 PCS) -> should be blocked
      const checkExceededPCS = validateStockConsumption(mockPart, 8, "PCS");
      expect(checkExceededPCS.ok).toBe(false);
      expect(checkExceededPCS.message).toContain("Insufficient stock");

      // 3. Part quantity of 1 Pack (10 PCS) -> should be blocked since only 7 PCS available
      const checkExceededPack = validateStockConsumption(mockPart, 1, "Pack");
      expect(checkExceededPack.ok).toBe(false);
      expect(checkExceededPack.message).toContain("Insufficient stock");
    });
  });
});
