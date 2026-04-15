import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { UserRole } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  branchId: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ data: null, error: { message: "Missing authorization token" } });
    return;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
      sub: string;
      email: string;
      role: UserRole;
      branchId: string;
      name: string;
    };
    req.auth = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      branchId: decoded.branchId,
      name: decoded.name,
    };
    next();
  } catch {
    res.status(401).json({ data: null, error: { message: "Invalid or expired token" } });
  }
}
