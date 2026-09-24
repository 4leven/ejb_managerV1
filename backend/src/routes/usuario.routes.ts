import { Router } from 'express';
import { catalog,color,messageStatus,password,preferences,profile,removeTeamMember,team,teamCargo } from '../controllers/usuario.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePageAccess } from '../middlewares/pageAccess.js';
export const usuarioRoutes=Router().get('/catalogo',catalog).get('/equipo',requireAuth,requirePageAccess('verEquipo'),team).patch('/equipo/:id/cargo',requireAuth,teamCargo).delete('/equipo/:id',requireAuth,removeTeamMember).patch('/me/color',requireAuth,color).patch('/me/preferencias',requireAuth,preferences).patch('/me/estado-mensaje',requireAuth,messageStatus).patch('/me/perfil',requireAuth,profile).patch('/me/password',requireAuth,password);
