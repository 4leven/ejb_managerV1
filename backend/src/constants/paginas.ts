// Catálogo único de páginas del menú lateral que se pueden ocultar por
// usuario (Usuario.permisos, misma columna que ya usan los permisos de
// módulo — ver constants/permisos.ts). Es un modelo "opt-out": por defecto
// cada usuario ve exactamente lo que ya decidía la regla de cargo/área de
// siempre; si esta clave está explícitamente en `false`, se le oculta esa
// página aunque la regla de siempre diría que sí puede verla.
export type PaginaDef = { clave: string; etiqueta: string };

export const PAGINAS_CATALOGO: PaginaDef[] = [
  { clave: "verResumen", etiqueta: "Resumen" },
  { clave: "verNotificaciones", etiqueta: "Notificaciones" },
  { clave: "verProyectos", etiqueta: "Proyectos" },
  { clave: "verMiTrabajo", etiqueta: "Mi trabajo" },
  { clave: "verObjetivos", etiqueta: "Objetivos" },
  { clave: "verEquipo", etiqueta: "Equipo" },
  { clave: "verClientes", etiqueta: "Clientes" },
  { clave: "verTicketera", etiqueta: "Ticketera Consultoría" },
  { clave: "verKanbanSistemas", etiqueta: "Kanban Sistemas" },
  { clave: "verMensajes", etiqueta: "Mensajes" },
  { clave: "verCronograma", etiqueta: "Cronogramas y alertas" },
  { clave: "verCalendario", etiqueta: "Calendario" },
  { clave: "verInformesBI", etiqueta: "Informes BI" },
  { clave: "verRequerimientos", etiqueta: "Requerimientos" },
  { clave: "verReporteria", etiqueta: "Reportería" },
  { clave: "verFlujosAreas", etiqueta: "Flujos de Áreas" },
  { clave: "verEncuestas", etiqueta: "Encuestas" },
  { clave: "verAprobaciones", etiqueta: "Aprobaciones" },
  { clave: "verMarketing", etiqueta: "Marketing" },
  { clave: "verAdministracion", etiqueta: "Administración" },
  { clave: "verMejoraContinua", etiqueta: "Mejora continua" },
  { clave: "verPersonalizacion", etiqueta: "Personalización" },
];
