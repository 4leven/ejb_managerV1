import { Router } from "express";
import {
  adoptionSummary,
  listProductRecords,
  saveProductRecord,
  updateProductRecord,
} from "../controllers/product.controller.js";
export const productRoutes = Router()
  .get("/adopcion/resumen", adoptionSummary)
  .get("/:type", listProductRecords)
  .post("/:type", saveProductRecord)
  .patch("/:type/:id", updateProductRecord);
