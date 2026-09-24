// Catálogo único de permisos personalizados por usuario (Usuario.permisos).
// Fuente única: el backend valida contra estas claves y el frontend pinta el
// checklist del menú ⋮ de Equipo a partir de este mismo catálogo (se expone
// vía GET /usuarios/catalogo), para que nunca vuelvan a divergir como pasaba
// antes con la lista de AdministrationHub.tsx.
export type PermisoDef = { clave: string; etiqueta: string; modulo: string };

export const PERMISOS_CATALOGO: PermisoDef[] = [
  { clave: "crearProyectos", etiqueta: "Crear proyectos", modulo: "Iniciativas" },
  { clave: "editarProyectos", etiqueta: "Editar proyectos", modulo: "Iniciativas" },
  { clave: "eliminarProyectos", etiqueta: "Eliminar proyectos", modulo: "Iniciativas" },
  { clave: "verTicketera", etiqueta: "Ver Ticketera", modulo: "Ticketera" },
  { clave: "registrarTickets", etiqueta: "Registrar tickets", modulo: "Ticketera" },
  { clave: "editarTickets", etiqueta: "Editar tickets", modulo: "Ticketera" },
  { clave: "tomarTickets", etiqueta: "Tomar tickets", modulo: "Ticketera" },
  { clave: "verClientes", etiqueta: "Ver Clientes", modulo: "Clientes" },
  { clave: "crearClientes", etiqueta: "Crear clientes", modulo: "Clientes" },
  { clave: "crearProspectos", etiqueta: "Crear prospectos", modulo: "Marketing" },
  { clave: "editarProspectos", etiqueta: "Editar prospectos", modulo: "Marketing" },
  { clave: "eliminarProspectos", etiqueta: "Eliminar prospectos", modulo: "Marketing" },
  { clave: "aprobar", etiqueta: "Aprobar solicitudes", modulo: "Aprobaciones" },
  { clave: "exportar", etiqueta: "Exportar reportes", modulo: "Reportería" },
  { clave: "verAuditoria", etiqueta: "Ver auditoría", modulo: "Auditoría" },
  { clave: "accesoTotalPortal", etiqueta: "Acceso total al portal (todas las áreas)", modulo: "Global" },
];
