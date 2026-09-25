import { Request, Response, NextFunction } from "express";
import { Esfuerzo, Estado } from "@prisma/client";
import { z } from "zod";
import { iniciativaService } from "../services/iniciativa.service.js";
import { prisma } from "../config/db.js";
import { audit } from "../services/audit.js";
import { score as computeScore } from "../utils/iniciativa.js";
import {
  canManageInitiative, canDeleteInitiative, requiresProjectDeleteApproval,
  canReadInitiative,
  canCreateInitiativeInArea,
  canDeriveInitiative,
  canLeadInitiative,
} from "../services/permissions.js";
const createSchema = z
  .object({
    titulo: z.string().min(3),
    descripcion: z.string().min(10),
    clienteId: z.string().uuid().optional(),
    software: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => v || undefined),
    areaId: z.string().uuid(),
    responsableId: z.string().uuid().optional(),
    objetivoId: z.string().uuid().optional(),
    impacto: z.number().int().min(1).max(10),
    esfuerzo: z.nativeEnum(Esfuerzo),
    fechaInicio: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    fechaFin: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    tareas: z.array(z.string().trim().min(2).max(220)).max(30).optional(),
  })
  .refine((v) => !v.fechaInicio || !v.fechaFin || v.fechaFin >= v.fechaInicio, {
    message: "La fecha fin debe ser posterior al inicio",
  });
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      rows = await iniciativaService.list();
    res.json(rows.filter((row) => canReadInitiative(actor, row)));
  } catch (e) {
    next(e);
  }
};
export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = createSchema.parse(req.body),
      actor = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      });
    if (!canCreateInitiativeInArea(actor, input.areaId))
      throw new Error("Solo puedes registrar proyectos para tu área");
    if (input.responsableId) {
      if (!canDeriveInitiative(actor))
        throw new Error("Solo jefes, gerentes y el administrador principal pueden derivar proyectos");
      const responsable = await prisma.usuario.findUnique({ where: { id: input.responsableId }, select: { areaId: true } });
      if (!responsable || responsable.areaId !== input.areaId)
        throw new Error("El responsable seleccionado no pertenece al área del proyecto");
    }
    const row = await iniciativaService.create({...input,creadorId:actor.id});
    await audit(actor.id, "Crear", "Iniciativa", row.id, {
      codigo: row.codigo,
      titulo: row.titulo,
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
};
export const transition = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = String(req.params.id),
      actor = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      current = await prisma.iniciativa.findUniqueOrThrow({ where: { id } });
    if (!canManageInitiative(actor, current))
      throw new Error("No tienes permisos para cambiar este proyecto");
    const estado = z.nativeEnum(Estado).parse(req.body.estado),
      responsableId = z.string().uuid().nullish().parse(req.body.responsableId) ?? undefined;
    // Reenviar el responsable actual (el Kanban lo hace en cada movimiento) no
    // es derivar. Asignar o cambiar uno distinto exige la misma regla que
    // crear/editar, y el responsable debe ser del área del proyecto.
    if (responsableId && responsableId !== current.responsableId) {
      if (!canDeriveInitiative(actor))
        throw new Error("Solo jefes, gerentes y el administrador principal pueden derivar proyectos");
      const responsable = await prisma.usuario.findUnique({ where: { id: responsableId }, select: { areaId: true } });
      if (!responsable || responsable.areaId !== current.areaId)
        throw new Error("El responsable seleccionado no pertenece al área del proyecto");
    }
    const row = await iniciativaService.transition(id, estado, responsableId);
    await audit(actor.id, "Cambiar estado", "Iniciativa", id, {
      estado: row.estado,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
};
const progresoSchema = z.object({
  porcentaje: z.number().int().min(0).max(100),
  comentario: z.string().min(3).max(500),
});
export const progresos = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = String(req.params.id),
      actor = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      item = await prisma.iniciativa.findUniqueOrThrow({ where: { id } });
    if (!canReadInitiative(actor, item))
      throw new Error("No tienes acceso a este proyecto");
    res.json(await iniciativaService.progresos(id));
  } catch (e) {
    next(e);
  }
};
export const addProgreso = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = String(req.params.id),
      data = progresoSchema.parse(req.body),
      actor = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      item = await prisma.iniciativa.findUniqueOrThrow({ where: { id } });
    if (!canManageInitiative(actor, item))
      throw new Error("No tienes permisos para registrar avances");
    const row = await iniciativaService.addProgreso(
      id,
      actor.id,
      data.porcentaje,
      data.comentario,
    );
    await audit(actor.id, "Registrar avance", "Iniciativa", id, {
      porcentaje: data.porcentaje,
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
};
const appearanceSchema = z.object({
  icono: z.string().trim().min(1).max(12),
  colorIcono: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export const appearance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = String(req.params.id),
      data = appearanceSchema.parse(req.body),
      actor = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      item = await prisma.iniciativa.findUniqueOrThrow({ where: { id } });
    if (!canManageInitiative(actor, item))
      throw new Error("No tienes permisos para personalizar este proyecto");
    const row = await iniciativaService.appearance(
      id,
      data.icono,
      data.colorIcono,
    );
    await audit(actor.id, "Personalizar", "Iniciativa", id, {
      icono: data.icono,
      color: data.colorIcono,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
};
const editSchema = z
  .object({
    titulo: z.string().min(3).max(180),
    descripcion: z.string().min(10).max(1000),
    clienteId: z.string().uuid().nullable(),
    software: z.string().trim().max(120).nullable(),
    areaId: z.string().uuid(),
    responsableId: z.string().uuid().nullable(),
    impacto: z.number().int().min(1).max(10),
    esfuerzo: z.nativeEnum(Esfuerzo),
    fechaInicio: z
      .string()
      .nullable()
      .transform((v) => (v ? new Date(v) : null)),
    fechaFin: z
      .string()
      .nullable()
      .transform((v) => (v ? new Date(v) : null)),
  })
  .partial();
export const update = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = await (
        await import("../config/db.js")
      ).prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! } }),
      row = await (
        await import("../config/db.js")
      ).prisma.iniciativa.findUniqueOrThrow({
        where: { id: String(req.params.id) },
      });
    // Misma capacidad que ya rige tareas, avances, estado y apariencia: creador,
    // responsable, jefatura del área, técnico, admin global o permiso
    // editarProyectos. Quien no entra aquí sigue el flujo de aprobación.
    if (!canManageInitiative(actor, row))
      throw new Error("No tienes permisos para editar este proyecto");
    const db = (await import("../config/db.js")).prisma;
    const input = editSchema.parse(req.body);
    // Los campos de jefatura solo cuentan si realmente CAMBIAN: el formulario
    // reenvía los valores actuales y eso no debe bloquear al resto de la edición.
    const areaChanged = input.areaId !== undefined && input.areaId !== row.areaId;
    const responsableChanged = input.responsableId !== undefined && input.responsableId !== row.responsableId;
    const scoreChanged =
      (input.impacto !== undefined && input.impacto !== row.impacto) ||
      (input.esfuerzo !== undefined && input.esfuerzo !== row.esfuerzo);
    if ((areaChanged || scoreChanged) && !canLeadInitiative(actor, row.areaId))
      throw new Error("Solo la jefatura del área de origen, el técnico o el administrador global pueden mover el proyecto de área o cambiar su impacto y esfuerzo");
    if (responsableChanged && !canDeriveInitiative(actor))
      throw new Error("Solo jefes, gerentes y el administrador principal pueden derivar proyectos");
    if (areaChanged) await db.area.findUniqueOrThrow({ where: { id: input.areaId! } });
    // Mantiene sincronizado el texto legacy "cliente" con el cliente elegido en
    // el selector, para no romper reportes/búsqueda/alertas que leen ese campo
    // directo de la base sin pasar por el servicio de iniciativas.
    const data: typeof input & { cliente?: string | null; score?: number } = { ...input };
    if (input.clienteId === null) data.cliente = null;
    else if (input.clienteId) {
      const cliente = await db.cliente.findUnique({
        where: { id: input.clienteId },
        select: { razonSocial: true },
      });
      if (!cliente) throw new Error("Cliente no encontrado.");
      data.cliente = cliente.razonSocial;
    }
    // El responsable debe pertenecer al área final del proyecto (la nueva si se
    // está cambiando de área en el mismo guardado, o la actual si no).
    if (input.responsableId && (responsableChanged || areaChanged)) {
      const targetAreaId = input.areaId ?? row.areaId;
      const responsable = await db.usuario.findUnique({ where: { id: input.responsableId }, select: { areaId: true } });
      if (!responsable || responsable.areaId !== targetAreaId)
        throw new Error("El responsable seleccionado no pertenece al área del proyecto");
    }
    // Al mover de área sin indicar un responsable nuevo, el actual (del área
    // anterior) queda como "Sin derivar" en vez de apuntar a alguien ajeno.
    if (areaChanged && input.responsableId === undefined && row.responsableId)
      data.responsableId = null;
    // El score no se guarda directo: depende de impacto/esfuerzo, así que se
    // recalcula si cualquiera de los dos cambió (igual que al crear).
    if (input.impacto !== undefined || input.esfuerzo !== undefined) {
      data.score = computeScore(input.impacto ?? row.impacto, input.esfuerzo ?? row.esfuerzo);
    }
    const finalStart = input.fechaInicio !== undefined ? input.fechaInicio : row.fechaInicio;
    const finalEnd = input.fechaFin !== undefined ? input.fechaFin : row.fechaFin;
    if (finalStart && finalEnd && finalEnd < finalStart)
      throw new Error("La fecha fin debe ser posterior al inicio");
    const updated = await db.iniciativa.update({
      where: { id: row.id },
      data,
      include: {
        area: true,
        objetivo: true,
        responsable: true,
        clienteRef: true,
        progresos: { orderBy: { createdAt: "desc" } },
      },
    });
    // Solo los campos cuyo valor realmente cambió: el formulario reenvía todo
    // (incluso lo que no se tocó), así que se compara contra el valor actual.
    const asComparable = (value: unknown) => (value instanceof Date ? value.getTime() : value ?? null);
    const camposCambiados = Object.entries(input)
      .filter(([campo, valor]) => asComparable(valor) !== asComparable((row as Record<string, unknown>)[campo]))
      .map(([campo]) => campo);
    await audit(actor.id, "Editar", "Iniciativa", row.id, {
      codigo: row.codigo,
      campos: camposCambiados,
      ...(areaChanged ? { areaAnterior: row.areaId, areaNueva: input.areaId } : {}),
      ...(responsableChanged ? { responsableAnterior: row.responsableId, responsableNuevo: input.responsableId } : {}),
    });
    res.json({ ...updated, cliente: updated.clienteRef?.razonSocial ?? updated.cliente });
  } catch (e) {
    next(e);
  }
};
export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const db = (await import("../config/db.js")).prisma,
      actor = await db.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      });
    const row = await db.iniciativa.findFirstOrThrow({where:{id:String(req.params.id),deletedAt:null}});
    if (!canDeleteInitiative(actor,row.creadorId,row.areaId)) throw new Error("Solo el creador, la jefatura de su área o el administrador global puede eliminar este proyecto.");
    if(requiresProjectDeleteApproval(actor)) throw new Error("Solicita la aprobación del gerente del área o del administrador global para eliminar este proyecto.");
    await db.iniciativa.update({ where: { id: String(req.params.id) }, data: { deletedAt: new Date(), deletedById: actor.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
