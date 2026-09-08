import { Router } from "express";
import * as ticket from "../controllers/ticket.controller.js";
export const ticketRoutes=Router().get("/stream",ticket.stream).get("/resumen",ticket.summary).get("/catalogos",ticket.catalogs).get("/clientes",ticket.clients).get("/consultores",ticket.consultants).get("/",ticket.list).post("/",ticket.create).get("/:id",ticket.detail).post("/:id/tomar",ticket.take).patch("/:id/avance",ticket.advance).post("/:id/finalizar",ticket.finish).post("/:id/reabrir",ticket.reopen).post("/:id/reasignar",ticket.reassign);
