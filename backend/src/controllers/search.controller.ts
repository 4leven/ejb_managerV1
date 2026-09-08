import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db.js";
import {
  canReadInitiative,
  hasPermission,
  isTechnical,
} from "../services/permissions.js";

export async function globalSearch(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = String(req.query.q ?? "").trim();
    if (query.length < 2) return res.json([]);
    const actor = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.userId! },
    });
    const contains = { contains: query, mode: "insensitive" as const };
    const [initiatives, users, events, flows] = await Promise.all([
      prisma.iniciativa.findMany({
        where: {
          OR: [
            { titulo: contains },
            { codigo: contains },
            { cliente: contains },
            { descripcion: contains },
          ],
        },
        select: {
          id: true,
          codigo: true,
          titulo: true,
          cliente: true,
          areaId: true,
          responsableId: true,
        },
        take: 8,
      }),
      prisma.usuario.findMany({
        where: {
          OR: [
            { nombres: contains },
            { apellidos: contains },
            { email: contains },
          ],
        },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          cargo: true,
          fotoPerfil: true,
        },
        take: 6,
      }),
      prisma.evento.findMany({
        where: { OR: [{ titulo: contains }, { descripcion: contains }] },
        select: { id: true, titulo: true, inicio: true, iniciativaId: true, areaId: true },
        take: 6,
      }),
      prisma.flujoArea.findMany({
        where: {
          OR: [
            { titulo: contains },
            { descripcion: contains },
            { archivoNombre: contains },
          ],
        },
        select: { id: true, titulo: true, archivoNombre: true, areaId: true },
        take: 6,
      }),
    ]);
    const allAreas = actor.isSuperAdmin || isTechnical(actor);
    res.json([
      ...initiatives.filter((item) => canReadInitiative(actor, item)).map((item) => ({
        tipo: "Proyecto",
        id: item.id,
        titulo: `${item.codigo} · ${item.titulo}`,
        detalle: item.cliente ?? "Sin cliente",
        destino: "iniciativas",
      })),
      ...users.map((item) => ({
        tipo: "Persona",
        id: item.id,
        titulo: `${item.nombres} ${item.apellidos}`,
        detalle: item.cargo === "Tecnico" ? "Técnico" : item.cargo,
        destino: "equipo",
      })),
      ...events.filter((item) => allAreas || item.areaId === actor.areaId).map((item) => ({
        tipo: "Evento",
        id: item.id,
        titulo: item.titulo,
        detalle: item.inicio,
        destino: "calendario",
      })),
      ...flows.filter((item) => allAreas || item.areaId === actor.areaId).map((item) => ({
        tipo: "Documento",
        id: item.id,
        titulo: item.titulo,
        detalle: item.archivoNombre,
        destino: "flujos",
      })),
    ]);
  } catch (error) {
    next(error);
  }
}

export async function auditTrail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.userId! },
    });
    if (
      !actor.isSuperAdmin &&
      actor.rol !== "Admin" &&
      !["Jefe","Gerente"].includes(actor.cargo) &&
      !hasPermission(actor, "verAuditoria")
    )
      throw new Error("No tienes permisos para consultar la auditoría");
    const rows = await prisma.registroPortal.findMany({
      where: { tipo: "auditoria" },
      include: {
        creador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            fotoPerfil: true,
            areaId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(
      actor.isSuperAdmin || actor.rol === "Admin" || isTechnical(actor)
        ? rows
        : rows.filter((row) => row.creador.areaId === actor.areaId),
    );
  } catch (error) {
    next(error);
  }
}
