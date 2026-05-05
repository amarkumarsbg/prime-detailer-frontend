import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { customerRouter } from "./routes/customer.routes.js";
import { bootstrapRouter } from "./routes/bootstrap.routes.js";
import { collectionRouter } from "./routes/collection.routes.js";
import { branchApiRouter } from "./routes/branch-api.routes.js";
import { userApiRouter } from "./routes/user-api.routes.js";
import { vehicleApiRouter } from "./routes/vehicle-api.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { isTwilioSmsEnabled, isTwilioWhatsAppEnabled } from "./services/twilio-sms.service.js";
import { messagingRouter } from "./routes/messaging.routes.js";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Prime Detailers API",
    hint: "Use the Next.js app in your browser (usually port 3000), not this URL alone.",
    frontend: env.FRONTEND_ORIGIN,
    endpoints: { health: "/health", api: "/api" },
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/customers", customerRouter);
app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/collections", collectionRouter);
app.use("/api/branches", branchApiRouter);
app.use("/api/users", userApiRouter);
app.use("/api/vehicles", vehicleApiRouter);
app.use("/api/messaging", messagingRouter);

app.use(errorHandler);

const isProduction = process.env.NODE_ENV === "production";

app.listen(env.PORT, () => {
  if (isProduction) {
    console.log(`API listening on port ${env.PORT}`);
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
});
