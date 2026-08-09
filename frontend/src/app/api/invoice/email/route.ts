import { htmlToPrintQualityPdfBase64 } from "@/lib/invoice-pdf-chromium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const backendBase =
  process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

/**
 * Generate PDF and send email in one server round-trip (no large base64 through the browser).
 */
export async function POST(req: Request) {
  let body: {
    html?: string;
    cacheKey?: string;
    filename?: string;
    to?: string;
    subject?: string;
    emailHtml?: string;
    text?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const html = body.html?.trim();
  const to = body.to?.trim();
  const subject = body.subject?.trim();
  const emailHtml = body.emailHtml?.trim();
  const filename = body.filename?.trim() || "Invoice.pdf";

  if (!html || !to || !subject || !emailHtml) {
    return Response.json({ error: "html, to, subject, and emailHtml are required" }, { status: 400 });
  }

  const auth = req.headers.get("authorization");

  try {
    const content = await htmlToPrintQualityPdfBase64(html, body.cacheKey);

    const sendRes = await fetch(`${backendBase}/api/messaging/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify({
        to,
        subject,
        html: emailHtml,
        text: body.text,
        attachments: [{ filename, content }],
      }),
    });

    const text = await sendRes.text();
    let payload: { data?: unknown; error?: { message?: string; code?: string } };
    try {
      payload = text ? (JSON.parse(text) as typeof payload) : {};
    } catch {
      return Response.json(
        { error: text.slice(0, 200) || `Email API failed (${sendRes.status})` },
        { status: sendRes.status >= 400 ? sendRes.status : 502 }
      );
    }

    if (!sendRes.ok || payload.error) {
      return Response.json(
        {
          error: payload.error?.message ?? "Email send failed",
          code: payload.error?.code,
        },
        { status: sendRes.status >= 400 ? sendRes.status : 502 }
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invoice email failed";
    console.error("[invoice/email]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
