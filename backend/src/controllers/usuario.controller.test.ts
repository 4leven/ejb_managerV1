import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db.js";
import { profile, teamArea } from "./usuario.controller.js";

// Prisma simulado: ninguna prueba toca una base de datos.
const area = { A: "11111111-1111-4111-8111-111111111111", B: "22222222-2222-4222-8222-222222222222" };
const users: Record<string, any> = {
  admin: { id: "admin", isSuperAdmin: true, areaId: area.A, cargo: "Gerente" },
  admin2: { id: "admin2", isSuperAdmin: true, areaId: area.A, cargo: "Gerente" },
  worker: { id: "worker", isSuperAdmin: false, areaId: area.A, cargo: "Trabajador" },
  other: { id: "other", isSuperAdmin: false, areaId: area.A, cargo: "Trabajador" },
};
let lookups: string[] = [];
let updates: any[] = [];
const p = prisma as any;
p.usuario.findUniqueOrThrow = async ({ where }: any) => { lookups.push(where.id); return { ...users[where.id] }; };
p.usuario.update = async ({ where, data }: any) => { updates.push({ id: where.id, data }); return { id: where.id, ...data }; };
p.area.findUniqueOrThrow = async ({ where }: any) => ({ id: where.id });

async function call(fn: any, actorId: string, body: any, params: any = {}) {
  lookups = []; updates = [];
  let error: any = null; let json: any = null;
  await fn({ userId: actorId, body, params }, { json: (v: any) => (json = v) }, (e: any) => (error = e));
  return { error, json, updates, lookups };
}

test("Equipo/área: un NO admin es rechazado también cuando pide la MISMA área (ni siquiera un no-op exitoso)", async () => {
  const r = await call(teamArea, "worker", { areaId: area.A }, { id: "other" });
  assert.match(r.error.message, /Solo el administrador global/);
  assert.equal(r.json, null, "no debe haber respuesta exitosa");
  assert.equal(r.updates.length, 0);
});

test("Equipo/área: un NO admin es rechazado sin revelar si el usuario objetivo existe", async () => {
  const r = await call(teamArea, "worker", { areaId: area.B }, { id: "no-existe" });
  assert.match(r.error.message, /Solo el administrador global/);
  assert.deepEqual(r.lookups, ["worker"], "solo se lee al que pide; el objetivo ni se consulta");
});

test("Equipo/área: un NO admin es rechazado al pedir otra área", async () => {
  const r = await call(teamArea, "worker", { areaId: area.B }, { id: "other" });
  assert.match(r.error.message, /Solo el administrador global/);
  assert.equal(r.updates.length, 0);
});

test("Equipo/área: el admin cambia el área de otro usuario y su misma-área es un no-op válido", async () => {
  const moved = await call(teamArea, "admin", { areaId: area.B }, { id: "worker" });
  assert.equal(moved.error, null);
  assert.equal(moved.updates[0].data.areaId, area.B);
  const same = await call(teamArea, "admin", { areaId: area.A }, { id: "worker" });
  assert.equal(same.error, null);
});

test("Equipo/área: el admin no puede cambiar el área de OTRO admin, pero sí la suya", async () => {
  assert.match((await call(teamArea, "admin", { areaId: area.B }, { id: "admin2" })).error.message, /otra cuenta administradora/);
  assert.equal((await call(teamArea, "admin", { areaId: area.B }, { id: "admin" })).error, null);
});

test("Perfil propio: un no-admin que reenvía SU MISMA área sigue pudiendo guardar el resto del perfil (no se rompe)", async () => {
  const r = await call(profile, "worker", { nombres: "Ana", apellidos: "Paz", areaId: area.A });
  assert.equal(r.error, null);
  const other = await call(profile, "worker", { nombres: "Ana", apellidos: "Paz", areaId: area.B });
  assert.match(other.error.message, /Solo el administrador global/);
});
