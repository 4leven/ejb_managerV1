import "dotenv/config";
import { PrismaClient as PostgresClient, Prisma as PostgresPrisma } from "@prisma/client";
import { PrismaClient as SqlServerClient } from "../generated/sqlserver-client/index.js";

const targetUrl = process.env.MSSQL_DATABASE_URL;
if (!targetUrl) {
  throw new Error("Falta MSSQL_DATABASE_URL en el entorno.");
}

const sourceUrl = process.env.POSTGRES_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceUrl?.startsWith("postgres")) {
  throw new Error("Falta POSTGRES_DATABASE_URL (origen PostgreSQL) en el entorno.");
}

const source = new PostgresClient({ datasourceUrl: sourceUrl });
const target = new SqlServerClient({ datasourceUrl: targetUrl });

const jsonFields = new Map([
  ["Usuario", new Set(["permisos", "notificationPreferences"])],
  ["TicketHistorial", new Set(["metadata"])],
  ["RegistroPortal", new Set(["datos"])],
  ["TareaIniciativa", new Set(["adjuntos"])],
  ["SolicitudCambio", new Set(["payload", "snapshot", "etapas", "decisiones"])],
  ["Notificacion", new Set(["datos"])],
]);

const models = PostgresPrisma.dmmf.datamodel.models;

function delegateName(modelName) {
  return modelName[0].toLowerCase() + modelName.slice(1);
}

function scalarData(model, row) {
  const json = jsonFields.get(model.name) ?? new Set();
  return Object.fromEntries(
    model.fields
      .filter((field) => field.kind !== "object")
      .filter((field) => Object.prototype.hasOwnProperty.call(row, field.name))
      .map((field) => {
        const value = row[field.name];
        if (json.has(field.name) && value !== null && value !== undefined) {
          return [field.name, JSON.stringify(value)];
        }
        return [field.name, value];
      }),
  );
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value?.toFixed === "function" && value?.constructor?.name === "Decimal") {
    return value.toFixed();
  }
  return `N'${String(value).replaceAll("'", "''")}'`;
}

async function insertTicketsWithIdentity(model, data) {
  const fields = model.fields.filter((field) => field.kind !== "object");
  const columns = fields.map((field) => `[${field.dbName ?? field.name}]`).join(", ");
  const inserts = data.map((row) => {
    const values = fields.map((field) => sqlLiteral(row[field.name])).join(", ");
    return `INSERT INTO dbo.tickets (${columns}) VALUES (${values});`;
  });
  await target.$executeRawUnsafe([
    "SET IDENTITY_INSERT dbo.tickets ON;",
    ...inserts,
    "SET IDENTITY_INSERT dbo.tickets OFF;",
  ].join("\n"));
}

async function main() {
  const occupied = await target.area.count();
  if (occupied > 0) {
    throw new Error("La base SQL Server no está vacía; se canceló para evitar duplicados.");
  }

  await target.$executeRawUnsafe("EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'");

  const counts = [];
  let completed = false;
  try {
    for (const model of models) {
      const delegate = delegateName(model.name);
      const rows = await source[delegate].findMany();
      const data = rows.map((row) => scalarData(model, row));

      if (model.name === "Ticket") {
        await insertTicketsWithIdentity(model, data);
      } else {
        for (let offset = 0; offset < data.length; offset += 100) {
          await target[delegate].createMany({ data: data.slice(offset, offset + 100) });
        }
      }

      counts.push({ model: model.name, rows: rows.length });
      console.log(`${model.name}: ${rows.length}`);
    }
    completed = true;
  } finally {
    if (completed) {
      await target.$executeRawUnsafe("EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'");
    }
  }

  for (const { model, rows } of counts) {
    const delegate = delegateName(model);
    const copied = await target[delegate].count();
    if (copied !== rows) {
      throw new Error(`${model}: PostgreSQL=${rows}, SQL Server=${copied}`);
    }
  }

  console.log(`Migración validada: ${counts.length} tablas.`);
}

try {
  await main();
} finally {
  await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
}
