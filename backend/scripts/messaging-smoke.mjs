import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(), base = "http://127.0.0.1:4000/api";
const token = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET || "dev-only-secret");
async function call(path, userId, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(userId)}` }, body: options.body ? JSON.stringify(options.body) : undefined });
  const text = await response.text(), body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${body?.message || text}`);
  return body;
}
const created = { messages: [], scheduled: [], reactionMessage: "" };
try {
  const users = await prisma.usuario.findMany({ take: 3, orderBy: { createdAt: "asc" } });
  if (users.length < 3) throw new Error("Se necesitan tres usuarios reales para la prueba");
  const [first, second, third] = users, stamp = `smoke-${Date.now()}`;
  const original = await call(`/mensajes/${second.id}`, first.id, { method: "POST", body: { contenido: `${stamp} original` } }); created.messages.push(original.id); created.reactionMessage = original.id;
  const reply = await call(`/mensajes/${second.id}`, first.id, { method: "POST", body: { contenido: `${stamp} respuesta`, respuestaAId: original.id } }); created.messages.push(reply.id);
  const thread = await call(`/mensajes/${second.id}`, first.id);
  if (!thread.find((row) => row.id === reply.id)?.respuestaA) throw new Error("La respuesta persistente no fue incluida");
  let reactions = await call(`/mensajes/${original.id}/reacciones`, second.id, { method: "POST", body: { emoji: "🎉" } });
  if (reactions[0]?.count !== 1 || !reactions[0]?.mine) throw new Error("La reacción no se agregó");
  reactions = await call(`/mensajes/${original.id}/reacciones`, second.id, { method: "POST", body: { emoji: "🎉" } });
  if (reactions.length) throw new Error("La reacción no hizo toggle");
  const forwarded = await call(`/mensajes/${original.id}/reenviar`, first.id, { method: "POST", body: { destinatarioIds: [second.id, third.id] } }); created.messages.push(...forwarded.map((row) => row.id));
  if (forwarded.length !== 2 || forwarded.some((row) => row.reenviadoDeId !== original.id)) throw new Error("El reenvío múltiple falló");
  const scheduled = await call(`/mensajes/${second.id}/programar`, first.id, { method: "POST", body: { contenido: `${stamp} programado`, enviarEn: new Date(Date.now() + 90_000).toISOString() } }); created.scheduled.push(scheduled.id);
  const pending = await call("/mensajes/programados", first.id);
  if (!pending.some((row) => row.id === scheduled.id)) throw new Error("El mensaje programado no aparece");
  const edited = await call(`/mensajes/programados/${scheduled.id}`, first.id, { method: "PATCH", body: { contenido: `${stamp} editado`, enviarEn: new Date(Date.now() + 120_000).toISOString() } });
  if (!edited.contenido.endsWith("editado")) throw new Error("No se editó el mensaje programado");
  const search = await call(`/mensajes/buscar?q=${encodeURIComponent(stamp)}`, first.id);
  if (!search.some((group) => group.resultados.some((row) => row.mensajeId === original.id))) throw new Error("La búsqueda de contenido falló");
  await call(`/mensajes/programados/${scheduled.id}`, first.id, { method: "DELETE" }); created.scheduled=[];
  console.log("MESSAGING_SMOKE_OK: respuesta, reacción toggle, reenvío múltiple, programación y búsqueda verificados");
} finally {
  if (created.scheduled.length) await prisma.mensajeProgramado.deleteMany({ where: { id: { in: created.scheduled } } });
  if (created.messages.length) await prisma.mensaje.deleteMany({ where: { id: { in: created.messages } } });
  await prisma.$disconnect();
}
