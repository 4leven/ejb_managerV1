# Todo: fixes QA/UX EJB Manager

Ver `tasks/plan.md` para contexto completo, hallazgos de verificación y preguntas abiertas. Nada de esto se ejecuta hasta que Santi confirme.

## Fase A — Fundacional (bloquea el resto)
- [x] T0: Confirmar preguntas abiertas 1-4 con Santi (Q1-Q3 resueltas por Claude, Q4 en pausa)
- [x] T1: Exponer `puedeVerTicketera`/`puedeRegistrarTickets` en `publicUser` (auth.service.ts)
- [x] T2: Ampliar `canViewTickets`/`canRegisterTickets` para Jefe/Gerente de Ventas/Instalación (ticketing.ts), sin tocar `isTicketBoss`

### Checkpoint A
- [x] Backend compila (`npx tsc --noEmit`) — sin errores
- [x] Permisos probados por curl: Jefe de Ventas → true/true; Trabajador de Marketing → false/false; Trabajador de Ventas (no líder) → false/false
- [x] T2b (pedido por Santi tras revisar el diff): `list`/`detail`/`summary`/`stream` en `ticket.controller.ts` ahora acotan por `areaDestino` cuando el actor solo tiene acceso vía Ventas/Instalación (nueva función `ticketAreaScope`). Jefatura de Consultoría y `verTicketera` explícito siguen sin acotar (comportamiento previo). Probado con 2 tickets reales (uno por área): Jefe Ventas ve total:1 y 403 al abrir el de Consultoría; Jefe Consultoría ve ambos sin restricción. `advance`/`finish` ya estaban bien acotados (boss-o-asignado), no se tocaron.

## Fase B — Bugs funcionales altos
- [x] T3: Modal de evento (1.1) — **no reproducido, ya estaba arreglado** (verificado con Playwright a 1366x700 y 800x700: botón siempre visible)
- [x] T4: Botón de cabecera contextual real (1.2) — permiso de ticketera + lista explícita de páginas para "Nueva iniciativa"

### Checkpoint B
- [x] `tsc --noEmit` frontend: sin errores
- [x] Verificación manual con Playwright: resumen→"Nueva iniciativa", equipo→sin botón (antes mostraba uno), calendario→"Evento nuevo", ticketera sin permiso→sin botón, ticketera con permiso (Jefe Ventas)→"Registrar caso"

## Fase C — Responsividad tablet
- [ ] T5: Verificar y corregir truncamiento de filtros en tabla de tickets (2.1)
- [ ] T6: Scroll horizontal en calendario semanal (2.2)
- [ ] T7: Maestro-detalle en Chat ≤800px (2.3)

### Checkpoint C
- [ ] Verificación manual navegador a 768px

## Fase D — Formularios, filtros, estados vacíos
- [ ] T8: Validación fecha fin > inicio (3.1)
- [ ] T9: Buscador local en portafolio de iniciativas (3.2)
- [ ] T10: Icono + mensaje de estado vacío en tickets (3.3)

## Fase E — Visual / ergonomía
- [ ] T11: Reducir ruido del wallpaper del chat (4.1)
- [ ] T12: Tipografía "Accesos directos" (4.2)
- [ ] T13: Confirmar reproducción de duplicados de contactos antes de tocar (4.3)
- [ ] T14: Confirmar reproducción de badge de contraste antes de tocar (4.4)
- [ ] T15: Terminología, botón cerrar calendario, formato de fecha (4.5)

## Checkpoint final
- [ ] `tsc --noEmit` frontend + backend, cero errores
- [ ] Recorrido manual de los 5 puntos de verificación del spec (Fase 5.2 original)
- [ ] Autorevisión del diff
- [ ] Sin commit/push — queda para revisión de Santi
