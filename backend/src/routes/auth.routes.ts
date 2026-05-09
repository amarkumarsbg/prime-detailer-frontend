import { Router } from "express";
import {
  login,
  register,
  me,
  sendLoginOtp,
  verifyLoginOtp,
  forgotPassword,
  completePasswordReset,
  getResetPasswordTokenStatus,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/forgot-password", forgotPassword);
authRouter.get("/reset-password/status", getResetPasswordTokenStatus);
authRouter.post("/reset-password", completePasswordReset);
authRouter.post("/otp/send", sendLoginOtp);
authRouter.post("/otp/verify", verifyLoginOtp);
authRouter.post("/register", register);
authRouter.get("/me", requireAuth, me);
