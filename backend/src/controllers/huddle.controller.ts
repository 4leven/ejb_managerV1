import crypto from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";

const contextSchema = z.object({ contexto: z.enum(["dm", "grupo", "canal"]), contextoId: z.string().min(1).max(80) });
const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880";
const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
const apiSecret = process.env.LIVEKIT_API_SECRET || "secret";
const huddlesEnabled = process.env.ENABLE_HUDDLES === "true";
const roomService = new RoomServiceClient(livekitUrl.replace(/^ws/, "http"), apiKey, apiSecret);
const normalizedContext = (contexto: string, contextoId: string, userId: string) => contexto === "dm" ? [userId, contextoId].sort().join(":") : contextoId;

async function authorize(contexto: "dm" | "grupo" | "canal", rawId: string, userId: string) {
  if (contexto === "dm") {
    if (rawId === userId) throw new Error("No puedes iniciar una llamada contigo mismo");
    await prisma.usuario.findUniqueOrThrow({ where: { id: z.string().uuid().parse(rawId) } });
    return;
  }
  const row = await prisma.registroPortal.findUniqueOrThrow({ where: { id: rawId } }), data = row.datos as Record<string, unknown>;
  if (row.tipo !== contexto) throw new Error("El espacio no coincide con el contexto solicitado");
  const members = Array.isArray(data.miembros) ? data.miembros.map(String) : [row.creadorId];
  if (row.creadorId !== userId && !members.includes(userId)) throw new Error("No perteneces a este espacio");
}
async function tokenFor(room: string, userId: string) {
  const token = new AccessToken(apiKey, apiSecret, { identity: userId });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  return token.toJwt();
}
async function payload(huddle: { id: string; salaId: string }, userId: string) {
  return { huddleId: huddle.id, salaId: huddle.salaId, token: await tokenFor(huddle.salaId, userId), livekitUrl };
}
async function authorizeStoredHuddle(huddle: { contexto: string; contextoId: string }, userId: string) {
  if (huddle.contexto === "dm") {
    if (!huddle.contextoId.split(":").includes(userId)) throw new Error("No perteneces a esta llamada");
    return;
  }
  await authorize(huddle.contexto as "grupo" | "canal", huddle.contextoId, userId);
}

export async function startHuddle(req: Request, res: Response, next: NextFunction) {
  try {
    if (!huddlesEnabled) {
      res.status(503).json({ message: "Las llamadas están deshabilitadas temporalmente" });
      return;
    }
    const input = contextSchema.parse(req.body), userId = req.userId!;
    await authorize(input.contexto, input.contextoId, userId);
    const contextoId = normalizedContext(input.contexto, input.contextoId, userId);
    let huddle = await prisma.huddle.findFirst({ where: { contexto: input.contexto, contextoId, estado: "activa" }, orderBy: { createdAt: "desc" } });
    if (!huddle) huddle = await prisma.huddle.create({ data: { salaId: crypto.randomUUID(), contexto: input.contexto, contextoId, iniciadoPorId: userId } });
    res.status(201).json(await payload(huddle, userId));
  } catch (error) { next(error); }
}
export async function joinHuddle(req: Request, res: Response, next: NextFunction) {
  try { const huddle = await prisma.huddle.findFirstOrThrow({ where: { id: z.string().uuid().parse(req.params.id), estado: "activa" } }); await authorizeStoredHuddle(huddle, req.userId!); res.json(await payload(huddle, req.userId!)); } catch (error) { next(error); }
}
export async function leaveHuddle(req: Request, res: Response, next: NextFunction) {
  try {
    const huddle = await prisma.huddle.findUniqueOrThrow({ where: { id: z.string().uuid().parse(req.params.id) } });
    await authorizeStoredHuddle(huddle, req.userId!);
    let remaining = 0;
    try { remaining = (await roomService.listParticipants(huddle.salaId)).filter((participant) => participant.identity !== req.userId).length; } catch (error) { console.warn("LiveKit no estuvo disponible al comprobar participantes", error); }
    const result = remaining === 0 && huddle.estado === "activa" ? await prisma.huddle.update({ where: { id: huddle.id }, data: { estado: "finalizada", finalizadaAt: new Date() } }) : huddle;
    res.json(result);
  } catch (error) { next(error); }
}
export async function activeHuddle(req: Request, res: Response, next: NextFunction) {
  try {
    const input = contextSchema.parse(req.query), contextoId = normalizedContext(input.contexto, input.contextoId, req.userId!);
    await authorize(input.contexto, input.contextoId, req.userId!);
    res.json(await prisma.huddle.findFirst({ where: { contexto: input.contexto, contextoId, estado: "activa" }, include: { iniciadoPor: { select: { id: true, nombres: true, apellidos: true, fotoPerfil: true } } }, orderBy: { createdAt: "desc" } }));
  } catch (error) { next(error); }
}
