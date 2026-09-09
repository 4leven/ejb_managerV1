// Importa el histórico de "AGENDA_EJB_MANAGER_GESTION_COMPLETA.xlsx" (hojas Clientes + Ticketera_Importar)
// hacia la Ticketera real de EJB Manager, reutilizando Cliente/Ticket/TicketHistorial existentes.
//
// Uso:
//   node scripts/import-ticketera-legacy.mjs                  -> dry run (no escribe nada, solo reporta)
//   node scripts/import-ticketera-legacy.mjs --commit          -> ejecuta la importación real
//   node scripts/import-ticketera-legacy.mjs --commit --file=scripts/data/otro.xlsx
//
// Variables de entorno:
//   IMPORT_ACTOR_EMAIL  cuenta EJB Manager que queda como creadora de los tickets importados
//                        (por defecto santiago241200@gmail.com)
import "dotenv/config";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const fileArg = args.find((a) => a.startsWith("--file="));
const filePath = fileArg
  ? fileArg.slice("--file=".length)
  : fileURLToPath(new URL("./data/AGENDA_EJB_MANAGER_GESTION_COMPLETA.xlsx", import.meta.url));

const ORIGEN = "EXCEL_AGENDA_2026";
const ORIGEN_REF_PREFIX = "EXCEL-AGENDA-2026-";

// Debe mantenerse en sincronía con backend/src/constants/ticket.ts (TICKET_MODULES).
// Se copia aquí para que este script pueda ejecutarse con Node plano, sin pasar por el compilador de TypeScript.
const TICKET_MODULES = [
  "EJBPLANILLAS",
  "EJBCONTABLE",
  "EJBERP",
  "EJBCOMERCIAL",
  "EJBCONTRATOS",
  "EJBPAGOS",
  "EJBFACTURACIÓN",
  "EJBACTIVO FIJOS",
  "ROBOTS",
];

// EJB ACTIVOS no tiene equivalente exacto en TICKET_MODULES; se mapea al módulo existente más cercano.
const MODULE_MAP = {
  "EJB CONTABLE": "EJBCONTABLE",
  "EJB COMERCIAL": "EJBCOMERCIAL",
  "EJB PAGOS": "EJBPAGOS",
  "EJB PLANILLAS": "EJBPLANILLAS",
  "EJB ACTIVOS": "EJBACTIVO FIJOS",
};

const RESULTADO_MAP = {
  ATENDIDO: "ATENDIDO",
  BLOQUEADO: "BLOQUEADO",
  "EN ATENCION": "EN_ATENCION",
  PENDIENTE: "PENDIENTE",
  "SIN RESPUESTA": "SIN_RESPUESTA",
  "USUARIO NO DISPONIBLE": "USUARIO_NO_DISPONIBLE",
  "NO EXISTE EL NÚMERO": "NO_EXISTE_NUMERO",
  "NO EXISTE EL NUMERO": "NO_EXISTE_NUMERO",
};

const ESTADOS_VALIDOS = new Set(["PENDIENTE", "EN_CURSO", "FINALIZADO"]);

const norm = (value) => String(value ?? "").trim();
const orNull = (value) => {
  const v = norm(value);
  return v === "" ? null : v;
};

// Excel guarda fechas como número de serie desde 1899-12-30 (epoch compatible con el bug de año bisiesto de 1900).
function excelSerialToDate(serial) {
  if (serial === undefined || serial === null || serial === "") return null;
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
}

function parseTimeParts(raw) {
  const text = norm(raw);
  if (!text) return null;
  let s = text.replace(/_/g, ":").replace(/\./g, ":");
  const ampm = /am|pm/i.exec(s)?.[0]?.toLowerCase();
  s = s.replace(/\s*[ap]m/i, "");
  const m = /^(\d{1,2}):?(\d{2})?/.exec(s);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function combineDateTime(dateSerial, timeRaw) {
  const date = excelSerialToDate(dateSerial);
  if (!date) return null;
  const parts = parseTimeParts(timeRaw);
  const result = new Date(date);
  if (parts) result.setUTCHours(parts.hour, parts.minute, 0, 0);
  else result.setUTCHours(0, 0, 0, 0);
  return result;
}

function mapModulo(raw) {
  const value = norm(raw).toUpperCase();
  const mapped = MODULE_MAP[value];
  if (mapped && TICKET_MODULES.includes(mapped)) return mapped;
  return null;
}

function mapResultado(raw) {
  const value = norm(raw).toUpperCase();
  if (!value) return null;
  return RESULTADO_MAP[value] ?? value.replace(/\s+/g, "_");
}

function readSheet(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`No se encontró la hoja "${name}" en el archivo.`);
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
}

async function resolveCliente(tx, { ruc, razonSocial, telefono }, stats) {
  const rucClean = orNull(ruc);
  const nombre = norm(razonSocial);
  if (rucClean) {
    let cliente = await tx.cliente.findUnique({ where: { ruc: rucClean } });
    if (cliente) return cliente;
    cliente = await tx.cliente.findUnique({ where: { razonSocial: nombre } });
    if (cliente) return cliente;
    cliente = await tx.cliente.create({
      data: { ruc: rucClean, razonSocial: nombre, telefono: orNull(telefono) },
    });
    stats.clientesCreados++;
    return cliente;
  }
  let cliente = await tx.cliente.findUnique({ where: { razonSocial: nombre } });
  if (cliente) return cliente;
  cliente = await tx.cliente.create({
    data: { ruc: null, razonSocial: nombre, telefono: orNull(telefono) },
  });
  stats.clientesCreados++;
  return cliente;
}

async function resolveContacto(tx, clienteId, { nombre, telefono }, stats) {
  const nombreClean = orNull(nombre);
  const telefonoClean = orNull(telefono);
  if (!nombreClean && !telefonoClean) return null;
  let contacto = await tx.clienteContacto.findFirst({
    where: { clienteId, nombre: nombreClean, telefono: telefonoClean },
  });
  if (contacto) return contacto;
  contacto = await tx.clienteContacto.create({
    data: { clienteId, nombre: nombreClean, telefono: telefonoClean },
  });
  stats.contactosCreados++;
  return contacto;
}

class DryRunAbort extends Error {}

async function main() {
  console.log(`Archivo: ${filePath}`);
  console.log(`Modo: ${COMMIT ? "COMMIT (se escribirá en la base de datos)" : "DRY RUN (no se escribe nada)"}`);

  const actorEmail = (process.env.IMPORT_ACTOR_EMAIL || "santiago241200@gmail.com").toLowerCase();
  const actor = await prisma.usuario.findUnique({ where: { email: actorEmail } });
  if (!actor) {
    throw new Error(
      `No existe una cuenta EJB Manager con el correo ${actorEmail}. Ajusta IMPORT_ACTOR_EMAIL o crea la cuenta antes de importar.`,
    );
  }
  console.log(`Los tickets importados quedarán registrados por: ${actor.nombres} ${actor.apellidos} <${actor.email}>`);

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const clientesRows = readSheet(workbook, "Clientes");
  const ticketRows = readSheet(workbook, "Ticketera_Importar");
  console.log(`Hoja Clientes: ${clientesRows.length} filas. Hoja Ticketera_Importar: ${ticketRows.length} filas.`);

  const stats = { clientesCreados: 0, contactosCreados: 0, ticketsCreados: 0, ticketsOmitidos: 0, errores: [] };

  // 1) Maestro de clientes (hoja "Clientes"): upsert por RUC, nunca se sobrescribe un cliente existente.
  //    Cada fila es independiente: un error puntual no debe impedir importar el resto.
  for (const row of clientesRows) {
    try {
      const ruc = orNull(row.ruc);
      const razonSocial = norm(row.razon_social);
      if (!ruc || !razonSocial) continue;
      const existing = await prisma.cliente.findUnique({ where: { ruc } });
      if (existing) continue;
      const byName = await prisma.cliente.findUnique({ where: { razonSocial } });
      if (byName) continue;
      if (COMMIT) {
        await prisma.cliente.create({ data: { ruc, razonSocial } });
      }
      stats.clientesCreados++;
    } catch (error) {
      stats.errores.push({ idImportacion: `clientes:${row.ruc}`, message: error.message });
    }
  }

  // 2) Tickets históricos (hoja "Ticketera_Importar").
  //    Cada fila corre en su propia transacción: si una fila falla a nivel de base de datos,
  //    no debe arrastrar (ni abortar) las transacciones de las demás filas.
  for (const row of ticketRows) {
    const idImportacion = norm(row.id_importacion);
    const origenRef = `${ORIGEN_REF_PREFIX}${idImportacion}`;
    try {
      if (!idImportacion) throw new Error("Fila sin id_importacion, se omite.");

      const already = await prisma.ticket.findUnique({ where: { origenRef } });
      if (already) {
        stats.ticketsOmitidos++;
        continue;
      }

      const registradoAt = combineDateTime(row.fecha_registro, row.hora_registro);
      if (!registradoAt) throw new Error("Falta fecha_registro, no se puede importar sin fecha.");

      const estado = norm(row.estado_web).toUpperCase();
      if (!ESTADOS_VALIDOS.has(estado)) throw new Error(`estado_web desconocido: "${row.estado_web}"`);

      const modulo = mapModulo(row.modulo);
      if (!modulo) throw new Error(`Módulo sin mapeo conocido: "${row.modulo}"`);

      const contactadoAt = combineDateTime(row.fecha_contacto, row.hora_contacto);
      const intentos = norm(row.intentos_contacto);
      const intentosContacto = intentos && Number.isFinite(Number(intentos)) ? Math.trunc(Number(intentos)) : null;

      await prisma.$transaction(async (tx) => {
        const cliente = await resolveCliente(
          tx,
          { ruc: row.ruc, razonSocial: row.razon_social, telefono: row.telefono },
          stats,
        );
        const contactoRegistro = await resolveContacto(
          tx,
          cliente.id,
          { nombre: row.contacto, telefono: row.telefono },
          stats,
        );

        const ticket = await tx.ticket.create({
          data: {
            clienteId: cliente.id,
            ruc: cliente.ruc,
            razonSocial: norm(row.razon_social),
            modulo,
            telefono: orNull(row.telefono),
            contacto: orNull(row.contacto),
            contactoId: contactoRegistro?.id ?? null,
            consulta: orNull(row.consulta),
            estado,
            creadoPorId: actor.id,
            registradoAt,
            asignadoAId: null,
            contactadoAt,
            observaciones: orNull(row.observacion),
            finalizadoAt: estado === "FINALIZADO" ? (contactadoAt ?? null) : null,
            finalizadoPorId: null,
            resultadoContacto: mapResultado(row.gestion_real),
            atendidoPorNombre: orNull(row.atendido_por),
            intentosContacto,
            origen: ORIGEN,
            origenRef,
          },
        });

        await tx.ticketHistorial.create({
          data: {
            ticketId: ticket.id,
            accion: "Importado desde agenda histórica (Excel)",
            estadoNuevo: estado,
            usuarioId: actor.id,
            metadata: {
              idImportacion,
              gestionReal: orNull(row.gestion_real),
              atendidoPor: orNull(row.atendido_por),
              fuente: "AGENDA_EJB_MANAGER_GESTION_COMPLETA.xlsx",
            },
          },
        });

        if (!COMMIT) {
          // Fuerza rollback de esta fila: se ejecutó para validar, pero no se persiste.
          throw new DryRunAbort();
        }
      }, { timeout: 30000, maxWait: 10000 });

      stats.ticketsCreados++;
    } catch (error) {
      if (error instanceof DryRunAbort) {
        stats.ticketsCreados++;
        continue;
      }
      stats.errores.push({ idImportacion, message: error.message });
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`Clientes creados: ${stats.clientesCreados}`);
  console.log(`Contactos creados: ${stats.contactosCreados}`);
  console.log(`Tickets creados: ${stats.ticketsCreados}`);
  console.log(`Tickets ya existentes (omitidos por reimportación): ${stats.ticketsOmitidos}`);
  console.log(`Filas con error: ${stats.errores.length}`);
  if (stats.errores.length) {
    console.log("--- Detalle de errores ---");
    for (const e of stats.errores) console.log(`  id_importacion=${e.idImportacion}: ${e.message}`);
  }
  if (!COMMIT) {
    console.log(
      "\nDRY RUN: no se escribió nada (cada fila corrió en una transacción que se revirtió). " +
        "Los conteos de clientes/contactos son aproximados porque, al revertirse cada fila, la deduplicación " +
        "entre filas no aplica igual que en una corrida real. Lo importante de este modo es la lista de errores. " +
        "Vuelve a ejecutar con --commit para aplicar los cambios.",
    );
  }
}

main()
  .catch((error) => {
    console.error("Importación abortada:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
