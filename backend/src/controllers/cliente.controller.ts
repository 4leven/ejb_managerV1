import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { audit } from "../services/audit.js";
import { hasPermission } from "../services/permissions.js";

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q ?? "").trim();
    const rows = await prisma.cliente.findMany({
      where: q
        ? {
            OR: [
              { ruc: { contains: q } },
              { razonSocial: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { razonSocial: "asc" },
      take: 30,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

const createSchema = z.object({
  razonSocial: z.string().trim().min(2).max(180),
  ruc: z
    .string()
    .trim()
    .regex(/^\d{11}$/)
    .optional()
    .transform((v) => v || undefined),
  telefono: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || undefined),
  contacto: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((v) => v || undefined),
});

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.userId! },
    });
    if (!hasPermission(actor, "crearClientes"))
      throw new Error("No tienes permiso para registrar clientes nuevos.");
    const data = createSchema.parse(req.body);
    const conflict = await prisma.cliente.findFirst({
      where: { razonSocial: { equals: data.razonSocial, mode: "insensitive" } },
    });
    if (conflict)
      throw new Error(
        `Ya existe un cliente registrado como "${conflict.razonSocial}". Búscalo en el listado y selecciónalo.`,
      );
    const cliente = await prisma.cliente.create({ data });
    await audit(actor.id, "Crear", "Cliente", cliente.id, {
      razonSocial: cliente.razonSocial,
    });
    res.status(201).json(cliente);
  } catch (e) {
    next(e);
  }
}
