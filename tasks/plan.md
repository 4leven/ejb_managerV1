# Plan: fixes QA/UX en EJB Manager (spec de Santi, 2026-09-22)

## Overview

Spec de 5 fases (15 puntos) para EJB Manager. Antes de escribir código verifiqué cada punto contra el código real (grep + lectura de archivos). Varios puntos **no coinciden exactamente** con lo que el spec asume — están anotados abajo. No se tocó ningún archivo de código todavía.

## Fase 0 del spec original — NO se ejecuta tal cual

El spec pide `git add . && git commit -m "..."` y luego crear ramas. Eso choca con la regla fija: *"Nunca hagas commit ni push. Yo reviso el git diff."* No voy a commitear nada por mi cuenta.

Tampoco voy a copiar `frontend/src` → `frontend/src_backup_qa` ni `backend/src` → `backend/src_backup_qa` (duplicar código fuente dentro del propio working tree es inusual, puede confundir al IDE/TS y terminar commiteado sin querer).

**Alternativa real de backup**, coherente con lo ya establecido en esta sesión:
- Rama de trabajo: `git checkout -b fix/functional-qa-and-ux-improvements` (sin commit previo — el estado actual ya está respaldado por git history y por la rama `backup-pre-ux-audit-2026` existente).
- Si quieres además un snapshot de archivos, puedo hacer un `git stash` con nombre o un zip fuera del repo — no una copia dentro de `src/`.

Ver **Pregunta abierta 1**.

## Hallazgos de la verificación (por ítem del spec)

| # | Ítem | Estado real encontrado |
|---|---|---|
| 1.1 | Modal "Guardar evento" inalcanzable | **Confirmado, aplicable tal cual.** `.event-modal` / `.event-grid` / `.event-modal-footer` existen en `EventCalendar.tsx` exactamente como el spec asume. Falta el `max-height`/`overflow`/`sticky` prescrito. |
| 1.2 | Botón fantasma de cabecera | **Diagnóstico distinto al del spec.** En `App.tsx` (~L2471-2489) el botón YA es contextual por página (`ticketera`→"Registrar caso", `calendario`→"Evento nuevo", se oculta en `mensajes`) — pero el **default** (`page !== "mensajes"`) muestra "Nueva iniciativa" en TODAS las demás páginas (equipo, aprobaciones, producto, administración, etc.), no solo en "iniciativas". Ese es el bug real. Además, "Registrar caso" no verifica `canRegisterTickets` — el frontend **no tiene ningún helper de permisos de ticketera** (`frontend/src/utils/access.ts` no tiene equivalente a `canViewTickets`/`canRegisterTickets`/`isTicketBoss` del backend). Para ocultarlo correctamente hay que exponer esa capacidad desde el backend (el `catalogs`/`resumen` de tickets no la trae hoy) o duplicar la lógica en el frontend — **requiere decisión**, ver Pregunta abierta 2. |
| 1.3 | Permisos de Ticketera para Ventas/Instalación | **El diagnóstico del spec es parcialmente incorrecto.** `canViewTickets` y `canRegisterTickets` (`backend/src/services/ticketing.ts`) YA incluyen un fallback por permiso (`hasPermission(actor,"verTicketera")` / `"registrarTickets"`) — no están limitados a Consultoría. El campo `areaDestino` (Ventas/Instalación/Consultoría) SÍ existe y está persistido en el Ticket (lo tenía mal documentado en el vault, ya corregido). El gap real: `isTicketBoss` (que da poderes de reasignar/reabrir/gestión total) exige `belongsToConsulting(actor) && cargo Jefe/Gerente` — un Jefe/Gerente de Ventas o Instalación NO cae ahí, y no hay filtrado por `areaDestino` en `list()` (quien ve tickets, ve TODOS, sin importar área). Ampliar `isTicketBoss` les daría poder de reasignar/reabrir tickets de Consultoría también, no solo "seguimiento". Ver **Pregunta abierta 3** antes de tocar este archivo. |
| 2.1 | Tabla de tickets sin scroll horizontal en tablet | **Ya implementado.** `.ticket-table-wrap{overflow:auto}` + `.ticket-table{min-width:1120px}` en `ticketera.css` ya fuerza scroll horizontal. Los filtros ya muestran texto completo ("Cliente: Todos", no "Cliente: Todo") en el código fuente — la truncación que describes puede ser un problema de renderizado específico a 768px (ancho del `<select>` nativo del navegador) que no se ve leyendo el CSS. **Necesita verificación visual real en el navegador a 768px**, no solo lectura de código. |
| 2.2 | Calendario semanal sin scroll en tablet | No verificado a fondo todavía (pendiente de la fase de implementación); el enfoque del spec es razonable. |
| 2.3 | Chat sin maestro-detalle en tablet | Estructura base (`activeSpace`, lista de contactos, hilo) existe en `Messages.tsx`. Falta el comportamiento responsive descrito. Aplicable. |
| 3.1 | Validación de formularios | **Parcialmente ya implementado.** El modal de evento YA tiene `formError`/`.event-form-error` (mensaje de error visible, no bloqueo nativo silencioso) — falta agregar la regla específica "fecha fin no puede ser anterior a inicio". El modal de "Nueva iniciativa" hay que revisarlo aparte (no confirmado aún). |
| 3.2 | Buscador local en portafolio | No verificado a fondo (pendiente); parece un gap real, aplicable. |
| 3.3 | Icono de estado vacío en tickets | El texto "No se encontraron tickets con los filtros actuales" **no existe todavía** en `TicketWorkspace.tsx` — gap real, aplicable. El ícono `Check` se usa en varios lados (estado de ticket, historial), hay que ubicar específicamente el de "sin resultados" antes de tocarlo. |
| 4.1 | Wallpaper con ruido visual | **Archivo equivocado en el spec.** El patrón de fondo (`wallpaper-ejb-*`, `wallpaper-custom`) está definido en `refinements.css`, no en `google-chat-theme.css` (ese archivo solo tiene el botón/popover para elegirlo). Hay que localizar la regla de opacidad real antes de tocar nada. |
| 4.2 | Tipografía en "Accesos directos" | `.chat-shortcuts button` existe en `google-chat-theme.css` pero solo define color/hover, no las propiedades de tamaño/peso/flex que el spec pide agregar — aplicable tal cual. |
| 4.3 | Duplicados en lista de contactos | **Ya implementado.** `Messages.tsx` línea ~546 ya dedupea por `contact.id` con `Array.from(new Map(...))`. Si sigues viendo duplicados, es otro bug (quizás en otra lista, no en la que ya dedupea) — **necesito que me indiques exactamente dónde los ves** antes de "arreglar" algo que ya está resuelto. |
| 4.4 | Contraste del badge "100 Score" | **No reproducido — el spec parece estar desactualizado.** En `projects-center.css`, `.score` ya usa fondo `#fef9c3` (exactamente el que pide el spec) y texto `#78350f` (número) / `#854d0e` (label "Score", ya es el color exacto que pide el spec). Calculando el ratio: ambos superan 10:1, muy por encima del mínimo AA (4.5:1). Puede que ya se haya corregido en un commit reciente, o que el badge problemático esté en otro componente. **Necesito confirmación visual** antes de tocar esto. |
| 4.5 | Terminología / botón cerrar / formato de fecha | No verificado a fondo (pendiente); el botón de cerrar (`.close`) hoy es rojo agresivo (`#dc2626`, confirmado en `refinements.css` y `styles.css`) — ese punto sí aplica tal cual. |

## Preguntas abiertas (necesito tu decisión antes de programar)

1. **Fase 0 / backup**: ¿confirmas rama de trabajo sin commit previo (el historial de git ya sirve de respaldo), o prefieres que arme un backup de otra forma (zip fuera del repo, stash con nombre)? No voy a duplicar `src/` dentro del repo salvo que me digas explícitamente que sí lo quieres así.
2. **1.2 — botón contextual**: para ocultar "Registrar caso" quien no tenga permiso, ¿prefieres que exponga un flag `puedeRegistrarTickets` desde el backend (ej. en `/api/tickets/resumen` o `/catalogos`), o que duplique la lógica de `canRegisterTickets`/`canViewTickets` en el frontend usando `user.permisos`/`cargo`/`area`? La primera opción es más segura (una sola fuente de verdad) pero toca un endpoint más.
3. **1.3 — alcance del permiso para Ventas/Instalación**: ¿"modo seguimiento" significa que un Jefe/Gerente de Ventas/Instalación debe poder **ver y registrar** casos (ampliar `canViewTickets`/`canRegisterTickets`, sin darles poder de reasignar/reabrir tickets ajenos), o realmente quieres que tengan el mismo nivel que hoy tiene jefatura de Consultoría (`isTicketBoss`, con reasignar/reabrir incluido)? Y ¿deben ver TODOS los tickets o solo los de `areaDestino` = su propia área? (hoy no hay filtrado por área en absoluto — extenderlo sin decidir el alcance podría sobre-otorgar permisos).
4. **4.3 y 4.4**: ambos parecen ya resueltos en el código actual. ¿Los viste en la app corriendo (no en el código)? Si sí, dime en qué pantalla/condición exacta para reproducirlos antes de "corregir" algo que podría no estar roto.

## Task List

### Fase A — Fundacional / decisiones (bloquea el resto)
- [ ] **T0**: Confirmar con Santi las Preguntas abiertas 1-4 y el orden de fases a ejecutar.
- [ ] **T1** (depende de T0, pregunta 2): Si aplica, exponer `puedeRegistrarTickets`/`puedeVerTicketera` desde backend (`ticket.controller.ts` catalogs o resumen).
  - Archivos: `backend/src/controllers/ticket.controller.ts`
  - Verificación: `npx tsc --noEmit` en backend; `curl` al endpoint con un usuario sin permiso y confirmar `false`.
- [ ] **T2** (depende de T0, pregunta 3): Ajustar permisos de Ticketera para Ventas/Instalación en `backend/src/services/ticketing.ts` según el alcance decidido.
  - Verificación: `npx tsc --noEmit`; probar con un usuario Jefe de Ventas contra `GET /api/tickets` y `POST /api/tickets`.

### Checkpoint A
- [ ] Backend compila sin errores de tipos.
- [ ] Las dos decisiones de permisos están implementadas y probadas por `curl`/Postman antes de tocar UI.

### Fase B — Bugs funcionales altos (UI)
- [ ] **T3**: Fix modal calendario (1.1) — CSS en `EventCalendar.tsx`/`refinements.css` (`max-height`, `overflow-y`, footer `sticky`).
  - Verificación: navegador con viewport 800px de alto, botón "Guardar evento" visible sin scroll extra del modal.
- [ ] **T4** (depende de T1): Botón de cabecera contextual real (1.2) en `App.tsx` — corregir el `else` genérico y condicionar "Registrar caso" al flag/permiso.
  - Verificación: navegar por todas las páginas del nav y confirmar el botón correcto (o ausente) en cada una; probar con un usuario sin `registrarTickets`.

### Checkpoint B
- [ ] `npx tsc --noEmit` (frontend) y `npx tsc --noEmit` (backend) sin errores.
- [ ] Verificación manual de 1.1 y 1.2 en navegador.

### Fase C — Responsividad tablet (768-900px)
- [ ] **T5**: Confirmar visualmente en navegador (768px) si 2.1 (truncamiento de filtros) reproduce. Si sí, ajustar `min-width`/`flex` de los `<select>` en `ticketera.css`.
- [ ] **T6**: Scroll horizontal en grilla semanal del calendario (2.2).
- [ ] **T7**: Patrón maestro-detalle en Chat (2.3) — `Messages.tsx`, media query ≤800px.

### Checkpoint C
- [ ] Verificación manual en navegador con viewport 768px para tickets, calendario y chat.

### Fase D — Formularios, filtros, estados vacíos
- [ ] **T8**: Validación fecha fin > inicio en modal de evento (3.1), reutilizando `.event-form-error` ya existente. Revisar modal "Nueva iniciativa" aparte.
- [ ] **T9**: Buscador local de texto en portafolio de iniciativas (3.2).
- [ ] **T10**: Icono + mensaje de estado vacío en tabla de tickets (3.3).

### Fase E — Visual / ergonomía (bajo riesgo)
- [ ] **T11**: Reducir ruido del wallpaper del chat (4.1) — localizar la regla real en `refinements.css`.
- [ ] **T12**: Tipografía de "Accesos directos" (4.2).
- [ ] **T13**: Confirmar con Santi si 4.3 (dedup contactos) reproduce en algún otro listado antes de tocar código.
- [ ] **T14**: Confirmar con Santi si 4.4 (contraste badge) reproduce visualmente antes de tocar código.
- [ ] **T15**: Terminología, botón cerrar del calendario, formato de fecha en español (4.5).

### Checkpoint final
- [ ] `npx tsc --noEmit` en frontend y backend, cero errores.
- [ ] Recorrido manual completo de los 5 puntos de verificación del spec original (Fase 5.2).
- [ ] Revisión de mi propio diff antes de avisar que terminé (regla fija de Santi).
- [ ] Sin commit/push — queda para que Santi revise `git diff`.

## Risks and Mitigations

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Ampliar `isTicketBoss`/`canViewTickets` sin definir alcance | Alto (fuga de datos entre áreas, sobre-privilegio) | Resolver Pregunta abierta 3 antes de T2 |
| "Arreglar" 4.3/4.4 que ya están resueltos | Bajo pero desperdicia esfuerzo, puede introducir regresión | Confirmar reproducción visual antes de T13/T14 |
| CSS del spec pisa reglas ya existentes (ej. 2.1 ya tiene scroll) | Medio (doble regla, comportamiento inconsistente) | T5 empieza por verificar en navegador, no por copiar el CSS del spec literal |

## Open Questions
Ver sección "Preguntas abiertas" arriba.
