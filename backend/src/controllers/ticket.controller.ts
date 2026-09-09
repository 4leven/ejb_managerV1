import type { NextFunction, Request, Response } from "express";
import { CanalTicket, EstadoTicket, Prisma, PrioridadTicket } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { TICKET_CHANNELS, TICKET_MODULES, TICKET_PRIORITIES } from "../constants/ticket.js";
import {
  attemptAtomicTicketClaim,
  canRegisterTickets,
  canTakeTickets,
  canViewTickets,
  isTicketBoss,
} from "../services/ticketing.js";

const uuid = z.string().uuid();
const person = {
  select: {
    id: true,
    nombres: true,
    apellidos: true,
    fotoPerfil: true,
    estadoMensaje: true,
  },
};
const listInclude = {
  cliente: true,
  creadoPor: person,
  asignadoA: person,
  finalizadoPor: person,
};
const detailInclude = {
  ...listInclude,
  historial: {
    include: { usuario: person },
    orderBy: { createdAt: "asc" as const },
  },
};
const ticketScope: Prisma.TicketWhereInput = {
  modulo: { in: [...TICKET_MODULES] },
};

const createSchema = z.object({
  clienteId: uuid.optional(),
  ruc:z.string().trim().regex(/^\d{11}$/, "El RUC debe tener 11 dígitos.").optional(),
  razonSocial:z.string().trim().min(2).max(180).optional(),
  telefono:z.string().trim().max(30).optional(),
  observaciones:z.string().trim().max(3000).optional(),
  modulo: z.enum(TICKET_MODULES),
  contacto: z.string().trim().min(2).max(150),
  consulta: z.string().trim().min(5).max(3000),
  prioridad: z.nativeEnum(PrioridadTicket),
  canal: z.nativeEnum(CanalTicket),
});

const fail = (status: number, message: string) =>
  Object.assign(new Error(message), { status });
const ticketNumber = (correlative: number) =>
  `TCK-${String(correlative).padStart(6, "0")}`;
const present = <T extends { correlativo: number; cliente?: { ruc?: string | null; razonSocial?: string; telefono?: string | null } }>(ticket: T) => ({
  ...ticket,
  numeroTicket: ticketNumber(ticket.correlativo),
  ruc: (ticket as any).ruc ?? ticket.cliente?.ruc,
  razonSocial: (ticket as any).razonSocial ?? ticket.cliente?.razonSocial,
  telefono: "telefono" in ticket ? (ticket as any).telefono : ticket.cliente?.telefono,
});
const actor = (id: string) =>
  prisma.usuario.findUniqueOrThrow({ where: { id }, include: { area: true } });

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canViewTickets(currentUser)) throw fail(403, "No tienes permiso para ver la Ticketera");
    const q = String(req.query.q ?? "").trim();
    const estado = req.query.estado
      ? z.nativeEnum(EstadoTicket).parse(req.query.estado)
      : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const priority = req.query.prioridad
      ? z.nativeEnum(PrioridadTicket).parse(req.query.prioridad)
      : undefined;
    const channel = req.query.canal
      ? z.nativeEnum(CanalTicket).parse(req.query.canal)
      : undefined;
    const dateFrom = req.query.desde ? new Date(String(req.query.desde)) : undefined;
    const dateTo = req.query.hasta ? new Date(String(req.query.hasta)) : undefined;
    if (dateTo && !Number.isNaN(dateTo.getTime())) dateTo.setHours(23, 59, 59, 999);
    const correlative = /^TCK-(\d+)$/i.exec(q)?.[1];
    const where: Prisma.TicketWhereInput = {
      ...ticketScope,
      ...(estado && { estado }),
      ...(req.query.clienteId && { clienteId: uuid.parse(req.query.clienteId) }),
      ...(req.query.mine === "true"
        ? { asignadoAId: currentUser.id }
        : req.query.asignadoAId
          ? { asignadoAId: uuid.parse(req.query.asignadoAId) }
          : {}),
      ...(req.query.modulo && { modulo: z.enum(TICKET_MODULES).parse(req.query.modulo) }),
      ...(priority && { prioridad: priority }),
      ...(channel && { canal: channel }),
      ...((dateFrom || dateTo) && {
        registradoAt: {
          ...(dateFrom && !Number.isNaN(dateFrom.getTime()) && { gte: dateFrom }),
          ...(dateTo && !Number.isNaN(dateTo.getTime()) && { lte: dateTo }),
        },
      }),
      ...(q && {
        OR: [
          ...(correlative ? [{ correlativo: Number(correlative) }] : []),
          { ruc: { contains: q } },
          { razonSocial: { contains: q, mode: "insensitive" as const } },
          { contacto: { contains: q, mode: "insensitive" as const } },
          { telefono: { contains: q } },
          { consulta: { contains: q, mode: "insensitive" as const } },
        ],
      }),
    };
    const sort = String(req.query.orden ?? "operativo");
    const orderBy: Prisma.TicketOrderByWithRelationInput[] =
      sort === "fecha_desc" ? [{ registradoAt: "desc" }]
      : sort === "fecha_asc" ? [{ registradoAt: "asc" }]
      : sort === "estado" ? [{ estado: "asc" }, { registradoAt: "asc" }]
      : sort === "prioridad" ? [{ prioridad: "desc" }, { registradoAt: "asc" }]
      : sort === "asesor" ? [{ asignadoA: { nombres: "asc" } }, { registradoAt: "desc" }]
      : sort === "tiempo" ? [{ registradoAt: "asc" }]
      : [{ estado: "asc" }, { registradoAt: "asc" }];
    const [rows, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: listInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);
    res.json({ rows: rows.map(present), total, page, limit });
  } catch (error) {
    next(error);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canViewTickets(currentUser)) throw fail(403, "No tienes permiso para ver este caso");
    const row = await prisma.ticket.findUniqueOrThrow({
      where: { id: uuid.parse(req.params.id) },
      include: detailInclude,
    });
    if (!TICKET_MODULES.includes(row.modulo as (typeof TICKET_MODULES)[number]))
      throw fail(404, "El caso no pertenece a Consultoría Contable ni Consultoría Planilla");
    res.json(present(row));
  } catch (error) {
    next(error);
  }
}

export async function catalogs(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canViewTickets(currentUser)) throw fail(403, "No tienes permiso");
    res.json({
      modules: TICKET_MODULES,
      channels: TICKET_CHANNELS,
      priorities: TICKET_PRIORITIES,
    });
  } catch (error) {
    next(error);
  }
}

export async function clients(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canViewTickets(currentUser)) throw fail(403, "No tienes permiso");
    const q = String(req.query.q ?? "").trim();
    res.json(
      await prisma.cliente.findMany({
        where: q
          ? {
              OR: [
                { ruc: { contains: q } },
                { razonSocial: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        orderBy: { razonSocial: "asc" },
        take: 40,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function consultants(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canViewTickets(currentUser)) throw fail(403, "No tienes permiso");
    res.json(
      await prisma.usuario.findMany({
        where: {
          OR: [
            { area: { nombre: { contains: "Contable", mode: "insensitive" } } },
            { area: { nombre: { contains: "Planilla", mode: "insensitive" } } },
          ],
        },
        orderBy: [{ nombres: "asc" }, { apellidos: "asc" }],
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          fotoPerfil: true,
          estadoMensaje: true,
          cargo: true,
          _count: { select: { ticketsAsignados: { where: { estado: "EN_CURSO" } } } },
        },
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canViewTickets(currentUser)) throw fail(403, "No tienes permiso");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [total, pending, progress, finalized, finishedToday, mine, expired, closed] = await Promise.all([
      prisma.ticket.count({ where: ticketScope }),
      prisma.ticket.count({ where: { ...ticketScope, estado: "PENDIENTE" } }),
      prisma.ticket.count({ where: { ...ticketScope, estado: "EN_CURSO" } }),
      prisma.ticket.count({ where: { ...ticketScope, estado: "FINALIZADO" } }),
      prisma.ticket.count({ where: { ...ticketScope, estado: "FINALIZADO", finalizadoAt: { gte: today } } }),
      prisma.ticket.count({ where: { ...ticketScope, estado: "EN_CURSO", asignadoAId: currentUser.id } }),
      prisma.ticket.count({
        where: { ...ticketScope, estado: { not: "FINALIZADO" }, slaVenceAt: { lt: new Date() } },
      }),
      prisma.ticket.findMany({
        where: { ...ticketScope, estado: "FINALIZADO", finalizadoAt: { not: null } },
        select: { registradoAt: true, finalizadoAt: true },
        orderBy: { finalizadoAt: "desc" },
        take: 500,
      }),
    ]);
    const averageMinutes = closed.length
      ? Math.round(
          closed.reduce(
            (total, item) => total + (item.finalizadoAt!.getTime() - item.registradoAt.getTime()),
            0,
          ) / closed.length / 60000,
        )
      : null;
    res.json({ total, pending, progress, finalized, finishedToday, mine, expired, averageMinutes });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canRegisterTickets(currentUser))
      throw fail(403, "No tienes permiso para registrar casos");
    const data = createSchema.parse(req.body);
    const row = await prisma.$transaction(async (tx) => {
      const selected = data.clienteId ? await tx.cliente.findUnique({where:{id:data.clienteId}}) : null;
      if(data.clienteId&&!selected)throw fail(404,"Cliente no encontrado.");
      const ruc=data.ruc??selected?.ruc, razonSocial=data.razonSocial??selected?.razonSocial;
      if(!ruc||!/^\d{11}$/.test(ruc)||!razonSocial)throw fail(400,"Completa el RUC de 11 dígitos y la razón social.");
      const client = selected?.ruc===ruc ? selected : await tx.cliente.upsert({where:{ruc},create:{ruc,razonSocial,telefono:data.telefono||null,contacto:data.contacto},update:{}});
      const phone=data.telefono!==undefined?data.telefono:client.telefono;
      const ticket = await tx.ticket.create({
        data: {
          clienteId: client.id,
          ruc,
          razonSocial,
          modulo: data.modulo,
          telefono: phone||null,
          observaciones:data.observaciones||null,
          contacto: data.contacto,
          consulta: data.consulta,
          prioridad: data.prioridad,
          canal: data.canal,
          creadoPorId: currentUser.id,
        },
      });
      await tx.ticketHistorial.create({
        data: {
          ticketId: ticket.id,
          accion: "Ticket registrado",
          estadoNuevo: "PENDIENTE",
          usuarioId: currentUser.id,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: detailInclude });
    });
    res.status(201).json(present(row));
  } catch (error) {
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")return next(fail(409,"Ya existe un cliente con esos datos. Busca su RUC o revisa la razón social antes de registrar."));
    next(error);
  }
}

export async function take(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canTakeTickets(currentUser)) throw fail(403, "No tienes permiso para tomar casos");
    const id = uuid.parse(req.params.id);
    const row = await prisma.$transaction(async (tx) => {
      const claimed = await attemptAtomicTicketClaim(tx.ticket, id, currentUser.id);
      if (!claimed) {
        const current = await tx.ticket.findUnique({
          where: { id },
          include: { asignadoA: true },
        });
        throw fail(
          409,
          current?.asignadoA
            ? `Este caso ya está siendo atendido por ${current.asignadoA.nombres} ${current.asignadoA.apellidos}.`
            : "Este caso ya no está disponible.",
        );
      }
      await tx.ticketHistorial.create({
        data: {
          ticketId: id,
          accion: "Ticket tomado",
          estadoAnterior: "PENDIENTE",
          estadoNuevo: "EN_CURSO",
          usuarioId: currentUser.id,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
    res.json(present(row));
  } catch (error) {
    next(error);
  }
}

export async function advance(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    const id = uuid.parse(req.params.id);
    const data = z.object({
      modulo: z.enum(TICKET_MODULES).optional(),
      observaciones: z.string().trim().max(3000).optional(),
      solucion: z.string().trim().max(3000).optional(),
    }).parse(req.body);
    const current = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    const boss = isTicketBoss(currentUser);
    if (current.estado === "FINALIZADO" && !boss)
      throw fail(403, "Los casos finalizados están disponibles en modo solo lectura");
    if (current.estado !== "EN_CURSO" && !(boss && current.estado === "FINALIZADO"))
      throw fail(409, "Este caso no admite modificaciones");
    if (!boss && current.asignadoAId !== currentUser.id)
      throw fail(403, "Este caso está bloqueado para otro consultor");
    const row = await prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id }, data });
      if (data.modulo && data.modulo !== current.modulo) {
        await tx.ticketHistorial.create({
          data: {
            ticketId: id,
            accion: `Módulo modificado de ${current.modulo} a ${data.modulo}`,
            estadoAnterior: current.estado,
            estadoNuevo: current.estado,
            usuarioId: currentUser.id,
            metadata: { moduloAnterior: current.modulo, moduloNuevo: data.modulo },
          },
        });
      }
      if (data.observaciones !== undefined || data.solucion !== undefined) {
        await tx.ticketHistorial.create({
          data: {
            ticketId: id,
            accion: boss && current.estado === "FINALIZADO" ? "Modificación administrativa" : "Avance guardado",
            estadoAnterior: current.estado,
            estadoNuevo: current.estado,
            usuarioId: currentUser.id,
            comentario: data.observaciones || data.solucion,
          },
        });
      }
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
    res.json(present(row));
  } catch (error) {
    next(error);
  }
}

export async function finish(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    const id = uuid.parse(req.params.id);
    const data = z.object({
      observaciones: z.string().trim().max(3000).optional(),
      solucion: z.string().trim().max(3000).optional(),
    }).refine(
      (value) => (value.observaciones?.length ?? 0) >= 5 || (value.solucion?.length ?? 0) >= 5,
      { message: "Debes registrar una observación final o la solución brindada" },
    ).parse(req.body);
    const current = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    if (current.estado !== "EN_CURSO") throw fail(409, "El caso no está en curso");
    if (!isTicketBoss(currentUser) && current.asignadoAId !== currentUser.id)
      throw fail(403, "Solo el consultor responsable puede finalizarlo");
    const row = await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: {
          ...data,
          estado: "FINALIZADO",
          finalizadoAt: new Date(),
          finalizadoPorId: currentUser.id,
        },
      });
      await tx.ticketHistorial.create({
        data: {
          ticketId: id,
          accion: "Ticket finalizado",
          estadoAnterior: "EN_CURSO",
          estadoNuevo: "FINALIZADO",
          usuarioId: currentUser.id,
          comentario: data.solucion || data.observaciones,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
    res.json(present(row));
  } catch (error) {
    next(error);
  }
}

export async function reopen(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!isTicketBoss(currentUser)) throw fail(403, "Solo jefatura puede reabrir casos");
    const id = uuid.parse(req.params.id);
    const current = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    if (current.estado !== "FINALIZADO") throw fail(409, "Solo se pueden reabrir casos finalizados");
    const row = await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: {
          estado: "PENDIENTE",
          asignadoAId: null,
          asignadoAt: null,
          contactadoAt: null,
          finalizadoAt: null,
          finalizadoPorId: null,
        },
      });
      await tx.ticketHistorial.create({
        data: {
          ticketId: id,
          accion: "Ticket reabierto",
          estadoAnterior: "FINALIZADO",
          estadoNuevo: "PENDIENTE",
          usuarioId: currentUser.id,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
    res.json(present(row));
  } catch (error) {
    next(error);
  }
}

export async function reassign(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!isTicketBoss(currentUser)) throw fail(403, "Solo jefatura puede reasignar casos");
    const id = uuid.parse(req.params.id);
    const asignadoAId = uuid.parse(req.body.asignadoAId);
    const [current, assignee] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { id } }),
      actor(asignadoAId),
    ]);
    if (current.estado === "FINALIZADO") throw fail(409, "Un caso finalizado no se puede reasignar");
    if (!canTakeTickets(assignee)) throw fail(400, "El usuario elegido no es consultor de atención");
    const row = await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: {
          asignadoAId,
          asignadoAt: new Date(),
          contactadoAt: current.contactadoAt ?? new Date(),
          estado: "EN_CURSO",
        },
      });
      await tx.ticketHistorial.create({
        data: {
          ticketId: id,
          accion: `Ticket reasignado a ${assignee.nombres} ${assignee.apellidos}`,
          estadoAnterior: current.estado,
          estadoNuevo: "EN_CURSO",
          usuarioId: currentUser.id,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
    res.json(present(row));
  } catch (error) {
    next(error);
  }
}

export async function linkConsultant(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!isTicketBoss(currentUser))
      throw fail(403, "Solo jefatura puede vincular un consultor histórico");
    const id = uuid.parse(req.params.id);
    const asignadoAId = uuid.parse(req.body.asignadoAId);
    const [current, assignee] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { id } }),
      actor(asignadoAId),
    ]);
    if (current.asignadoAId) throw fail(409, "Este caso ya tiene un consultor vinculado");
    if (!canTakeTickets(assignee)) throw fail(400, "El usuario elegido no es consultor de atención");
    const row = await prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id }, data: { asignadoAId } });
      await tx.ticketHistorial.create({
        data: {
          ticketId: id,
          accion: `Consultor histórico "${current.atendidoPorNombre ?? "sin nombre"}" vinculado a ${assignee.nombres} ${assignee.apellidos}`,
          estadoAnterior: current.estado,
          estadoNuevo: current.estado,
          usuarioId: currentUser.id,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
    res.json(present(row));
  } catch (error) {
    next(error);
  }
}

export async function stream(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = await actor(req.userId!);
    if (!canViewTickets(currentUser)) throw fail(403, "No tienes permiso");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    let signature = "";
    let closed = false;
    const send = async () => {
      if (closed) return;
      const rows = await prisma.ticket.findMany({
        where: ticketScope,
        select: { id: true, estado: true, modulo: true, asignadoAId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      const nextSignature = JSON.stringify(rows);
      if (nextSignature !== signature) {
        signature = nextSignature;
        res.write(`event: tickets\ndata: ${nextSignature}\n\n`);
      } else {
        res.write(`: ${Date.now()}\n\n`);
      }
    };
    await send();
    const timer = setInterval(() => void send().catch(() => undefined), 2500);
    req.on("close", () => {
      closed = true;
      clearInterval(timer);
    });
  } catch (error) {
    next(error);
  }
}
