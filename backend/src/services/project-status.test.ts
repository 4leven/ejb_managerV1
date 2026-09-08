import test from "node:test";
import assert from "node:assert/strict";
import { automaticProjectStatus, progressFromTasks } from "./project-status.js";

test("el avance de las tareas determina el porcentaje del proyecto", () => {
  assert.equal(progressFromTasks(4, 0, 80), 0);
  assert.equal(progressFromTasks(4, 1), 25);
  assert.equal(progressFromTasks(3, 2), 67);
  assert.equal(progressFromTasks(4, 4), 100);
});

test("un proyecto sin tareas conserva el ultimo avance manual", () => {
  assert.equal(progressFromTasks(0, 0, 86), 86);
  assert.equal(progressFromTasks(0, 0, 120), 100);
});

test("el estado cambia automaticamente con el avance", () => {
  assert.equal(automaticProjectStatus(0, "Pendiente"), "Pendiente");
  assert.equal(automaticProjectStatus(25, "Pendiente"), "En_desarrollo");
  assert.equal(automaticProjectStatus(100, "En_desarrollo"), "Finalizado");
  assert.equal(automaticProjectStatus(60, "Finalizado"), "En_desarrollo");
  assert.equal(automaticProjectStatus(0, "Finalizado"), "Pendiente");
  assert.equal(automaticProjectStatus(0, "Pendiente", true), "En_desarrollo");
});
