import "dotenv/config";
import path from "node:path";
import compression from "compression";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { customerRouter } from "./routes/customer.routes.js";
import { bootstrapRouter } from "./routes/bootstrap.routes.js";
import { collectionRouter } from "./routes/collection.routes.js";
import { quotationRouter } from "./routes/quotation.routes.js";
import { branchApiRouter } from "./routes/branch-api.routes.js";
import { userApiRouter } from "./routes/user-api.routes.js";
import { vehicleApiRouter } from "./routes/vehicle-api.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { isTwilioSmsEnabled, isTwilioWhatsAppEnabled } from "./services/twilio-sms.service.js";
import { isPasswordResetEmailConfigured } from "./services/password-reset-email.service.js";
import { messagingRouter } from "./routes/messaging.routes.js";
import { jobCardUploadRouter } from "./routes/job-card-upload.routes.js";
import { publicAttendanceRouter } from "./routes/public-attendance.routes.js";
import { attendanceRouter } from "./routes/attendance.routes.js";
import { partyRouter } from "./routes/party.routes.js";
import { organizationRouter } from "./routes/organization.routes.js";
import { platformRouter } from "./routes/platform.routes.js";

import { prisma } from "./lib/prisma.js";
import { getPublicInvoiceView } from "./services/public-invoice.service.js";
import { getPublicBranding } from "./services/public-branding.service.js";

const app = express();

app.use(compression());

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  })
);
/** Invoice email attaches base64 PDFs; default 100kb limit causes "request entity too large". */
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

const uploadsRoot = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsRoot, { maxAge: 7 * 24 * 60 * 60 * 1000 }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Prime Detailers API",
    hint: "Use the Next.js app in your browser (usually port 3000), not this URL alone.",
    frontend: env.FRONTEND_ORIGIN,
    endpoints: { health: "/health", healthDb: "/health/db", api: "/api" },
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/health/db", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "up" });
  } catch (e) {
    next(e);
  }
});

app.get("/api/public/invoices/:id", async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const data = await getPublicInvoiceView(id);
    res.json({ data, error: null });
  } catch (e) {
    next(e);
  }
});

app.get("/api/public/branding", async (_req, res, next) => {
  try {
    const data = await getPublicBranding();
    res.json({ data, error: null });
  } catch (e) {
    next(e);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/job-cards", jobCardUploadRouter);
app.use("/api/customers", customerRouter);
app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/collections", collectionRouter);
app.use("/api/quotations", quotationRouter);
app.use("/api/branches", branchApiRouter);
app.use("/api/users", userApiRouter);
app.use("/api/vehicles", vehicleApiRouter);
app.use("/api/messaging", messagingRouter);
app.use("/api/public/attendance", publicAttendanceRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/parties", partyRouter);
app.use("/api/organization", organizationRouter);
app.use("/api/platform", platformRouter);

app.use(errorHandler);

const isProduction = process.env.NODE_ENV === "production";

app.listen(env.PORT, () => {
  if (isProduction) {
    console.log(`API listening on port ${env.PORT}`);
    if (!isPasswordResetEmailConfigured()) {
      console.warn(
        "[email] RESEND_API_KEY is not set — forgot-password will return 503 until email is configured."
      );
    }
    return;
  }
  console.log(`API listening on http://localhost:${env.PORT}`);
  if (isTwilioSmsEnabled()) {
    const sid = env.TWILIO_ACCOUNT_SID ?? "";
    const viaApiKey = Boolean(env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET);
    console.log(
      `[twilio] SMS enabled (auth: ${viaApiKey ? "API key" : "Auth Token"}, Account SID …${sid.slice(-6)})`
    );
  }
  if (isTwilioWhatsAppEnabled()) {
    const wa = env.TWILIO_WHATSAPP_FROM ?? "";
    console.log(`[twilio] WhatsApp outbound enabled (sender …${wa.slice(-8)})`);
  }
  if (isPasswordResetEmailConfigured()) {
    console.log("[email] Password reset via Resend is enabled (RESEND_API_KEY set).");
  } else if (!isProduction) {
    console.log(
      "[email] RESEND_API_KEY not set — forgot-password prints reset links in this terminal (dev only)."
    );
  }
});
