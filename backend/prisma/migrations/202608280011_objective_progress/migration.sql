CREATE TABLE "objetivo_progresos" (
    "id" UUID NOT NULL,
    "objetivo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "comentario" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "objetivo_progresos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_objetivo_progresos_fecha" ON "objetivo_progresos"("objetivo_id", "created_at");
ALTER TABLE "objetivo_progresos" ADD CONSTRAINT "objetivo_progresos_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivos_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objetivo_progresos" ADD CONSTRAINT "objetivo_progresos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
