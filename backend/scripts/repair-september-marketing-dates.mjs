import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "../dist/config/db.js";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Indica la ruta del Excel de prospectos.");

const normalize = (value) => String(value ?? "").trim().toLocaleUpperCase("es-PE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
const identifier = (value) => String(value ?? "").replace(/\.0$/, "").trim();
const keyFor = ({ ruc, nombreCliente }) => ruc ? `RUC:${identifier(ruc)}` : `NOMBRE:${normalize(nombreCliente)}`;
const isoDay = (date, forcedMonth) => {
  const year = date.getUTCFullYear();
  const storedMonth = date.getUTCMonth() + 1;
  const storedDay = date.getUTCDate();
  const day = storedDay === forcedMonth && storedMonth !== forcedMonth ? storedMonth : storedDay;
  return `${year}-${String(forcedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const workbook = XLSX.read(await readFile(sourcePath), { type: "buffer", cellDates: true });
const sheet = workbook.Sheets.SETIEMBRE ?? workbook.Sheets.SEPTIEMBRE;
if (!sheet) throw new Error("El archivo no contiene una hoja SETIEMBRE o SEPTIEMBRE.");
const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
const headerIndex = grid.findIndex((row) => row.some((cell) => normalize(cell).replace(/[^A-Z0-9]/g, "") === "FECHADECONTACTO"));
if (headerIndex < 0) throw new Error("No se encontró el encabezado FECHA DE CONTACTO.");
const headers = grid[headerIndex].map((cell) => normalize(cell).replace(/[^A-Z0-9]/g, ""));
const column = (name) => headers.indexOf(name);
const dateColumn = column("FECHADECONTACTO");
const clientColumn = column("CLIENTE");
const rucColumn = column("RUC");
const companyColumn = column("EMPRESA");

const sourceRows = grid.slice(headerIndex + 1).flatMap((row, index) => {
  const rawDate = row[dateColumn];
  const name = String(row[clientColumn] || row[companyColumn] || "").trim();
  if (!(rawDate instanceof Date) || !name) return [];
  return [{ sourceRow: headerIndex + index + 2, nombreCliente: name, ruc: identifier(row[rucColumn]), desiredDate: isoDay(rawDate, 9) }];
});

const existing = await prisma.prospecto.findMany({
  where: { deletedAt: null, fechaContacto: { gte: new Date("2026-09-01T00:00:00Z"), lt: new Date("2026-10-01T00:00:00Z") } },
});
const existingByKey = new Map(existing.map((row) => [keyFor(row), row]));
const matches = sourceRows.map((source) => ({ source, row: existingByKey.get(keyFor(source)) })).filter((entry) => entry.row);
const missing = sourceRows.filter((source) => !existingByKey.has(keyFor(source)));
if (missing.length || matches.length !== existing.length) {
  throw new Error(`Reparación cancelada: ${matches.length} coincidencias, ${missing.length} filas sin coincidencia y ${existing.length} registros existentes.`);
}

const backupDirectory = resolve("backups");
await mkdir(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
const backupPath = resolve(backupDirectory, `marketing-setiembre-antes-${stamp}.json`);
await writeFile(backupPath, JSON.stringify(existing, null, 2), "utf8");

await prisma.$transaction(matches.map(({ source, row }) => prisma.prospecto.update({
  where: { id: row.id },
  data: { fechaContacto: new Date(`${source.desiredDate}T00:00:00Z`) },
})));

const repaired = await prisma.prospecto.findMany({
  where: { id: { in: matches.map(({ row }) => row.id) } },
  select: { fechaContacto: true },
});
const byDay = repaired.reduce((result, row) => {
  const date = row.fechaContacto.toISOString().slice(0, 10);
  result[date] = (result[date] ?? 0) + 1;
  return result;
}, {});
console.log(JSON.stringify({ updated: matches.length, backupPath, byDay }, null, 2));
await prisma.$disconnect();
