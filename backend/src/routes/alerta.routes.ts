import { Router } from 'express';
import { alerts, alertStream } from '../controllers/alerta.controller.js';

export const alertaRoutes = Router()
  .get('/stream', alertStream)
  .get('/', alerts);
