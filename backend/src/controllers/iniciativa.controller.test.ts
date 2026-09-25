import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db.js";
import { create, transition, update } from "./iniciativa.controller.js";

// Prisma simulado: ninguna prueba toca una base de datos.
const area = { A: "11111111-1111-4111-8111-111111111111", B: "22222222-2222-4222-8222-222222222222" };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const users: Record<string, any> = {
  creador: { id: id(1), areaId: area.A, cargo: "Trabajador", rol: "Usuario", isSuperAdmin: false, permisos: {} },
  responsable: { id: id(2), areaId: area.A, cargo: "Trabajador", rol: "Usuario", isSuperAdmin: false, permisos: {} },
  otraArea: { id: id(3), areaId: area.B, cargo: "Trabajador", rol: "Usuario", isSuperAdmin: false, permisos: {} },
  jefeA: { id: id(4), areaId: area.A, cargo: "Jefe", rol: "Comite", isSuperAdmin: false, permisos: {} },
  jefeB: { id: id(5), areaId: area.B, cargo: "Jefe", rol: "Comite", isSuperAdmin: false, permisos: {} },
  editorB: { id: id(6), areaId: area.B, cargo: "Trabajador", rol: "Usuario", isSuperAdmin: false, permisos: { editarProyectos: true } },
  miembroB: { id: id(7), areaId: area.B, cargo: "Trabajador", rol: "Usuario", isSuperAdmin: false, permisos: {} },
  tecnico: { id: id(8), areaId: area.A, cargo: "Tecnico", rol: "Usuario", isSuperAdmin: false, permisos: {} },
};
const byId = Object.fromEntries(Object.values(users).map((u) => [u.id, u]));
const baseProject = () => ({
  id: id(100), codigo: "INV-100", titulo: undefined as string | undefined, descripcion: undefined as string | undefined, areaId: area.A, creadorId: users.creador.id, responsableId: null as string | null,
  impacto: 5, esfuerzo: "Medio", fechaInicio: null, fechaFin: null, estado: "Pendiente",
});
let project = baseProject();
let updates: any[] = [];
let audits: any[] = [];

const p = prisma as any;
p.usuario.findUniqueOrThrow = async ({ where }: any) => ({ ...byId[where.id] });
p.usuario.findUnique = async ({ where }: any) => (byId[where.id] ? { areaId: byId[where.id].areaId } : null);
p.iniciativa.findUniqueOrThrow = async () => ({ ...project });
p.iniciativa.update = async ({ data }: any) => { updates.push(data); return { ...project, ...data, clienteRef: null }; };
p.area.findUniqueOrThrow = async ({ where }: any) => ({ id: where.id });
p.registroPortal.create = async ({ data }: any) => { audits.push(data.datos); return data; };

async function call(fn: any, actor: string, body: any, params: any = { id: project.id }) {
  updates = []; audits = [];
  let error: any = null; let json: any = null;
  await fn({ userId: users[actor].id, body, params }, { json: (v: any) => (json = v), status: () => ({ json: (v: any) => (json = v) }) }, (e: any) => (error = e));
  return { error, json, updates, audits };
}
const fresh = (over: Record<string, unknown> = {}) => { project = { ...baseProject(), ...over }; };

test("creador edita título y descripción de lo suyo y queda auditado", async () => {
  fresh();
  const r = await call(update, "creador", { titulo: "Nuevo título", descripcion: "Descripción actualizada larga" });
  assert.equal(r.error, null);
  assert.equal(r.updates[0].titulo, "Nuevo título");
  assert.equal(r.audits.length, 1);
  assert.equal(r.audits[0].accion, "Editar");
  assert.deepEqual(r.audits[0].detalle.campos, ["titulo", "descripcion"]);
});

test("el formulario reenvía área/impacto/esfuerzo sin cambios y no bloquea al creador", async () => {
  fresh();
  const r = await call(update, "creador", { titulo: "Otro título", areaId: area.A, impacto: 5, esfuerzo: "Medio" });
  assert.equal(r.error, null);
});

test("audit registra solo los campos que cambiaron, no todo lo que llegó en el payload", async () => {
  fresh();
  project.titulo = "Título original";
  project.descripcion = "Descripción original suficientemente larga";
  project.fechaInicio = new Date("2026-09-01") as any;
  const r = await call(update, "jefeA", {
    titulo: "Título original", // igual
    descripcion: "Descripción original suficientemente larga", // igual
    areaId: area.A, // igual
    impacto: 9, // cambia
    esfuerzo: "Medio", // igual
    fechaInicio: "2026-09-01", // igual (Date vs Date)
    fechaFin: "2026-09-30", // cambia (null -> fecha)
    software: null, // igual (null vs undefined)
  });
  assert.equal(r.error, null);
  assert.deepEqual(r.audits[0].detalle.campos.sort(), ["fechaFin", "impacto"]);
});

test("creador NO puede cambiar impacto/esfuerzo ni mover de área", async () => {
  fresh();
  assert.match((await call(update, "creador", { impacto: 9 })).error.message, /jefatura del área de origen/);
  assert.match((await call(update, "creador", { esfuerzo: "Alto" })).error.message, /jefatura del área de origen/);
  const move = await call(update, "creador", { areaId: area.B });
  assert.match(move.error.message, /jefatura del área de origen/);
  assert.equal(move.updates.length, 0);
});

test("creador NO puede derivar (cambiar ni quitar responsable) al editar", async () => {
  fresh();
  const assign = await call(update, "creador", { responsableId: users.responsable.id });
  assert.match(assign.error.message, /pueden derivar/);
  project.responsableId = users.responsable.id;
  const clear = await call(update, "creador", { responsableId: null });
  assert.match(clear.error.message, /pueden derivar/);
});

test("alguien de otra área es rechazado al editar", async () => {
  fresh();
  const r = await call(update, "otraArea", { titulo: "Intento ajeno" });
  assert.match(r.error.message, /No tienes permisos para editar/);
  assert.equal(r.updates.length, 0);
  assert.equal(r.audits.length, 0);
});

test("jefe de otra área tampoco puede editar ni mover el proyecto", async () => {
  fresh();
  const r = await call(update, "jefeB", { areaId: area.B });
  assert.match(r.error.message, /No tienes permisos para editar/);
});

test("jefatura del área cambia área y responsable; al mover sin responsable nuevo queda 'Sin derivar'", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const move = await call(update, "jefeA", { areaId: area.B });
  assert.equal(move.error, null);
  assert.equal(move.updates[0].areaId, area.B);
  assert.equal(move.updates[0].responsableId, null);
  assert.equal(move.audits[0].detalle.areaNueva, area.B);
  fresh();
  const derive = await call(update, "jefeA", { responsableId: users.responsable.id, impacto: 8 });
  assert.equal(derive.error, null);
  assert.equal(derive.updates[0].responsableId, users.responsable.id);
  assert.equal(derive.updates[0].impacto, 8);
});

test("jefatura no puede derivar a alguien de otra área", async () => {
  fresh();
  const r = await call(update, "jefeA", { responsableId: users.otraArea.id });
  assert.match(r.error.message, /no pertenece al área/);
});

test("técnico mueve de área e impacto pero no deriva (como ya estaba)", async () => {
  fresh();
  const r = await call(update, "tecnico", { areaId: area.B, impacto: 7 });
  assert.equal(r.error, null);
  const d = await call(update, "tecnico", { responsableId: users.responsable.id });
  assert.match(d.error.message, /pueden derivar/);
});

test("permiso editarProyectos permite editar campos comunes de otra área, pero no los de jefatura", async () => {
  fresh();
  assert.equal((await call(update, "editorB", { titulo: "Editado por permiso" })).error, null);
  assert.match((await call(update, "editorB", { areaId: area.B })).error.message, /jefatura del área de origen/);
});

test("un miembro común de otra área sin permiso sigue rechazado (irá por aprobación)", async () => {
  fresh();
  assert.match((await call(update, "miembroB", { titulo: "Sin permiso" })).error.message, /No tienes permisos para editar/);
});

test("transition: reenviar el mismo responsable no cuenta como derivar", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const r = await call(transition, "responsable", { estado: "En_evaluacion", responsableId: users.responsable.id });
  assert.equal(r.error, null);
});

test("transition: un no-jefe NO puede reasignar el responsable por la vía del estado", async () => {
  fresh();
  const r = await call(transition, "creador", { estado: "En_evaluacion", responsableId: users.responsable.id });
  assert.match(r.error.message, /pueden derivar/);
  assert.equal(r.updates.length, 0);
});

test("transition: jefatura asigna responsable del área; uno de otra área se rechaza", async () => {
  fresh();
  assert.equal((await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: users.responsable.id })).error, null);
  assert.match((await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: users.otraArea.id })).error.message, /no pertenece al área/);
});

test("crear: se abre en la propia área y NO entre áreas", async () => {
  fresh();
  const own = { titulo: "Proyecto propio", descripcion: "Descripción suficientemente larga", areaId: area.A, impacto: 5, esfuerzo: "Bajo" };
  p.iniciativa.create = async ({ data }: any) => ({ id: id(200), codigo: "INV-200", ...data });
  const iniciativaService = (await import("../services/iniciativa.service.js")).iniciativaService as any;
  iniciativaService.create = async (d: any) => ({ id: id(200), codigo: "INV-200", ...d });
  assert.equal((await call(create, "creador", own, {})).error, null);
  const cross = await call(create, "creador", { ...own, areaId: area.B }, {});
  assert.match(cross.error.message, /Solo puedes registrar proyectos para tu área/);
});

// ---- Huecos detectados en revisión (Codex): quitar el responsable de forma indirecta o implícita ----

test("técnico (sin poder de derivar) NO puede mover de área un proyecto que YA tiene responsable: eso lo dejaría sin derivar", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const r = await call(update, "tecnico", { areaId: area.B });
  assert.match(r.error.message, /pueden derivar/);
  assert.equal(r.updates.length, 0, "no debe guardarse ningún cambio");
  assert.equal(r.audits.length, 0);
});

test("técnico tampoco elude la regla mandando responsableId explícito o null junto con el cambio de área", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const explicitNull = await call(update, "tecnico", { areaId: area.B, responsableId: null });
  assert.match(explicitNull.error.message, /pueden derivar/);
  assert.equal(explicitNull.updates.length, 0);
});

test("técnico SÍ mueve de área un proyecto SIN responsable (no hay nada que quitar)", async () => {
  fresh();
  project.responsableId = null;
  const r = await call(update, "tecnico", { areaId: area.B });
  assert.equal(r.error, null);
  assert.equal(r.updates[0].areaId, area.B);
  assert.ok(!("responsableId" in r.updates[0]) || r.updates[0].responsableId === undefined);
});

test("jefatura que mueve de área un proyecto con responsable sí puede, y queda auditado el responsable que se quitó", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const r = await call(update, "jefeA", { areaId: area.B });
  assert.equal(r.error, null);
  assert.equal(r.updates[0].responsableId, null);
  assert.equal(r.audits[0].detalle.responsableAnterior, users.responsable.id);
  assert.equal(r.audits[0].detalle.responsableNuevo, null);
});

test("transition: responsableId null EXPLÍCITO quita al responsable si quien lo pide puede derivar", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const r = await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: null });
  assert.equal(r.error, null);
  assert.equal(r.updates[0].responsableId, null, "null explícito debe borrar, no convertirse en 'sin cambio'");
});

test("transition: responsableId null explícito pasa por la validación de derivar (un no-jefe NO puede quitarlo)", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  for (const actor of ["creador", "responsable", "tecnico"]) {
    const r = await call(transition, actor, { estado: "En_evaluacion", responsableId: null });
    assert.match(r.error.message, /pueden derivar/, `actor: ${actor}`);
    assert.equal(r.updates.length, 0, `actor: ${actor}`);
  }
});

test("transition: responsableId AUSENTE conserva al responsable; null sobre un proyecto sin responsable es un no-op válido", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const kept = await call(transition, "creador", { estado: "En_evaluacion" });
  assert.equal(kept.error, null);
  assert.equal(kept.updates[0].responsableId, users.responsable.id);
  fresh();
  const noop = await call(transition, "creador", { estado: "En_evaluacion", responsableId: null });
  assert.equal(noop.error, null, "no hay responsable que quitar: no exige jefatura");
  assert.equal(noop.updates[0].responsableId, null);
});

test("transition: quitar al responsable y priorizar en el mismo movimiento se rechaza (priorizar exige responsable)", async () => {
  fresh();
  project.estado = "En_evaluacion";
  project.responsableId = users.responsable.id;
  const r = await call(transition, "jefeA", { estado: "Priorizado", responsableId: null });
  assert.match(r.error.message, /Asigna un responsable antes de priorizar/);
  assert.equal(r.updates.length, 0);
});

// ---- Auditoría de transition cuando cambia el responsable (antes no dejaba rastro) ----

test("transition: asignar un responsable queda auditado (quién, anterior y nuevo)", async () => {
  fresh();
  project.responsableId = null;
  const r = await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: users.responsable.id });
  assert.equal(r.error, null);
  assert.equal(r.audits.length, 1);
  assert.equal(r.audits[0].accion, "Cambiar estado");
  assert.equal(r.audits[0].detalle.responsableAnterior, null);
  assert.equal(r.audits[0].detalle.responsableNuevo, users.responsable.id);
  assert.equal(r.audits[0].detalle.estado, "En_evaluacion");
});

test("transition: quitar el responsable (null explícito) queda auditado", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const r = await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: null });
  assert.equal(r.error, null);
  assert.equal(r.audits[0].detalle.responsableAnterior, users.responsable.id);
  assert.equal(r.audits[0].detalle.responsableNuevo, null);
});

test("transition: cambiar de un responsable a otro queda auditado con ambos", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  users.otroResp = { id: id(20), areaId: area.A, cargo: "Trabajador", rol: "Usuario", isSuperAdmin: false, permisos: {} };
  byId[users.otroResp.id] = users.otroResp;
  const r = await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: users.otroResp.id });
  assert.equal(r.error, null);
  assert.equal(r.audits[0].detalle.responsableAnterior, users.responsable.id);
  assert.equal(r.audits[0].detalle.responsableNuevo, users.otroResp.id);
});

test("transition: si el responsable NO cambia (ausente, reenviado igual o null sin responsable) el audit no lo menciona", async () => {
  for (const body of [{ estado: "En_evaluacion" }, { estado: "En_evaluacion", responsableId: "SAME" }, { estado: "En_evaluacion", responsableId: null }]) {
    fresh();
    project.responsableId = body.responsableId === "SAME" ? users.responsable.id : body.responsableId === null ? null : users.responsable.id;
    const r = await call(transition, "jefeA", { ...body, ...(body.responsableId === "SAME" ? { responsableId: users.responsable.id } : {}) });
    assert.equal(r.error, null, JSON.stringify(body));
    assert.equal("responsableAnterior" in r.audits[0].detalle, false, JSON.stringify(body));
    assert.equal("responsableNuevo" in r.audits[0].detalle, false, JSON.stringify(body));
  }
});

test("transition: un intento rechazado NO deja auditoría de cambio de responsable", async () => {
  fresh();
  project.responsableId = users.responsable.id;
  const r = await call(transition, "tecnico", { estado: "En_evaluacion", responsableId: null });
  assert.ok(r.error);
  assert.equal(r.audits.length, 0);
});

// ---- Derivar acotado al área del proyecto: Jefe de OTRA área no puede, aunque pueda gestionar el proyecto ----

// Jefe del área B que llega a gestionar un proyecto del área A por otra vía:
// permiso global editarProyectos, o siendo el creador del proyecto.
users.jefeBEditor = { id: id(30), areaId: area.B, cargo: "Jefe", rol: "Comite", isSuperAdmin: false, permisos: { editarProyectos: true } };
users.jefeBCrea = { id: id(31), areaId: area.B, cargo: "Jefe", rol: "Comite", isSuperAdmin: false, permisos: { crearProyectos: true } };
users.adminGlobal = { id: id(32), areaId: area.B, cargo: "Gerente", rol: "Admin", isSuperAdmin: true, permisos: {} };
for (const key of ["jefeBEditor", "jefeBCrea", "adminGlobal"]) byId[users[key].id] = users[key];

test("Jefe de OTRA área con editarProyectos NO puede derivar en un proyecto ajeno: ni asignar, ni cambiar, ni quitar (update)", async () => {
  fresh();
  const assign = await call(update, "jefeBEditor", { responsableId: users.responsable.id });
  assert.match(assign.error.message, /pueden derivar/);
  assert.equal(assign.updates.length, 0);
  project.responsableId = users.responsable.id;
  const clear = await call(update, "jefeBEditor", { responsableId: null });
  assert.match(clear.error.message, /pueden derivar/);
  assert.equal(clear.updates.length, 0);
  // Sigue pudiendo editar los campos comunes con ese permiso (no se rompe lo demás).
  assert.equal((await call(update, "jefeBEditor", { titulo: "Título editado por permiso" })).error, null);
});

test("Jefe de OTRA área que es CREADOR del proyecto NO puede derivar (update)", async () => {
  fresh({ creadorId: users.jefeBEditor.id });
  users.jefeBEditor.permisos = {}; // solo la vía "creador"
  const r = await call(update, "jefeBEditor", { responsableId: users.responsable.id });
  users.jefeBEditor.permisos = { editarProyectos: true };
  assert.match(r.error.message, /pueden derivar/);
  assert.equal(r.updates.length, 0);
});

test("Jefe de OTRA área NO puede asignar ni quitar por la vía del estado (transition), y no deja auditoría", async () => {
  fresh();
  const assign = await call(transition, "jefeBEditor", { estado: "En_evaluacion", responsableId: users.responsable.id });
  assert.match(assign.error.message, /pueden derivar/);
  project.responsableId = users.responsable.id;
  const remove = await call(transition, "jefeBEditor", { estado: "En_evaluacion", responsableId: null });
  assert.match(remove.error.message, /pueden derivar/);
  assert.equal(remove.updates.length, 0);
  assert.equal(remove.audits.length, 0);
  // Cambiar el estado sin tocar al responsable sí puede (gestiona el proyecto por el permiso).
  assert.equal((await call(transition, "jefeBEditor", { estado: "En_evaluacion" })).error, null);
});

test("Jefe de OTRA área que es creador tampoco deriva por transition", async () => {
  fresh({ creadorId: users.jefeBEditor.id, responsableId: users.responsable.id });
  users.jefeBEditor.permisos = {};
  const r = await call(transition, "jefeBEditor", { estado: "En_evaluacion", responsableId: null });
  users.jefeBEditor.permisos = { editarProyectos: true };
  assert.match(r.error.message, /pueden derivar/);
});

test("crear: un Jefe con crearProyectos en OTRA área puede registrar el proyecto pero NO derivarlo", async () => {
  fresh();
  const iniciativaService = (await import("../services/iniciativa.service.js")).iniciativaService as any;
  iniciativaService.create = async (d: any) => ({ id: id(201), codigo: "INV-201", ...d });
  const body = { titulo: "Proyecto en otra área", descripcion: "Descripción suficientemente larga", areaId: area.A, impacto: 5, esfuerzo: "Bajo" };
  assert.equal((await call(create, "jefeBCrea", body, {})).error, null, "crear sin derivar sigue permitido");
  const derive = await call(create, "jefeBCrea", { ...body, responsableId: users.responsable.id }, {});
  assert.match(derive.error.message, /pueden derivar/);
});

test("Jefe de LA MISMA área SIGUE derivando: asignar, cambiar y quitar en update, transition y crear", async () => {
  fresh();
  users.otroResp2 = { id: id(21), areaId: area.A, cargo: "Trabajador", rol: "Usuario", isSuperAdmin: false, permisos: {} };
  byId[users.otroResp2.id] = users.otroResp2;
  assert.equal((await call(update, "jefeA", { responsableId: users.responsable.id })).error, null, "update: asignar");
  project.responsableId = users.responsable.id;
  assert.equal((await call(update, "jefeA", { responsableId: users.otroResp2.id })).error, null, "update: cambiar");
  assert.equal((await call(update, "jefeA", { responsableId: null })).error, null, "update: quitar");
  fresh();
  assert.equal((await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: users.responsable.id })).error, null, "transition: asignar");
  project.responsableId = users.responsable.id;
  assert.equal((await call(transition, "jefeA", { estado: "En_evaluacion", responsableId: null })).error, null, "transition: quitar");
  fresh({ responsableId: users.responsable.id });
  assert.equal((await call(update, "jefeA", { areaId: area.B })).error, null, "update: mover de área con responsable");
  const iniciativaService = (await import("../services/iniciativa.service.js")).iniciativaService as any;
  iniciativaService.create = async (d: any) => ({ id: id(202), codigo: "INV-202", ...d });
  const body = { titulo: "Proyecto propio", descripcion: "Descripción suficientemente larga", areaId: area.A, impacto: 5, esfuerzo: "Bajo", responsableId: users.responsable.id };
  assert.equal((await call(create, "jefeA", body, {})).error, null, "crear derivando en su propia área");
});

test("Admin global SIGUE derivando en cualquier área, y el técnico sigue sin poder", async () => {
  fresh();
  assert.equal((await call(transition, "adminGlobal", { estado: "En_evaluacion", responsableId: users.responsable.id })).error, null);
  project.responsableId = users.responsable.id;
  assert.equal((await call(update, "adminGlobal", { responsableId: null })).error, null);
  fresh({ responsableId: users.responsable.id });
  assert.match((await call(update, "tecnico", { areaId: area.B })).error.message, /pueden derivar/);
});
