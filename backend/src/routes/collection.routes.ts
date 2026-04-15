import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getCollection,
  postSnapshot,
  putCollectionItem,
  deleteCollectionRow,
} from "../controllers/collection.controller.js";

export const collectionRouter = Router();

collectionRouter.use(requireAuth);

collectionRouter.get("/:collection", getCollection);
collectionRouter.post("/:collection/snapshot", postSnapshot);
collectionRouter.put("/:collection/:entityId", putCollectionItem);
collectionRouter.delete("/:collection/:entityId", deleteCollectionRow);
