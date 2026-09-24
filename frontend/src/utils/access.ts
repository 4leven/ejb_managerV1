export type AccessUser = {
  cargo?: string;
  isSuperAdmin?: boolean;
  permisos?: Record<string, boolean>;
  area?: { nombre?: string } | null;
};

export const isTechnicalUser = (user?: AccessUser | null) =>
  user?.cargo === "Tecnico";

export const canOperateGlobally = (user?: AccessUser | null) =>
  Boolean(user?.isSuperAdmin || isTechnicalUser(user));

export const hasFullPortalAccess = (user?: AccessUser | null) =>
  Boolean(user?.isSuperAdmin || user?.permisos?.accesoTotalPortal);

export const cargoLabel = (cargo?: string | null) =>
  cargo === "Tecnico" ? "Técnico" : cargo === "Administracion" ? "Administración" : cargo || "Sin rol";

export const isAreaLeaderUser=(user?:AccessUser|null)=>Boolean(user&&["Jefe","Gerente"].includes(user.cargo||""));
export const isAdministrationUser=(user?:AccessUser|null)=>user?.cargo==="Administracion";
export const canPublishAnnouncements=(user?:AccessUser|null)=>Boolean(user?.isSuperAdmin||isAreaLeaderUser(user)||isAdministrationUser(user));
export const canDeleteOwned=(user:any,creatorId?:string|null,areaId?:string|null)=>Boolean(user?.isSuperAdmin||user?.id===creatorId||(isAreaLeaderUser(user)&&areaId&&user?.area?.id===areaId));
export const canManageMarketing=(user?:AccessUser|null)=>Boolean(user?.isSuperAdmin||user?.area?.nombre?.trim().toLocaleLowerCase("es-PE")==="marketing");
export const canReadMarketing=(user?:AccessUser|null)=>Boolean(user);
export const hasPermission=(user?:AccessUser|null,key?:string)=>Boolean(user?.isSuperAdmin||(key&&user?.permisos?.[key]));
// Espejo en frontend de canManageInitiative (backend/src/services/permissions.ts),
// para poder ocultar/deshabilitar "Agregar tarea" y acciones similares antes de
// llamar a la API. La validación real y definitiva sigue siendo la del backend.
export const canManageInitiative=(
  user?: (AccessUser & { id?: string; area?: { id?: string; nombre?: string } | null }) | null,
  item?: { areaId?: string; responsableId?: string | null; creadorId?: string | null } | null,
)=>Boolean(
  user &&
    item &&
    (canOperateGlobally(user) ||
      (isAreaLeaderUser(user) && user.area?.id === item.areaId) ||
      hasPermission(user, "editarProyectos") ||
      (item.responsableId && user.id === item.responsableId) ||
      (item.creadorId && user.id === item.creadorId)),
);
