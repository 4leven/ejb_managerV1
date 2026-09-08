import { Router } from "express";
import {
  forgot,
  login,
  me,
  register,
  reset,
  verify,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";
export const authRoutes = Router()
  .post("/registro", register)
  .post("/login", login)
  .post("/olvide-password", forgot)
  .post("/restablecer-password", reset)
  .post("/verificar-email", verify)
  .get("/me", requireAuth, me);
