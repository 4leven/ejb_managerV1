import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomInt} from 'node:crypto';
import {prisma} from '../dist/config/db.js';
import {create,detail,list} from '../dist/controllers/ticket.controller.js';
import {saveProductRecord} from '../dist/controllers/product.controller.js';
import {createSimulation,resolve} from '../dist/controllers/aprobacion.controller.js';
import {TICKET_MODULES} from '../dist/constants/ticket.js';
const prefix=randomUUID().slice(0,8),ruc='99'+String(randomInt(0,1e9)).padStart(9,'0');let area,user;
async function call(fn,body={},params={},query={}){let value,error;const res={status(){return this},json(v){value=v;return this}};await fn({userId:user.id,body,params,query},res,e=>error=e);if(error)throw error;return value}
try{
 area=await prisma.area.create({data:{nombre:`QA registro ${prefix}`,colorHex:'#112233'}});
 user=await prisma.usuario.create({data:{nombres:'QA temporal',apellidos:prefix,email:`${prefix}@example.invalid`,passwordHash:randomUUID(),areaId:area.id,cargo:'Trabajador',rol:'Usuario',isSuperAdmin:true}});
 const input={ruc,razonSocial:`QA cliente ${prefix}`,telefono:'555123456',contacto:'QA contacto',consulta:'Consulta de prueba aislada',prioridad:'NORMAL',canal:'TELEFONO',observaciones:'Observaciones iniciales de prueba'};
 for(const modulo of TICKET_MODULES){const row=await call(create,{...input,modulo});assert.equal(row.estado,'PENDIENTE');assert.equal(row.asignadoAId,null);assert.equal(row.observaciones,input.observaciones);assert.equal(row.ruc,ruc);assert.equal(row.telefono,input.telefono);}
 assert.equal(await prisma.cliente.count({where:{ruc}}),1);
 const master=await prisma.cliente.findUniqueOrThrow({where:{ruc}});
 const changed=await call(create,{...input,clienteId:master.id,razonSocial:`QA nombre corregido ${prefix}`,telefono:'',modulo:'ROBOTS'});
 const view=await call(detail,{}, {id:changed.id});assert.equal(view.telefono,null);assert.equal(view.razonSocial,`QA nombre corregido ${prefix}`);
 assert.equal((await prisma.cliente.findUniqueOrThrow({where:{ruc}})).razonSocial,input.razonSocial);
 const page=await call(list,{}, {},{q:ruc});assert.equal(page.total,10);
 await assert.rejects(call(create,{...input,ruc:'123',modulo:'ROBOTS'}));
 await assert.rejects(call(create,{...input,modulo:'NO EXISTE'}));
 const photo={nombre:'prueba.png',mime:'image/png',data:'data:image/png;base64,iVBORw0KGgo='};
 const post=await call(saveProductRecord,{titulo:'QA foto',mensaje:'',formato:'markdown',prioridad:'Informativo',adjuntos:[photo]},{type:'comunicado'});assert.equal(post.datos.adjuntos.length,1);
 await assert.rejects(call(saveProductRecord,{titulo:'QA vacío',mensaje:'',prioridad:'Informativo',adjuntos:[]},{type:'comunicado'}));
 const count=await prisma.iniciativa.count();const simulation=await call(createSimulation);
 assert.equal(simulation.snapshot.simulacion,true);
 await call(resolve,{approved:true,comentario:'Prueba de aprobación sin efectos'}, {id:simulation.id});
 assert.equal(await prisma.iniciativa.count(),count);
 assert.equal((await prisma.solicitudCambio.findUniqueOrThrow({where:{id:simulation.id}})).estado,'Aprobada');
 const rejected=await call(createSimulation);await call(resolve,{approved:false,comentario:'Prueba de rechazo sin efectos'},{id:rejected.id});
 assert.equal((await prisma.solicitudCambio.findUniqueOrThrow({where:{id:rejected.id}})).estado,'Rechazada');
 console.log('PASS: 9 módulos, cliente nuevo/existente, campos editables, cola sin asignación, observaciones, foto sin texto y simulación aprobar/rechazar sin efectos.');
}finally{
 if(user){await prisma.notificacion.deleteMany({where:{usuarioId:user.id}});await prisma.solicitudCambio.deleteMany({where:{solicitanteId:user.id}});await prisma.registroPortal.deleteMany({where:{creadorId:user.id}});await prisma.ticket.deleteMany({where:{creadoPorId:user.id}});await prisma.usuario.delete({where:{id:user.id}});}
 await prisma.cliente.deleteMany({where:{ruc}});if(area)await prisma.area.delete({where:{id:area.id}});await prisma.$disconnect();console.log('Datos temporales de QA retirados.');
}
