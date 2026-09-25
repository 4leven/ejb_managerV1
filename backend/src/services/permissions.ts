export type Actor={id:string;areaId:string;cargo:string;rol:string;isSuperAdmin:boolean;permisos?:unknown;area?:{nombre:string}|null};
export const hasPermission=(actor:Actor,key:string)=>actor.isSuperAdmin||Boolean((actor.permisos as Record<string,boolean>|null)?.[key]);
export const isTechnical=(actor:Actor)=>actor.cargo==="Tecnico";
export const hasGlobalOperationalAccess=(actor:Actor)=>actor.isSuperAdmin||isTechnical(actor);
export const isAreaLeader=(actor:Actor)=>["Jefe","Gerente"].includes(actor.cargo);
export const isAdministration=(actor:Actor)=>actor.cargo==="Administracion";
export const isManagement=(actor:Actor)=>actor.isSuperAdmin||isAreaLeader(actor)||hasPermission(actor,"accesoTotalPortal");
export const canPublishAnnouncements=(actor:Actor)=>isManagement(actor)||isAdministration(actor);
export const canManageArea=(actor:Actor,areaId:string)=>hasGlobalOperationalAccess(actor)||(isAreaLeader(actor)&&actor.areaId===areaId);
export const canDeleteOwned=(actor:Actor,ownerId:string|null|undefined,areaId:string|null|undefined)=>actor.isSuperAdmin||actor.id===ownerId||(isAreaLeader(actor)&&Boolean(areaId)&&actor.areaId===areaId);
// A diferencia de canDeleteOwned (genérica: se usa para eliminar mensajes,
// eventos, objetivos, espacios de chat, etc.), esta es específica de
// Iniciativas: el permiso "eliminarProyectos" solo debe destrabar el borrado
// de proyectos, no el de cualquier otro contenido que comparta canDeleteOwned.
export const canDeleteInitiative=(actor:Actor,ownerId:string|null|undefined,areaId:string|null|undefined)=>canDeleteOwned(actor,ownerId,areaId)||hasPermission(actor,"eliminarProyectos");
export const requiresProjectDeleteApproval=(actor:Actor)=>!actor.isSuperAdmin&&["Asistente","Trabajador"].includes(actor.cargo)&&!hasPermission(actor,"eliminarProyectos");
export const canApproveProjectDeletion=(actor:Actor,areaId:string)=>actor.isSuperAdmin||(actor.cargo==="Gerente"&&actor.areaId===areaId);
export const canReadInitiative=(actor:Actor,item:{areaId:string;responsableId?:string|null})=>hasGlobalOperationalAccess(actor)||isManagement(actor)||actor.areaId===item.areaId||actor.id===item.responsableId;
// Antes no incluía al creador: un Trabajador/Asistente que crea una iniciativa
// sin asignarle responsable (no ve ese campo, solo lo ven jefes/gerentes) se
// quedaba sin poder gestionar su propio proyecto — ni agregar tareas, ni
// registrar avance, ni cambiar el estado. Se agrega el mismo criterio que ya
// usa canDeleteOwned para "dueño" del contenido.
export const canManageInitiative=(actor:Actor,item:{areaId:string;responsableId?:string|null;creadorId?:string|null})=>canManageArea(actor,item.areaId)||hasPermission(actor,"editarProyectos")||actor.id===item.responsableId||actor.id===item.creadorId;
// Crear: cualquiera puede registrar en su propia área; en otra área solo con
// el permiso crearProyectos, siendo técnico/admin o jefatura de esa área.
export const canCreateInitiativeInArea=(actor:Actor,areaId:string)=>hasPermission(actor,"crearProyectos")||actor.areaId===areaId||canManageArea(actor,areaId);
// "Derivar" = asignar, cambiar o quitar el responsable de un proyecto. Regla
// única para crear, editar y cambiar de estado. Acotada al ÁREA DEL PROYECTO
// (igual que canLeadInitiative): admin global, o Jefe/Gerente de esa área. Antes
// bastaba ser Jefe/Gerente de cualquier área, así que uno de otra área que
// llegaba a gestionar el proyecto (creador o permiso editarProyectos) podía
// derivarlo. Poder gestionar un proyecto NO implica poder derivarlo.
export const canDeriveInitiative=(actor:Actor,areaId:string)=>actor.isSuperAdmin||(isAreaLeader(actor)&&actor.areaId===areaId);
// Campos "de jefatura" al editar (mover de área, impacto/esfuerzo): jefatura del
// área de origen, técnico o administrador global. El resto de campos los edita
// cualquiera que pase canManageInitiative.
export const canLeadInitiative=(actor:Actor,areaId:string)=>canManageArea(actor,areaId);
export const canManageMarketing=(actor:Actor)=>actor.isSuperAdmin||actor.area?.nombre.trim().toLocaleLowerCase("es-PE")==="marketing";
export const canReadMarketing=(_actor:Actor)=>true;
export const groupMembers=(data:any,creatorId:string):string[]=>Array.from(new Set([creatorId,...(Array.isArray(data?.miembros)?data.miembros:[])]));
export const canReadPrivateGroup=(actorId:string,data:any,creatorId:string)=>groupMembers(data,creatorId).includes(actorId);

// Espejo exacto de isWorkerPortalUser (frontend/src/App.tsx) para poder
// replicar server-side las mismas reglas de visibilidad de página que ya
// existen en el sidebar.
export const isWorkerPortalUser=(actor:Actor)=>/trabajador|empleado/i.test(`${actor.cargo??""} ${actor.rol??""}`);

// Regla de visibilidad "de siempre" para cada página del sidebar, calcada de
// las condiciones que ya usa App.tsx para mostrar/ocultar cada link — no se
// cambia ninguna, solo se replica en el backend para poder exigirla de
// verdad, no solo ocultar el botón.
const PAGE_BASELINE: Record<string,(actor:Actor)=>boolean> = {
  verResumen: () => true,
  verNotificaciones: () => true,
  verProyectos: () => true,
  verMiTrabajo: () => true,
  verObjetivos: (actor) => !isWorkerPortalUser(actor),
  verEquipo: () => true,
  verClientes: () => true,
  verTicketera: () => true,
  verKanbanSistemas: () => true,
  verMensajes: () => true,
  verCronograma: (actor) => isManagement(actor),
  verCalendario: () => true,
  verInformesBI: (actor) => isManagement(actor),
  verRequerimientos: (actor) => !isWorkerPortalUser(actor),
  verReporteria: (actor) => isManagement(actor),
  verFlujosAreas: (actor) => isManagement(actor),
  verEncuestas: () => true,
  verAprobaciones: () => true,
  verMarketing: (actor) => !isWorkerPortalUser(actor) && canReadMarketing(actor),
  verAdministracion: (actor) => isManagement(actor),
  verMejoraContinua: () => true,
  verPersonalizacion: () => true,
};

// "opt-out": el permiso solo puede QUITAR acceso (permisos[clave] === false),
// nunca dar acceso de más — si la regla de siempre ya lo bloqueaba, seguir
// bloqueado sin importar el permiso. Así nunca contradice ni duplica la
// lógica de cargo/área existente, solo la restringe más cuando se usa.
export const canSeePage=(actor:Actor,clave:string)=>{
  const baseline = PAGE_BASELINE[clave];
  if (!baseline) return true;
  if (!baseline(actor)) return false;
  if (actor.isSuperAdmin) return true;
  return (actor.permisos as Record<string,boolean>|null)?.[clave] !== false;
};
