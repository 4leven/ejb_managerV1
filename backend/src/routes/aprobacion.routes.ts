import { Router } from 'express';import { pending,requestChange,resolve,createSimulation } from '../controllers/aprobacion.controller.js';
import { requirePageAccess } from '../middlewares/pageAccess.js';
export const aprobacionRoutes=Router().get('/',requirePageAccess('verAprobaciones'),pending).post('/',requestChange).post('/simulacion',createSimulation).post('/:id/resolver',resolve);
