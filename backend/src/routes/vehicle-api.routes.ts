import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getVehicles,
  postVehicle,
  putVehicle,
  removeVehicle,
  postVehicleSnapshot,
} from "../controllers/vehicle-api.controller.js";

export const vehicleApiRouter = Router();

vehicleApiRouter.use(requireAuth);

vehicleApiRouter.get("/", getVehicles);
vehicleApiRouter.post("/snapshot", postVehicleSnapshot);
vehicleApiRouter.post("/", postVehicle);
vehicleApiRouter.put("/:id", putVehicle);
vehicleApiRouter.delete("/:id", removeVehicle);
