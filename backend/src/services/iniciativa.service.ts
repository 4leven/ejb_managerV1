import { Estado, Esfuerzo, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { codigo, score } from '../utils/iniciativa.js';
import { automaticProjectStatus, progressFromTasks, type ProjectStatus } from './project-status.js';

const allowed: Record<Estado, Estado[]> = {
  Pendiente: [Estado.En_evaluacion], En_evaluacion: [Estado.Pendiente, Estado.Priorizado],
  Priorizado: [Estado.En_evaluacion, Estado.En_desarrollo], En_desarrollo: [Estado.Priorizado],
  Finalizado: []
};
export const iniciativaService = {
  async list() {const rows=await prisma.iniciativa.findMany({where:{deletedAt:null},include:{area:true, objetivo:true, responsable:true, clienteRef:true,tareas:{where:{deletedAt:null},include:{responsable:{select:{id:true,nombres:true,apellidos:true,fotoPerfil:true}},comentarios:{include:{usuario:{select:{id:true,nombres:true,apellidos:true,fotoPerfil:true}}},orderBy:{createdAt:'desc'}}},orderBy:{createdAt:'asc'}},progresos:{orderBy:{createdAt:'desc'}},_count:{select:{eventos:true}}}, orderBy:{score:'desc'}});return rows.map(row=>{const porcentajeAvance=progressFromTasks(row.tareas.length,row.tareas.filter(task=>task.completada).length,row.porcentajeAvance),hasActiveTasks=row.tareas.some(task=>task.estado==='Iniciado'||task.estado==='En_progreso');return{...row,cliente:row.clienteRef?.razonSocial??row.cliente,porcentajeAvance,estado:automaticProjectStatus(porcentajeAvance,row.estado as ProjectStatus,hasActiveTasks)}})},
  async create(data:{creadorId?:string;titulo:string;descripcion:string;clienteId?:string;software?:string;areaId:string;responsableId?:string;objetivoId?:string;impacto:number;esfuerzo:Esfuerzo;fechaInicio?:Date;fechaFin?:Date;tareas?:string[]}) {
    const attempt = () => prisma.$transaction(async tx => {
      // El codigo (INV-0001, INV-0002, ...) se calcula como el maximo numerico real,
      // no por orden alfabetico de string: codigos con distinto ancho de relleno
      // (ej. los antiguos de 3 digitos vs. los nuevos de 4) no ordenan igual como
      // texto que como numero, y basarse en ORDER BY codigo DESC podria repetir
      // o saltar numeros ya usados en produccion.
      const rows = await tx.iniciativa.findMany({ select:{codigo:true} });
      const sequence = rows.reduce((max,row)=>Math.max(max, Number(row.codigo.slice(4)) || 0), 0);
      const {tareas,...initiative}=data;
      // El texto legacy "cliente" se mantiene en sincronia con el cliente elegido
      // en el selector, para que reportes/exportaciones/busqueda que aun leen ese
      // campo directo de la base (sin pasar por este servicio) sigan mostrando el
      // nombre correcto sin necesidad de tocarlos.
      const clienteNombre = initiative.clienteId
        ? (await tx.cliente.findUnique({ where:{ id: initiative.clienteId }, select:{ razonSocial:true } }))?.razonSocial
        : undefined;
      return tx.iniciativa.create({data:{...initiative,cliente:clienteNombre,codigo:codigo(sequence),score:score(data.impacto,data.esfuerzo),tareas:tareas?.length?{create:tareas.map(titulo=>({titulo}))}:undefined},include:{area:true,tareas:true,clienteRef:true}});
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    try { return await attempt(); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) return attempt();
      throw error;
    }
  },
  // responsableId: undefined = conservar el actual; null = quitarlo; texto = asignarlo.
  async transition(id:string, estado:Estado, responsableId?:string|null) {
    const current = await prisma.iniciativa.findUniqueOrThrow({where:{id}});
    if (!allowed[current.estado].includes(estado)) throw new Error('Transición de estado no permitida');
    const owner = responsableId === undefined ? current.responsableId : responsableId;
    if (estado === Estado.Priorizado && !owner) throw new Error('Asigna un responsable antes de priorizar');
    return prisma.iniciativa.update({where:{id},data:{estado,responsableId:owner}});
  },
  progresos:(id:string)=>prisma.progreso.findMany({where:{iniciativaId:id},include:{usuario:{select:{nombres:true,apellidos:true}}},orderBy:{createdAt:'desc'}}),
  appearance:(id:string,icono:string,colorIcono:string)=>prisma.iniciativa.update({where:{id},data:{icono,colorIcono},include:{area:true,objetivo:true,responsable:true}}),
  async addProgreso(id:string,usuarioId:string,porcentaje:number,comentario:string){
    return prisma.$transaction(async tx=>{
      const initiative=await tx.iniciativa.findUniqueOrThrow({where:{id},include:{tareas:{where:{deletedAt:null},select:{completada:true,estado:true}}}});
      const porcentajeAvance=progressFromTasks(initiative.tareas.length,initiative.tareas.filter(task=>task.completada).length,porcentaje);
      const estadoProyecto=automaticProjectStatus(porcentajeAvance,initiative.estado as ProjectStatus,initiative.tareas.some(task=>task.estado==='Iniciado'||task.estado==='En_progreso'));
      const progreso=await tx.progreso.create({data:{iniciativaId:id,usuarioId,porcentaje,comentario},include:{usuario:{select:{nombres:true,apellidos:true}}}});
      await tx.iniciativa.update({where:{id},data:{porcentajeAvance,estado:estadoProyecto}});
      return {...progreso,porcentajeAvance,estadoProyecto};
    });
  }
};
