# Prompt para Codex — Mensajería avanzada + Huddles en EJB Chat

> Copia todo este documento tal cual y pégalo como instrucción a Codex dentro del repo `C:\Proyecto Innovation Hub`. Está escrito para que lo ejecute de punta a punta sin ambigüedad: incluye el contrato de datos, el contrato de API y los criterios de aceptación de cada feature.

---

## 0. Rol y forma de trabajar

Eres un ingeniero full-stack senior trabajando directamente sobre este repositorio. No es un ejercicio ni un mockup: cada feature debe quedar **100% operativa de punta a punta** (base de datos → API → UI), no solo maquetada. Trabaja en el orden de las fases indicado más abajo, y al terminar cada fase corre las verificaciones que se piden antes de pasar a la siguiente. Si algo del código existente no coincide con lo que este documento asume, detente, inspecciona el archivo real y ajusta tu implementación a lo que encuentres — no asumas.

## 1. Contexto del proyecto

Monorepo pnpm con dos paquetes:

- `backend/`: Express 4 + TypeScript + Prisma 6.5 + PostgreSQL 16 (`tsx watch src/server.ts` en dev). Autenticación por JWT (`Authorization: Bearer <token>`) vía `requireAuth` en `src/middlewares/auth.ts`, que setea `req.userId`.
- `frontend/`: React 19 + TypeScript + Vite. Sin router ni librería de estado: `App.tsx` es un componente monolítico que controla la navegación por estado (`page`). El chat vive en `frontend/src/components/Messages.tsx` (~1600 líneas) y `frontend/src/components/CollaborationModules.tsx` (grupos/canales/firma/encuestas). El estilo visual del chat vive en `frontend/src/google-chat-theme.css` (ya aplicado, no lo toques salvo que una feature nueva necesite clases nuevas — en ese caso sigue el mismo sistema de tokens `--gc-*` ya definido ahí).

Archivos clave que ya existen y debes extender (no reescribir desde cero):

```
backend/prisma/schema.prisma
backend/src/controllers/mensaje.controller.ts
backend/src/routes/mensaje.routes.ts
backend/src/server.ts
frontend/src/components/Messages.tsx
frontend/src/components/CollaborationModules.tsx
frontend/src/api/iniciativas.ts   (aquí viven las funciones fetch* del frontend, agrega las nuevas siguiendo el mismo patrón: authHeaders(), expectJson(), etc.)
```

El modelo `Mensaje` actual (mensajes directos 1:1) es:

```prisma
model Mensaje {
  id             String      @id @default(uuid()) @db.Uuid
  remitenteId    String      @map("remitente_id") @db.Uuid
  destinatarioId String      @map("destinatario_id") @db.Uuid
  contenido      String      @db.VarChar(2000)
  tipo           TipoMensaje @default(Texto)   // Texto | Documento | Sticker
  archivoNombre  String?     @map("archivo_nombre") @db.VarChar(255)
  archivoMime    String?     @map("archivo_mime") @db.VarChar(120)
  archivoData    String?     @map("archivo_data")
  leidoAt        DateTime?   @map("leido_at")
  createdAt      DateTime    @default(now()) @map("created_at")
  remitente      Usuario     @relation("MensajesEnviados", fields: [remitenteId], references: [id], onDelete: Cascade)
  destinatario   Usuario     @relation("MensajesRecibidos", fields: [destinatarioId], references: [id], onDelete: Cascade)
}
```

Los grupos/canales NO usan tablas propias: son filas de `RegistroPortal` (`tipo: "grupo" | "canal"`) con los mensajes guardados dentro del JSON `datos.mensajes[]`. Eso ya soporta `respuestaA` (cita) y una reacción `👍` hardcodeada — lo dejamos así (no migres los espacios a tablas relacionales, no es parte de este alcance).

## 2. Reglas no negociables

1. **No rompas nada que ya funciona.** Antes de tocar `mensaje.controller.ts` o `Messages.tsx`, léelos completos. Los endpoints y clases CSS existentes deben seguir funcionando igual.
2. **Migraciones versionadas de verdad**: usa `pnpm --filter backend prisma:migrate` (o `npx prisma migrate dev --name <nombre_descriptivo>`) para cada cambio de esquema. Nunca edites a mano una migración ya aplicada.
3. **Sigue las convenciones ya usadas**: nombres de modelos/campos en español, `@map` a snake_case, Zod para validar body en cada controller, `next(e)` en los catch, mismo estilo de respuesta JSON.
4. **Tipado estricto** — no introduzcas `any` salvo que el archivo ya lo use en ese mismo patrón.
5. **Prueba cada endpoint** antes de darlo por terminado (con `curl`, un script en `backend/scripts/`, o el smoke test que ya existe en `backend/scripts/approval-smoke.mjs` como referencia de estilo). No entregues nada con `// TODO` ni datos simulados.
6. **Reusa el sistema visual existente**: toda UI nueva debe usar las clases y variables `--gc-*` de `google-chat-theme.css` (colores, radios, tipografía) para verse como el resto del chat, no un componente aparte con su propio estilo.
7. Al terminar cada fase, deja un resumen corto de qué endpoints/archivos tocaste y cómo verificarlo manualmente.

## 3. Alcance de esta tarea

**Fase 1 — Mensajería avanzada** (no requiere infraestructura nueva, todo corre con lo que ya tienes):
1. Hilos / responder a un mensaje directo
2. Reacciones con emoji (reales, no solo 👍)
3. Reenviar mensajes
4. Mensajes programados (enviar más tarde) + borradores
5. Smart chips (menciones e iniciativas referenciadas)
6. Búsqueda dentro del contenido de los mensajes

**Fase 2 — Huddles (llamadas de audio/video)** vía LiveKit, una vez que la Fase 1 esté probada y funcionando.

No están en el alcance (quedan fuera a propósito): asistente de IA tipo "Ask Gemini", traducción automática, cuentas de invitado externas, moderación/DLP.

---

## FASE 1 — Mensajería avanzada

### 1.1 Cambios de esquema (`backend/prisma/schema.prisma`)

Extiende el modelo `Mensaje` y agrega dos modelos nuevos. Respeta exactamente estos nombres y mapeos:

```prisma
model Mensaje {
  id             String      @id @default(uuid()) @db.Uuid
  remitenteId    String      @map("remitente_id") @db.Uuid
  destinatarioId String      @map("destinatario_id") @db.Uuid
  contenido      String      @db.VarChar(2000)
  tipo           TipoMensaje @default(Texto)
  archivoNombre  String?     @map("archivo_nombre") @db.VarChar(255)
  archivoMime    String?     @map("archivo_mime") @db.VarChar(120)
  archivoData    String?     @map("archivo_data")
  leidoAt        DateTime?   @map("leido_at")
  createdAt      DateTime    @default(now()) @map("created_at")

  // NUEVO — hilos/respuestas
  respuestaAId   String?     @map("respuesta_a_id") @db.Uuid
  respuestaA     Mensaje?    @relation("MensajeRespuesta", fields: [respuestaAId], references: [id], onDelete: SetNull)
  respuestas     Mensaje[]   @relation("MensajeRespuesta")

  // NUEVO — reenvío
  reenviadoDeId  String?     @map("reenviado_de_id") @db.Uuid
  reenviadoDe    Mensaje?    @relation("MensajeReenvio", fields: [reenviadoDeId], references: [id], onDelete: SetNull)
  reenvios       Mensaje[]   @relation("MensajeReenvio")

  reacciones     MensajeReaccion[]
  remitente      Usuario     @relation("MensajesEnviados", fields: [remitenteId], references: [id], onDelete: Cascade)
  destinatario   Usuario     @relation("MensajesRecibidos", fields: [destinatarioId], references: [id], onDelete: Cascade)

  @@index([remitenteId, destinatarioId, createdAt], map: "idx_mensajes_conversacion")
  @@index([destinatarioId, leidoAt], map: "idx_mensajes_no_leidos")
  @@map("mensajes")
}

model MensajeReaccion {
  id        String   @id @default(uuid()) @db.Uuid
  mensajeId String   @map("mensaje_id") @db.Uuid
  usuarioId String   @map("usuario_id") @db.Uuid
  emoji     String   @db.VarChar(8)
  createdAt DateTime @default(now()) @map("created_at")
  mensaje   Mensaje  @relation(fields: [mensajeId], references: [id], onDelete: Cascade)
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@unique([mensajeId, usuarioId, emoji])
  @@map("mensaje_reacciones")
}

model MensajeProgramado {
  id             String      @id @default(uuid()) @db.Uuid
  remitenteId    String      @map("remitente_id") @db.Uuid
  destinatarioId String      @map("destinatario_id") @db.Uuid
  contenido      String      @db.VarChar(2000)
  tipo           TipoMensaje @default(Texto)
  archivoNombre  String?     @map("archivo_nombre") @db.VarChar(255)
  archivoMime    String?     @map("archivo_mime") @db.VarChar(120)
  archivoData    String?     @map("archivo_data")
  enviarEn       DateTime    @map("enviar_en")
  enviadoAt      DateTime?   @map("enviado_at")
  createdAt      DateTime    @default(now()) @map("created_at")
  remitente      Usuario     @relation("MensajesProgramados", fields: [remitenteId], references: [id], onDelete: Cascade)

  @@index([enviarEn, enviadoAt], map: "idx_programados_pendientes")
  @@map("mensajes_programados")
}
```

Agrega a `model Usuario` las relaciones inversas correspondientes: `reaccionesMensaje MensajeReaccion[]` y `mensajesProgramados MensajeProgramado[] @relation("MensajesProgramados")`.

Corre la migración: `pnpm --filter backend exec prisma migrate dev --name mensajeria_avanzada`.

### 1.2 Hilos / responder a un mensaje directo

- `POST /api/mensajes/:userId` (extender `send` en `mensaje.controller.ts`): el body ahora acepta `respuestaAId?: string (uuid)`. Si viene, valida con Prisma que ese mensaje exista y pertenezca a la misma conversación (remitente/destinatario coinciden con los dos usuarios de este chat) — si no, `400`.
- `GET /api/mensajes/:userId` (extender `thread`): incluye `respuestaA` con un `select` mínimo (`id, contenido, tipo, remitenteId, createdAt`) para poder pintar la cita sin una segunda llamada.
- Frontend (`Messages.tsx`): agrega el mismo patrón que ya existe para `spaceReply` (`spaceDraft`, `composer-reply`, botón "Responder" en `chat-context-actions`) pero para mensajes 1:1 — hoy ese botón de responder **no existe en los DMs**, solo en grupos/espacios. Añade estado `dmReply`, botón "Responder" en las acciones al hacer hover de cada mensaje, y una cita (`chat-reply-preview`, la clase ya existe en el CSS) arriba de la burbuja cuando el mensaje tiene `respuestaA`.

**Criterio de aceptación**: responder a un mensaje de una conversación 1:1 crea el mensaje con `respuestaAId` seteado, y la UI muestra la cita del mensaje original arriba del nuevo, de forma persistente (recargar la página y seguir viéndose).

### 1.3 Reacciones con emoji

- `POST /api/mensajes/:messageId/reacciones` — body `{ emoji: string }`. Comportamiento *toggle*: si el usuario actual ya reaccionó con ese mismo emoji a ese mensaje, la elimina; si no, la crea. Debes verificar que el usuario actual sea remitente o destinatario del mensaje (autorización).
- Extiende `GET /api/mensajes/:userId` para devolver, por mensaje, un resumen `reacciones: { emoji: string; count: number; mine: boolean }[]` (agrupado, no la lista cruda).
- Frontend: en `chat-context-actions` agrega un botón que abra un mini selector de emojis (un set fijo de 6-8: 👍 ❤️ 😂 😮 😢 🙏 🎉 ✅ es suficiente, no hace falta el picker completo) y pinta los chips de reacción debajo de la burbuja, clicables para sumar/quitar la propia.
- Para los mensajes de **grupos/canales** (que viven en el JSON de `RegistroPortal`), generaliza la reacción hardcodeada `👍` de `reactSpaceMessage` para aceptar cualquier emoji del mismo set, reusando la misma estructura `m.reacciones[emoji] = [usuarioId, ...]` que ya existe.

**Criterio de aceptación**: reaccionar y quitar la reacción funciona en DMs y en grupos/canales, persiste al recargar, y el contador de cada emoji es correcto con múltiples usuarios reaccionando.

### 1.4 Reenviar mensajes

- `POST /api/mensajes/:messageId/reenviar` — body `{ destinatarioIds: string[] }` (1 a N). Por cada `destinatarioId`: valida que exista y no sea el propio usuario, crea un nuevo `Mensaje` copiando `contenido/tipo/archivoNombre/archivoMime/archivoData` del original y seteando `reenviadoDeId` = id del mensaje original. Devuelve el array de mensajes creados.
- Frontend: botón "Reenviar" en `chat-context-actions` (DMs y grupos) que abre un selector simple con la lista de contactos (checkboxes, reusa `contacts`) y un botón "Enviar". Los mensajes reenviados muestran una etiqueta pequeña "Reenviado" arriba de la burbuja (usa `reenviadoDe` si lo incluyes en el `select`/`include` del `thread`).

**Criterio de aceptación**: reenviar un mensaje con documento/GIF adjunto lo reenvía con el archivo intacto, a uno o varios contactos a la vez, y la etiqueta "Reenviado" aparece en el mensaje resultante.

### 1.5 Mensajes programados (enviar más tarde)

- `POST /api/mensajes/:userId/programar` — body `{ contenido, tipo?, archivoNombre?, archivoMime?, archivoData?, enviarEn: string(ISO) }`. Valida `enviarEn` en el futuro (mínimo 1 minuto desde ahora). Crea `MensajeProgramado`.
- `GET /api/mensajes/programados` — lista los programados del usuario actual con `enviadoAt: null`, ordenados por `enviarEn asc`.
- `PATCH /api/mensajes/programados/:id` — edita `contenido`/`enviarEn` (solo si es dueño y `enviadoAt` sigue null).
- `DELETE /api/mensajes/programados/:id` — cancela (solo si es dueño y no se envió aún).
- **Scheduler**: agrega `backend/src/services/scheduler.ts` con un `setInterval` (cada 30s) que se arranca desde `server.ts` al iniciar el servidor. En cada tick: busca `MensajeProgramado` con `enviadoAt: null` y `enviarEn <= now`, crea el `Mensaje` real correspondiente, y marca `enviadoAt = now()`. Envuelve en try/catch con log — un error en un mensaje no debe tumbar el proceso ni bloquear los demás.
- Frontend: en el compositor (`chat-panel > form`), agrega un botón de reloj junto al de enviar que abre un mini date-time picker ("Enviar ahora" vs "Programar para..."). Agrega una vista "Programados" accesible desde `chat-shortcuts` (mismo patrón que Inicio/No leídos/Destacados) que lista los pendientes con opción de editar/cancelar.

**Criterio de aceptación**: programar un mensaje para dentro de 1-2 minutos, dejar la pestaña abierta, y verificar que aparece en la conversación como un mensaje normal exactamente cuando toca (con el backend corriendo) — sin recargar la página manualmente (el polling que ya existe en `Messages.tsx` para refrescar mensajes debe recogerlo).

### 1.6 Smart chips (menciones e iniciativas)

- Localiza la función `richText()` en `Messages.tsx` (ya convierte `@menciones` en `<mark className="chat-mention">`). Extiéndela para reconocer también un patrón de código de iniciativa (el mismo formato que `Iniciativa.codigo`, `@db.VarChar(10)` — revisa el formato real usado, p.ej. `IN-004`) dentro del texto del mensaje.
- Cuando detectes ese patrón, en vez de solo resaltarlo, conviértelo en un botón/chip inline que, al hacer clic, abra un popover con una vista previa (título, estado, avance %) consultando el endpoint que ya existe para iniciativas (revisa `frontend/src/api/iniciativas.ts` y el controller correspondiente — no crees un endpoint nuevo si ya hay uno que sirva un resumen por id/código).
- Para las `@menciones`, el chip debe abrir un popover con el nombre completo, cargo y estado del compañero (usa los datos que ya tienes en `contacts`, no hace falta llamar al backend de nuevo).

**Criterio de aceptación**: escribir un mensaje con `@NombreApellido` y con un código de iniciativa real lo convierte, al enviarse, en chips clicables con vista previa — sin romper el resaltado de menciones que ya funcionaba.

### 1.7 Búsqueda dentro de los mensajes

- `GET /api/mensajes/buscar?q=<texto>` — busca (case-insensitive, `contains`) dentro de `contenido` de todos los `Mensaje` donde el usuario actual es `remitenteId` o `destinatarioId`. Agrupa el resultado por la otra persona de la conversación, con un fragmento del mensaje, `createdAt` y `mensajeId`. Límite razonable (50 resultados).
- Frontend: el input `message-search` en `conversation-list` hoy solo filtra contactos por nombre. Si el texto no matchea ningún contacto, dispara la búsqueda de contenido y muestra los resultados agrupados por conversación debajo de la lista, con opción de hacer clic para abrir esa conversación y hacer scroll hasta el mensaje (agrega `data-message-id` a cada `<article>` de `.messages` y usa `scrollIntoView`).

**Criterio de aceptación**: buscar una palabra que solo aparece dentro del contenido de un mensaje viejo (no en ningún nombre de contacto) devuelve ese resultado y al hacer clic abre la conversación correcta con scroll al mensaje.

---

## FASE 2 — Huddles (llamadas de audio/video) con LiveKit

Solo empieza esta fase cuando la Fase 1 esté verificada.

### 2.1 Infraestructura

- Usa **LiveKit Cloud** (tier gratuito) para no montar servidor propio: crear proyecto en `cloud.livekit.io`, obtener `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` y agregarlos a `backend/.env` / `.env.example`.
  - Alternativa self-hosted (si se prefiere no depender de un tercero): agregar a `docker-compose.yml` un servicio `livekit` con la imagen `livekit/livekit-server:latest` en modo `--dev` para desarrollo local. Documenta ambas opciones en el `README.md`, pero implementa contra la variable de entorno `LIVEKIT_URL` para que el código sea agnóstico de cuál se usa.
- Backend: `pnpm --filter backend add livekit-server-sdk`.
- Frontend: `pnpm --filter frontend add livekit-client @livekit/components-react`.

### 2.2 Esquema

```prisma
model Huddle {
  id            String    @id @default(uuid()) @db.Uuid
  salaId        String    @unique @map("sala_id") @db.VarChar(80)
  contexto      String    @db.VarChar(20)    // 'dm' | 'grupo' | 'canal'
  contextoId    String    @map("contexto_id") @db.VarChar(80)  // el otro usuarioId si es 'dm', o el id del RegistroPortal si es grupo/canal
  iniciadoPorId String    @map("iniciado_por_id") @db.Uuid
  estado        String    @default("activa") @db.VarChar(20)   // 'activa' | 'finalizada'
  createdAt     DateTime  @default(now()) @map("created_at")
  finalizadaAt  DateTime? @map("finalizada_at")
  iniciadoPor   Usuario   @relation("HuddlesIniciados", fields: [iniciadoPorId], references: [id])

  @@index([contexto, contextoId, estado])
  @@map("huddles")
}
```

Migración: `prisma migrate dev --name huddles`.

### 2.3 Endpoints (`backend/src/controllers/huddle.controller.ts` + `huddle.routes.ts`, montado en `/api/huddles`)

- `POST /api/huddles` — body `{ contexto: 'dm'|'grupo'|'canal', contextoId: string }`. Si ya hay una `Huddle` `activa` para ese `(contexto, contextoId)`, únete a esa en vez de crear otra. Si no, crea una nueva con `salaId` único (`crypto.randomUUID()`), genera un `AccessToken` de LiveKit (`livekit-server-sdk`) con `identity: req.userId`, `room: salaId`, grants `roomJoin/canPublish/canSubscribe`. Responde `{ huddleId, salaId, token, livekitUrl }`.
- `POST /api/huddles/:id/unirse` — valida `estado: 'activa'`, genera token para `req.userId`, responde igual que arriba.
- `POST /api/huddles/:id/salir` — usa `RoomServiceClient` de `livekit-server-sdk` para listar participantes de la sala; si ya no queda nadie, marca `estado: 'finalizada'` y `finalizadaAt: now()`.
- `GET /api/huddles/activas?contexto=&contextoId=` — para que el frontend sepa si ya hay una llamada en curso en esa conversación específica.

### 2.4 Frontend

- Botones de llamada de audio y video en `.chat-panel > header` (DMs) y `.space-chat-header` (grupos/canales) — sigue el estilo de los otros botones de header (`wallpaper-button`, `space-settings-button`).
- Componente nuevo `frontend/src/components/Huddle.tsx`: ventana flotante (posición fija, esquina inferior derecha, redimensionable) que usa `livekit-client`/`@livekit/components-react` para conectarse con el token recibido; controles de silenciar, cámara, compartir pantalla y colgar. Reestílalo con los tokens `--gc-*` para que combine con el resto del chat en vez de usar el look por defecto de la librería.
- Detección de llamada entrante: reusa el mismo patrón de polling que ya existe en `MessageSpaceList` (`setInterval` cada 3-4s) para consultar `GET /api/huddles/activas` de la conversación abierta y, si hay una activa que el usuario no inició, mostrar un banner "Llamada en curso — Unirse".

> Nota para quien lea esto después: como la app no tiene WebSockets, esta notificación de llamada entrante depende del intervalo de polling (no es instantánea al milisegundo). Si más adelante se quiere un timbre inmediato de verdad, la mejora natural es sumar Socket.IO — queda fuera de esta tarea a propósito.

**Criterio de aceptación**: dos usuarios distintos (dos sesiones/navegadores) pueden iniciar una videollamada desde el mismo chat 1:1, verse y escucharse en tiempo real, silenciar/activar cámara, y colgar — y la fila `Huddle` queda marcada `finalizada` cuando ambos salen.

---

## 4. Definición de "hecho"

No des la tarea por terminada hasta que:

- [ ] `prisma migrate dev` corrió sin errores y `prisma studio` muestra las tablas nuevas.
- [ ] Cada endpoint nuevo fue probado con datos reales (no solo compilación exitosa).
- [ ] El chat existente (contactos, historial, gifs, documentos, grupos, canales, firma, encuestas, fondos) sigue funcionando exactamente igual que antes.
- [ ] La UI nueva usa los mismos tokens visuales (`--gc-*`) que el resto del chat — nada debería "desentonar".
- [ ] `backend`: `pnpm build` (tsc) compila sin errores. `frontend`: `pnpm build` (tsc -b && vite build) compila sin errores.
- [ ] Diste un resumen de qué se implementó, qué archivos se tocaron, y los pasos exactos para que alguien más lo pruebe manualmente.
