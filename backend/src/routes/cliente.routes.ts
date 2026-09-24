import { Router } from 'express';
import { create, search } from '../controllers/cliente.controller.js';
export const clienteRoutes = Router().get('/', search).post('/', create);
