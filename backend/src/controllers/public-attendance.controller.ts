import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getBranchAttendanceContext,
  resolveAttendancePin,
} from "../services/public-attendance.service.js";

export async function getPublicAttendanceContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const branchId = String(req.query.branchId ?? "").trim();
    const qr = typeof req.query.qr === "string" ? req.query.qr : undefined;
    if (!branchId) {
      res.status(400).json({
        data: null,
        error: { message: "branchId is required", code: "MISSING_BRANCH" },
      });
      return;
    }

    const result = await getBranchAttendanceContext(branchId, qr);
    if (!result.ok) {
      const code = result.error;
      res.status(code === "INVALID_QR" ? 403 : 404).json({
        data: null,
        error: {
          message:
            code === "INVALID_QR"
              ? "This QR link is not valid for this branch."
              : "Unknown or inactive branch.",
          code,
        },
      });
      return;
    }

    res.json({ data: result, error: null });
  } catch (e) {
    next(e);
  }
}

const resolvePinSchema = z.object({
  pin: z.string().min(1).max(16),
  branchId: z.string().min(1),
});

export async function postResolveAttendancePin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = resolvePinSchema.parse(req.body);
    const result = await resolveAttendancePin(body.pin, body.branchId);
    if (!result.ok) {
      const status =
        result.error === "WRONG_BRANCH" ? 403 : 404;
      res.status(status).json({
        data: null,
        error: {
          message:
            result.error === "WRONG_BRANCH"
              ? "You are not assigned to this branch."
              : "PIN not recognized.",
          code: result.error,
        },
      });
      return;
    }
    res.json({ data: result, error: null });
  } catch (e) {
    next(e);
  }
}
