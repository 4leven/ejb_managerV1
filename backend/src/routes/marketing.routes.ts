import { Router } from "express";
import { createProspecto, getMeta, importProspectos, listProspectos, meses, removeProspecto, reporte, resumen, setMeta, updateProspecto } from "../controllers/marketing.controller.js";
export const marketingRoutes = Router()
  .get("/prospectos", listProspectos)
  .post("/prospectos", createProspecto)
  .post("/prospectos/importar", importProspectos)
  .patch("/prospectos/:id", updateProspecto)
  .delete("/prospectos/:id", removeProspecto)
  .get("/resumen", resumen)
  .get("/reporte", reporte)
  .get("/meses", meses)
  .get("/meta", getMeta)
  .patch("/meta", setMeta);
