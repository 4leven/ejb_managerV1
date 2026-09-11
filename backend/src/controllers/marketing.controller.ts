import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { audit } from "../services/audit.js";
import { marketingService } from "../services/marketing.service.js";
import { createMarketingReportPdf } from "../services/marketingReport.js";
import { canManageMarketing, canReadMarketing } from "../services/permissions.js";

const periodoSchema = z.object({
  anio: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

const prospectoSchema = z.object({
  fechaContacto: z.coerce.date(),
  nombreCliente: z.string().trim().min(2).max(160),
  ruc: z.string().trim().max(20).optional().transform((v) => v || undefined),
  empresa: z.string().trim().max(160).optional().transform((v) => v || undefined),
  celular: z.string().trim().max(30).optional().transform((v) => v || undefined),
  correo: z.string().trim().max(160).optional().transform((v) => v || undefined),
  canal: z.string().trim().min(2).max(60),
  sistemaEjb: z.string().trim().min(2).max(400),
  notas: z.string().trim().max(2000).optional().transform((v) => v || undefined),
});

const importRowSchema = z.object({
  fechaContacto: z.coerce.date(),
  nombreCliente: z.string().trim().min(1).max(160),
  ruc: z.string().trim().max(20).optional().transform((v) => v || undefined),
  empresa: z.string().trim().max(160).optional().transform((v) => v || undefined),
  celular: z.string().trim().max(30).optional().transform((v) => v || undefined),
  correo: z.string().trim().max(160).optional().transform((v) => v || undefined),
  canal: z.string().trim().min(1).max(60),
  sistemaEjb: z.string().trim().min(1).max(400),
  notas: z.string().trim().max(2000).optional().transform((v) => v || undefined),
});

const metaSchema = z.object({
  metaMensual: z.number().int().min(0).max(100000).optional(),
  metaSemanal: z.number().int().min(0).max(100000).optional(),
});

async function loadActor(req: Request) {
  return prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! }, include: { area: true } });
}

export const listProspectos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canReadMarketing(actor)) throw new Error("No tienes acceso al módulo de Marketing");
    const { anio, mes } = periodoSchema.parse(req.query);
    res.json(await marketingService.listProspectos(anio, mes));
  } catch (e) { next(e); }
};

export const createProspecto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canManageMarketing(actor)) throw new Error("No tienes permisos para registrar prospectos");
    const input = prospectoSchema.parse(req.body);
    const row = await marketingService.createProspecto({ ...input, creadoPorId: actor.id });
    await audit(actor.id, "Crear", "Prospecto", row.id, { nombreCliente: row.nombreCliente });
    res.status(201).json(row);
  } catch (e) { next(e); }
};

export const updateProspecto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canManageMarketing(actor)) throw new Error("No tienes permisos para editar prospectos");
    const row = await marketingService.updateProspecto(String(req.params.id), prospectoSchema.partial().parse(req.body));
    await audit(actor.id, "Editar", "Prospecto", row.id, {});
    res.json(row);
  } catch (e) { next(e); }
};

export const removeProspecto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canManageMarketing(actor)) throw new Error("No tienes permisos para eliminar prospectos");
    const row = await marketingService.removeProspecto(String(req.params.id));
    await audit(actor.id, "Eliminar", "Prospecto", row.id, {});
    res.json({ ok: true });
  } catch (e) { next(e); }
};

export const importProspectos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canManageMarketing(actor)) throw new Error("No tienes permisos para importar prospectos");
    const rows = z.array(z.unknown()).min(1).max(500).parse(req.body.rows);
    const result = { created: 0, skipped: 0, errors: [] as { fila: number; message: string }[] };
    for (const [index, raw] of rows.entries()) {
      try {
        const input = importRowSchema.parse(raw);
        const duplicate = await prisma.prospecto.findFirst({
          where: {
            deletedAt: null,
            fechaContacto: input.fechaContacto,
            ...(input.ruc
              ? { ruc: input.ruc }
              : { nombreCliente: input.nombreCliente, celular: input.celular ?? null }),
          },
          select: { id: true },
        });
        if (duplicate) {
          result.skipped++;
          continue;
        }
        const row = await marketingService.createProspecto({ ...input, creadoPorId: actor.id });
        await audit(actor.id, "Importar", "Prospecto", row.id, { nombreCliente: row.nombreCliente });
        result.created++;
      } catch (error) {
        const message = error instanceof z.ZodError
          ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
          : error instanceof Error ? error.message : "Error desconocido";
        result.errors.push({ fila: index + 2, message });
      }
    }
    res.json(result);
  } catch (e) { next(e); }
};

export const resumen = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canReadMarketing(actor)) throw new Error("No tienes acceso al módulo de Marketing");
    const { anio, mes } = periodoSchema.parse(req.query);
    res.json(await marketingService.resumen(anio, mes));
  } catch (e) { next(e); }
};

export const meses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canReadMarketing(actor)) throw new Error("No tienes acceso al módulo de Marketing");
    res.json(await marketingService.mesesDisponibles());
  } catch (e) { next(e); }
};

export const getMeta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canReadMarketing(actor)) throw new Error("No tienes acceso al módulo de Marketing");
    const { anio, mes } = periodoSchema.parse(req.query);
    res.json(await marketingService.getMeta(anio, mes));
  } catch (e) { next(e); }
};

export const setMeta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canManageMarketing(actor)) throw new Error("No tienes permisos para editar la meta de marketing");
    const { anio, mes } = periodoSchema.parse(req.query);
    const row = await marketingService.setMeta(anio, mes, metaSchema.parse(req.body));
    await audit(actor.id, "Editar meta", "MetaMarketing", row.id, { anio, mes });
    res.json(row);
  } catch (e) { next(e); }
};

export const reporte = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = await loadActor(req);
    if (!canReadMarketing(actor)) throw new Error("No tienes acceso al módulo de Marketing");
    const { anio, mes } = periodoSchema.parse(req.query);
    const [prospectos, resumenMes] = await Promise.all([
      marketingService.listProspectos(anio, mes),
      marketingService.resumen(anio, mes),
    ]);
    const bytes = await createMarketingReportPdf({ anio, mes, prospectos, resumen: resumenMes, actor });
    const filename = `reporte-prospectos-${anio}-${String(mes).padStart(2, "0")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(bytes));
  } catch (e) { next(e); }
};
