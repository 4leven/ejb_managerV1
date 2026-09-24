import { Router } from 'express';import { create,list,progress } from '../controllers/objetivo.controller.js';
import { requirePageAccess } from '../middlewares/pageAccess.js';
export const objetivoRoutes=Router().get('/',requirePageAccess('verObjetivos'),list).post('/',create).post('/:id/progresos',progress);
