import { Router } from "express";
import {
  login,
  me,
  sendLoginOtp,
  verifyLoginOtp,
  forgotPassword,
  completePasswordReset,
  getResetPasswordTokenStatus,
  changePassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/change-password", requireAuth, changePassword);
authRouter.post("/forgot-password", forgotPassword);
authRouter.get("/reset-password/status", getResetPasswordTokenStatus);
authRouter.post("/reset-password", completePasswordReset);
authRouter.post("/otp/send", sendLoginOtp);
authRouter.post("/otp/verify", verifyLoginOtp);
authRouter.get("/me", requireAuth, me);
