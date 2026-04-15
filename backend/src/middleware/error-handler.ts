import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      data: null,
      error: { message: "Validation failed", details: err.flatten() },
    });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = message === "Not found" ? 404 : 500;
  res.status(status).json({ data: null, error: { message } });
}
