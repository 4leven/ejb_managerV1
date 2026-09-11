import { prisma } from "../config/db.js";
import { calcularProyeccion } from "./marketingMetrics.js";

const DEFAULT_META_MENSUAL = 80;
const DEFAULT_META_SEMANAL = 20;

function monthRange(anio: number, mes: number) {
  return { gte: new Date(anio, mes - 1, 1), lt: new Date(anio, mes, 1) };
}

export function splitMarketingSystems(value: string) {
  return value
    .split(/[,;|\n]+|(?=\bEJB\s+)/i)
    .map((item) => item.replace(/^[\s/]+|[\s/]+$/g, "").trim())
    .filter(Boolean);
}

export const marketingService = {
  async listProspectos(anio: number, mes: number) {
    return prisma.prospecto.findMany({
      where: { deletedAt: null, fechaContacto: monthRange(anio, mes) },
      include: { creadoPor: { select: { id: true, nombres: true, apellidos: true } } },
      orderBy: [{ fechaContacto: "asc" }, { createdAt: "asc" }],
    });
  },

  createProspecto(data: {
    fechaContacto: Date; nombreCliente: string; ruc?: string; empresa?: string;
    celular?: string; correo?: string; canal: string; sistemaEjb: string;
    notas?: string; creadoPorId?: string;
  }) {
    return prisma.prospecto.create({ data });
  },

  async updateProspecto(id: string, data: Partial<{
    fechaContacto: Date; nombreCliente: string; ruc?: string; empresa?: string;
    celular?: string; correo?: string; canal: string; sistemaEjb: string; notas?: string;
  }>) {
    return prisma.prospecto.update({ where: { id }, data });
  },

  removeProspecto(id: string) {
    return prisma.prospecto.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async getMeta(anio: number, mes: number) {
    const existing = await prisma.metaMarketing.findUnique({ where: { anio_mes: { anio, mes } } });
    if (existing) return existing;
    return ensureMonthMeta(anio, mes);
  },

  async setMeta(anio: number, mes: number, data: { metaMensual?: number; metaSemanal?: number }) {
    await this.getMeta(anio, mes);
    return prisma.metaMarketing.update({ where: { anio_mes: { anio, mes } }, data });
  },

  async resumen(anio: number, mes: number) {
    const [prospectos, meta] = await Promise.all([
      this.listProspectos(anio, mes),
      this.getMeta(anio, mes),
    ]);
    const proyeccion = calcularProyeccion({
      anio, mes,
      prospectosCaptados: prospectos.length,
      metaMensual: meta.metaMensual,
      metaSemanal: meta.metaSemanal,
    });
    const porCanal: Record<string, number> = {};
    const porSistema: Record<string, number> = {};
    let prospectosMultiproducto = 0;
    for (const p of prospectos) {
      porCanal[p.canal] = (porCanal[p.canal] ?? 0) + 1;
      const sistemas = splitMarketingSystems(p.sistemaEjb);
      if (sistemas.length >= 2) prospectosMultiproducto++;
      for (const sistema of sistemas) {
        porSistema[sistema] = (porSistema[sistema] ?? 0) + 1;
      }
    }
    return {
      proyeccion,
      porCanal,
      porSistema,
      multiproducto: {
        cantidad: prospectosMultiproducto,
        porcentaje: prospectos.length ? Math.round((prospectosMultiproducto / prospectos.length) * 100) : 0,
      },
    };
  },

  async mesesDisponibles() {
    const [primerProspecto, metas] = await Promise.all([
      prisma.prospecto.findFirst({ where: { deletedAt: null }, orderBy: { fechaContacto: "asc" }, select: { fechaContacto: true } }),
      prisma.metaMarketing.findMany({ select: { anio: true, mes: true } }),
    ]);
    const periodos = new Set<string>();
    const hoy = new Date();
    if (primerProspecto) {
      let cursor = new Date(primerProspecto.fechaContacto.getFullYear(), primerProspecto.fechaContacto.getMonth(), 1);
      const limite = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      while (cursor <= limite) {
        periodos.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    for (const m of metas) periodos.add(`${m.anio}-${m.mes}`);
    periodos.add(`${hoy.getFullYear()}-${hoy.getMonth() + 1}`);
    return Array.from(periodos)
      .map((key) => { const [anio, mes] = key.split("-").map(Number); return { anio, mes }; })
      .sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  },
};

export async function ensureMonthMeta(anio: number, mes: number) {
  const existing = await prisma.metaMarketing.findUnique({ where: { anio_mes: { anio, mes } } });
  if (existing) return existing;
  const previo = new Date(anio, mes - 2, 1);
  const anterior = await prisma.metaMarketing.findUnique({
    where: { anio_mes: { anio: previo.getFullYear(), mes: previo.getMonth() + 1 } },
  });
  try {
    return await prisma.metaMarketing.create({
      data: {
        anio, mes,
        metaMensual: anterior?.metaMensual ?? DEFAULT_META_MENSUAL,
        metaSemanal: anterior?.metaSemanal ?? DEFAULT_META_SEMANAL,
      },
    });
  } catch {
    // Otra request la creó al mismo tiempo: la leemos en vez de fallar.
    return prisma.metaMarketing.findUniqueOrThrow({ where: { anio_mes: { anio, mes } } });
  }
}
