import type { Actor } from "./permissions.js";
import { hasPermission, isAreaLeader, isTechnical, canSeePage } from "./permissions.js";
import { TICKET_AREA_KEYS } from "../constants/ticket.js";

export type TicketActor = Actor & { area: { nombre: string } };

const normalizeAreaName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

const belongsToConsulting = (actor: TicketActor) =>
  TICKET_AREA_KEYS.includes(normalizeAreaName(actor.area.nombre) as (typeof TICKET_AREA_KEYS)[number]);

// Áreas que derivan casos a la Ticketera sin ser Consultoría (ver TICKET_DESTINATION_AREAS).
// Su jefatura puede ver y registrar en modo seguimiento, pero no hereda los poderes de
// isTicketBoss (reasignar/reabrir casos de cualquier área).
const LINKED_AREA_KEYS = ["ventas", "instalacion"] as const;
const belongsToLinkedArea = (actor: TicketActor) =>
  LINKED_AREA_KEYS.includes(normalizeAreaName(actor.area.nombre) as (typeof LINKED_AREA_KEYS)[number]);
const isLinkedAreaLeader = (actor: TicketActor) => belongsToLinkedArea(actor) && isAreaLeader(actor);

export const isTicketBoss = (actor: TicketActor) =>
  actor.isSuperAdmin ||
  isTechnical(actor) ||
  actor.rol === "Admin" ||
  (belongsToConsulting(actor) && ["Jefe","Gerente"].includes(actor.cargo));

export const canViewTickets = (actor: TicketActor) =>
  (isTicketBoss(actor) || belongsToConsulting(actor) || isLinkedAreaLeader(actor) || hasPermission(actor, "verTicketera")) &&
  canSeePage(actor, "verTicketera");

export const canRegisterTickets = (actor: TicketActor) =>
  isTicketBoss(actor) || isLinkedAreaLeader(actor) || hasPermission(actor, "registrarTickets");

export const canTakeTickets = (actor: TicketActor) =>
  isTicketBoss(actor) || belongsToConsulting(actor) || hasPermission(actor, "tomarTickets");

// Si el actor solo tiene acceso vía isLinkedAreaLeader (Jefe/Gerente de Ventas o
// Instalación), su vista debe acotarse a los tickets con areaDestino = su propia área.
// Jefatura de Ticketera, Consultoría o quien tenga el permiso verTicketera otorgado
// explícitamente siguen viendo todo (null = sin acotar), igual que antes de este cambio.
export const ticketAreaScope = (actor: TicketActor): string | null => {
  if (isTicketBoss(actor) || hasPermission(actor, "verTicketera")) return null;
  if (isLinkedAreaLeader(actor)) return actor.area.nombre;
  return null;
};

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
