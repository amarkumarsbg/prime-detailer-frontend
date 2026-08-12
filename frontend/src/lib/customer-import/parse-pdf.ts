/**
 * Extract customer name/phone pairs from a text-based PDF.
 * Scanned/image PDFs without text layer will return no rows.
 */
export async function parseCustomerPdf(
  file: File
): Promise<{ headers: string[]; rows: string[][] }> {
  const pdfjs = await import("pdfjs-dist");

  // Use CDN worker to avoid bundler worker config issues in Next.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  type TextItem = { str: string; x: number; y: number };
  const lines: Array<{ y: number; items: TextItem[] }> = [];

  const yTolerance = 3;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const transform = "transform" in item ? (item.transform as number[]) : null;
      const x = transform?.[4] ?? 0;
      const y = transform?.[5] ?? 0;
      const str = String(item.str).trim();

      let line = lines.find((l) => Math.abs(l.y - y) <= yTolerance);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ str, x, y });
    }
  }

  lines.sort((a, b) => b.y - a.y);

  const phoneRe =
    /(?:\+?\s*91[\s-]*)?(?:\d[\s-]*){10}|\b[6-9](?:[\s-]?\d){9}\b/g;

  const rows: string[][] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const ordered = [...line.items].sort((a, b) => a.x - b.x);
    const text = ordered
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const phones = text.match(phoneRe);
    if (!phones?.length) continue;

    for (const rawPhone of phones) {
      const digits = rawPhone.replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) continue;
      if (seen.has(digits)) continue;
      seen.add(digits);

      let name = text
        .replace(rawPhone, " ")
        .replace(/\b(name|customer|phone|mobile|contact|whatsapp)\s*[:#-]?\s*/gi, " ")
        .replace(/[|,;]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Drop leftover digit noise
      name = name.replace(/\b\d{5,}\b/g, "").replace(/\s+/g, " ").trim();

      if (!name || name.length < 2) {
        name = `Customer ${digits.slice(-4)}`;
      }

      rows.push([name, digits, "", ""]);
    }
  }

  if (rows.length === 0) {
    throw new Error(
      "No customer name/phone rows found in this PDF. Use a text-based PDF, or export to CSV/Excel."
    );
  }

  return {
    headers: ["Name", "Phone", "Email", "Address"],
    rows,
  };
}
