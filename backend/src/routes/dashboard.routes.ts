import { Router } from 'express';
import { monthlyReport, summary } from '../controllers/dashboard.controller.js';
import { requirePageAccess } from '../middlewares/pageAccess.js';
export const dashboardRoutes=Router().get('/',requirePageAccess('verInformesBI'),summary).get('/reporte-mensual',requirePageAccess('verReporteria'),monthlyReport);
