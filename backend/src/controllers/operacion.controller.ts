import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { isTechnical, isAdministration, canDeleteOwned, isAreaLeader } from "../services/permissions.js";

const estados = [
  "Solicitado",
  "Pendiente",
  "En revisión",
  "En curso",
  "Aprobado",
  "Entregado",
  "Desaprobado",
  "Rechazado",
] as const;
const reqSchema = z.object({
  titulo: z.string().min(2).max(180),
  descripcion: z.string().max(800).optional(),
  cantidad: z.number().int().min(1).max(9999),
  prioridad: z.enum(["Baja", "Normal", "Alta", "Urgente"]),
  estado: z.enum(estados),
  fechaNecesaria: z.string().optional(),
});
const include = {
  area: true,
  usuario: { select: { id: true, nombres: true, apellidos: true } },
} as const;

const permissionFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSeDPVkBSwxJw28elU-oZsyuq1_O-UuUYSJ8P085onZeWEFuNg/viewform";

export async function permissions(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! } });
    const canSeeAll = actor.isSuperAdmin || isTechnical(actor) || isAdministration(actor);
    res.json(await prisma.registroPortal.findMany({
      where: { tipo: "permiso", ...(canSeeAll ? {} : { creadorId: actor.id }) },
      include: { creador: { select: { id: true, nombres: true, apellidos: true, fotoPerfil: true, area: true } } },
      orderBy: { createdAt: "desc" },
    }));
  } catch (e) { next(e); }
}

export async function createPermission(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = { estado: "Formulario enviado", formularioUrl: permissionFormUrl, confirmadoAt: new Date().toISOString() };
    res.status(201).json(await prisma.registroPortal.create({
      data: { tipo: "permiso", datos: datos as any, creadorId: req.userId! },
      include: { creador: { select: { id: true, nombres: true, apellidos: true, fotoPerfil: true, area: true } } },
    }));
  } catch (e) { next(e); }
}

export async function requirements(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const u = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.userId! },
      include: { area: true },
    });
    const canManage = u.isSuperAdmin || isTechnical(u) || isAdministration(u);
    res.json(
      await prisma.requerimiento.findMany({
        where: {
          deletedAt: null,
          ...(canManage ? {} : { areaId: u.areaId }),
        },
        include,
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (e) {
    next(e);
  }
}
export async function createRequirement(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const d = reqSchema.parse(req.body),
      u = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      });
    res
      .status(201)
      .json(
        await prisma.requerimiento.create({
          data: {
            ...d,
            fechaNecesaria: d.fechaNecesaria
              ? new Date(d.fechaNecesaria)
              : undefined,
            areaId: u.areaId,
            usuarioId: u.id,
          },
          include,
        }),
      );
  } catch (e) {
    next(e);
  }
}

export async function updateRequirement(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const d = reqSchema.partial().parse(req.body),
      u = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
        include: { area: true },
      }),
      row = await prisma.requerimiento.findUniqueOrThrow({
        where: { id: String(req.params.id) },
      });
    const owner = row.usuarioId === u.id,
      administration = isAdministration(u);
    if (!u.isSuperAdmin && !isTechnical(u) && !owner && !administration && !(isAreaLeader(u)&&u.areaId===row.areaId))
      throw new Error("No tienes permiso para editar este requerimiento");
    const data =
      !u.isSuperAdmin && !isTechnical(u) && !owner && !administration
        ? { estado: d.estado }
        : {
            ...d,
            fechaNecesaria: d.fechaNecesaria
              ? new Date(d.fechaNecesaria)
              : undefined,
          };
    res.json(
      await prisma.requerimiento.update({
        where: { id: row.id },
        data,
        include,
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function deleteRequirement(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const u = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      }),
      row = await prisma.requerimiento.findUniqueOrThrow({
        where: { id: String(req.params.id) },
      });
    if (!canDeleteOwned(u,row.usuarioId,row.areaId))
      throw new Error("Solo el solicitante puede eliminar este requerimiento");
    await prisma.requerimiento.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function flows(req: Request, res: Response, next: NextFunction) {
  try {
    const u = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.userId! },
    });
    res.json(
      await prisma.flujoArea.findMany({
        where: {
          deletedAt: null,
          ...(u.isSuperAdmin || isTechnical(u) ? {} : { areaId: u.areaId }),
        },
        include: {
          area: true,
          usuario: { select: { nombres: true, apellidos: true } },
          versiones: {
            select: {
              id: true,
              version: true,
              archivoNombre: true,
              createdAt: true,
            },
            orderBy: { version: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (e) {
    next(e);
  }
}
export async function createFlow(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const d = z
        .object({
          titulo: z.string().min(3),
          descripcion: z.string().max(500).optional(),
          archivoNombre: z.string().max(255),
          archivoData: z
            .string()
            .startsWith("data:application/pdf;base64,")
            .max(4500000),
        })
        .parse(req.body),
      u = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      });
    const row = await prisma.flujoArea.create({
      data: {
        ...d,
        areaId: u.areaId,
        usuarioId: u.id,
        versiones: {
          create: {
            version: 1,
            archivoNombre: d.archivoNombre,
            archivoData: d.archivoData,
            usuarioId: u.id,
          },
        },
      },
      include: {
        area: true,
        usuario: { select: { nombres: true, apellidos: true } },
        versiones: true,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
}
export async function addFlowVersion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = z
        .object({
          archivoNombre: z.string().max(255),
          archivoData: z
            .string()
            .startsWith("data:application/pdf;base64,")
            .max(4500000),
        })
        .parse(req.body),
      flow = await prisma.flujoArea.findUniqueOrThrow({
        where: { id: String(req.params.id) },
        include: { versiones: { orderBy: { version: "desc" }, take: 1 } },
      }),
      user = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      });
    if (!user.isSuperAdmin && !isTechnical(user) && flow.areaId !== user.areaId)
      throw new Error("No tienes acceso a este documento");
    const version = (flow.versiones[0]?.version ?? 0) + 1;
    await prisma.$transaction([
      prisma.documentoVersion.create({
        data: {
          flujoId: flow.id,
          version,
          archivoNombre: input.archivoNombre,
          archivoData: input.archivoData,
          usuarioId: user.id,
        },
      }),
      prisma.flujoArea.update({
        where: { id: flow.id },
        data: {
          archivoNombre: input.archivoNombre,
          archivoData: input.archivoData,
        },
      }),
    ]);
    res.json({ ok: true, version });
  } catch (e) {
    next(e);
  }
}
export async function deleteFlow(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const row = await prisma.flujoArea.findUniqueOrThrow({
        where: { id: String(req.params.id) },
      }),
      user = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.userId! },
      });
    if (!canDeleteOwned(user,row.usuarioId,row.areaId))
      throw new Error(
        "No tienes permiso para enviar este documento a la papelera",
      );
    await prisma.flujoArea.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
