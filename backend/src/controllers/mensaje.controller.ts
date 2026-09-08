import { conversationCutoffs, cutoffId } from "../services/conversation-visibility.js";
import { NextFunction, Request, Response } from "express";
import { TipoMensaje } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { createHash } from "node:crypto";

const uuid = z.string().uuid();
const messageData = z.object({ contenido: z.string().trim().max(2000).default(""), tipo: z.nativeEnum(TipoMensaje).default(TipoMensaje.Texto), archivoNombre: z.string().max(255).optional(), archivoMime: z.string().max(120).optional(), archivoData: z.string().max(3000000).optional() });
const validMessage = messageData.refine((value) => value.contenido.length > 0 || Boolean(value.archivoData), { message: "El mensaje está vacío" });
const minimalReference = { id: true, contenido: true, tipo: true, remitenteId: true, createdAt: true } as const;
const belongsToConversation = (message: { remitenteId: string; destinatarioId: string }, first: string, second: string) =>
  (message.remitenteId === first && message.destinatarioId === second) || (message.remitenteId === second && message.destinatarioId === first);

function presentMessage<T extends { reacciones?: { emoji: string; usuarioId: string }[] }>(row: T, currentUserId: string) {
  const grouped = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const reaction of row.reacciones ?? []) {
    const current = grouped.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    current.count += 1;
    current.mine ||= reaction.usuarioId === currentUserId;
    grouped.set(reaction.emoji, current);
  }
  const { reacciones: _raw, ...message } = row;
  return { ...message, reacciones: [...grouped.values()] };
}

export async function conversations(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.userId!;
    const [coworkers, messages] = await Promise.all([
      prisma.usuario.findMany({ where: { id: { not: id } }, select: { id: true, nombres: true, apellidos: true, fotoPerfil: true, estadoMensaje: true, cargo: true, area: true } }),
      prisma.mensaje.findMany({ where: { OR: [{ remitenteId: id }, { destinatarioId: id }] }, select: { id: true, remitenteId: true, destinatarioId: true, contenido: true, tipo: true, archivoNombre: true, createdAt: true, leidoAt: true }, orderBy: { createdAt: "desc" } }),
    ]);
    const cutoffs = await conversationCutoffs(id);
    const visible = messages.filter(message => message.createdAt.getTime() > (cutoffs.get(message.remitenteId === id ? message.destinatarioId : message.remitenteId) ?? 0));
    res.json(coworkers.map((user) => ({ ...user, hidden: cutoffs.has(user.id), lastMessage: visible.find((message) => belongsToConversation(message, id, user.id)) ?? null, unread: visible.filter((message) => message.remitenteId === user.id && message.destinatarioId === id && !message.leidoAt).length })).sort((a, b) => new Date(b.lastMessage?.createdAt ?? 0).getTime() - new Date(a.lastMessage?.createdAt ?? 0).getTime()));
  } catch (error) { next(error); }
}

export async function thread(req: Request, res: Response, next: NextFunction) {
  try {
    const other = uuid.parse(req.params.userId), me = req.userId!;
    const cutoff = (await conversationCutoffs(me)).get(other);
    const where = { ...(cutoff ? {createdAt:{gt:new Date(cutoff)}} : {}), OR: [{ remitenteId: me, destinatarioId: other }, { remitenteId: other, destinatarioId: me }] };
    await prisma.mensaje.updateMany({ where: { remitenteId: other, destinatarioId: me, leidoAt: null }, data: { leidoAt: new Date() } });
    // Compare small metadata before loading attachment payloads from the database.
    const metadata = await prisma.mensaje.findMany({ where, select: { id: true, contenido: true, eliminadoAt:true, leidoAt: true, respuestaAId: true, reenviadoDeId: true, reacciones: { select: { id: true }, orderBy: { id: "asc" } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const etag = `"${createHash("sha256").update(JSON.stringify(metadata)).digest("hex")}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    if (req.headers["if-none-match"] === etag) { res.status(304).end(); return; }
    const rows = await prisma.mensaje.findMany({ where, include: { respuestaA: { select: minimalReference }, reenviadoDe: { select: minimalReference }, reacciones: { select: { emoji: true, usuarioId: true } } }, orderBy: { createdAt: "asc" } });
    res.json(rows.map((row) => presentMessage(row, me)));
  } catch (error) { next(error); }
}

export async function send(req: Request, res: Response, next: NextFunction) {
  try {
    const destinatarioId = uuid.parse(req.params.userId);
    const data = validMessage.and(z.object({ respuestaAId: uuid.optional() })).parse(req.body);
    if (destinatarioId === req.userId) throw new Error("No puedes enviarte mensajes a ti mismo");
    await prisma.usuario.findUniqueOrThrow({ where: { id: destinatarioId } });
    if (data.respuestaAId) {
      const original = await prisma.mensaje.findUnique({ where: { id: data.respuestaAId } });
      if (!original || original.eliminadoAt || !belongsToConversation(original, req.userId!, destinatarioId)) throw new Error("La respuesta no pertenece a esta conversación");
    }
    res.status(201).json(await prisma.mensaje.create({ data: { remitenteId: req.userId!, destinatarioId, ...data }, include: { respuestaA: { select: minimalReference } } }));
  } catch (error) { next(error); }
}

export async function toggleReaction(req: Request, res: Response, next: NextFunction) {
  try {
    const mensajeId = uuid.parse(req.params.messageId), usuarioId = req.userId!;
    const { emoji } = z.object({ emoji: z.string().trim().min(1).max(8) }).parse(req.body);
    const message = await prisma.mensaje.findUniqueOrThrow({ where: { id: mensajeId } });
    if(message.eliminadoAt)throw new Error("Este mensaje fue eliminado.");
    if (message.remitenteId !== usuarioId && message.destinatarioId !== usuarioId) throw new Error("No tienes acceso a este mensaje");
    const existing = await prisma.mensajeReaccion.findUnique({ where: { mensajeId_usuarioId_emoji: { mensajeId, usuarioId, emoji } } });
    if (existing) await prisma.mensajeReaccion.delete({ where: { id: existing.id } }); else await prisma.mensajeReaccion.create({ data: { mensajeId, usuarioId, emoji } });
    const reactions = await prisma.mensajeReaccion.findMany({ where: { mensajeId }, select: { emoji: true, usuarioId: true } });
    res.json(presentMessage({ reacciones: reactions }, usuarioId).reacciones);
  } catch (error) { next(error); }
}

export async function forwardMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = uuid.parse(req.params.messageId), remitenteId = req.userId!;
    const { destinatarioIds } = z.object({ destinatarioIds: z.array(uuid).min(1).max(50) }).parse(req.body);
    const uniqueIds = [...new Set(destinatarioIds)].filter((value) => value !== remitenteId);
    if (!uniqueIds.length) throw new Error("Selecciona al menos un destinatario válido");
    const original = await prisma.mensaje.findUniqueOrThrow({ where: { id } });
    if(original.eliminadoAt)throw new Error("Este mensaje fue eliminado.");
    if (original.remitenteId !== remitenteId && original.destinatarioId !== remitenteId) throw new Error("No tienes acceso a este mensaje");
    if (await prisma.usuario.count({ where: { id: { in: uniqueIds } } }) !== uniqueIds.length) throw new Error("Uno o más destinatarios no existen");
    const rows = await prisma.$transaction(uniqueIds.map((destinatarioId) => prisma.mensaje.create({ data: { remitenteId, destinatarioId, contenido: original.contenido, tipo: original.tipo, archivoNombre: original.archivoNombre, archivoMime: original.archivoMime, archivoData: original.archivoData, reenviadoDeId: original.id } })));
    res.status(201).json(rows);
  } catch (error) { next(error); }
}

export async function scheduleMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const destinatarioId = uuid.parse(req.params.userId);
    const body = validMessage.and(z.object({ enviarEn: z.string().datetime() })).parse(req.body), enviarEn = new Date(body.enviarEn);
    if (enviarEn.getTime() < Date.now() + 60_000) throw new Error("La fecha debe ser al menos un minuto en el futuro");
    if (destinatarioId === req.userId) throw new Error("No puedes programar mensajes para ti mismo");
    const { enviarEn: _date, ...data } = body;
    await prisma.usuario.findUniqueOrThrow({ where: { id: destinatarioId } });
    res.status(201).json(await prisma.mensajeProgramado.create({ data: { ...data, enviarEn, destinatarioId, remitenteId: req.userId! } }));
  } catch (error) { next(error); }
}

export async function scheduledMessages(req: Request, res: Response, next: NextFunction) {
  try { res.json(await prisma.mensajeProgramado.findMany({ where: { remitenteId: req.userId!, enviadoAt: null }, orderBy: { enviarEn: "asc" } })); } catch (error) { next(error); }
}
export async function updateScheduledMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = uuid.parse(req.params.id), input = z.object({ contenido: z.string().trim().min(1).max(2000).optional(), enviarEn: z.string().datetime().optional() }).refine((value) => value.contenido !== undefined || value.enviarEn !== undefined).parse(req.body);
    const row = await prisma.mensajeProgramado.findFirstOrThrow({ where: { id, remitenteId: req.userId!, enviadoAt: null } }), enviarEn = input.enviarEn ? new Date(input.enviarEn) : undefined;
    if (enviarEn && enviarEn.getTime() < Date.now() + 60_000) throw new Error("La fecha debe ser al menos un minuto en el futuro");
    res.json(await prisma.mensajeProgramado.update({ where: { id: row.id }, data: { contenido: input.contenido, enviarEn } }));
  } catch (error) { next(error); }
}
export async function deleteScheduledMessage(req: Request, res: Response, next: NextFunction) {
  try { const id = uuid.parse(req.params.id), row = await prisma.mensajeProgramado.findFirstOrThrow({ where: { id, remitenteId: req.userId!, enviadoAt: null } }); await prisma.mensajeProgramado.delete({ where: { id: row.id } }); res.status(204).end(); } catch (error) { next(error); }
}

export async function searchMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const q = z.string().trim().min(2).max(120).parse(req.query.q), me = req.userId!;
    const rows = await prisma.mensaje.findMany({ where: { contenido: { contains: q, mode: "insensitive" }, OR: [{ remitenteId: me }, { destinatarioId: me }] }, include: { remitente: { select: { id: true, nombres: true, apellidos: true, fotoPerfil: true } }, destinatario: { select: { id: true, nombres: true, apellidos: true, fotoPerfil: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
    const groups = new Map<string, { usuario: object; resultados: object[] }>();
    const cutoffs = await conversationCutoffs(me);
    for (const row of rows) { if(row.createdAt.getTime() <= (cutoffs.get(row.remitenteId === me ? row.destinatarioId : row.remitenteId) ?? 0)) continue; const other = row.remitenteId === me ? row.destinatario : row.remitente, group = groups.get(other.id) ?? { usuario: other, resultados: [] }; group.resultados.push({ mensajeId: row.id, fragmento: row.contenido.slice(0, 240), createdAt: row.createdAt }); groups.set(other.id, group); }
    res.json([...groups.values()]);
  } catch (error) { next(error); }
}
export async function deleteForEveryone(req: Request,res: Response,next: NextFunction){
 try {
  const id=uuid.parse(req.params.messageId);
  const row=await prisma.mensaje.findUniqueOrThrow({where:{id}});
  if(row.remitenteId!==req.userId) return res.status(403).json({message:"Solo puedes eliminar para todos los mensajes que tú enviaste."});
  const result=await prisma.$transaction(async tx=>{
   await tx.mensajeReaccion.deleteMany({where:{mensajeId:id}});
   return tx.mensaje.update({where:{id},data:{contenido:"Este mensaje fue eliminado",tipo:TipoMensaje.Texto,archivoNombre:null,archivoMime:null,archivoData:null,eliminadoAt:row.eliminadoAt??new Date(),respuestaAId:null,reenviadoDeId:null}});
  });
  res.json({...result,reacciones:[]});
 }catch(error){next(error)}
}
export async function deleteConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const otherId = uuid.parse(req.params.userId), userId = req.userId!;
    await prisma.usuario.findUniqueOrThrow({where:{id:otherId}});
    const datos = { otherId, before: new Date().toISOString() };
    await prisma.registroPortal.upsert({where:{id:cutoffId(userId,otherId)},create:{id:cutoffId(userId,otherId),tipo:"chat_eliminado",creadorId:userId,datos},update:{datos}});
    res.json({ok:true});
  } catch(error) {next(error)}
}
