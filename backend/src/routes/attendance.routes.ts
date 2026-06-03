import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAttendance, deleteAttendance } from "../controllers/attendance.controller.js";

/** Authenticated dashboard reads (and admin reset) of staff attendance records. */
export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

attendanceRouter.get("/", getAttendance);
attendanceRouter.delete("/", deleteAttendance);
