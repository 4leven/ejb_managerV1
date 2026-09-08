import { Router } from 'express';
import { monthlyReport, summary } from '../controllers/dashboard.controller.js';
export const dashboardRoutes=Router().get('/',summary).get('/reporte-mensual',monthlyReport);
