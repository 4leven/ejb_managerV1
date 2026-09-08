INSERT INTO "areas" ("id", "nombre", "color_hex", "created_at")
VALUES (gen_random_uuid(), 'Sistemas', '#2563EB', CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO UPDATE SET "color_hex" = EXCLUDED."color_hex";
