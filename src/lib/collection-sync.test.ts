import { describe, expect, it } from "vitest";
import {
  documentCollectionBasePath,
  isGraduatedDocumentCollection,
} from "./collection-sync";

describe("collection-sync Phase 4 graduation", () => {
  it("routes graduated modules to dedicated aliases", () => {
    expect(documentCollectionBasePath("jobCards")).toBe("/api/job-cards");
    expect(documentCollectionBasePath("invoices")).toBe("/api/invoices");
    expect(documentCollectionBasePath("quotations")).toBe("/api/quotations");
    expect(isGraduatedDocumentCollection("jobCards")).toBe(true);
  });

  it("keeps other collections on the legacy gateway", () => {
    expect(documentCollectionBasePath("appointments")).toBe("/api/collections/appointments");
    expect(documentCollectionBasePath("payroll")).toBe("/api/collections/payroll");
    expect(isGraduatedDocumentCollection("appointments")).toBe(false);
  });
});
