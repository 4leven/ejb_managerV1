import { Router } from 'express';import { pending,requestChange,resolve,createSimulation } from '../controllers/aprobacion.controller.js';
export const aprobacionRoutes=Router().get('/',pending).post('/',requestChange).post('/simulacion',createSimulation).post('/:id/resolver',resolve);
