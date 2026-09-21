import assert from "node:assert/strict";
import test from "node:test";
import { TICKET_CHANNELS, TICKET_DESTINATION_AREAS, TICKET_MODULES } from "./ticket.js";

test("el catálogo único conserva exactamente los módulos aprobados", () => {
  assert.deepEqual([...TICKET_MODULES], [
    "EJBPLANILLAS",
    "EJBCONTABLE",
    "EJBERP",
    "EJBCOMERCIAL",
    "EJBCONTRATOS",
    "EJBPAGOS",
    "EJBFACTURACIÓN",
    "EJBACTIVO FIJOS",
    "ROBOTS",
  ]);
});

test("el catálogo operativo solo expone los canales requeridos", () => {
  assert.deepEqual([...TICKET_CHANNELS], ["TELEFONO", "WHATSAPP", "CORREO", "OTRO"]);
});

test("la Ticketera conserva únicamente las áreas de destino aprobadas", () => {
  assert.deepEqual([...TICKET_DESTINATION_AREAS], ["Ventas", "Instalación", "Consultoría"]);
});
