import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getCustomers,
  getCustomer,
  postCustomer,
  putCustomer,
  removeCustomer,
  patchWallet,
} from "../controllers/customer.controller.js";

export const customerRouter = Router();

customerRouter.use(requireAuth);

customerRouter.get("/", getCustomers);
customerRouter.post("/", postCustomer);
customerRouter.patch("/:id/wallet", patchWallet);
customerRouter.get("/:id", getCustomer);
customerRouter.put("/:id", putCustomer);
customerRouter.delete("/:id", removeCustomer);
