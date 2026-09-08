import { Router } from 'express'; import { addProgreso,appearance,create,list,progresos,remove,transition,update } from '../controllers/iniciativa.controller.js';
import { addTask,updateTask } from '../controllers/tarea.controller.js';
export const iniciativaRoutes=Router().get('/',list).post('/',create).patch('/:id/estado',transition).patch('/:id/apariencia',appearance).patch('/:id',update).delete('/:id',remove).get('/:id/progresos',progresos).post('/:id/progresos',addProgreso).post('/:id/tareas',addTask).patch('/:id/tareas/:taskId',updateTask);
