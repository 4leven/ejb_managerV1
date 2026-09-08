import { Router } from 'express';import { create,list,progress } from '../controllers/objetivo.controller.js';
export const objetivoRoutes=Router().get('/',list).post('/',create).post('/:id/progresos',progress);
