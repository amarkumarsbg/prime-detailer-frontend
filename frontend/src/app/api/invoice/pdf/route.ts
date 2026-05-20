import { htmlToPrintQualityPdfBase64 } from "@/lib/invoice-pdf-chromium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { html?: string; cacheKey?: string };
  try {
    body = (await req.json()) as { html?: string; cacheKey?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const html = body.html?.trim();
  if (!html) {
    return Response.json({ error: "html is required" }, { status: 400 });
  }

  try {
    const content = await htmlToPrintQualityPdfBase64(html, body.cacheKey);
    return Response.json({ content });
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF generation failed";
    console.error("[invoice/pdf]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
