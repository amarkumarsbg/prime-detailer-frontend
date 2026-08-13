import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { inspectionPhotoUploadHandler } from "../middleware/inspection-photo-upload.js";
import { postJobCardInspectionPhoto } from "../controllers/job-card-upload.controller.js";

export const jobCardUploadRouter = Router();

jobCardUploadRouter.use(requireAuth);
jobCardUploadRouter.use(requirePermission("JOB_CARDS"));

jobCardUploadRouter.post(
  "/:jobCardId/photos",
  inspectionPhotoUploadHandler,
  postJobCardInspectionPhoto
);
