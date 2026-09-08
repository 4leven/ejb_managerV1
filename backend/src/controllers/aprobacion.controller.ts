import { AccionSolicitud, EstadoSolicitud, TipoEntidad } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { audit } from "../services/audit.js";
import { notify } from "../services/notification.js";
import { hasPermission, isManagement, isTechnical, isAdministration, canDeleteOwned, requiresProjectDeleteApproval, canApproveProjectDeletion } from "../services/permissions.js";

const schema = z.object({
  tipoEntidad: z.nativeEnum(TipoEntidad),
  entidadId: z.string().uuid(),
  accion: z.nativeEnum(AccionSolicitud),
  payload: z.record(z.any()).optional(),
  motivo: z.string().trim().min(3).max(500),
});
const resolutionSchema = z.object({
  approved: z.boolean(),
  comentario: z.string().trim().min(3).max(500),
});
const entityLabel: Record<TipoEntidad, string> = {
  Iniciativa: "Proyectos",
  Objetivo: "Objetivos",
  Requerimiento: "Requerimientos",
  Documento: "Documentos",
};

async function snapshot(type: TipoEntidad, id: string) {
  if (type === TipoEntidad.Iniciativa)
    return prisma.iniciativa.findFirstOrThrow({
      where: { id, deletedAt: null },
    });
  if (type === TipoEntidad.Objetivo)
    return prisma.objetivoNegocio.findFirstOrThrow({
      where: { id, deletedAt: null },
    });
  if (type === TipoEntidad.Requerimiento)
    return prisma.requerimiento.findFirstOrThrow({
      where: { id, deletedAt: null },
    });
  return prisma.flujoArea.findFirstOrThrow({ where: { id, deletedAt: null } });
}
async function stagesFor(type: TipoEntidad, areaId: string, areaName: string) {
  const rules = await prisma.registroPortal.findMany({
    where: { tipo: "regla_aprobacion" },
    orderBy: { createdAt: "desc" },
  });
  const rule = rules.find((row) => {
      const data = row.datos as any;
      return (
        data.activa !== false &&
        data.entidad === entityLabel[type] &&
        (!data.area ||
          /todas/i.test(data.area) ||
          data.area === areaId ||
          data.area === areaName)
      );
    }),
    configured = (rule?.datos as any)?.etapas;
  const allowed = ["Jefe", "Gerente", "Administración"];
  const stages = Array.isArray(configured)
    ? configured.map(String).filter((stage) => allowed.includes(stage))
    : [];
  return stages.length ? stages : ["Gerente"];
}
function canApprove(user: any, stage: string, areaId: string) {
  if (user.isSuperAdmin) return true;

  if (user.areaId !== areaId) return false;
  if (/administraci[oó]n|admin/i.test(stage)) return isAdministration(user);
  if (/gerencia|gerente/i.test(stage)) return user.cargo === "Gerente";
  if (/jefe/i.test(stage))
    return user.cargo === "Jefe";
  return false;
}
async function notifyStage(
  areaId: string,
  stage: string,
  requestId: string,
  requester: string,
) {
  const users = await prisma.usuario.findMany({
    where: /administraci[oó]n|admin/i.test(stage)
      ? {}
      : { OR: [{ areaId }, { isSuperAdmin: true }, { cargo: "Tecnico" }] },
  });
  const approvers = users.filter((user) => canApprove(user, stage, areaId));
  if (!approvers.length)
    throw new Error(`No existe un aprobador disponible para la etapa ${stage}`);
  await Promise.all(
    approvers.map((user) =>
      notify(
        user.id,
        "aprobacion",
        "Nueva solicitud pendiente",
        `${requester} requiere tu aprobación en la etapa ${stage}. Referencia ${requestId.slice(0, 8)}.`,
        "/aprobaciones",
        { requestId, stage },
      ),
    ),
  );
}
async function applyChange(tx: any, request: any, actorId: string) {
  const payload = request.payload ?? {};
  if (request.tipoEntidad === TipoEntidad.Iniciativa) {
    if (request.accion === AccionSolicitud.Eliminar)
      return tx.iniciativa.update({
        where: { id: request.entidadId },
        data: { deletedAt: new Date(), deletedById: actorId },
      });
    const allowed = z
      .object({
        titulo: z.string().min(2).max(200).optional(),
        descripcion: z.string().min(2).optional(),
        cliente: z.string().max(160).nullable().optional(),
        impacto: z.number().int().min(1).max(10).optional(),
        esfuerzo: z.enum(["Bajo", "Medio", "Alto"]).optional(),
      })
      .parse(payload);
    return tx.iniciativa.update({
      where: { id: request.entidadId },
      data: allowed,
    });
  }
  if (request.tipoEntidad === TipoEntidad.Objetivo) {
    if (request.accion === AccionSolicitud.Eliminar)
      return tx.objetivoNegocio.update({
        where: { id: request.entidadId },
        data: { deletedAt: new Date(), deletedById: actorId },
      });
    const allowed = z
      .object({
        nombre: z.string().min(3).max(150).optional(),
        descripcion: z.string().max(1000).nullable().optional(),
      })
      .parse(payload);
    return tx.objetivoNegocio.update({
      where: { id: request.entidadId },
      data: allowed,
    });
  }
  if (request.tipoEntidad === TipoEntidad.Requerimiento) {
    if (request.accion === AccionSolicitud.Eliminar)
      return tx.requerimiento.update({
        where: { id: request.entidadId },
        data: { deletedAt: new Date() },
      });
    const allowed = z
      .object({
        titulo: z.string().min(2).max(180).optional(),
        descripcion: z.string().max(800).nullable().optional(),
        cantidad: z.number().int().min(1).max(9999).optional(),
        prioridad: z.string().max(20).optional(),
        estado: z.string().max(30).optional(),
      })
      .parse(payload);
    return tx.requerimiento.update({
      where: { id: request.entidadId },
      data: allowed,
    });
  }
  if (request.accion === AccionSolicitud.Eliminar)
    return tx.flujoArea.update({
      where: { id: request.entidadId },
      data: { deletedAt: new Date() },
    });
  const allowed = z
    .object({
      titulo: z.string().min(3).max(180).optional(),
      descripcion: z.string().max(500).nullable().optional(),
    })
    .parse(payload);
  return tx.flujoArea.update({
    where: { id: request.entidadId },
    data: allowed,
  });
}

export async function requestChange(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
        include: { area: true },
      }),
      data = schema.parse(req.body),
      current = await snapshot(data.tipoEntidad, data.entidadId);
    const entity = current as any, ownerId = entity.creadorId ?? entity.usuarioId;
    const areaId = entity.areaId;
    if(!areaId && !user.isSuperAdmin) throw new Error("Este registro no tiene área de origen identificada. Solicita la revisión del administrador global.");
    if(data.accion===AccionSolicitud.Eliminar && !canDeleteOwned(user,ownerId,areaId)) throw new Error("No puedes solicitar eliminar contenido de otra persona fuera de tu jefatura de área.");
    if(!user.isSuperAdmin && !isTechnical(user) && !isAdministration(user) && areaId!==user.areaId && ownerId!==user.id)throw new Error("El registro no pertenece a tu área.");
    const directDelete = data.accion===AccionSolicitud.Eliminar && canDeleteOwned(user,ownerId,areaId) && !(data.tipoEntidad===TipoEntidad.Iniciativa && requiresProjectDeleteApproval(user));
    if (directDelete || (data.accion===AccionSolicitud.Editar && (user.isSuperAdmin || isTechnical(user) || (isAdministration(user)&&data.tipoEntidad===TipoEntidad.Requerimiento)))) {
      await prisma.$transaction((tx) => applyChange(tx, { ...data }, user.id));
      await audit(user.id, data.accion, data.tipoEntidad, data.entidadId, {
        directa: true,
      });
      return res
        .status(201)
        .json({ estado: EstadoSolicitud.Aprobada, appliedDirectly: true });
    }
    const duplicate = await prisma.solicitudCambio.findFirst({
      where: {
        tipoEntidad: data.tipoEntidad,
        entidadId: data.entidadId,
        accion: data.accion,
        estado: EstadoSolicitud.Pendiente,
      },
    });
    if (duplicate)
      throw new Error("Ya existe una solicitud pendiente para esta acción");
    const etapas = data.accion===AccionSolicitud.Eliminar ? ["Gerente"] : await stagesFor(
        data.tipoEntidad,
        areaId,
        (await prisma.area.findUniqueOrThrow({where:{id:areaId}})).nombre,
      ),
      row = await prisma.solicitudCambio.create({
        data: {
          ...data,
          snapshot: current as any,
          etapas,
          etapaActual: 0,
          decisiones: [],
          solicitanteId: user.id,
          areaId,
        },
      });
    await notifyStage(
      areaId,
      etapas[0],
      row.id,
      `${user.nombres} ${user.apellidos}`,
    );
    await audit(user.id, "Solicitar", data.tipoEntidad, data.entidadId, {
      solicitudId: row.id,
      etapas,
    });
    const approvers = (await prisma.usuario.findMany({where:{OR:[{areaId},{isSuperAdmin:true}]}})).filter(u=>canApprove(u,etapas[0],areaId)).map(u=>({id:u.id,nombre:`${u.nombres} ${u.apellidos}`,cargo:u.isSuperAdmin?"Administrador global":u.cargo}));
    res.status(201).json({...row,approvers});
  } catch (e) {
    next(e);
  }
}

export async function createSimulation(req:Request,res:Response,next:NextFunction){
 try{
  const user=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}});
  if(!user.isSuperAdmin)throw new Error("Solo el administrador global puede crear esta simulación.");
    const pendingRows=await prisma.solicitudCambio.findMany({where:{solicitanteId:user.id,estado:EstadoSolicitud.Pendiente},orderBy:{createdAt:"desc"},take:100});
    const existing=pendingRows.find(row=>(row.snapshot as any)?.simulacion===true);
  if(existing)return res.json(existing);
  const row=await prisma.solicitudCambio.create({data:{tipoEntidad:TipoEntidad.Iniciativa,entidadId:randomUUID(),accion:AccionSolicitud.Editar,motivo:"[PRUEBA] Revisión de un cambio de título. Puedes aprobar o rechazar esta solicitud sin modificar ningún proyecto real.",snapshot:{simulacion:true,titulo:"Proyecto demostrativo — título original",descripcion:"Escenario de prueba, no corresponde a un proyecto real."},payload:{titulo:"Proyecto demostrativo — título aprobado"},etapas:["Gerente"],etapaActual:0,decisiones:[],solicitanteId:user.id,areaId:user.areaId}});
  await prisma.notificacion.create({data:{usuarioId:user.id,tipo:"aprobacion",titulo:"[PRUEBA] Solicitud lista para revisar",mensaje:"Abre Aprobaciones → Pendientes. Puedes aprobar o rechazar la simulación sin afectar proyectos reales.",enlace:"/aprobaciones",datos:{requestId:row.id,simulacion:true}}});
  res.status(201).json(row);
 }catch(error){next(error)}
}

export async function pending(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      scope = z
        .enum(["pending", "mine", "history"])
        .catch("pending")
        .parse(req.query.scope);
    if (
      scope !== "mine" &&
      !isManagement(user) &&
      !hasPermission(user, "aprobar")
    )
      throw new Error("No tienes permisos para consultar aprobaciones");
    const area =
        user.isSuperAdmin || user.rol === "Admin" || isTechnical(user)
          ? {}
          : { areaId: user.areaId },
      where: any =
        scope === "mine"
          ? { solicitanteId: user.id }
          : scope === "history"
            ? { estado: { not: EstadoSolicitud.Pendiente }, ...area }
            : { estado: EstadoSolicitud.Pendiente, ...area };
    let rows = await prisma.solicitudCambio.findMany({
      where,
      include: {
        solicitante: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            fotoPerfil: true,
          },
        },
        aprobador: { select: { nombres: true, apellidos: true } },
        area: true,
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    if (scope === "pending")
      rows = rows.filter((row) =>
        canApprove(
          user,
          ((row.etapas as string[]) ?? ["Gerente"])[row.etapaActual] ??
            "Gerente",
          row.areaId,
        ),
      );
    res.json(rows.filter(row=>!(row.snapshot as any)?.simulacion||row.solicitanteId===user.id));
  } catch (e) {
    next(e);
  }
}

export async function resolve(req: Request, res: Response, next: NextFunction) {
  try {
    const input = resolutionSchema.parse(req.body),
      user = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      request = await prisma.solicitudCambio.findUniqueOrThrow({
        where: { id: String(req.params.id) },
        include: { solicitante: true },
      }),
      etapas = (request.etapas as string[])?.length
        ? (request.etapas as string[])
        : ["Gerente"],
      stage = etapas[request.etapaActual];
    if (
      request.estado !== EstadoSolicitud.Pendiente ||
      !canApprove(user, stage, request.areaId)
    )
      throw new Error("Solicitud no disponible para tu etapa de aprobación");
    const simulation=(request.snapshot as any)?.simulacion===true;
    if(simulation&&request.solicitanteId!==user.id)throw new Error("Esta simulación pertenece a otra persona.");
    if(request.accion===AccionSolicitud.Eliminar&&!simulation){
      const target=await snapshot(request.tipoEntidad,request.entidadId) as any;
      if(request.tipoEntidad===TipoEntidad.Iniciativa && !canApproveProjectDeletion(user,target.areaId))throw new Error("Solo el gerente del área del proyecto o el administrador global puede autorizar esta eliminación.");
      if(!canDeleteOwned(user,target.creadorId??target.usuarioId,target.areaId))throw new Error("No tienes potestad para eliminar este contenido.");
      if(target.areaId!==request.areaId)throw new Error("El área del registro cambió. Debe generarse una nueva solicitud.");
    }
    const decision = {
        etapa: stage,
        approved: input.approved,
        comentario: input.comentario,
        usuarioId: user.id,
        autor: `${user.nombres} ${user.apellidos}`,
        fecha: new Date().toISOString(),
      },
      decisions = [...((request.decisiones as any[]) ?? []), decision],
      finalApproval =
        input.approved && request.etapaActual >= etapas.length - 1;
    await prisma.$transaction(async (tx) => {
      const reserved = await tx.solicitudCambio.updateMany({
        where: {
          id: request.id,
          estado: EstadoSolicitud.Pendiente,
          etapaActual: request.etapaActual,
        },
        data:
          input.approved && !finalApproval
            ? { etapaActual: { increment: 1 }, decisiones: decisions }
            : {
                estado: input.approved
                  ? EstadoSolicitud.Aprobada
                  : EstadoSolicitud.Rechazada,
                decisiones: decisions,
                motivoResolucion: input.comentario,
                aprobadorId: user.id,
                resolvedAt: new Date(),
              },
      });
      if (reserved.count !== 1)
        throw new Error("La solicitud ya fue atendida por otra persona");
      if (finalApproval && !simulation) await applyChange(tx, request, user.id);
    });
    if (input.approved && !finalApproval)
      await notifyStage(
        request.areaId,
        etapas[request.etapaActual + 1],
        request.id,
        `${request.solicitante.nombres} ${request.solicitante.apellidos}`,
      );
    else if(simulation)
      await prisma.notificacion.create({data:{usuarioId:user.id,tipo:"aprobacion",titulo:input.approved?"[PRUEBA] Simulación aprobada":"[PRUEBA] Simulación rechazada",mensaje:"Tu decisión quedó en el historial. Ningún proyecto real fue modificado.",enlace:"/aprobaciones",datos:{requestId:request.id,simulacion:true}}});
    else
      await notify(
        request.solicitanteId,
        "aprobacion",
        input.approved ? "Solicitud aprobada" : "Solicitud rechazada",
        `${request.accion} de ${request.tipoEntidad}: ${input.comentario}`,
        "/aprobaciones",
        { requestId: request.id, approved: input.approved },
      );
    await audit(
      user.id,
      input.approved ? "Aprobar" : "Rechazar",
      request.tipoEntidad,
      request.entidadId,
      { solicitudId: request.id, etapa: stage, comentario: input.comentario },
    );
    res.json({
      ok: true,
      completed: finalApproval || !input.approved,
      nextStage:
        input.approved && !finalApproval
          ? etapas[request.etapaActual + 1]
          : null,
    });
  } catch (e) {
    next(e);
  }
}
