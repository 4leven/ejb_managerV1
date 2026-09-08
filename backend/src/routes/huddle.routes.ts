import { Router } from "express";
import { activeHuddle, joinHuddle, leaveHuddle, startHuddle } from "../controllers/huddle.controller.js";
export const huddleRoutes = Router().get("/activas", activeHuddle).post("/", startHuddle).post("/:id/unirse", joinHuddle).post("/:id/salir", leaveHuddle);
