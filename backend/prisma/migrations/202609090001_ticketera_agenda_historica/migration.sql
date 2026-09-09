-- Relaja restricciones NOT NULL en tickets para admitir registros históricos importados
-- (el formulario web sigue exigiendo estos campos vía validación zod en el controlador).
ALTER TABLE "tickets" ALTER COLUMN "ruc" DROP NOT NULL;
ALTER TABLE "tickets" ALTER COLUMN "contacto" DROP NOT NULL;
ALTER TABLE "tickets" ALTER COLUMN "consulta" DROP NOT NULL;

-- Campos nuevos para trazabilidad de la importación histórica y del contacto real de la llamada.
ALTER TABLE "tickets" ADD COLUMN "resultado_contacto" VARCHAR(40);
ALTER TABLE "tickets" ADD COLUMN "atendido_por_nombre" VARCHAR(120);
ALTER TABLE "tickets" ADD COLUMN "intentos_contacto" INTEGER;
ALTER TABLE "tickets" ADD COLUMN "origen" VARCHAR(40);
ALTER TABLE "tickets" ADD COLUMN "origen_ref" VARCHAR(60);
ALTER TABLE "tickets" ADD COLUMN "contacto_id" UUID;
CREATE UNIQUE INDEX "tickets_origen_ref_key" ON "tickets"("origen_ref");

-- Maestro de contactos por cliente (un cliente puede tener varios contactos/teléfonos).
CREATE TABLE "cliente_contactos" ("id" UUID NOT NULL,"cliente_id" UUID NOT NULL,"nombre" VARCHAR(150),"telefono" VARCHAR(30),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "cliente_contactos_pkey" PRIMARY KEY ("id"));
CREATE INDEX "cliente_contactos_cliente_id_idx" ON "cliente_contactos"("cliente_id");
CREATE UNIQUE INDEX "cliente_contactos_cliente_id_nombre_telefono_key" ON "cliente_contactos"("cliente_id","nombre","telefono");
ALTER TABLE "cliente_contactos" ADD CONSTRAINT "cliente_contactos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "cliente_contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
