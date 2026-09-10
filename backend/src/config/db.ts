import { PrismaClient as PrismaContract } from '@prisma/client';
import { PrismaClient as SqlServerClient } from '../../generated/sqlserver-client/index.js';

const jsonFields = new Set([
  'permisos',
  'notificationPreferences',
  'metadata',
  'datos',
  'adjuntos',
  'payload',
  'snapshot',
  'etapas',
  'decisiones',
]);

function serializeJsonFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializeJsonFields);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (jsonFields.has(key) && item !== null && item !== undefined && typeof item !== 'string') {
      return [key, JSON.stringify(item)];
    }
    return [key, serializeJsonFields(item)];
  }));
}

function parseJsonFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(parseJsonFields);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (jsonFields.has(key) && typeof item === 'string') {
      try {
        return [key, JSON.parse(item)];
      } catch {
        return [key, item];
      }
    }
    return [key, parseJsonFields(item)];
  }));
}

function serializeMutationArgs(args: unknown): unknown {
  if (!args || typeof args !== 'object') return args;
  const record = args as Record<string, unknown>;
  return {
    ...record,
    ...(Object.prototype.hasOwnProperty.call(record, 'data')
      ? { data: serializeJsonFields(record.data) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(record, 'create')
      ? { create: serializeJsonFields(record.create) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(record, 'update')
      ? { update: serializeJsonFields(record.update) }
      : {}),
  };
}

function normalizeSqlServerFilters(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSqlServerFilters);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'mode')
      .map(([key, item]) => [key, normalizeSqlServerFilters(item)]),
  );
}

const sqlServer = new SqlServerClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const normalized = normalizeSqlServerFilters(args);
        const result = await query(serializeMutationArgs(normalized) as typeof args);
        return parseJsonFields(result);
      },
    },
  },
});

// Conserva el contrato público existente (enums y campos JSON) mientras el
// cliente físico usa SQL Server, evitando cambios en controladores y servicios.
export const prisma = sqlServer as unknown as PrismaContract;
