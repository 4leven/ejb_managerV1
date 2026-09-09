import "dotenv/config";
import { randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let ticketId = "";
let clientId = "";

const request = async (path, token, options = {}) => {
  const response = await fetch(`http://127.0.0.1:4000${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

try {
  const boss =
    (await prisma.usuario.findFirst({ where: { isSuperAdmin: true }, select: { id: true } })) ??
    (await prisma.usuario.findFirst({ where: { rol: "Admin" }, select: { id: true } }));
  const consultant = await prisma.usuario.findFirst({
    where: { id: { not: boss?.id }, isSuperAdmin: false, rol: { not: "Admin" } },
    select: { id: true },
  });
  if (!boss || !consultant) throw new Error("La prueba requiere un jefe y un usuario adicional.");

  const sign = (id) =>
    jwt.sign({}, process.env.JWT_SECRET ?? "dev-only-secret", {
      subject: id,
      expiresIn: "5m",
    });
  const bossToken = sign(boss.id);
  const consultantToken = sign(consultant.id);
  const ruc = String(randomInt(10_000_000_000, 99_999_999_999));
  const masterClient = await prisma.cliente.create({
    data: {
      ruc,
      razonSocial: `CLIENTE PRUEBA CICLO ${ruc}`,
      telefono: "999999999",
      contacto: "Contacto del maestro",
    },
  });
  clientId = masterClient.id;

  const created = await request("/api/tickets", bossToken, {
    method: "POST",
    body: JSON.stringify({
      clienteId: masterClient.id,
      modulo: "EJBCONTABLE",
      contacto: "Prueba automatizada",
      consulta: "Validar el flujo completo de atención",
      prioridad: "NORMAL",
      canal: "WHATSAPP",
    }),
  });
  if (created.response.status !== 201)
    throw new Error(`Registro falló: ${JSON.stringify(created.body)}`);
  ticketId = created.body.id;
  if (created.body.ruc !== masterClient.ruc || created.body.telefono !== masterClient.telefono)
    throw new Error("El ticket no tomó los datos del maestro de clientes.");
  console.log("Registro: OK", created.body.numeroTicket);

  const taken = await request(`/api/tickets/${ticketId}/tomar`, bossToken, { method: "POST" });
  if (taken.response.status !== 200 || taken.body.estado !== "EN_CURSO")
    throw new Error(`Toma falló: ${JSON.stringify(taken.body)}`);
  console.log("Tomar caso: OK");

  const advanced = await request(`/api/tickets/${ticketId}/avance`, bossToken, {
    method: "PATCH",
    body: JSON.stringify({
      modulo: "EJBPLANILLAS",
      observaciones: "Diagnóstico inicial registrado",
    }),
  });
  if (advanced.response.status !== 200 || advanced.body.modulo !== "EJBPLANILLAS")
    throw new Error(`Avance falló: ${JSON.stringify(advanced.body)}`);
  const moduleAudit = advanced.body.historial?.find(
    (entry) =>
      entry.metadata?.moduloAnterior === "EJBCONTABLE" &&
      entry.metadata?.moduloNuevo === "EJBPLANILLAS",
  );
  if (!moduleAudit) throw new Error("No se registró la auditoría del cambio de módulo.");
  console.log("Avance y auditoría de módulo: OK");

  const finished = await request(`/api/tickets/${ticketId}/finalizar`, bossToken, {
    method: "POST",
    body: JSON.stringify({ observaciones: "Validación de ciclo completa" }),
  });
  if (finished.response.status !== 200 || finished.body.estado !== "FINALIZADO")
    throw new Error(`Cierre falló: ${JSON.stringify(finished.body)}`);
  if (!finished.body.finalizadoAt || finished.body.finalizadoPor?.id !== boss.id)
    throw new Error("El cierre no registró fecha y usuario de finalización.");
  console.log("Finalizar y registrar historial: OK");

  const forbidden = await request(`/api/tickets/${ticketId}/avance`, consultantToken, {
    method: "PATCH",
    body: JSON.stringify({ observaciones: "Cambio no autorizado" }),
  });
  if (forbidden.response.status !== 403)
    throw new Error(`Solo lectura falló: se recibió ${forbidden.response.status}`);
  console.log("Solo lectura para otro consultor: OK");

  const reopened = await request(`/api/tickets/${ticketId}/reabrir`, bossToken, {
    method: "POST",
  });
  if (
    reopened.response.status !== 200 ||
    reopened.body.estado !== "PENDIENTE" ||
    reopened.body.asignadoAId !== null
  )
    throw new Error(`Reapertura falló: ${JSON.stringify(reopened.body)}`);
  const reopenAudit = reopened.body.historial?.find(
    (entry) =>
      entry.accion === "Ticket reabierto" &&
      entry.estadoAnterior === "FINALIZADO" &&
      entry.estadoNuevo === "PENDIENTE",
  );
  if (!reopenAudit) throw new Error("No se registró el historial de reapertura a PENDIENTE.");
  console.log("Reabrir a pendientes y registrar historial: OK");

  const unchangedClient = await prisma.cliente.findUniqueOrThrow({ where: { id: clientId } });
  if (
    unchangedClient.telefono !== masterClient.telefono ||
    unchangedClient.contacto !== masterClient.contacto
  )
    throw new Error("La Ticketera modificó el maestro de clientes.");
  console.log("Maestro de clientes sin modificaciones: OK");
} finally {
  if (ticketId) await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined);
  if (clientId) await prisma.cliente.delete({ where: { id: clientId } }).catch(() => undefined);
  await prisma.$disconnect();
}
