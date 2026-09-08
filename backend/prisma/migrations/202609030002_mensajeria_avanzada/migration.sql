ALTER TABLE "mensajes"
  ADD COLUMN "reenviado_de_id" UUID,
  ADD COLUMN "respuesta_a_id" UUID;

CREATE TABLE "mensaje_reacciones" (
  "id" UUID NOT NULL,
  "mensaje_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "emoji" VARCHAR(8) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensaje_reacciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mensajes_programados" (
  "id" UUID NOT NULL,
  "remitente_id" UUID NOT NULL,
  "destinatario_id" UUID NOT NULL,
  "contenido" VARCHAR(2000) NOT NULL,
  "tipo" "TipoMensaje" NOT NULL DEFAULT 'Texto',
  "archivo_nombre" VARCHAR(255),
  "archivo_mime" VARCHAR(120),
  "archivo_data" TEXT,
  "enviar_en" TIMESTAMP(3) NOT NULL,
  "enviado_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensajes_programados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mensaje_reacciones_mensaje_id_usuario_id_emoji_key"
  ON "mensaje_reacciones"("mensaje_id", "usuario_id", "emoji");
CREATE INDEX "idx_programados_pendientes"
  ON "mensajes_programados"("enviar_en", "enviado_at");

ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_respuesta_a_id_fkey"
  FOREIGN KEY ("respuesta_a_id") REFERENCES "mensajes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_reenviado_de_id_fkey"
  FOREIGN KEY ("reenviado_de_id") REFERENCES "mensajes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mensaje_reacciones" ADD CONSTRAINT "mensaje_reacciones_mensaje_id_fkey"
  FOREIGN KEY ("mensaje_id") REFERENCES "mensajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensaje_reacciones" ADD CONSTRAINT "mensaje_reacciones_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes_programados" ADD CONSTRAINT "mensajes_programados_remitente_id_fkey"
  FOREIGN KEY ("remitente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
