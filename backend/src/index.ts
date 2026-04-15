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

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

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

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
