export const API_URL = import.meta.env.VITE_API_URL ?? "/api";
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("ejb_token") ?? sessionStorage.getItem("ejb_token") ?? ""}`,
});

type ApiBody = Record<string, any> | any[] | string | number | boolean | null;

async function readJsonSafely(response: Response): Promise<ApiBody> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiBody;
  } catch {
    throw new Error(
      response.ok
        ? "El servidor devolvió una respuesta incompleta. Intenta nuevamente."
        : `El servidor respondió con un formato inválido (${response.status}).`,
    );
  }
}

function apiError(body: ApiBody, fallback: string) {
  return body && typeof body === "object" && !Array.isArray(body) && body.message
    ? String(body.message)
    : fallback;
}

async function expectJson(response: Response, fallback: string): Promise<any> {
  const body = await readJsonSafely(response);
  if (!response.ok) throw new Error(apiError(body, fallback));
  return body ?? { ok: true };
}
export async function downloadMonthlyReport(
  format: "pdf" | "xls",
  filters: {
    month?: string;
    area?: string;
    client?: string;
    compare?: boolean;
    projectId?: string;
    taskId?: string;
    workerId?: string;
  } = {},
) {
  const params = new URLSearchParams({ format });
  if (filters.month) params.set("month", filters.month);
  if (filters.area) params.set("area", filters.area);
  if (filters.client) params.set("client", filters.client);
  if (filters.compare) params.set("compare", "1");
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.taskId) params.set("taskId", filters.taskId);
  if (filters.workerId) params.set("workerId", filters.workerId);
  const response = await fetch(
    `${API_URL}/dashboard/reporte-mensual?${params}`,
    { headers: authHeaders() },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "No se pudo descargar el reporte");
  }
  const blob = await response.blob(),
    disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
    `reporte-mensual.${format}`;
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
export async function fetchIniciativas() {
  const r = await fetch(`${API_URL}/iniciativas`, { headers: authHeaders() });
  return expectJson(r, "No se pudo conectar");
}
export async function fetchCatalogo() {
  const r = await fetch(`${API_URL}/usuarios/catalogo`);
  return expectJson(r, "No se pudo cargar el catálogo");
}
export async function createIniciativa(data: {
  titulo: string;
  descripcion: string;
  clienteId?: string;
  software?: string;
  areaId: string;
  responsableId?: string;
  impacto: number;
  esfuerzo: string;
  fechaInicio?: string;
  fechaFin?: string;
  tareas?: string[];
}) {
  const r = await fetch(`${API_URL}/iniciativas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return expectJson(r, "No se pudo registrar");
}
export const transitionInitiative = (
  id: string,
  estado: "Pendiente" | "En_evaluacion" | "Priorizado" | "En_desarrollo" | "Finalizado",
  responsableId?: string,
) =>
  jsonRequest(`/iniciativas/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado, responsableId }),
  });
export async function register(data: Record<string, string>) {
  const r = await fetch(`${API_URL}/auth/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return expectJson(r, "No se pudo crear la cuenta");
}
export async function login(email: string, password: string) {
  const r = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return expectJson(r, "No se pudo iniciar sesión");
}
export async function me() {
  const r = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
  try {
    return await expectJson(r, "Sesión inválida");
  } catch (error) {
    // El status permite distinguir sesión vencida (401) de un backend caído.
    throw Object.assign(error as Error, { status: r.status });
  }
}
async function jsonRequest(path: string, options: RequestInit = {}) {
  const r = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  return expectJson(r, "No se pudo completar la operación");
}
export const fetchObjetivos = () => jsonRequest("/objetivos");
export const createObjetivo = (data: { nombre: string; descripcion: string }) =>
  jsonRequest("/objetivos", { method: "POST", body: JSON.stringify(data) });
export const addObjectiveProgress = (
  id: string,
  data: { porcentaje: number; comentario: string },
) =>
  jsonRequest(`/objetivos/${id}/progresos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
export const fetchEquipo = () => jsonRequest("/usuarios/equipo");
export const saveTeamCargo = (id: string, cargo: string) =>
  jsonRequest(`/usuarios/equipo/${id}/cargo`, {
    method: "PATCH",
    body: JSON.stringify({ cargo }),
  });
export const saveTeamArea = (id: string, areaId: string) =>
  jsonRequest(`/usuarios/equipo/${id}/area`, {
    method: "PATCH",
    body: JSON.stringify({ areaId }),
  });
export const deleteTeamMember = (id: string) =>
  jsonRequest(`/usuarios/equipo/${id}`, { method: "DELETE" });
export const savePortalColor = (portalColor: string) =>
  jsonRequest("/usuarios/me/color", {
    method: "PATCH",
    body: JSON.stringify({ portalColor }),
  });
export const fetchProgresos = (id: string) =>
  jsonRequest(`/iniciativas/${id}/progresos`);
export const addProgreso = (
  id: string,
  data: { porcentaje: number; comentario: string },
) =>
  jsonRequest(`/iniciativas/${id}/progresos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
export const addInitiativeTask = (
  id: string,
  data: {
    titulo: string;
    estado?: string;
    comentario?: string;
    fechaInicio?: string;
    fechaFin?: string;
    prioridad?: string;
    responsableId?: string | null;
    recordatorioAt?: string | null;
    adjuntos?: { nombre: string; mime: string; data: string }[];
  },
) =>
  jsonRequest(`/iniciativas/${id}/tareas`, {
    method: "POST",
    body: JSON.stringify(data),
  });
export const updateInitiativeTask = (
  id: string,
  taskId: string,
  data: {
    titulo?: string;
    estado: string;
    comentario?: string;
    fechaInicio?: string;
    fechaFin?: string;
    prioridad?: string;
    responsableId?: string | null;
    recordatorioAt?: string | null;
    adjuntos?: { nombre: string; mime: string; data: string }[];
  },
) =>
  jsonRequest(`/iniciativas/${id}/tareas/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const saveInitiativeAppearance = (
  id: string,
  data: { icono: string; colorIcono: string },
) =>
  jsonRequest(`/iniciativas/${id}/apariencia`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const updateInitiative = (
  id: string,
  data: {
    titulo: string;
    descripcion: string;
    clienteId?: string | null;
    software?: string | null;
    areaId: string;
    responsableId?: string | null;
    impacto?: number;
    esfuerzo?: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  },
) =>
  jsonRequest(`/iniciativas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteInitiative = (id: string) =>
  jsonRequest(`/iniciativas/${id}`, { method: "DELETE" });
export const fetchClientes = (q = "") =>
  jsonRequest(`/clientes?q=${encodeURIComponent(q)}`);
export const createCliente = (data: {
  razonSocial: string;
  ruc?: string;
  telefono?: string;
  contacto?: string;
}) => jsonRequest("/clientes", { method: "POST", body: JSON.stringify(data) });
let conversationsRequest: { auth: string; promise: Promise<any> } | undefined;
export const fetchConversations = () => {
  const auth = authHeaders().Authorization;
  if (conversationsRequest?.auth === auth) return conversationsRequest.promise;
  const entry = { auth, promise: jsonRequest("/mensajes/conversaciones") };
  conversationsRequest = entry;
  void entry.promise.finally(() => {
    setTimeout(() => { if (conversationsRequest === entry) conversationsRequest = undefined; }, 2500);
  }).catch(() => { if (conversationsRequest === entry) conversationsRequest = undefined; });
  return entry.promise;
};
export const saveMessageStatus = (estadoMensaje: string) =>
  jsonRequest("/usuarios/me/estado-mensaje", {
    method: "PATCH",
    body: JSON.stringify({ estadoMensaje }),
  });
let threadCache: { key: string; etag: string; rows: any[] } | undefined;
export const fetchMessages = async (userId: string) => {
  const headers = authHeaders();
  const key = `${headers.Authorization}:${userId}`;
  const cached = threadCache?.key === key ? threadCache : undefined;
  const response = await fetch(`${API_URL}/mensajes/${userId}`, {
    headers: { ...headers, ...(cached ? { "If-None-Match": cached.etag } : {}) },
    cache: "no-store",
  });
  if (response.status === 304 && cached) return cached.rows;
  const rows = await expectJson(response, "No se pudieron cargar los mensajes");
  const etag = response.headers.get("ETag");
  if (etag) threadCache = { key, etag, rows };
  return rows;
};
export const sendMessage = (
  userId: string,
  data: string | Record<string, unknown>,
) =>
  jsonRequest(`/mensajes/${userId}`, {
    method: "POST",
    body: JSON.stringify(typeof data === "string" ? { contenido: data } : data),
  });
export const toggleMessageReaction = (messageId: string, emoji: string) =>
  jsonRequest(`/mensajes/${messageId}/reacciones`, { method: "POST", body: JSON.stringify({ emoji }) });
export const forwardMessage = (messageId: string, destinatarioIds: string[]) =>
  jsonRequest(`/mensajes/${messageId}/reenviar`, { method: "POST", body: JSON.stringify({ destinatarioIds }) });
export const scheduleMessage = (userId: string, data: Record<string, unknown>) =>
  jsonRequest(`/mensajes/${userId}/programar`, { method: "POST", body: JSON.stringify(data) });
export const fetchScheduledMessages = () => jsonRequest("/mensajes/programados");
export const updateScheduledMessage = (id: string, data: { contenido?: string; enviarEn?: string }) =>
  jsonRequest(`/mensajes/programados/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteScheduledMessage = (id: string) => jsonRequest(`/mensajes/programados/${id}`, { method: "DELETE" });
export const searchMessageContent = (query: string) => jsonRequest(`/mensajes/buscar?q=${encodeURIComponent(query)}`);
export const startHuddle = (contexto: "dm" | "grupo" | "canal", contextoId: string) => jsonRequest("/huddles", { method: "POST", body: JSON.stringify({ contexto, contextoId }) });
export const joinHuddle = (id: string) => jsonRequest(`/huddles/${id}/unirse`, { method: "POST" });
export const leaveHuddle = (id: string) => jsonRequest(`/huddles/${id}/salir`, { method: "POST" });
export const fetchActiveHuddle = (contexto: "dm" | "grupo" | "canal", contextoId: string) => jsonRequest(`/huddles/activas?contexto=${contexto}&contextoId=${encodeURIComponent(contextoId)}`);
export const fetchAlerts = () => jsonRequest("/alertas");
export async function subscribeAlerts(
  onAlerts: (rows: any[]) => void,
  signal: AbortSignal,
) {
  const response = await fetch(`${API_URL}/alertas/stream`, {
    headers: { Accept: "text/event-stream", ...authHeaders() },
    signal,
  });
  if (!response.ok || !response.body)
    throw new Error("No se pudo abrir el canal de alertas");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      if (!block.includes("event: alertas")) continue;
      const data = block
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (data) onAlerts(JSON.parse(data));
    }
  }
}

export const fetchTickets=(params:Record<string,string|number|undefined>={})=>{const q=new URLSearchParams();Object.entries(params).forEach(([k,v])=>v!==undefined&&v!==""&&q.set(k,String(v)));return jsonRequest(`/tickets?${q}`)};
export const fetchTicketSummary=()=>jsonRequest("/tickets/resumen");
export const fetchTicketDetail=(id:string)=>jsonRequest(`/tickets/${id}`);
export const fetchTicketCatalogs=()=>jsonRequest("/tickets/catalogos");
export const fetchTicketClients=(q="")=>jsonRequest(`/tickets/clientes?q=${encodeURIComponent(q)}`);
export const fetchTicketConsultants=()=>jsonRequest("/tickets/consultores");
export const createTicket=(data:Record<string,unknown>)=>jsonRequest("/tickets",{method:"POST",body:JSON.stringify(data)});
export const takeTicket=(id:string,areaDestino?:string)=>jsonRequest(`/tickets/${id}/tomar`,{method:"POST",body:JSON.stringify({areaDestino})});
export const saveTicketAdvance=(id:string,data:Record<string,unknown>)=>jsonRequest(`/tickets/${id}/avance`,{method:"PATCH",body:JSON.stringify(data)});
export const finishTicket=(id:string,data:Record<string,unknown>)=>jsonRequest(`/tickets/${id}/finalizar`,{method:"POST",body:JSON.stringify(data)});
export const rejectTicket=(id:string,motivo:string)=>jsonRequest(`/tickets/${id}/rechazar`,{method:"POST",body:JSON.stringify({motivo})});
export const reopenTicket=(id:string,motivo:string)=>jsonRequest(`/tickets/${id}/reabrir`,{method:"POST",body:JSON.stringify({motivo})});
export const reassignTicket=(id:string,asignadoAId:string)=>jsonRequest(`/tickets/${id}/reasignar`,{method:"POST",body:JSON.stringify({asignadoAId})});
export const linkTicketConsultant=(id:string,asignadoAId:string)=>jsonRequest(`/tickets/${id}/vincular-consultor`,{method:"POST",body:JSON.stringify({asignadoAId})});
export async function subscribeTickets(onChange:()=>void,signal:AbortSignal){const response=await fetch(`${API_URL}/tickets/stream`,{headers:{Accept:"text/event-stream",...authHeaders()},signal});if(!response.ok||!response.body)throw new Error("No se pudo conectar a la Ticketera");const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";while(!signal.aborted){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const blocks=buffer.split("\n\n");buffer=blocks.pop()??"";for(const block of blocks)if(block.includes("event: tickets"))onChange()}}
export const fetchEvents = () => jsonRequest("/eventos");
export const createEvent = (data: Record<string, unknown>) =>
  jsonRequest("/eventos", { method: "POST", body: JSON.stringify(data) });
export const updateEvent = (id: string, data: Record<string, unknown>) =>
  jsonRequest(`/eventos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteEvent = (id: string) =>
  jsonRequest(`/eventos/${id}`, { method: "DELETE" });
export const fetchApprovals = (
  scope: "pending" | "mine" | "history" = "pending",
) => jsonRequest(`/aprobaciones?scope=${scope}`);
export const requestChange = (data: Record<string, unknown>) =>
  jsonRequest("/aprobaciones", { method: "POST", body: JSON.stringify(data) });
export const resolveApproval = (
  id: string,
  approved: boolean,
  comentario: string,
) =>
  jsonRequest(`/aprobaciones/${id}/resolver`, {
    method: "POST",
    body: JSON.stringify({ approved, comentario }),
  });
export const savePreferences = (darkMode: boolean) =>
  jsonRequest("/usuarios/me/preferencias", {
    method: "PATCH",
    body: JSON.stringify({ darkMode }),
  });
export const saveProfile = (data: {
  nombres: string;
  apellidos: string;
  fotoPerfil?: string | null;
  cargo?: string;
  areaId?: string;
}) =>
  jsonRequest("/usuarios/me/perfil", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const changePassword = (currentPassword: string, newPassword: string) =>
  jsonRequest("/usuarios/me/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
export const fetchRequirements = () => jsonRequest("/operacion/requerimientos");
export const createRequirement = (data: Record<string, unknown>) =>
  jsonRequest("/operacion/requerimientos", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const updateRequirement = (id: string, data: Record<string, unknown>) =>
  jsonRequest(`/operacion/requerimientos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteRequirement = (id: string) =>
  jsonRequest(`/operacion/requerimientos/${id}`, { method: "DELETE" });
export const fetchPermissions = () => jsonRequest("/operacion/permisos");
export const createPermission = () =>
  jsonRequest("/operacion/permisos", { method: "POST" });
export const fetchFlows = () => jsonRequest("/operacion/flujos");
export const createFlow = (data: Record<string, unknown>) =>
  jsonRequest("/operacion/flujos", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const forgotPassword = (email: string) =>
  jsonRequest("/auth/olvide-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
export const resetPassword = (token: string, password: string) =>
  jsonRequest("/auth/restablecer-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
export const fetchCollaboration = (
  tipo: "grupo" | "canal" | "firma" | "encuesta",
) => jsonRequest(`/colaboracion/${tipo}`);
export const createCollaboration = (
  tipo: "grupo" | "canal" | "firma" | "encuesta",
  datos: Record<string, unknown>,
) =>
  jsonRequest(`/colaboracion/${tipo}`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
export const updateCollaboration = (
  tipo: "grupo" | "canal" | "firma" | "encuesta",
  id: string,
  datos: Record<string, unknown>,
) =>
  jsonRequest(`/colaboracion/${tipo}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
export const fetchGroupInvitations = () =>
  jsonRequest("/colaboracion/invitaciones/grupos");
export const inviteGroupMember = (groupId: string, usuarioId: string) =>
  jsonRequest(`/colaboracion/grupo/${groupId}/invitaciones`, {
    method: "POST",
    body: JSON.stringify({ usuarioId }),
  });
export const respondGroupInvitation = (
  groupId: string,
  invitationId: string,
  respuesta: "Aceptar" | "Rechazar",
) =>
  jsonRequest(
    `/colaboracion/grupo/${groupId}/invitaciones/${invitationId}/responder`,
    { method: "POST", body: JSON.stringify({ respuesta }) },
  );
export const globalSearch = (query: string) =>
  jsonRequest(`/busqueda?q=${encodeURIComponent(query)}`);
export const fetchAuditTrail = () => jsonRequest("/busqueda/auditoria");
export const fetchNotifications = (archived = false) =>
  jsonRequest(`/notificaciones?archivadas=${archived}`);
export const readAllNotifications = () =>
  jsonRequest("/notificaciones/leer-todas", { method: "PATCH" });
export const readNotification = (id: string) =>
  jsonRequest(`/notificaciones/${id}/leer`, { method: "PATCH" });
export const archiveNotification = (id: string) =>
  jsonRequest(`/notificaciones/${id}/archivar`, { method: "PATCH" });
export const saveNotificationPreferences = (data: Record<string, boolean>) =>
  jsonRequest("/notificaciones/preferencias", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const fetchTrash = () => jsonRequest("/admin/papelera");
export const restoreTrash = (id: string, type: string) =>
  jsonRequest(`/admin/papelera/${id}/restaurar`, {
    method: "PATCH",
    body: JSON.stringify({ type }),
  });
export const purgeTrash = (id: string, type: string) =>
  jsonRequest(`/admin/papelera/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ type }),
  });
export const bulkImport = (rows: Record<string, unknown>[]) =>
  jsonRequest("/admin/importar", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
export const updateUserPermissions = (
  id: string,
  permissions: Record<string, boolean>,
) =>
  jsonRequest(`/admin/usuarios/${id}/permisos`, {
    method: "PATCH",
    body: JSON.stringify(permissions),
  });
export const completeOnboarding = () =>
  jsonRequest("/admin/onboarding", { method: "PATCH" });
export const addFlowVersion = (id: string, data: Record<string, unknown>) =>
  jsonRequest(`/operacion/flujos/${id}/versiones`, {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteFlow = (id: string) =>
  jsonRequest(`/operacion/flujos/${id}`, { method: "DELETE" });
export const verifyEmail = (token: string) =>
  jsonRequest("/auth/verificar-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
export const fetchMySignature = () =>
  jsonRequest("/colaboracion/firma/perfil/mi-firma");
export const saveMySignature = (firmaData: string) =>
  jsonRequest("/colaboracion/firma/perfil/mi-firma", {
    method: "PUT",
    body: JSON.stringify({ firmaData }),
  });
export const signDocument = (id: string, password: string) =>
  jsonRequest(`/colaboracion/firma/${id}/firmar`, {
    method: "POST",
    body: JSON.stringify({ password, acepta: true }),
  });
export const rejectDocument = (id: string, password: string, motivo: string) =>
  jsonRequest(`/colaboracion/firma/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify({ password, motivo }),
  });
export type ProductRecordType =
  | "regla_aprobacion"
  | "integracion"
  | "feedback_usuario"
  | "adopcion"
  | "comunicado";
export const fetchProductRecords = (type: ProductRecordType) =>
  jsonRequest(`/producto/${type}`);
export const saveProductRecord = (
  type: ProductRecordType,
  data: Record<string, unknown>,
) =>
  jsonRequest(`/producto/${type}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
export const updateProductRecord = (
  type: ProductRecordType,
  id: string,
  data: Record<string, unknown>,
) =>
  jsonRequest(`/producto/${type}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const fetchAdoptionSummary = () =>
  jsonRequest("/producto/adopcion/resumen");
export const trackAdoption = (modulo: string, accion: string) =>
  saveProductRecord("adopcion", {
    modulo,
    accion,
    at: new Date().toISOString(),
  });
export const deleteConversation = (userId: string) => jsonRequest(`/mensajes/${userId}`, {method:"DELETE"});
export const createApprovalSimulation=()=>jsonRequest('/aprobaciones/simulacion',{method:'POST'});
export const deleteMessageForEveryone = (messageId:string)=>jsonRequest(`/mensajes/mensajes/${messageId}/para-todos`,{method:"DELETE"});
export const deleteChatSpace = (type: string, id: string) => jsonRequest(`/colaboracion/${type}/${id}`, {method:"DELETE"});
export const chatSpaceAction = (type: string, id: string, data: Record<string,unknown>) => jsonRequest(`/colaboracion/${type}/${id}/actividad`, {method:"POST",body:JSON.stringify(data)});
export const gmailStatus=()=>jsonRequest("/gmail/status");
export const gmailAuthorize=()=>jsonRequest("/gmail/authorize",{method:"POST"});
export const gmailInbox=()=>jsonRequest("/gmail/inbox");
export const gmailSend=(data:{to:string;subject:string;body:string})=>jsonRequest("/gmail/send",{method:"POST",body:JSON.stringify(data)});
export const gmailDisconnect=()=>jsonRequest("/gmail/connection",{method:"DELETE"});
