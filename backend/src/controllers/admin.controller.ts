import { NextFunction, Request, Response } from "express";
import { Cargo, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { isManagement, canSeePage } from "../services/permissions.js";
import { audit } from "../services/audit.js";
async function manager(id: string) {
  const actor = await prisma.usuario.findUniqueOrThrow({ where: { id } });
  if (!isManagement(actor) || !canSeePage(actor, "verAdministracion"))
    throw new Error(
      "Solo administración o gerencia puede realizar esta acción",
    );
  return actor;
}
export async function updatePermissions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = await manager(req.userId!),
      id = String(req.params.id),
      data = z.record(z.boolean()).parse(req.body);
    if (!actor.isSuperAdmin)
      throw new Error("Solo el administrador global puede cambiar permisos");
    const row = await prisma.usuario.update({
      where: { id },
      data: { permisos: data },
      select: { id: true, nombres: true, apellidos: true, permisos: true },
    });
    await audit(actor.id, "Cambiar permisos", "Usuario", id, {
      permisos: data,
    });
    res.json(row);
  } catch (e) {
    next(e);
  }
}
export async function completeOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await prisma.usuario.update({
      where: { id: req.userId! },
      data: { onboardingCompleted: true },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
export async function trash(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await manager(req.userId!),
      area = actor.isSuperAdmin ? {} : { areaId: actor.areaId };
    const [p, t, e, f, r, o] = await Promise.all([
      prisma.iniciativa.findMany({
        where: { ...area, deletedAt: { not: null } },
        select: { id: true, titulo: true, codigo: true, deletedAt: true },
      }),
      prisma.tareaIniciativa.findMany({
        where: { deletedAt: { not: null }, iniciativa: area },
        select: { id: true, titulo: true, deletedAt: true },
      }),
      prisma.evento.findMany({
        where: { ...area, deletedAt: { not: null } },
        select: { id: true, titulo: true, deletedAt: true },
      }),
      prisma.flujoArea.findMany({
        where: { ...area, deletedAt: { not: null } },
        select: { id: true, titulo: true, deletedAt: true },
      }),
      prisma.requerimiento.findMany({
        where: { ...area, deletedAt: { not: null } },
        select: { id: true, titulo: true, deletedAt: true },
      }),
      actor.isSuperAdmin
        ? prisma.objetivoNegocio.findMany({
            where: { deletedAt: { not: null } },
            select: { id: true, nombre: true, deletedAt: true },
          })
        : Promise.resolve([]),
    ]);
    res.json([
      ...p.map((x) => ({ ...x, type: "proyecto" })),
      ...t.map((x) => ({ ...x, type: "tarea" })),
      ...e.map((x) => ({ ...x, type: "evento" })),
      ...f.map((x) => ({ ...x, type: "documento" })),
      ...r.map((x) => ({ ...x, type: "requerimiento" })),
      ...o.map((x) => ({ ...x, titulo: x.nombre, type: "objetivo" })),
    ]);
  } catch (e) {
    next(e);
  }
}
export async function restoreTrash(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = await manager(req.userId!),
      type = z
        .enum([
          "proyecto",
          "objetivo",
          "tarea",
          "evento",
          "documento",
          "requerimiento",
        ])
        .parse(req.body.type),
      id = String(req.params.id),
      models: any = {
        proyecto: prisma.iniciativa,
        objetivo: prisma.objetivoNegocio,
        tarea: prisma.tareaIniciativa,
        evento: prisma.evento,
        documento: prisma.flujoArea,
        requerimiento: prisma.requerimiento,
      };
    await models[type].update({ where: { id }, data: { deletedAt: null } });
    await audit(actor.id, "Restaurar", "Papelera", id, { type });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
export async function purgeTrash(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = await manager(req.userId!);
    if (!actor.isSuperAdmin)
      throw new Error(
        "Solo el administrador global puede eliminar definitivamente",
      );
    const type = z
        .enum([
          "proyecto",
          "objetivo",
          "tarea",
          "evento",
          "documento",
          "requerimiento",
        ])
        .parse(req.body.type),
      id = String(req.params.id),
      models: any = {
        proyecto: prisma.iniciativa,
        objetivo: prisma.objetivoNegocio,
        tarea: prisma.tareaIniciativa,
        evento: prisma.evento,
        documento: prisma.flujoArea,
        requerimiento: prisma.requerimiento,
      };
    const row=await models[type].findUniqueOrThrow({where:{id}});
    if(!row.deletedAt)throw new Error("Solo se pueden purgar registros que ya estén en la papelera.");
    await models[type].delete({ where: { id } });
    await audit(actor.id, "Eliminar definitivamente", "Papelera", id, { type });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
const rowSchema = z.object({
  tipo: z.enum(["proyecto", "usuario", "tarea"]),
  titulo: z.string().min(2).optional(),
  email: z.string().email().optional(),
  nombres: z.string().optional(),
  apellidos: z.string().optional(),
  areaId: z.string().uuid(),
  iniciativaId: z.string().uuid().optional(),
  descripcion: z.string().optional(),
  cliente: z.string().optional(),
});
export async function bulkImport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = await manager(req.userId!),
      rows = z.array(rowSchema).min(1).max(500).parse(req.body.rows),
      result = { created: 0, errors: [] as any[] };
    for (const [index, row] of rows.entries()) {
      try {
        if (row.tipo === "usuario") {
          if (!row.email) throw new Error("Falta email");
          await prisma.usuario.create({
            data: {
              nombres: row.nombres || "Nuevo",
              apellidos: row.apellidos || "Usuario",
              email: row.email.toLowerCase(),
              passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
              areaId: row.areaId,
              cargo: Cargo.Trabajador,
              rol: Rol.Usuario,
            },
          });
        } else if (row.tipo === "tarea") {
          if (!row.iniciativaId || !row.titulo)
            throw new Error("Falta iniciativaId o título");
          await prisma.tareaIniciativa.create({
            data: { iniciativaId: row.iniciativaId, titulo: row.titulo },
          });
        } else {
          if (!row.titulo) throw new Error("Falta título");
          const count = await prisma.iniciativa.count();
          await prisma.iniciativa.create({
            data: {
              codigo: `IMP-${String(count + 1).padStart(4, "0")}`,
              creadorId:actor.id,
              titulo: row.titulo,
              descripcion: row.descripcion || "Importado desde Excel",
              cliente: row.cliente,
              areaId: row.areaId,
              impacto: 5,
              esfuerzo: "Medio",
              score: 5,
            },
          });
        }
        result.created++;
      } catch (error) {
        result.errors.push({
          fila: index + 2,
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }
    await audit(actor.id, "Importación masiva", "Sistema", actor.id, {
      created: result.created,
      errors: result.errors.length,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}
