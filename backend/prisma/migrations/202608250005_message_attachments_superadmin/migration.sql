CREATE TYPE "TipoMensaje" AS ENUM ('Texto','Documento','Sticker');
ALTER TABLE "usuarios" ADD COLUMN "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mensajes"
  ADD COLUMN "tipo" "TipoMensaje" NOT NULL DEFAULT 'Texto',
  ADD COLUMN "archivo_nombre" VARCHAR(255),
  ADD COLUMN "archivo_mime" VARCHAR(120),
  ADD COLUMN "archivo_data" TEXT;

UPDATE "usuarios"
SET "is_super_admin"=true, "rol"='Admin'
WHERE lower("nombres") LIKE 'santiago%' AND lower("apellidos") LIKE '%villanueva%';
