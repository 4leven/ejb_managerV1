import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { isTechnical, isAdministration, canDeleteOwned, isAreaLeader } from "../services/permissions.js";

const eventFields = z.object({
    titulo: z.string().min(3).max(180),
    descripcion: z.string().max(800).optional(),
    inicio: z.string().datetime(),
    fin: z.string().datetime(),
    icono: z.string().min(1).max(12),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    prioridad: z.enum(["Baja", "Normal", "Alta", "Urgente"]),
    estado: z.enum(["Programado", "En curso", "Completado", "Cancelado"]),
    areaId: z.string().uuid(),
    asignadoId: z.string().uuid().optional(),
    iniciativaId: z.string().uuid().optional(),
    software: z.string().max(120).optional(),
    plataforma: z.enum(["Zoom 1", "Zoom 2"]).optional(),
    empresa: z.string().max(160).optional(),
    sala: z
      .enum([
        "Piso 11 - Sala 1",
        "Piso 11 - Sala 2",
        "Piso 13 - Sala 1",
        "Piso 14 - Sala 1",
        "Piso 14 - Sala 2",
      ])
      .optional(),
    comentarios: z.string().max(800).optional(),
  });
const schema = eventFields.refine((value) => new Date(value.fin) > new Date(value.inicio), {
    message: "La fecha final debe ser posterior al inicio",
  });

const include = {
  area: true,
  creador: { select: { id: true, nombres: true, apellidos: true } },
  asignado: { select: { id: true, nombres: true, apellidos: true } },
  iniciativa: { select: { id: true, codigo: true, titulo: true } },
} as const;

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const actor=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}});
    res.json(
      (await prisma.evento.findMany({
        where: { deletedAt: null },
        include,
        orderBy: { inicio: "asc" },
      })).map(row=>({...row,canDelete:canDeleteOwned(actor,row.creadorId,row.areaId),canEdit:row.creadorId===actor.id||actor.isSuperAdmin||isTechnical(actor)||isAdministration(actor)||(isAreaLeader(actor)&&actor.areaId===row.areaId)})),
    );
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = schema.parse(req.body);
    const actor = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.userId! },
    });
    if (!actor.isSuperAdmin && !isTechnical(actor) && !isAdministration(actor) && data.areaId !== actor.areaId)
      throw new Error("Solo puedes crear eventos para tu área");
    res.status(201).json(
      await prisma.evento.create({
        data: {
          ...data,
          inicio: new Date(data.inicio),
          fin: new Date(data.fin),
          creadorId: actor.id,
        },
        include,
      }),
    );
  } catch (error) {
    next(error);
  }
}

const updateSchema = eventFields.omit({ areaId: true }).partial();

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const [row, actor] = await Promise.all([
      prisma.evento.findUniqueOrThrow({ where: { id } }),
      prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! } }),
    ]);
    if (row.creadorId !== actor.id && !actor.isSuperAdmin && !isTechnical(actor) && !isAdministration(actor) && !(isAreaLeader(actor)&&actor.areaId===row.areaId))
      throw new Error("No tienes permisos para editar este evento");
    const data = updateSchema.parse(req.body);
    res.json(
      await prisma.evento.update({
        where: { id },
        data: {
          ...data,
          inicio: data.inicio ? new Date(data.inicio) : undefined,
          fin: data.fin ? new Date(data.fin) : undefined,
        },
        include,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const [row, actor] = await Promise.all([
      prisma.evento.findUniqueOrThrow({ where: { id } }),
      prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! } }),
    ]);
    if (!canDeleteOwned(actor,row.creadorId,row.areaId))
      throw new Error("No tienes permisos para eliminar este evento");
    await prisma.evento.update({ where: { id },data:{deletedAt:new Date()} });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
