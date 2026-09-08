CREATE TABLE IF NOT EXISTS "registros_portal" (
  "id" UUID NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "datos" JSONB NOT NULL,
  "creador_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registros_portal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "registros_portal_tipo_created_at_idx" ON "registros_portal"("tipo", "created_at");
DO $$ BEGIN
  ALTER TABLE "registros_portal" ADD CONSTRAINT "registros_portal_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
