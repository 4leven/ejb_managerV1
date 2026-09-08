import { createHash } from "node:crypto";
import { prisma } from "../config/db.js";

export async function conversationCutoffs(userId: string) {
  const records = await prisma.registroPortal.findMany({ where: { tipo: "chat_eliminado", creadorId: userId }, select: { datos: true } });
  return new Map(records.map(row => { const data = row.datos as any; return [String(data.otherId), new Date(data.before).getTime()] as const; }));
}
export function cutoffId(userId: string, otherId: string) {
  const h = createHash("sha256").update(`chat:${userId}:${otherId}`).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
