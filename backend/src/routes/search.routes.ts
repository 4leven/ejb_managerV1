import{Router}from"express";import{auditTrail,globalSearch}from"../controllers/search.controller.js";export const searchRoutes=Router().get("/",globalSearch).get("/auditoria",auditTrail);
