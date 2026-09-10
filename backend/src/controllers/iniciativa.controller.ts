import { Request, Response, NextFunction } from "express";
import { Esfuerzo, Estado } from "@prisma/client";
import { z } from "zod";
import { iniciativaService } from "../services/iniciativa.service.js";
import { prisma } from "../config/db.js";
import { audit } from "../services/audit.js";
import {
  canManageInitiative, canDeleteOwned, requiresProjectDeleteApproval, isAreaLeader,
  canReadInitiative,
  canManageArea,
  hasPermission,
  isTechnical,
} from "../services/permissions.js";
const createSchema = z
  .object({
    titulo: z.string().min(3),
    descripcion: z.string().min(10),
    cliente: z
      .string()
      .trim()
      .max(160)
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
    if (!hasPermission(actor,"crearProyectos") && actor.areaId !== input.areaId && !canManageArea(actor, input.areaId))
      throw new Error("Solo puedes registrar proyectos para tu área");
    if (input.responsableId) {
      if (!actor.isSuperAdmin && !isAreaLeader(actor))
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
    const row = await iniciativaService.transition(
      id,
      z.nativeEnum(Estado).parse(req.body.estado),
      req.body.responsableId,
    );
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
    cliente: z.string().trim().max(160).nullable(),
    areaId: z.string().uuid(),
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
    if (
      !actor.isSuperAdmin &&
      !isTechnical(actor) &&
      (!isAreaLeader(actor) || actor.areaId !== row.areaId)
    )
      throw new Error("Solo el jefe del área puede editar esta iniciativa");
    res.json(
      await (
        await import("../config/db.js")
      ).prisma.iniciativa.update({
        where: { id: row.id },
        data: editSchema.parse(req.body),
        include: {
          area: true,
          objetivo: true,
          responsable: true,
          progresos: { orderBy: { createdAt: "desc" } },
        },
      }),
    );
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
    if (!canDeleteOwned(actor,row.creadorId,row.areaId)) throw new Error("Solo el creador, la jefatura de su área o el administrador global puede eliminar este proyecto.");
    if(requiresProjectDeleteApproval(actor)) throw new Error("Solicita la aprobación del gerente del área o del administrador global para eliminar este proyecto.");
    await db.iniciativa.update({ where: { id: String(req.params.id) }, data: { deletedAt: new Date(), deletedById: actor.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
