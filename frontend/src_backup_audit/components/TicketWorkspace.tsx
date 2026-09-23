import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Headphones,
  History,
  Inbox,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  Save,
  UserRound,
  X,
} from "lucide-react";
import {
  createTicket,
  fetchTicketCatalogs,
  fetchTicketClients,
  fetchTicketConsultants,
  fetchTicketDetail,
  fetchTickets,
  fetchTicketSummary,
  finishTicket,
  linkTicketConsultant,
  reassignTicket,
  rejectTicket,
  reopenTicket,
  saveTicketAdvance,
  subscribeTickets,
  takeTicket,
} from "../api/iniciativas";
import { isTechnicalUser } from "../utils/access";
import { uiConfirm, uiPrompt } from "../utils/dialog";

type TicketStatus = "PENDIENTE" | "EN_CURSO" | "FINALIZADO" | "RECHAZADO";
type TicketPriority = "BAJA" | "NORMAL" | "ALTA" | "URGENTE";
type TicketPerson = {
  id: string;
  nombres: string;
  apellidos: string;
  fotoPerfil?: string | null;
  estadoMensaje?: string;
  cargo?: string;
  _count?: { ticketsAsignados?: number };
};
type TicketClient = {
  id: string;
  ruc?: string | null;
  razonSocial: string;
  telefono?: string | null;
};
type Ticket = {
  id: string;
  numeroTicket: string;
  estado: TicketStatus;
  prioridad: TicketPriority;
  canal: string;
  clienteId: string;
  ruc: string;
  razonSocial: string;
  modulo: string;
  areaDestino: string;
  telefono?: string | null;
  contacto: string;
  consulta: string;
  observaciones?: string | null;
  solucion?: string | null;
  asignadoAId?: string | null;
  asignadoA?: TicketPerson | null;
  creadoPor?: TicketPerson | null;
  finalizadoPor?: TicketPerson | null;
  registradoAt: string;
  asignadoAt?: string | null;
  contactadoAt?: string | null;
  finalizadoAt?: string | null;
  resultadoContacto?: string | null;
  atendidoPorNombre?: string | null;
  intentosContacto?: number | null;
  origen?: string | null;
  historial?: Array<{
    id: string;
    accion: string;
    comentario?: string | null;
    estadoAnterior?: TicketStatus | null;
    estadoNuevo?: TicketStatus | null;
    metadata?: { moduloAnterior?: string; moduloNuevo?: string; areaAnterior?: string; areaNueva?: string } | null;
    createdAt: string;
    usuario?: TicketPerson | null;
  }>;
};
type Catalogs = { modules: string[]; areas: string[]; channels: string[]; priorities: string[] };
type QuickTab = "all" | "PENDIENTE" | "EN_CURSO" | "FINALIZADO";

const fullName = (person?: TicketPerson | null) =>
  person ? `${person.nombres} ${person.apellidos}` : "Sin asignar";
const initials = (person?: TicketPerson | null) =>
  person ? `${person.nombres[0] ?? ""}${person.apellidos[0] ?? ""}`.toUpperCase() : "—";
const statusLabel = (status: TicketStatus) =>
  ({ PENDIENTE: "Pendiente", EN_CURSO: "En curso", FINALIZADO: "Finalizado", RECHAZADO: "Rechazado" })[status];
const label = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
const dateTime = (value?: string | null) => {
  if (!value) return { date: "—", time: "—" };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
};
const fullDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
const elapsed = (start: string, end?: string | null) => {
  const minutes = Math.max(0, Math.round((new Date(end ?? Date.now()).getTime() - new Date(start).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
};

export default function TicketWorkspace({ user }: { user: any }) {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [rejectedRows, setRejectedRows] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [clients, setClients] = useState<TicketClient[]>([]);
  const [clientOptions, setClientOptions] = useState<TicketClient[]>([]);
  const [consultants, setConsultants] = useState<TicketPerson[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs>({ modules: [], areas: [], channels: [], priorities: [] });
  const [selected, setSelected] = useState<Ticket>();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [clientDraft,setClientDraft]=useState({ruc:"",razonSocial:"",telefono:""});
  const [success,setSuccess]=useState("");
  const [detailTab, setDetailTab] = useState<"information" | "history">("information");
  const [quickTab, setQuickTab] = useState<QuickTab>("PENDIENTE");
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("operativo");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<TicketClient>();
  const [moduleValue, setModuleValue] = useState("");
  const [areaDestinoValue, setAreaDestinoValue] = useState("");
  const [observations, setObservations] = useState("");
  const [solution, setSolution] = useState("");
  const [linkConsultantId, setLinkConsultantId] = useState("");
  const [rowMenuId, setRowMenuId] = useState<string>();
  const claimInFlight = useRef(false);

  const isBoss =
    user.isSuperAdmin ||
    isTechnicalUser(user) ||
    user.rol === "Admin" ||
    (["Jefe","Gerente"].includes(user.cargo) && String(user.area?.nombre ?? "").toLowerCase().includes("consult"));
  const consultingArea = String(user.area?.nombre ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
  const canTakeCases =
    isBoss ||
    consultingArea === "consultoria contable" ||
    consultingArea === "consultoria planilla" ||
    Boolean(user.permisos?.tomarTickets);
  const canRegister = isBoss || Boolean(user.permisos?.registrarTickets);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = quickTab === "PENDIENTE" || quickTab === "EN_CURSO" || quickTab === "FINALIZADO"
        ? quickTab
        : statusFilter;
      const [data, kpis, rejected] = await Promise.all([
        fetchTickets({
          q: query,
          estado: state,
          mine: assigneeFilter === "__mine__" ? "true" : undefined,
          clienteId: clientFilter,
          modulo: moduleFilter,
          asignadoAId: assigneeFilter === "__mine__" ? undefined : assigneeFilter,
          prioridad: priorityFilter,
          canal: channelFilter,
          desde: dateFrom,
          hasta: dateTo,
          orden: sort,
          page,
          limit,
        }),
        fetchTicketSummary(),
        fetchTickets({ estado: "RECHAZADO", orden: "fecha_desc", page: 1, limit: 100 }),
      ]);
      setRows(data.rows);
      setTotal(data.total);
      setSummary(kpis);
      setRejectedRows(rejected.rows);
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo actualizar la Ticketera.");
    } finally {
      setLoading(false);
    }
  }, [query, quickTab, statusFilter, clientFilter, moduleFilter, assigneeFilter, priorityFilter, channelFilter, dateFrom, dateTo, sort, page, limit]);

  useEffect(() => {
    Promise.all([fetchTicketClients(), fetchTicketConsultants(), fetchTicketCatalogs()])
      .then(([clientRows, consultantRows, catalogRows]) => {
        setClients(clientRows);
        setClientOptions(clientRows);
        setConsultants(consultantRows);
        setCatalogs(catalogRows);
      })
      .catch((cause) => setError(cause.message));
  }, []);
  useEffect(() => {
    if (!registerOpen) return;
    const timer = window.setTimeout(() => {
      void fetchTicketClients(clientSearch.trim())
        .then(setClientOptions)
        .catch((cause) => setError(cause.message ?? "No se pudo buscar en el maestro de clientes."));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [registerOpen, clientSearch]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void subscribeTickets(() => void load(), controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const openRegister = () => {
      if (canRegister) {setSelected(undefined);setError("");setRegisterOpen(true);}
      else setError("No tienes permiso para registrar casos.");
    };
    window.addEventListener("ticket:new", openRegister);
    return () => window.removeEventListener("ticket:new", openRegister);
  }, [canRegister]);
  useEffect(() => {
    if (!registerOpen && !selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (registerOpen) setRegisterOpen(false);
      else setSelected(undefined);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [registerOpen, selected]);
  useEffect(() => {
    if (!rowMenuId) return;
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(`[data-ticket-menu="${rowMenuId}"]`))
        setRowMenuId(undefined);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [rowMenuId]);

  const pages = Math.max(1, Math.ceil(total / limit));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const selectTicket = (ticket: Ticket) => {
    setSelected(ticket);
    setModuleValue(ticket.modulo);
    setAreaDestinoValue(ticket.areaDestino || "Consultoría");
    setObservations(ticket.observaciones ?? "");
    setSolution(ticket.solucion ?? "");
    setLinkConsultantId("");
    setDetailTab("information");
  };
  const openTicket = async (ticket: Ticket) => {
    selectTicket(ticket);
    try {
      selectTicket(await fetchTicketDetail(ticket.id));
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo cargar el ticket.");
    }
  };
  const run = async (action: Promise<Ticket>) => {
    setSaving(true);
    try {
      selectTicket(await action);
      await load();
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo completar la operación.");
    } finally {
      setSaving(false);
    }
  };
  const runAndCloseDetail = async (action: Promise<Ticket>) => {
    setSaving(true);
    setError("");
    try {
      const updated = await action;
      const visibleState = quickTab === "all" ? statusFilter : quickTab;
      setRows((current) => {
        if (visibleState && updated.estado !== visibleState)
          return current.filter((row) => row.id !== updated.id);
        return current.map((row) => (row.id === updated.id ? updated : row));
      });
      await load();
      setSelected(undefined);
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo completar la operación.");
    } finally {
      setSaving(false);
    }
  };
  const replaceTicket = (ticket: Ticket) => {
    setRows((current) => current.map((row) => (row.id === ticket.id ? ticket : row)));
    if (selected?.id === ticket.id) selectTicket(ticket);
  };
  const claimTicket = async (ticket: Ticket) => {
    if (claimInFlight.current || saving) return;
    const claimable = ticket.estado === "PENDIENTE" && (!ticket.asignadoAId || ticket.asignadoAId === user.id) && canTakeCases;
    if (!claimable) {
      await openTicket(ticket);
      return;
    }
    claimInFlight.current = true;
    setError("");
    setSaving(true);
    try {
      const updated = await takeTicket(ticket.id, areaDestinoValue || ticket.areaDestino);
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      // La API devuelve el detalle completo y el usuario autenticado que tomó el caso.
      selectTicket(updated);
      setRowMenuId(undefined);
      await Promise.all([
        load(),
        fetchTicketConsultants().then(setConsultants),
      ]);
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo tomar el caso.");
    } finally {
      claimInFlight.current = false;
      setSaving(false);
    }
  };
  const rejectCase = async (ticket: Ticket) => {
    if (saving || ticket.estado === "FINALIZADO" || ticket.estado === "RECHAZADO") return;
    const inProgress = ticket.estado === "EN_CURSO" && ticket.asignadoAId;
    const motivo = await uiPrompt(
      `Rechazar ${ticket.numeroTicket}`,
      "",
      {
        message: inProgress
          ? `${fullName(ticket.asignadoA)} lo tiene en curso. El caso pasará a Rechazado y dejará de estar asignado. Indica el motivo del rechazo.`
          : "El caso pasará a Rechazado. Indica el motivo del rechazo.",
        placeholder: "Motivo del rechazo",
        multiline: true,
        confirmText: "Rechazar caso",
      },
    );
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      setError("Indica un motivo de al menos 3 caracteres para rechazar el caso.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await rejectTicket(ticket.id, motivo.trim());
      const visibleState = quickTab === "all" ? statusFilter : quickTab;
      setRows((current) => visibleState && updated.estado !== visibleState
        ? current.filter((row) => row.id !== updated.id)
        : current.map((row) => row.id === updated.id ? updated : row));
      if (selected?.id === updated.id) setSelected(undefined);
      setSuccess(`El caso ${ticket.numeroTicket} fue rechazado.`);
      await load();
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo rechazar el caso.");
    } finally {
      setSaving(false);
    }
  };
  const requestReopen = async (ticket: Ticket, options?: { fromPanel?: boolean }) => {
    if (saving) return;
    const backToProgress = ticket.estado === "FINALIZADO" && Boolean(ticket.asignadoAId);
    const motivo = await uiPrompt(
      `Reabrir ${ticket.numeroTicket}`,
      "",
      {
        message: backToProgress
          ? `El caso volverá a "En curso" con ${fullName(ticket.asignadoA)} como responsable. Indica el motivo de la reapertura.`
          : "El caso volverá a la cola de pendientes, sin consultor asignado. Indica el motivo de la reapertura.",
        placeholder: "Motivo de la reapertura",
        multiline: true,
        confirmText: "Reabrir caso",
      },
    );
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      setError("Indica un motivo de al menos 3 caracteres para reabrir el caso.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await reopenTicket(ticket.id, motivo.trim());
      setSuccess(`El caso ${ticket.numeroTicket} fue reabierto${backToProgress ? "" : " y vuelve a la cola de pendientes"}.`);
      if (options?.fromPanel) {
        setRejectedRows((current) => current.filter((row) => row.id !== ticket.id));
        await load();
      } else {
        const visibleState = quickTab === "all" ? statusFilter : quickTab;
        setRows((current) => visibleState && updated.estado !== visibleState
          ? current.filter((row) => row.id !== ticket.id)
          : current.map((row) => row.id === updated.id ? updated : row));
        await load();
        setSelected(undefined);
      }
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo reabrir el caso.");
    } finally {
      setSaving(false);
    }
  };
  const assignTicket = async (ticket: Ticket, person: TicketPerson) => {
    if (
      !(await uiConfirm(
        "Reasignar caso",
        `¿Deseas asignar ${ticket.numeroTicket} a ${fullName(person)}?`,
      ))
    )
      return;
    setSaving(true);
    try {
      const updated = await reassignTicket(ticket.id, person.id);
      replaceTicket(updated);
      setRowMenuId(undefined);
      await Promise.all([
        load(),
        fetchTicketConsultants().then(setConsultants),
      ]);
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo reasignar el caso.");
    } finally {
      setSaving(false);
    }
  };
  const clearFilters = () => {
    setQuery("");
    setClientFilter("");
    setModuleFilter("");
    setStatusFilter("");
    setAssigneeFilter("");
    setPriorityFilter("");
    setChannelFilter("");
    setDateFrom("");
    setDateTo("");
    setSort("operativo");
    setQuickTab("all");
    setPage(1);
  };
  const clientValue = (client: TicketClient) => `${client.ruc ? `${client.ruc} · ` : ""}${client.razonSocial}`;
  const submitTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(!/^\d{11}$/.test(clientDraft.ruc)||clientDraft.razonSocial.trim().length<2){setError("Completa el RUC de 11 dígitos y la razón social.");return;}
    if(clientDraft.telefono&&!/^\d{6,9}$/.test(clientDraft.telefono)){setError("El teléfono debe tener entre 6 y 9 dígitos.");return;}
    if(saving)return;
    setError("");
    setSaving(true);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const ticket = await createTicket({
        clienteId: selectedClient?.ruc===clientDraft.ruc ? selectedClient.id : undefined,
        ...clientDraft,
        observaciones:data.observaciones,
        modulo: data.modulo,
        areaDestino: data.areaDestino,
        contacto: data.contacto,
        consulta: data.consulta,
        prioridad: data.prioridad,
        canal: data.canal,
      });
      setRegisterOpen(false);
      setClientSearch("");
      setSelectedClient(undefined);
      setSelected(undefined);
      await load();
      clearFilters();setSort("fecha_desc");
      setClientDraft({ruc:"",razonSocial:"",telefono:""});
      setSuccess(`${ticket.numeroTicket} registrado. El caso quedó pendiente en la cola, sin consultor asignado.`);
      void fetchTicketClients("").then(setClients);
    } catch (cause: any) {
      setError(cause.message ?? "No se pudo registrar el caso.");
    } finally {
      setSaving(false);
    }
  };

  const finalized = Number(summary.finalized ?? Math.max(0, Number(summary.total ?? 0) - Number(summary.pending ?? 0) - Number(summary.progress ?? 0)));
  const chartTotal = Math.max(1, Number(summary.total ?? 0));
  const chartStyle = {
    "--pending-angle": `${(Number(summary.pending ?? 0) / chartTotal) * 360}deg`,
    "--progress-angle": `${((Number(summary.pending ?? 0) + Number(summary.progress ?? 0)) / chartTotal) * 360}deg`,
  } as CSSProperties;
  const tabs: Array<{ id: QuickTab; text: string; count: number }> = [
    { id: "all", text: "Todos", count: Number(summary.total ?? 0) },
    { id: "PENDIENTE", text: "Pendientes", count: Number(summary.pending ?? 0) },
    { id: "EN_CURSO", text: "En curso", count: Number(summary.progress ?? 0) },
    { id: "FINALIZADO", text: "Finalizados", count: finalized },
  ];

  const registerModal = registerOpen
    ? createPortal(
        <div className="overlay ticket-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setRegisterOpen(false);
        }}>
          <form className="ticket-register" onSubmit={submitTicket}>
            <header>
              <span><Plus /></span>
              <div><h2>Registrar nuevo caso</h2><p>Los datos de registro y el número de ticket se generan automáticamente.</p></div>
              <button type="button" className="close" aria-label="Cerrar" onClick={() => setRegisterOpen(false)}><X /></button>
            </header>
            {error&&<p role="alert" className="ticket-register-error">{error}</p>}
            <div className="ticket-form-grid">
              <label className="wide">Buscar cliente existente
                <span className="ticket-input-icon"><Search /><input
                  name="clientSearch"
                  list="ticket-client-options"
                  value={clientSearch}
                  placeholder="Buscar por RUC o razón social"
                  autoComplete="off"
                  onChange={(event) => {
                    const value = event.target.value;
                    setClientSearch(value);
                    const normalized = value.trim().toLocaleLowerCase("es-PE");
                    const found=clientOptions.find((client) =>
                      clientValue(client) === value ||
                      client.ruc === value.trim() ||
                      client.razonSocial.toLocaleLowerCase("es-PE") === normalized
                    );
                    setSelectedClient(found);
                    if(found)setClientDraft({ruc:found.ruc??"",razonSocial:found.razonSocial,telefono:found.telefono??""});
                    else if(/^\d{1,11}$/.test(value.trim()))setClientDraft((current)=>({...current,ruc:value.trim()}));
                  }}
                /></span>
                <datalist id="ticket-client-options">{clientOptions.map((client) => <option key={client.id} value={clientValue(client)} />)}</datalist>
                {clientSearch && !selectedClient && <small className="not-found"><AlertTriangle />Si es un cliente nuevo, completa sus datos debajo.</small>}
                {selectedClient && <small><Check />Cliente seleccionado del maestro</small>}
              </label>
              <label>RUC<input name="ruc" required inputMode="numeric" pattern="[0-9]{11}" minLength={11} maxLength={11} value={clientDraft.ruc} onChange={event=>{setClientDraft({...clientDraft,ruc:event.target.value.replace(/\D/g,"")});setSelectedClient(undefined);}} placeholder="11 dígitos" /></label>
              <label>Razón social<input name="razonSocial" required minLength={2} maxLength={180} value={clientDraft.razonSocial} onChange={event=>setClientDraft({...clientDraft,razonSocial:event.target.value})} placeholder="Nombre o razón social del cliente" /></label>
              <label>Teléfono<input name="telefono" type="tel" inputMode="numeric" pattern="\d{6,9}" maxLength={9} value={clientDraft.telefono} onChange={event=>setClientDraft({...clientDraft,telefono:event.target.value.replace(/\D/g,"")})} placeholder="Entre 6 y 9 dígitos" title="El teléfono debe tener entre 6 y 9 dígitos." /></label>
              <label>Usuario / contacto<input name="contacto" required minLength={2} maxLength={150} placeholder="Persona que realiza la consulta" /></label>
              <label>Módulo consultado<select name="modulo" required defaultValue=""><option value="" disabled>Seleccionar módulo</option>{catalogs.modules.map((module) => <option key={module}>{module}</option>)}</select></label>
              <label>Prioridad<select name="prioridad" defaultValue="NORMAL">{catalogs.priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label>
              <label>Canal<select name="canal" defaultValue="TELEFONO">{catalogs.channels.map((channel) => <option key={channel} value={channel}>{label(channel)}</option>)}</select></label>
              <label>Área<select name="areaDestino" required defaultValue=""><option value="" disabled>Seleccionar área</option>{catalogs.areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
              <label className="wide">Observaciones iniciales<textarea name="observaciones" maxLength={3000} placeholder="Información adicional (opcional)" /></label>
              <label className="wide">Consulta<textarea name="consulta" required minLength={5} maxLength={3000} placeholder="Describe con claridad la consulta del cliente..." /></label>
            </div>
            <footer><button type="button" onClick={() => setRegisterOpen(false)}>Cancelar</button><button className="primary" disabled={saving}><Plus />{saving ? "Registrando…" : "Registrar caso"}</button></footer>
          </form>
        </div>,
        document.body,
      )
    : null;

  const canEditSelected = Boolean(selected) && (
    isBoss || (selected?.estado === "EN_CURSO" && selected.asignadoAId === user.id)
  );
  const canManageSelected = canEditSelected && selected?.estado !== "PENDIENTE" && selected?.estado !== "RECHAZADO";
  const selectedRegistered = dateTime(selected?.registradoAt);
  const selectedContacted = dateTime(selected?.contactadoAt);
  const detailPanel = selected
    ? createPortal(
        <div className="ticket-detail-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(undefined);
        }}>
          <aside className="ticket-detail" aria-label={`Detalle ${selected.numeroTicket}`}>
            <header>
              <h2>{selected.numeroTicket}</h2>
              <span className={`ticket-state ${selected.estado.toLowerCase()}`}>
                <span className="ticket-state-icon" aria-hidden="true">{selected.estado === "FINALIZADO" ? <Check /> : <i />}</span>
                {statusLabel(selected.estado)}
              </span>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setSelected(undefined)}><X /></button>
            </header>
            <nav className="ticket-detail-tabs" aria-label="Secciones del ticket">
              <button className={detailTab === "information" ? "active" : ""} onClick={() => setDetailTab("information")}><Building2 />Información</button>
              <button className={detailTab === "history" ? "active" : ""} onClick={() => setDetailTab("history")}><History />Historial <span>{selected.historial?.length ?? 0}</span></button>
            </nav>
            <main>
              {error && <div className="ticket-feedback" role="alert"><AlertTriangle />{error}<button type="button" onClick={() => setError("")} aria-label="Cerrar aviso"><X /></button></div>}
              {detailTab === "information" ? <>
                <section className={`ticket-information-sheet ${selected.estado === "EN_CURSO" && canEditSelected ? "ticket-ready-to-finish" : ""}`}>
                  <dl className="ticket-info-grid">
                    <div><dt>Fecha registro</dt><dd>{selectedRegistered.date}</dd></div>
                    <div><dt>Hora registro</dt><dd>{selectedRegistered.time}</dd></div>
                    <div><dt>RUC</dt><dd>{selected.ruc || "—"}</dd></div>
                    <div><dt>Razón social</dt><dd>{selected.razonSocial || "—"}</dd></div>
                    <div><dt>Módulo</dt><dd>{canManageSelected ? <select value={moduleValue} onChange={(event) => setModuleValue(event.target.value)}>{catalogs.modules.map((module) => <option key={module}>{module}</option>)}</select> : selected.modulo || "—"}</dd></div>
                    <div><dt>Área de destino</dt><dd>{(canManageSelected || (selected.estado === "PENDIENTE" && canTakeCases)) ? <select value={areaDestinoValue} onChange={(event) => setAreaDestinoValue(event.target.value)}>{catalogs.areas.map((area) => <option key={area} value={area}>{area}</option>)}</select> : selected.areaDestino || "—"}</dd></div>
                    <div><dt>Teléfono</dt><dd>{selected.telefono || "—"}</dd></div>
                    <div><dt>Usuario</dt><dd>{selected.contacto || "—"}</dd></div>
                    <div className="ticket-info-query"><dt>Consulta del usuario</dt><dd>{selected.consulta || "—"}</dd></div>
                    <div><dt>Estado</dt><dd>{statusLabel(selected.estado)}</dd></div>
                    <div><dt>Atendido por</dt><dd>{selected.asignadoA ? fullName(selected.asignadoA) : (selected.atendidoPorNombre || "—")}</dd></div>
                    <div><dt>Fecha contacto</dt><dd>{selectedContacted.date}</dd></div>
                    <div><dt>Hora contacto</dt><dd>{selectedContacted.time}</dd></div>
                    {selected.resultadoContacto && <div><dt>Resultado del contacto</dt><dd>{label(selected.resultadoContacto)}</dd></div>}
                    {typeof selected.intentosContacto === "number" && <div><dt>Intentos de contacto</dt><dd>{selected.intentosContacto}</dd></div>}
                  </dl>
                  {isBoss && !selected.asignadoAId && selected.atendidoPorNombre && (
                    <div className="ticket-legacy-link">
                      <label>Vincular cuenta real a "{selected.atendidoPorNombre}" (histórico)
                        <select value={linkConsultantId} onChange={(event) => setLinkConsultantId(event.target.value)}>
                          <option value="">Selecciona un consultor…</option>
                          {consultants.map((person) => <option key={person.id} value={person.id}>{fullName(person)}</option>)}
                        </select>
                      </label>
                      <button type="button" disabled={saving || !linkConsultantId} onClick={() => void run(linkTicketConsultant(selected.id, linkConsultantId))}>Vincular</button>
                    </div>
                  )}
                  <label className="ticket-panel-observations">Observaciones
                    <textarea value={observations} readOnly={!canManageSelected} onChange={(event) => setObservations(event.target.value)} placeholder={canManageSelected ? "Describe la atención realizada (opcional)." : "—"} />
                  </label>
                  {selected.estado !== "PENDIENTE" && <label className="ticket-panel-observations">Solución brindada <span>{solution.length}/3000</span>
                    <textarea value={solution} readOnly={!canManageSelected} onChange={(event) => setSolution(event.target.value)} placeholder="—" />
                  </label>}
                </section>
              </> : <section className="ticket-history-list"><h3>Trazabilidad del caso</h3>{selected.historial?.map((entry) => <article key={entry.id}><i><Check /></i><div><b>{entry.accion}</b><span>{fullName(entry.usuario)} · {fullDate(entry.createdAt)}</span>{(entry.estadoAnterior || entry.estadoNuevo || entry.metadata?.moduloAnterior || entry.metadata?.areaAnterior) && <small className="ticket-history-meta">{entry.estadoAnterior && entry.estadoNuevo && `${statusLabel(entry.estadoAnterior)} → ${statusLabel(entry.estadoNuevo)}`}{entry.metadata?.moduloAnterior && ` · ${entry.metadata.moduloAnterior} → ${entry.metadata.moduloNuevo}`}{entry.metadata?.areaAnterior && ` · Área: ${entry.metadata.areaAnterior} → ${entry.metadata.areaNueva}`}</small>}{entry.comentario && <p>{entry.comentario}</p>}</div></article>)}{!selected.historial?.length && <p className="ticket-empty">Aún no hay movimientos registrados.</p>}</section>}
            </main>
            <footer>
              <button type="button" onClick={() => setSelected(undefined)}>Cerrar</button>
              {selected.estado === "PENDIENTE" && (!selected.asignadoAId || selected.asignadoAId === user.id) && canTakeCases && <button type="button" className="primary" disabled={saving} onClick={() => void claimTicket(selected)}><Headphones />{saving ? "Asignando…" : "Tomar caso"}</button>}
              {selected.estado === "EN_CURSO" && canEditSelected && <><button type="button" className="ticket-save-action" disabled={saving} onClick={() => void run(saveTicketAdvance(selected.id, { modulo: moduleValue, areaDestino: areaDestinoValue, observaciones: observations, solucion: solution }))}><Save />Guardar avance</button><button type="button" className="primary" disabled={saving} onClick={() => void runAndCloseDetail(finishTicket(selected.id, { observaciones: observations, solucion: solution }))}><CheckCircle2 />Finalizar caso</button></>}
              {selected.estado === "FINALIZADO" && isBoss && <><button type="button" className="ticket-save-action" disabled={saving} onClick={() => void run(saveTicketAdvance(selected.id, { modulo: moduleValue, areaDestino: areaDestinoValue, observaciones: observations, solucion: solution }))}><Save />Guardar corrección</button><button type="button" disabled={saving} onClick={() => void requestReopen(selected)}><RefreshCcw />Reabrir</button></>}
              {selected.estado === "RECHAZADO" && isBoss && <button type="button" disabled={saving} onClick={() => void requestReopen(selected)}><RefreshCcw />Reabrir</button>}
            </footer>
          </aside>
        </div>,
        document.body,
      )
    : null;

  return <div className="ticket-workspace">
    {success&&<div className="ticket-feedback" role="status"><CheckCircle2/>{success}<button type="button" onClick={()=>setSuccess("")} aria-label="Cerrar confirmación"><X/></button></div>}
    {error && <div className="ticket-feedback" role="status"><AlertTriangle />{error}<button onClick={() => setError("")} aria-label="Cerrar aviso"><X /></button></div>}
    <section className="ticket-kpis" aria-label="Indicadores de atención">
      <article><span className="pending"><Clock3 /></span><div><b>{summary.pending ?? 0}</b><small>Pendientes</small></div></article>
      <article><span className="progress"><Inbox /></span><div><b>{summary.progress ?? 0}</b><small>En curso</small></div></article>
      <article><span className="finished"><CheckCircle2 /></span><div><b>{summary.finishedToday ?? 0}</b><small>Finalizados hoy</small></div></article>
      <article><span className="average"><BarChart3 /></span><div><b>{summary.total ?? 0}</b><small>Total registrado</small></div></article>
    </section>

    <div className="ticket-operational-layout">
      <section className="ticket-table-panel">
        <nav className="ticket-quick-tabs" aria-label="Vistas rápidas">{tabs.map((tab) => <button key={tab.id} className={quickTab === tab.id ? "active" : ""} onClick={() => { setQuickTab(tab.id); setStatusFilter(""); setPage(1); }}>{tab.id !== "all" && <i className={`tab-dot ${tab.id.toLowerCase()}`} />}{tab.text} <span>({tab.count})</span></button>)}</nav>
        <div className="ticket-toolbar">
          <label className="ticket-search"><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por N° de ticket, RUC, razón social, usuario o consulta..." /></label>
          <select aria-label="Cliente" value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setPage(1); }}><option value="">Cliente: Todos</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.razonSocial}</option>)}</select>
          <select aria-label="Módulo" value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setPage(1); }}><option value="">Módulo: Todos</option>{catalogs.modules.map((module) => <option key={module}>{module}</option>)}</select>
          <select aria-label="Estado" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setQuickTab("all"); setPage(1); }}><option value="">Estado: Todos</option><option value="PENDIENTE">Pendiente</option><option value="EN_CURSO">En curso</option><option value="FINALIZADO">Finalizado</option><option value="RECHAZADO">Rechazado</option></select>
          <select aria-label="Asignado a" value={assigneeFilter} onChange={(event) => { setAssigneeFilter(event.target.value); setPage(1); }}><option value="">Asignado a: Todos</option><option value="__mine__">Asignado a: Mis casos</option>{consultants.map((person) => <option key={person.id} value={person.id}>{fullName(person)}</option>)}</select>
          <button className="ticket-clear" onClick={clearFilters}>Limpiar</button>
          <div className="ticket-date-range" role="group" aria-label="Filtrar por fecha de registro">
            <span><CalendarRange />Fecha de registro</span>
            <label>Desde<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label>
            <label>Hasta<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label>
          </div>
        </div>

        <div className="ticket-table-wrap" aria-busy={loading}>
          <table className="ticket-table">
            <colgroup>
              <col className="ticket-col-number" />
              <col className="ticket-col-date" />
              <col className="ticket-col-client" />
              <col className="ticket-col-module" />
              <col className="ticket-col-query" />
              <col className="ticket-col-state" />
              <col className="ticket-col-assignee" />
              <col className="ticket-col-actions" />
            </colgroup>
            <thead><tr><th>#</th><th>Fecha / Hora</th><th>Cliente</th><th>Módulo</th><th>Consulta</th><th>Estado</th><th>Asignado a</th><th>Acciones</th></tr></thead>
            <tbody>
            {rows.map((ticket) => {
              const registered = dateTime(ticket.registradoAt);
              return <tr key={ticket.id} onClick={() => void openTicket(ticket)}>
                <td><b className="ticket-number">{ticket.numeroTicket}</b></td>
                <td><b>{registered.date}</b><small>{registered.time}</small></td>
                <td><b>{ticket.ruc}</b><small title={ticket.razonSocial}>{ticket.razonSocial}</small></td>
                <td><span className="ticket-module">{ticket.modulo}</span><small className="ticket-area-destination">{ticket.areaDestino || "Consultoría"}</small></td>
                <td><span className="ticket-query-preview" title={ticket.consulta}>{ticket.consulta}</span></td>
                <td><span className={`ticket-state ${ticket.estado.toLowerCase()}`}><span className="ticket-state-icon" aria-hidden="true">{ticket.estado === "FINALIZADO" ? <Check /> : <i />}</span>{statusLabel(ticket.estado)}</span></td>
                <td>
                  {ticket.asignadoA ? (
                    <span className="ticket-table-person" title={fullName(ticket.asignadoA)}>
                      {ticket.asignadoA.fotoPerfil ? (
                        <img src={ticket.asignadoA.fotoPerfil} alt="" />
                      ) : (
                        <i>{initials(ticket.asignadoA)}</i>
                      )}
                      <b>{fullName(ticket.asignadoA)}</b>
                    </span>
                  ) : ticket.atendidoPorNombre ? (
                    <span className="ticket-table-person ticket-table-person-legacy" title={`Histórico: ${ticket.atendidoPorNombre} (sin cuenta vinculada)`}>
                      <i>{ticket.atendidoPorNombre.trim().slice(0, 2).toUpperCase()}</i>
                      <b>{ticket.atendidoPorNombre}</b>
                    </span>
                  ) : (
                    <span className="ticket-unassigned">—</span>
                  )}
                </td>
                <td>
                  <div className="ticket-row-actions">
                    <button className="ticket-take-action" disabled={saving} onClick={(event) => { event.stopPropagation(); void openTicket(ticket); }}><Headphones />{ticket.estado === "PENDIENTE" && (!ticket.asignadoAId || ticket.asignadoAId === user.id) && canTakeCases ? "Tomar" : "Abrir"}</button>
                    {ticket.estado !== "FINALIZADO" && ticket.estado !== "RECHAZADO" && canTakeCases && <button className="ticket-reject-action" disabled={saving} onClick={(event) => { event.stopPropagation(); void rejectCase(ticket); }}><Ban />Rechazar</button>}
                    {isBoss && ticket.estado !== "FINALIZADO" && ticket.estado !== "RECHAZADO" && <div className="ticket-row-menu" data-ticket-menu={ticket.id}>
                      <button
                        type="button"
                        className="ticket-more-action"
                        aria-label={`Más acciones para ${ticket.numeroTicket}`}
                        aria-expanded={rowMenuId === ticket.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setRowMenuId((current) => current === ticket.id ? undefined : ticket.id);
                        }}
                      ><MoreVertical /></button>
                      {rowMenuId === ticket.id && (
                        <div className="ticket-row-menu-popover" onClick={(event) => event.stopPropagation()}>
                          <section className="ticket-menu-reassign">
                            <span><UserRound />Reasignar a</span>
                            <div>
                              {consultants.map((person) => (
                                <button
                                  type="button"
                                  key={person.id}
                                  className={ticket.asignadoAId === person.id ? "selected" : ""}
                                  disabled={saving || ticket.asignadoAId === person.id}
                                  onClick={() => void assignTicket(ticket, person)}
                                >
                                  {person.fotoPerfil ? <img src={person.fotoPerfil} alt="" /> : <i>{initials(person)}</i>}
                                  <b>{fullName(person)}</b>
                                  {ticket.asignadoAId === person.id && <Check />}
                                </button>
                              ))}
                            </div>
                          </section>
                        </div>
                      )}
                    </div>}
                  </div>
                </td>
              </tr>;
            })}
            {!loading && !rows.length && <tr><td colSpan={8}><div className="ticket-empty"><CheckCircle2 /><b>Sin resultados</b><span>No hay tickets que coincidan con los filtros.</span></div></td></tr>}
            {loading && !rows.length && <tr><td colSpan={8}><div className="ticket-table-loading">Actualizando tickets…</div></td></tr>}
          </tbody></table>
        </div>
        <footer className="ticket-pagination"><span>Mostrando {rows.length} de {total} resultados</span><label><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option>10</option><option>20</option><option>50</option><option>100</option></select> por página</label><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></button><b>{page} / {pages}</b><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></button></footer>
      </section>

      <section className="ticket-side-panels">
        <article className="ticket-summary-panel"><header><h3>Resumen de atención</h3><span>Hoy</span></header><div><i className="ticket-summary-chart" style={chartStyle}><b>{summary.total ?? 0}<small>Tickets</small></b></i><ul><li><i className="pending" />Pendientes <b>{summary.pending ?? 0}</b></li><li><i className="progress" />En curso <b>{summary.progress ?? 0}</b></li><li><i className="finished" />Finalizados <b>{finalized}</b></li></ul></div></article>
        <article className="ticket-consultants-panel"><header><h3>Consultores</h3><span>{consultants.length}</span></header><div>{consultants.map((person) => { const active = Number(person._count?.ticketsAsignados ?? 0); return <article key={person.id}><i className="ticket-consultant-avatar">{initials(person)}</i><p><b>{fullName(person)}</b><small><i className={active ? "busy" : "available"} />{active ? `En ${active} caso${active > 1 ? "s" : ""}` : person.estadoMensaje || "Sin estado"}</small></p></article>; })}{!consultants.length && <p className="ticket-empty-copy">No hay consultores registrados.</p>}</div></article>
        <article className="ticket-rejected-panel"><header><h3>Rechazados</h3><span>{rejectedRows.length}</span></header><div>{rejectedRows.map((ticket) => <article key={ticket.id}><div><b className="ticket-number">{ticket.numeroTicket}</b><p title={ticket.razonSocial}>{ticket.razonSocial}</p></div>{isBoss ? <button type="button" disabled={saving} onClick={() => void requestReopen(ticket, { fromPanel: true })}><RefreshCcw />Reabrir</button> : <span className="ticket-state rechazado"><span className="ticket-state-icon" aria-hidden="true"><i /></span>Rechazado</span>}</article>)}{!rejectedRows.length && <p className="ticket-empty-copy">No hay casos rechazados.</p>}</div></article>
      </section>
    </div>

    {canRegister && <button className="ticket-mobile-new" onClick={() => setRegisterOpen(true)}><Plus />Registrar caso<ChevronRight /></button>}
    {registerModal}
    {detailPanel}
  </div>;
}
