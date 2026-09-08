import { attachmentSchema } from "./chat-space.controller.js";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { isManagement, canPublishAnnouncements, isAdministration } from "../services/permissions.js";
import { audit } from "../services/audit.js";
async function actor(id: string) {
  return prisma.usuario.findUniqueOrThrow({ where: { id } });
}
const types = z.enum([
  "regla_aprobacion",
  "integracion",
  "feedback_usuario",
  "adopcion",
  "comunicado",
]);
const announcementSchema = z.object({titulo:z.string().trim().min(1).max(180),mensaje:z.string().trim().max(4000),formato:z.enum(["texto","markdown"]).default("texto"),prioridad:z.enum(["Informativo","Importante","Urgente"]),adjuntos:z.array(attachmentSchema).max(1).optional()}).refine(data=>Boolean(data.mensaje||data.adjuntos?.length),{message:"Escribe un mensaje o adjunta una imagen o archivo."});
const approvalRuleSchema = z.object({
  nombre: z.string().trim().min(3).max(120),
  entidad: z.enum(["Proyectos", "Objetivos", "Documentos", "Requerimientos"]),
  area: z.string().trim().min(1).max(100).default("Todas"),
  etapas: z
    .array(z.enum(["Jefe", "Gerente", "Administración"]))
    .min(1)
    .max(3),
  activa: z.boolean().default(true),
});
export async function listProductRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await actor(req.userId!),
      type = types.parse(req.params.type);
    if (
      ["regla_aprobacion", "integracion", "adopcion"].includes(type) &&
      !isManagement(user)
    )
      throw new Error("No tienes permisos para consultar este módulo");
    const where: any = { tipo: type };
    if (type === "feedback_usuario" && !isManagement(user))
      where.creadorId = user.id;
    res.json(
      await prisma.registroPortal.findMany({
        where,
        include: {
          creador: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              fotoPerfil: true,
              area: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: type === "adopcion" ? 1000 : 200,
      }),
    );
  } catch (e) {
    next(e);
  }
}
export async function saveProductRecord(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await actor(req.userId!),
      type = types.parse(req.params.type),
      data = z.record(z.unknown()).parse(req.body);
    if (
      ["regla_aprobacion", "integracion"].includes(type) &&
      !isManagement(user)
    )
      throw new Error("No tienes permisos para configurar este módulo");
    if(type==="comunicado"&&!canPublishAnnouncements(user))throw new Error("Solo Administración, Jefe o Gerente pueden enviar comunicados.");
    const normalized =
        type === "regla_aprobacion" ? approvalRuleSchema.parse(data) : type === "comunicado" ? announcementSchema.parse(data) : data,
      provider = String(data.proveedor ?? ""),
      safe =
        type === "integracion"
          ? {
              proveedor: provider,
              habilitada: Boolean(data.habilitada),
              cuenta: String(data.cuenta ?? ""),
              credentialConfigured: Boolean(
                process.env[
                  `${provider.toUpperCase().replaceAll(" ", "_")}_CLIENT_ID`
                ],
              ),
            }
          : normalized,
      row = await prisma.registroPortal.create({
        data: { tipo: type, datos: safe as any, creadorId: user.id },
        include: {
          creador: {
            select: { id: true, nombres: true, apellidos: true, area: true },
          },
        },
      });
    await audit(user.id, "Crear", type, row.id, { tipo: type });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
}
export async function updateProductRecord(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await actor(req.userId!),
      row = await prisma.registroPortal.findUniqueOrThrow({
        where: { id: String(req.params.id) },
      });
    types.parse(row.tipo);
    if(row.tipo==="comunicado"&&!canPublishAnnouncements(user))throw new Error("No tienes permisos para editar comunicados.");
    if (!isManagement(user) && !(row.tipo==="comunicado"&&isAdministration(user)) && row.creadorId !== user.id)
      throw new Error("No tienes permisos para editar este registro");
    const raw = z.record(z.unknown()).parse(req.body),
      data =
        row.tipo === "regla_aprobacion" ? approvalRuleSchema.parse(raw) : row.tipo === "comunicado" ? announcementSchema.parse(raw) : raw,
      updated = await prisma.registroPortal.update({
        where: { id: row.id },
        data: { datos: data as any },
      });
    await audit(user.id, "Editar", row.tipo, row.id, {});
    res.json(updated);
  } catch (e) {
    next(e);
  }
}
export async function adoptionSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await actor(req.userId!);
    if (!isManagement(user))
      throw new Error("Solo gerencia puede consultar adopción");
    const since = new Date(Date.now() - 30 * 86400000),
      rows = await prisma.registroPortal.findMany({
        where: { tipo: "adopcion", createdAt: { gte: since } },
        include: {
          creador: {
            select: { id: true, nombres: true, apellidos: true, area: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      byModule: Record<string, number> = {},
      users = new Set<string>();
    for (const row of rows) {
      const data = row.datos as any;
      byModule[data.modulo] = (byModule[data.modulo] ?? 0) + 1;
      users.add(row.creadorId);
    }
    res.json({
      events: rows.length,
      activeUsers: users.size,
      byModule,
      recent: rows.slice(0, 30),
    });
  } catch (e) {
    next(e);
  }
}
