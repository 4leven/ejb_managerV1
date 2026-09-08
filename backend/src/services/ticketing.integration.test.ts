import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { attemptAtomicTicketClaim } from "./ticketing.js";

const databaseTest = process.env.RUN_TICKET_DB_TEST === "1" ? test : test.skip;

databaseTest("PostgreSQL adjudica un ticket a un solo consultor bajo concurrencia", async () => {
  const prisma = new PrismaClient();
  let clientId = "";
  let ticketId = "";
  try {
    const users = await prisma.usuario.findMany({ select: { id: true }, take: 2 });
    assert.equal(users.length, 2, "La prueba requiere dos usuarios existentes");
    const ruc = String(randomInt(10_000_000_000, 99_999_999_999));
    const client = await prisma.cliente.create({
      data: { ruc, razonSocial: `CLIENTE PRUEBA CONCURRENCIA ${ruc}` },
    });
    clientId = client.id;
    const ticket = await prisma.ticket.create({
      data: {
        clienteId: clientId,
        ruc,
        razonSocial: client.razonSocial,
        modulo: "EJBCONTABLE",
        contacto: "Prueba automatizada",
        consulta: "Validación temporal de adjudicación atómica",
        creadoPorId: users[0].id,
      },
    });
    ticketId = ticket.id;
    const outcomes = await Promise.all([
      prisma.$transaction((tx) => attemptAtomicTicketClaim(tx.ticket, ticketId, users[0].id)),
      prisma.$transaction((tx) => attemptAtomicTicketClaim(tx.ticket, ticketId, users[1].id)),
    ]);
    assert.equal(outcomes.filter(Boolean).length, 1);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    assert.equal(stored.estado, "EN_CURSO");
    assert.ok([users[0].id, users[1].id].includes(stored.asignadoAId ?? ""));
  } finally {
    if (ticketId) await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined);
    if (clientId) await prisma.cliente.delete({ where: { id: clientId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
