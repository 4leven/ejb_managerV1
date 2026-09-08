import test from "node:test";
import assert from "node:assert/strict";
import {
  attemptAtomicTicketClaim,
  canRegisterTickets,
  canTakeTickets,
  canViewTickets,
  isTicketBoss,
  type TicketActor,
} from "./ticketing.js";

const worker: TicketActor = {
  id: "worker-1",
  areaId: "area-1",
  area: { nombre: "Operaciones" },
  cargo: "Trabajador",
  rol: "Usuario",
  isSuperAdmin: false,
};

test("los permisos de Ticketera se validan en el servidor", () => {
  assert.equal(canViewTickets(worker), false);
  assert.equal(canTakeTickets(worker), false);
  assert.equal(canRegisterTickets(worker), false);
  assert.equal(canViewTickets({ ...worker, permisos: { verTicketera: true } }), true);
  assert.equal(canTakeTickets({ ...worker, permisos: { tomarTickets: true } }), true);
  assert.equal(canRegisterTickets({ ...worker, permisos: { registrarTickets: true } }), true);
});

test("el técnico tiene control operativo de Ticketera sin ser administrador global", () => {
  const technician = { ...worker, cargo: "Tecnico" };
  assert.equal(technician.isSuperAdmin, false);
  assert.equal(isTicketBoss(technician), true);
  assert.equal(canViewTickets(technician), true);
  assert.equal(canRegisterTickets(technician), true);
  assert.equal(canTakeTickets(technician), true);
});

test("el equipo de Consultoría y su jefatura tienen el alcance esperado", () => {
  const consultant = { ...worker, area: { nombre: "Consultoría Contable" } };
  const payrollConsultant = { ...worker, area: { nombre: "CONSULTORIA PLANILLA" } };
  const otherConsultant = { ...worker, area: { nombre: "Consultoría Comercial" } };
  assert.equal(canViewTickets(consultant), true);
  assert.equal(canTakeTickets(consultant), true);
  assert.equal(canViewTickets(payrollConsultant), true);
  assert.equal(canTakeTickets(payrollConsultant), true);
  assert.equal(canViewTickets(otherConsultant), false);
  assert.equal(canTakeTickets(otherConsultant), false);
  assert.equal(canRegisterTickets(consultant), false);
  assert.equal(isTicketBoss(consultant), false);
  assert.equal(isTicketBoss({ ...consultant, cargo: "Gerente" }), true);
});

test("dos intentos simultáneos solo pueden adjudicar una vez el mismo ticket", async () => {
  let claimed = false;
  const ticket = {
    async updateMany({ where }: any) {
      assert.deepEqual(where, {
        id: "ticket-1",
        estado: "PENDIENTE",
        asignadoAId: null,
      });
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    },
  };
  const results = await Promise.all([
    attemptAtomicTicketClaim(ticket, "ticket-1", "consultor-a"),
    attemptAtomicTicketClaim(ticket, "ticket-1", "consultor-b"),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});
