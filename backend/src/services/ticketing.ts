import type { Actor } from "./permissions.js";
import { hasPermission, isTechnical } from "./permissions.js";
import { TICKET_AREA_KEYS } from "../constants/ticket.js";

export type TicketActor = Actor & { area: { nombre: string } };

const belongsToConsulting = (actor: TicketActor) =>
  TICKET_AREA_KEYS.includes(
    actor.area.nombre
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase() as (typeof TICKET_AREA_KEYS)[number],
  );

export const isTicketBoss = (actor: TicketActor) =>
  actor.isSuperAdmin ||
  isTechnical(actor) ||
  actor.rol === "Admin" ||
  (belongsToConsulting(actor) && ["Jefe","Gerente"].includes(actor.cargo));

export const canViewTickets = (actor: TicketActor) =>
  isTicketBoss(actor) || belongsToConsulting(actor) || hasPermission(actor, "verTicketera");

export const canRegisterTickets = (actor: TicketActor) =>
  isTicketBoss(actor) || hasPermission(actor, "registrarTickets");

export const canTakeTickets = (actor: TicketActor) =>
  isTicketBoss(actor) || belongsToConsulting(actor) || hasPermission(actor, "tomarTickets");

type TicketUpdateMany = {
  updateMany(args: {
    where: { id: string; estado: "PENDIENTE"; OR: Array<{ asignadoAId: null } | { asignadoAId: string }> };
    data: {
      estado: "EN_CURSO";
      asignadoAId: string;
      asignadoAt: Date;
      contactadoAt: Date;
    };
  }): Promise<{ count: number }>;
};

export async function attemptAtomicTicketClaim(
  ticket: TicketUpdateMany,
  id: string,
  actorId: string,
  now = new Date(),
) {
  const result = await ticket.updateMany({
    where: { id, estado: "PENDIENTE", OR: [{ asignadoAId: null }, { asignadoAId: actorId }] },
    data: {
      estado: "EN_CURSO",
      asignadoAId: actorId,
      asignadoAt: now,
      contactadoAt: now,
    },
  });
  return result.count === 1;
}
