import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../dist/config/db.js';
import { remove } from '../dist/controllers/iniciativa.controller.js';
import { requestChange, resolve } from '../dist/controllers/aprobacion.controller.js';
import { deleteForEveryone, thread } from '../dist/controllers/mensaje.controller.js';
import { spaceActivity, removeSpace } from '../dist/controllers/chat-space.controller.js';
import { updateSurvey } from '../dist/controllers/survey.controller.js';
import { saveProductRecord } from '../dist/controllers/product.controller.js';
import { authService } from '../dist/services/auth.service.js';
import { updateRequirement, deleteRequirement } from '../dist/controllers/operacion.controller.js';
import { update as updateEvent, remove as removeEvent } from '../dist/controllers/evento.controller.js';

const ids=[],areas=[],projects=[],prefix=randomUUID().slice(0,8);
const originalFindMany=prisma.usuario.findMany.bind(prisma.usuario);
async function call(fn,user,params={},body={}){
 let output,error,status=200;
 const res={json(v){output=v;return this},status(v){status=v;return this},setHeader(){},end(){}};
 await fn({userId:user.id,params,body,headers:{},query:{}},res,e=>{error=e});
 if(error)throw error;if(status>=400)throw new Error(output?.message||String(status));return output;
}
try{
 for(let i=0;i<2;i++)areas.push(await prisma.area.create({data:{nombre:`QA roles ${prefix}-${i}`,colorHex:'#112233'}}));
 async function actor(cargo,area=0,superAdmin=false){const user=await prisma.usuario.create({data:{nombres:'QA temporal',apellidos:prefix,email:`${randomUUID()}@example.invalid`,passwordHash:randomUUID(),cargo,rol:'Usuario',areaId:areas[area].id,isSuperAdmin:superAdmin}});ids.push(user.id);return user}
 const worker=await actor('Trabajador'),peer=await actor('Asistente'),tech=await actor('Tecnico'),jefe=await actor('Jefe'),manager=await actor('Gerente'),admin=await actor('Administracion'),foreign=await actor('Gerente',1),global=await actor('Trabajador',0,true);
 // Limit notification recipients to this test's accounts; no real users are notified.
 prisma.usuario.findMany=async(...args)=>(await originalFindMany(...args)).filter(row=>ids.includes(row.id));
 async function project(){const row=await prisma.iniciativa.create({data:{codigo:`Q${randomUUID().replaceAll('-','').slice(0,8)}`,titulo:'QA temporal',descripcion:'Prueba aislada de permisos',areaId:areas[0].id,creadorId:worker.id,impacto:1,esfuerzo:'Bajo',score:1}});projects.push(row.id);return row}
 const p=await project();
 for(const user of [worker,tech,peer,foreign])await assert.rejects(call(remove,user,{id:p.id}));
 const request=await call(requestChange,worker,{}, {tipoEntidad:'Iniciativa',entidadId:p.id,accion:'Eliminar',motivo:'Validar aprobación aislada'});
 assert.equal(request.estado,'Pendiente');assert.deepEqual(new Set(request.approvers.map(u=>u.id)),new Set([manager.id,global.id]));
 for(const user of [jefe,tech,admin,foreign])await assert.rejects(call(resolve,user,{id:request.id},{approved:true,comentario:'Revisión de prueba'}));
 assert.equal((await prisma.iniciativa.findUnique({where:{id:p.id}})).deletedAt,null);
 await call(resolve,manager,{id:request.id},{approved:true,comentario:'Aprobación única del gerente'});
 assert.ok((await prisma.iniciativa.findUnique({where:{id:p.id}})).deletedAt);
 await assert.rejects(call(resolve,global,{id:request.id},{approved:true,comentario:'Intento duplicado'}));
 const p2=await project();const r2=await call(requestChange,worker,{}, {tipoEntidad:'Iniciativa',entidadId:p2.id,accion:'Eliminar',motivo:'Validar administrador global'});
 await call(resolve,global,{id:r2.id},{approved:true,comentario:'Aprobación única global'});
 assert.ok((await prisma.iniciativa.findUnique({where:{id:p2.id}})).deletedAt);
 const msg=await prisma.mensaje.create({data:{remitenteId:worker.id,destinatarioId:peer.id,contenido:'Adjunto privado de prueba',tipo:'Documento',archivoData:'data:text/plain;base64,SG9sYQ==',archivoNombre:'qa.txt'}});
 await assert.rejects(call(deleteForEveryone,peer,{messageId:msg.id}));
 await call(deleteForEveryone,worker,{messageId:msg.id});
 for(const user of [worker,peer]){const rows=await call(thread,user,{userId:user.id===worker.id?peer.id:worker.id});const deleted=rows.find(r=>r.id===msg.id);assert.ok(deleted.eliminadoAt);assert.equal(deleted.archivoData,null);assert.equal(deleted.contenido,'Este mensaje fue eliminado');}
 const group=await prisma.registroPortal.create({data:{tipo:'grupo',creadorId:worker.id,datos:{nombre:'QA temporal',miembros:[worker.id,peer.id,jefe.id],mensajes:[]}}});
 const posted=await call(spaceActivity,worker,{tipo:'grupo',id:group.id},{action:'post',texto:'Mensaje de prueba'});
 await assert.rejects(call(spaceActivity,peer,{tipo:'grupo',id:group.id},{action:'remove',messageId:posted.datos.mensajes[0].id}));
 await assert.rejects(call(removeSpace,peer,{tipo:'grupo',id:group.id}));
 await call(removeSpace,jefe,{tipo:'grupo',id:group.id});
 assert.equal((await prisma.registroPortal.findUnique({where:{id:group.id}})).tipo,'grupo_eliminado');
 const survey=await prisma.registroPortal.create({data:{tipo:'encuesta',creadorId:worker.id,datos:{pregunta:'QA temporal',opciones:['A','B'],votos:{},activa:true}}});
 await updateSurvey(survey.id,peer.id,{action:'vote',opcion:1});
 await assert.rejects(updateSurvey(survey.id,peer.id,{pregunta:'No autorizado'}));
 await updateSurvey(survey.id,admin.id,{pregunta:'Administración puede editar'});
 assert.equal((await prisma.registroPortal.findUnique({where:{id:survey.id}})).datos.votos[peer.id].opcion,1);
 for(const user of [worker,peer,tech])await assert.rejects(call(saveProductRecord,user,{type:'comunicado'},{titulo:'QA',mensaje:'Prueba',prioridad:'Informativo'}));
 for(const user of [admin,jefe,manager])assert.ok((await call(saveProductRecord,user,{type:'comunicado'},{titulo:'QA temporal',mensaje:'Prueba aislada',prioridad:'Informativo'})).id);
 for(const cargo of ['Jefe','Gerente'])await assert.rejects(authService.register({cargo,approvalCode:'incorrecto'}),/Código de aprobación/);
 for(const cargo of ['Jefe','Gerente'])await assert.rejects(authService.register({cargo,email:worker.email,approvalCode:process.env.REGISTRATION_APPROVAL_CODE??'2026-2'}),/correo ya está registrado/);
 const requirement=await prisma.requerimiento.create({data:{titulo:'QA temporal',cantidad:1,prioridad:'Normal',estado:'Solicitado',areaId:areas[1].id,usuarioId:peer.id}});
 await call(updateRequirement,admin,{id:requirement.id},{titulo:'Administración edita otra área',cantidad:3});
 assert.equal((await prisma.requerimiento.findUnique({where:{id:requirement.id}})).cantidad,3);
 await assert.rejects(call(deleteRequirement,admin,{id:requirement.id}));
 const event=await prisma.evento.create({data:{titulo:'QA temporal',inicio:new Date(),fin:new Date(Date.now()+3600000),areaId:areas[1].id,creadorId:peer.id,icono:'QA',colorHex:'#112233',prioridad:'Normal',estado:'Programado'}});
 await call(updateEvent,admin,{id:event.id},{titulo:'Administración edita calendario'});
 assert.equal((await prisma.evento.findUnique({where:{id:event.id}})).titulo,'Administración edita calendario');
 await assert.rejects(call(removeEvent,admin,{id:event.id}));
 console.log('PASS: Administración edita requerimientos/calendario de otras áreas sin poder borrarlos; código válido aceptado para Jefe y Gerente.');
 console.log('PASS: roles, propiedad, aprobación única por gerente/global, bloqueo entre áreas, mensajes para todos, grupos, encuestas y comunicados.');
}finally{
 prisma.usuario.findMany=originalFindMany;
 // Only UUIDs created by this invocation are removed.
 await prisma.notificacion.deleteMany({where:{usuarioId:{in:ids}}});
 await prisma.solicitudCambio.deleteMany({where:{solicitanteId:{in:ids}}});
 await prisma.registroPortal.deleteMany({where:{creadorId:{in:ids}}});
 await prisma.mensaje.deleteMany({where:{remitenteId:{in:ids}}});
 await prisma.requerimiento.deleteMany({where:{usuarioId:{in:ids}}});
 await prisma.evento.deleteMany({where:{creadorId:{in:ids}}});
 await prisma.iniciativa.deleteMany({where:{id:{in:projects}}});
 await prisma.usuario.deleteMany({where:{id:{in:ids}}});
 await prisma.area.deleteMany({where:{id:{in:areas.map(a=>a.id)}}});
 await prisma.$disconnect();console.log('Registros temporales de QA retirados.');
}
