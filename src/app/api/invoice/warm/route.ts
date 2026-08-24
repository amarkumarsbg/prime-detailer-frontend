import { warmPrintBrowser } from "@/lib/invoice-pdf-chromium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts Chrome in the background so the first invoice PDF/email is faster. */
export async function GET() {
  try {
    await warmPrintBrowser();
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Warm failed";
    console.error("[invoice/warm]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
