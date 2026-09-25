import "dotenv/config";
import { PrismaClient as SqlServerClient, Prisma } from "../generated/sqlserver-client/index.js";

const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl) {
  throw new Error("Falta TARGET_DATABASE_URL en el entorno (cadena SQL Server del servidor destino).");
}

const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceUrl?.startsWith("sqlserver")) {
  throw new Error("Falta SOURCE_DATABASE_URL (o DATABASE_URL) apuntando al SQL Server de origen.");
}

const source = new SqlServerClient({ datasourceUrl: sourceUrl });
const target = new SqlServerClient({ datasourceUrl: targetUrl });

const models = Prisma.dmmf.datamodel.models;

function delegateName(modelName) {
  return modelName[0].toLowerCase() + modelName.slice(1);
}

function scalarData(model, row) {
  return Object.fromEntries(
    model.fields
      .filter((field) => field.kind !== "object")
      .filter((field) => Object.prototype.hasOwnProperty.call(row, field.name))
      .map((field) => [field.name, row[field.name]]),
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
    throw new Error("La base SQL Server destino no está vacía; se canceló para evitar duplicados.");
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
        if (data.length > 0) await insertTicketsWithIdentity(model, data);
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
      throw new Error(`${model}: origen=${rows}, destino=${copied}`);
    }
  }

  console.log(`Migración validada: ${counts.length} tablas.`);
}

try {
  await main();
} finally {
  await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
}
