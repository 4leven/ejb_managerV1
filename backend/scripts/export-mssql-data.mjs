import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient as SqlServerClient, Prisma } from "../generated/sqlserver-client/index.js";

const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceUrl?.startsWith("sqlserver")) {
  throw new Error("Falta SOURCE_DATABASE_URL (o DATABASE_URL) apuntando al SQL Server de origen.");
}

const outPath = resolve(process.env.EXPORT_OUTPUT ?? "scripts/output/data-export.sql");
mkdirSync(dirname(outPath), { recursive: true });

const source = new SqlServerClient({ datasourceUrl: sourceUrl });
const models = Prisma.dmmf.datamodel.models;

function delegateName(modelName) {
  return modelName[0].toLowerCase() + modelName.slice(1);
}

function tableName(model) {
  return model.dbName ?? model.name;
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

function insertsFor(model, rows) {
  const fields = model.fields.filter((field) => field.kind !== "object");
  const columns = fields.map((field) => `[${field.dbName ?? field.name}]`).join(", ");
  const table = tableName(model);
  return rows.map((row) => {
    const values = fields.map((field) => sqlLiteral(row[field.name])).join(", ");
    return `INSERT INTO dbo.${table} (${columns}) VALUES (${values});`;
  });
}

async function main() {
  const lines = [
    "SET NOCOUNT ON;",
    "SET QUOTED_IDENTIFIER ON;",
    "",
    "BEGIN TRY",
    "BEGIN TRAN;",
    "",
    "EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';",
    "",
  ];

  const counts = [];
  for (const model of models) {
    const delegate = delegateName(model.name);
    const rows = await source[delegate].findMany();
    counts.push({ model: model.name, table: tableName(model), rows: rows.length });

    if (rows.length === 0) continue;

    lines.push(`-- ${model.name}: ${rows.length} filas`);
    if (model.name === "Ticket") {
      lines.push("SET IDENTITY_INSERT dbo.tickets ON;");
      lines.push(...insertsFor(model, rows));
      lines.push("SET IDENTITY_INSERT dbo.tickets OFF;");
    } else {
      lines.push(...insertsFor(model, rows));
    }
    lines.push("");
  }

  lines.push("EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';");
  lines.push("");
  lines.push("COMMIT TRAN;");
  lines.push("END TRY");
  lines.push("BEGIN CATCH");
  lines.push("IF @@TRANCOUNT > 0 ROLLBACK TRAN;");
  lines.push("THROW;");
  lines.push("END CATCH");

  // UTF-16LE con BOM: sqlcmd interpreta este formato de forma confiable como
  // texto Unicode; un .sql en UTF-8 puede leerse con la codepage equivocada
  // y corromper tildes/ñ al importar (bytes UTF-8 partidos en dos caracteres).
  writeFileSync(outPath, "﻿" + lines.join("\n"), "utf16le");

  console.log(`Exportado a: ${outPath}`);
  for (const { model, rows } of counts) console.log(`  ${model}: ${rows}`);
}

try {
  await main();
} finally {
  await source.$disconnect();
}
