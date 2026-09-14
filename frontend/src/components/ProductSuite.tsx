import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowDownUp,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Mail,
  MailOpen,
  MessageSquareText,
  MoreVertical,
  Plug,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { AdministrationHub } from "./AdministrationHub";
import {
  archiveNotification,
  fetchAdoptionSummary,
  fetchNotifications,
  fetchProductRecords,
  readAllNotifications,
  readNotification,
  saveProductRecord,
  updateProductRecord,
  downloadMonthlyReport,
} from "../api/iniciativas";

const management = (u: any) =>
  u.isSuperAdmin ||
  u.rol === "Admin" ||
  /gerente|jefe|administrador/i.test(u.cargo || "");
const date = (v: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(v));

function Empty({ children }: { children: string }) {
  return <div className="suite-empty">{children}</div>;
}

export function MyWork({ user, items }: { user: any; items: any[] }) {
  const [selectedTask, setSelectedTask] = useState<any | null>(null),
    [workFilter, setWorkFilter] = useState<"all" | "overdue" | "upcoming">("all"),
    [workQuery, setWorkQuery] = useState("");
  const tasks = useMemo(
    () =>
      items
        .flatMap((project) =>
          (project.tareas ?? []).map((task: any) => ({
            ...task,
            project: project.titulo,
            projectId: project.id,
          })),
        )
        .filter(
          (task: any) =>
            !task.completada &&
            (!task.responsableId || task.responsableId === user.id),
        ),
    [items, user.id],
  );
  const overdue = tasks.filter(
    (t: any) => t.fechaFin && new Date(t.fechaFin) < new Date(),
    ),
    dueSoon = tasks.filter((t: any) => {
      if (!t.fechaFin) return false;
      const remaining = new Date(t.fechaFin).getTime() - Date.now();
      return remaining >= 0 && remaining <= 7 * 86400000;
    }),
    ownedProjects = items.filter(
      (item) => item.responsableId === user.id || item.responsable?.includes(user.nombres),
    ),
    visibleTasks = tasks
      .filter((task: any) => {
        if (workFilter === "overdue" && !overdue.includes(task)) return false;
        if (workFilter === "upcoming" && !dueSoon.includes(task)) return false;
        const needle = workQuery.trim().toLowerCase();
        return !needle || `${task.titulo} ${task.project} ${task.prioridad || ""}`.toLowerCase().includes(needle);
      })
      .sort((a: any, b: any) => {
        const aDate = a.fechaFin ? new Date(a.fechaFin).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.fechaFin ? new Date(b.fechaFin).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
  return (
    <div className="suite-grid suite-dashboard suite-work">
      <section className="suite-hero">
        <BriefcaseBusiness />
        <div>
          <span>Centro personal</span>
          <h2>Mi trabajo</h2>
          <p>Todo lo que requiere tu atención, reunido y priorizado.</p>
        </div>
      </section>
      <div className="suite-kpis">
        <article className="suite-kpi blue">
          <span className="suite-kpi-icon">
            <CheckCircle2 />
          </span>
          <b>{tasks.length}</b>
          <span>Tareas abiertas</span>
        </article>
        <article className="suite-kpi red">
          <span className="suite-kpi-icon">
            <Activity />
          </span>
          <b>{overdue.length}</b>
          <span>Vencidas</span>
        </article>
        <article className="suite-kpi green">
          <span className="suite-kpi-icon">
            <CalendarDays />
          </span>
          <b>{dueSoon.length}</b>
          <span>Próximas 7 días</span>
        </article>
        <article className="suite-kpi violet">
          <span className="suite-kpi-icon">
            <BriefcaseBusiness />
          </span>
          <b>
            {ownedProjects.length}
          </b>
          <span>Proyectos a cargo</span>
        </article>
      </div>
      <section className="suite-card suite-span">
        <header className="work-list-header">
          <div>
            <span>SEGUIMIENTO PERSONAL</span>
            <h3>Prioridades</h3>
          </div>
          <b>{visibleTasks.length} de {tasks.length}</b>
        </header>
        <div className="work-toolbar">
          <div role="tablist" aria-label="Filtrar tareas">
            <button type="button" role="tab" aria-selected={workFilter === "all"} className={workFilter === "all" ? "active" : ""} onClick={() => setWorkFilter("all")}>Todas <b>{tasks.length}</b></button>
            <button type="button" role="tab" aria-selected={workFilter === "overdue"} className={workFilter === "overdue" ? "active" : ""} onClick={() => setWorkFilter("overdue")}>Vencidas <b>{overdue.length}</b></button>
            <button type="button" role="tab" aria-selected={workFilter === "upcoming"} className={workFilter === "upcoming" ? "active" : ""} onClick={() => setWorkFilter("upcoming")}>Próximas <b>{dueSoon.length}</b></button>
          </div>
          <label>
            <Search />
            <input value={workQuery} onChange={(event) => setWorkQuery(event.target.value)} placeholder="Buscar tarea o proyecto" aria-label="Buscar en mi trabajo" />
          </label>
        </div>
        {visibleTasks.length ? (
          <div className="suite-list">
            {visibleTasks.map((t: any) => (
                <article key={t.id} role="button" tabIndex={0} className="work-task-preview" onClick={() => setSelectedTask(t)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedTask(t); }}>
                  <CheckCircle2 />
                  <div>
                    <b>{t.titulo}</b>
                    <span>
                      {t.project} ·{" "}
                      {t.fechaFin
                        ? `vence ${new Date(t.fechaFin).toLocaleDateString("es-PE")}`
                        : "sin fecha límite"}
                    </span>
                  </div>
                  <em className={overdue.includes(t) ? "danger" : ""}>
                    {t.prioridad || "Normal"}
                  </em>
                  <time className={overdue.includes(t) ? "danger" : ""} dateTime={t.fechaFin || undefined}>
                    <CalendarDays />
                    {t.fechaFin ? new Date(t.fechaFin).toLocaleDateString("es-PE") : "Sin fecha"}
                  </time>
                  <span className="work-open-action">Ver detalle</span>
                </article>
              ))}
          </div>
        ) : (
          <Empty>{tasks.length ? "No hay tareas que coincidan con este filtro." : "No tienes tareas pendientes."}</Empty>
        )}
      </section>
      {selectedTask && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Detalle de tarea" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTask(null); }}>
          <section className="work-task-modal">
            <button className="close" type="button" onClick={() => setSelectedTask(null)} aria-label="Cerrar detalle"><X /></button>
            <span className="eyebrow">TAREA PRIORITARIA</span>
            <h2>{selectedTask.titulo}</h2>
            <p>{selectedTask.comentario || "Esta tarea todavía no tiene una descripción adicional."}</p>
            <div className="work-task-facts">
              <article><span>Proyecto</span><b>{selectedTask.project}</b></article>
              <article><span>Prioridad</span><b>{selectedTask.prioridad || "Normal"}</b></article>
              <article><span>Estado</span><b>{selectedTask.estado || "Pendiente"}</b></article>
              <article><span>Inicio</span><b>{selectedTask.fechaInicio ? new Date(selectedTask.fechaInicio).toLocaleDateString("es-PE") : "Sin fecha"}</b></article>
              <article><span>Fin estimado</span><b>{selectedTask.fechaFin ? new Date(selectedTask.fechaFin).toLocaleDateString("es-PE") : "Sin fecha"}</b></article>
              <article><span>Responsable</span><b>{selectedTask.responsable ? `${selectedTask.responsable.nombres} ${selectedTask.responsable.apellidos}` : "Sin asignar"}</b></article>
            </div>
            <button className="primary" type="button" onClick={() => setSelectedTask(null)}>Entendido</button>
          </section>
        </div>
      )}
    </div>
  );
}

export function NotificationCenter({
  onUnreadChange,
  onNavigate,
}: {
  onUnreadChange?: (count: number) => void;
  onNavigate?: (destination: string) => void;
}) {
  const [rows, setRows] = useState<any[]>([]),
    [archivedRows, setArchivedRows] = useState<any[]>([]),
    [tab, setTab] = useState<"all" | "unread" | "read" | "archived">("all"),
    [query, setQuery] = useState(""),
    [typeFilter, setTypeFilter] = useState("all"),
    [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent"),
    [openMenu, setOpenMenu] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [active, archived] = await Promise.all([
        fetchNotifications(false),
        fetchNotifications(true),
      ]);
      setRows(active);
      setArchivedRows(archived);
      onUnreadChange?.(active.filter((row: any) => !row.leidaAt).length);
    } catch {
      setError("No pudimos cargar las notificaciones. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!openMenu) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".notification-more"))
        setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openMenu]);

  const unread = rows.filter((r) => !r.leidaAt).length;
  const read = rows.length - unread;
  const today = new Date();
  const readToday = [...rows, ...archivedRows].filter((row) => {
    if (!row.leidaAt) return false;
    const value = new Date(row.leidaAt);
    return (
      value.getFullYear() === today.getFullYear() &&
      value.getMonth() === today.getMonth() &&
      value.getDate() === today.getDate()
    );
  }).length;

  const baseRows = tab === "archived" ? archivedRows : rows;
  const types = Array.from(
    new Set([...rows, ...archivedRows].map((row) => String(row.tipo || "general"))),
  ).sort((a, b) => a.localeCompare(b));
  const shown = baseRows
    .filter((row) => {
      if (tab === "unread" && row.leidaAt) return false;
      if (tab === "read" && !row.leidaAt) return false;
      if (typeFilter !== "all" && String(row.tipo || "general") !== typeFilter)
        return false;
      return JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase());
    })
    .sort((a, b) => {
      const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === "recent" ? delta : -delta;
    });

  const classify = (row: any) => {
    const value = `${row.tipo || ""} ${row.titulo || ""} ${row.mensaje || ""}`.toLowerCase();
    if (/complet|finaliz|aprob/.test(value))
      return { key: "completed", label: "Completada", Icon: CheckCircle2 };
    if (/reuni|calendar|evento/.test(value))
      return { key: "meeting", label: "Reunión", Icon: CalendarDays };
    if (/invit|mensaje|chat/.test(value))
      return { key: "invitation", label: "Invitación", Icon: Mail };
    if (/tarea/.test(value))
      return { key: "task", label: "Tarea", Icon: BriefcaseBusiness };
    if (/retras|vencid|urgente|alta/.test(value))
      return { key: "priority", label: "Alta prioridad", Icon: Bell };
    return { key: "tracking", label: "En seguimiento", Icon: Bell };
  };

  const markRead = async (row: any) => {
    if (row.leidaAt) return;
    const readAt = new Date().toISOString();
    setRows((current) =>
      current.map((item) =>
        item.id === row.id ? { ...item, leidaAt: readAt } : item,
      ),
    );
    onUnreadChange?.(Math.max(0, unread - 1));
    try {
      await readNotification(row.id);
    } catch {
      setError("No pudimos marcar la notificación como leída.");
      await load();
    }
  };

  const destinationFor = (row: any) => {
    const explicit = String(row.enlace || "").trim();
    if (explicit) return explicit;
    const type = `${row.tipo || ""} ${row.titulo || ""}`.toLowerCase();
    if (/ticket|caso/.test(type)) return "ticketera";
    if (/aprob/.test(type)) return "aprobaciones";
    if (/invit|mensaje|chat/.test(type)) return "mensajes";
    if (/reuni|calendar|evento/.test(type)) return "calendario";
    if (/tarea|retras|vencid|cronograma/.test(type)) return "cronograma";
    if (/iniciativa|proyecto/.test(type)) return "iniciativas";
    return "";
  };

  const openNotification = (row: any) => {
    if (!row.leidaAt) void markRead(row);
    const destination = destinationFor(row);
    if (destination) onNavigate?.(destination);
  };

  const archive = async (row: any) => {
    try {
      await archiveNotification(row.id);
      setOpenMenu(null);
      await load();
    } catch {
      setError("No pudimos archivar la notificación.");
    }
  };

  return (
    <div className="notification-center">
      <section className="notification-hero">
        <span className="notification-hero-icon"><Bell /></span>
        <div className="notification-hero-copy">
          <small>CENTRO DE NOTIFICACIONES</small>
          <h2>Mantente informado en todo momento</h2>
          <p>Controla avisos, solicitudes y cambios importantes sin perder el contexto.</p>
        </div>
        <div className="notification-hero-art" aria-hidden="true">
          <span><Mail /></span>
          <Send />
          <b>Tu actividad,<br />siempre al día.</b>
        </div>
      </section>

      <div className="notification-kpis">
        <button className={tab === "all" ? "blue active" : "blue"} onClick={() => setTab("all")}>
          <span className="notification-kpi-icon"><Bell /></span>
          <span><b>{rows.length}</b><small>Total en esta vista</small></span>
          <i className="notification-mini-bars" aria-hidden="true"><u /><u /><u /><u /></i>
        </button>
        <button className={tab === "unread" ? "amber active" : "amber"} onClick={() => setTab("unread")}>
          <span className="notification-kpi-icon"><MailOpen /></span>
          <span><b>{unread}</b><small>Pendientes de lectura</small></span>
          <i className="notification-mini-bars" aria-hidden="true"><u /><u /><u /><u /></i>
        </button>
        <button className={tab === "archived" ? "violet active" : "violet"} onClick={() => setTab("archived")}>
          <span className="notification-kpi-icon"><Archive /></span>
          <span><b>{archivedRows.length}</b><small>Archivadas</small></span>
          <i className="notification-mini-bars" aria-hidden="true"><u /><u /><u /><u /></i>
        </button>
        <button className={tab === "read" ? "green active" : "green"} onClick={() => setTab("read")}>
          <span className="notification-kpi-icon"><CheckCircle2 /></span>
          <span><b>{readToday}</b><small>Leídas hoy</small></span>
          <i className="notification-mini-bars" aria-hidden="true"><u /><u /><u /><u /></i>
        </button>
      </div>

      <section className="notification-feed">
        <div className="notification-controls">
          <div className="notification-tabs" role="tablist" aria-label="Vistas de notificaciones">
            {[
              ["all", "Todas", rows.length],
              ["unread", "No leídas", unread],
              ["read", "Leídas", read],
              ["archived", "Archivadas", archivedRows.length],
            ].map(([value, label, count]) => (
              <button
                key={String(value)}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                onClick={() => setTab(value as typeof tab)}
              >
                {label} <span>({count})</span>
              </button>
            ))}
          </div>

          <div className="notification-filters">
            <label className="notification-search">
              <Search />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar notificación..." />
            </label>
            <label className="notification-select-control">
              <Filter />
              <select aria-label="Filtrar notificaciones" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">Filtrar: todas</option>
                {types.map((type) => <option value={type} key={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
              </select>
              <ChevronDown />
            </label>
            <label className="notification-select-control sort">
              <ArrowDownUp />
              <select aria-label="Ordenar notificaciones" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguas</option>
              </select>
              <ChevronDown />
            </label>
          </div>
        </div>

        <div className="notification-feed-actions">
          <button
            type="button"
            disabled={!unread}
            onClick={async () => {
              try {
                await readAllNotifications();
                const readAt = new Date().toISOString();
                setRows((current) =>
                  current.map((row) => ({ ...row, leidaAt: row.leidaAt || readAt })),
                );
                onUnreadChange?.(0);
                await load();
              } catch {
                setError("No pudimos marcar todas las notificaciones como leídas.");
              }
            }}
          >
            <Check /> Marcar todo como leído
          </button>
        </div>

        {error && <div className="notification-error"><Bell />{error}<button onClick={() => void load()}>Reintentar</button></div>}
        {loading ? (
          <div className="notification-loading"><i /><span>Cargando notificaciones...</span></div>
        ) : shown.length ? (
          <div className="notification-list">
            {shown.map((row) => {
              const meta = classify(row);
              const Icon = meta.Icon;
              return (
                <article className={`${row.leidaAt ? "read" : "unread"} kind-${meta.key}`} key={row.id}>
                  <span className="notification-row-icon"><Icon /></span>
                  {!row.leidaAt && <i className="notification-unread-dot" aria-label="No leída" />}
                  <button className="notification-copy" type="button" onClick={() => openNotification(row)}>
                    <b>{row.titulo || row.tipo || "Notificación"}</b>
                    <small>{row.mensaje || row.descripcion || "Actualización del sistema"}</small>
                  </button>
                  <span className={`notification-badge ${meta.key}`}>{meta.label}</span>
                  <time>{date(row.createdAt)}</time>
                  {tab !== "archived" ? (
                    <button className="notification-archive" type="button" onClick={() => void archive(row)}>Archivar</button>
                  ) : (
                    <span className="notification-archived-label"><Archive /> Archivada</span>
                  )}
                  <div className="notification-more">
                    <button type="button" aria-label="Más opciones" aria-expanded={openMenu === row.id} onClick={() => setOpenMenu((current) => current === row.id ? null : row.id)}><MoreVertical /></button>
                    {openMenu === row.id && (
                      <div>
                        {!row.leidaAt && <button type="button" onClick={() => { setOpenMenu(null); void markRead(row); }}><Check /> Marcar como leída</button>}
                        {tab !== "archived" && <button type="button" onClick={() => void archive(row)}><Archive /> Archivar</button>}
                        {row.leidaAt && tab === "archived" && <span>Sin acciones pendientes</span>}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <Empty>No hay notificaciones que coincidan con esta vista.</Empty>}
      </section>
    </div>
  );
}

export function Clients360({ items }: { items: any[] }) {
  const [worker, setWorker] = useState("");
  const linkedWorkers = (project: any): {id: string; name: string}[] => [
    ...(project.responsableId ? [{id: project.responsableId, name: project.responsable}] : []),
    ...(project.tareas ?? []).filter((task: any) => task.responsableId).map((task: any) => ({id: task.responsableId, name: task.responsable ? `${task.responsable.nombres} ${task.responsable.apellidos}` : items.find((item) => item.responsableId === task.responsableId)?.responsable || "Trabajador asignado"})),
  ];
  const workers = Array.from(new Map(items.flatMap(linkedWorkers).map((person) => [person.id, person])).values()).sort((a,b) => a.name.localeCompare(b.name));
  const clients = useMemo(
    () => Array.from(new Set(items.map((i) => i.cliente).filter(Boolean))),
    [items],
  );
  const [client, setClient] = useState(String(clients[0] || "")),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [showDates, setShowDates] = useState(true);
  const projects = items.filter((i) => i.cliente === client && (!worker || linkedWorkers(i).some((person) => person.id === worker))),
    slice = projects.slice(page * 5, page * 5 + 5);
  const exportCsv = () => {
    const csv = [
      "Código,Proyecto,Estado,Avance,Reuniones",
      ...projects
        .filter((p: any) => !selected.length || selected.includes(p.id))
        .map((p: any) =>
          [p.codigo, p.titulo, p.estado, p.avance, p.reuniones].join(","),
        ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `cliente-${client}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="suite-grid suite-dashboard suite-clients">
      <section className="suite-hero">
        <Users />
        <div>
          <span>VISIÓN 360°</span>
          <h2>{client || "Clientes"}</h2>
          <p>
            Proyectos, tareas, reuniones y responsables en un único contexto.
          </p>
        </div>
        <select
          value={client}
          onChange={(e) => {
            setClient(e.target.value);
            setPage(0);
            setSelected([]);
          }}
        >
          <option value="">Seleccionar cliente</option>
          {clients.map((c) => (
            <option key={String(c)}>{String(c)}</option>
          ))}
        </select>
      </section>
      <section className="suite-card suite-span">
        <label style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <Users size={20}/><b>Filtrar por trabajador</b>
          <select aria-label="Filtrar proyectos del cliente por trabajador" value={worker} onChange={(event)=>{setWorker(event.target.value);setPage(0);setSelected([])}} style={{padding:"10px 14px",maxWidth:"100%",background:"var(--surface)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:10}}>
            <option value="">Todos los trabajadores</option>
            {workers.map((person)=><option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          {worker&&<button type="button" onClick={()=>{setWorker("");setPage(0);setSelected([])}}>Limpiar filtro</button>}
        </label>
        <p>Incluye responsables de proyectos e iniciativas y trabajadores asignados a sus tareas.</p>
      </section>
      <div className="suite-kpis">
        <article className="suite-kpi blue">
          <span className="suite-kpi-icon">
            <BriefcaseBusiness />
          </span>
          <b>{projects.length}</b>
          <span>Proyectos</span>
          <small className="suite-kpi-context">{client || "Cliente no seleccionado"}</small>
        </article>
        <article className="suite-kpi violet">
          <span className="suite-kpi-icon">
            <CheckCircle2 />
          </span>
          <b>{projects.reduce((n, p) => n + p.tareas.length, 0)}</b>
          <span>Tareas</span>
          <small className="suite-kpi-context">{client || "Cliente no seleccionado"}</small>
        </article>
        <article className="suite-kpi green">
          <span className="suite-kpi-icon">
            <Users />
          </span>
          <b>{projects.reduce((n, p) => n + (p.reuniones || 0), 0)}</b>
          <span>Reuniones</span>
          <small className="suite-kpi-context">{client || "Cliente no seleccionado"}</small>
        </article>
      </div>
      <section className="suite-card suite-span">
        <div className="suite-toolbar">
          <h3>Portafolio del cliente</h3>
          <button onClick={() => setShowDates((v) => !v)}>
            <Settings2 /> Columnas
          </button>
          <button onClick={exportCsv}>
            <Download /> Exportar selección
          </button>
        </div>
        {projects.length ? (
          <>
            <div className="suite-table">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Código</th>
                    <th>Proyecto</th>
                    <th>Estado</th>
                    <th>Avance</th>
                    {showDates && <th>Fin estimado</th>}
                    <th>Reuniones</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={() =>
                            setSelected((s) =>
                              s.includes(p.id)
                                ? s.filter((x) => x !== p.id)
                                : [...s, p.id],
                            )
                          }
                        />
                      </td>
                      <td>{p.codigo}</td>
                      <td>
                        <b>{p.titulo}</b>
                        <small className="client-project-context">{client || p.cliente || "Sin cliente"} · {p.responsable || "Sin asignar"}</small>
                      </td>
                      <td>{p.estado}</td>
                      <td>{p.avance}%</td>
                      {showDates && (
                        <td>
                          {p.fechaFin
                            ? new Date(p.fechaFin).toLocaleDateString("es-PE")
                            : "—"}
                        </td>
                      )}
                      <td>{p.reuniones || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="suite-pagination">
              <span>
                {projects.length} registros · página {page + 1}
              </span>
              <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <button
                disabled={(page + 1) * 5 >= projects.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </>
        ) : (
          <Empty>Este cliente aún no tiene proyectos.</Empty>
        )}
      </section>
    </div>
  );
}

function ApprovalRules({ areas }: { areas: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => fetchProductRecords("regla_aprobacion").then(setRows);
  useEffect(() => {
    void load();
  }, []);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await saveProductRecord("regla_aprobacion", {
      nombre: f.get("nombre"),
      entidad: f.get("entidad"),
      area: f.get("area"),
      etapas: String(f.get("etapas"))
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      activa: true,
    });
    e.currentTarget.reset();
    load();
  };
  return (
    <section className="suite-card">
      <h3>Flujos de aprobación configurables</h3>
      <form className="suite-form" onSubmit={submit}>
        <input name="nombre" placeholder="Nombre de la regla" required />
        <select name="entidad">
          <option>Proyectos</option>
          <option>Objetivos</option>
          <option>Documentos</option>
          <option>Requerimientos</option>
        </select>
        <select name="area" required>
          <option>Todas</option>
          {areas.map((area) => (
            <option key={area.id}>{area.nombre}</option>
          ))}
        </select>
        <select name="etapas" required>
          <option value="Gerente">Gerente</option>
          <option value="Jefe,Gerente">Jefe → Gerente</option>
          <option value="Jefe,Gerente,Administración">
            Jefe → Gerente → Administración
          </option>
          <option value="Gerente,Administración">
            Gerente → Administración
          </option>
        </select>
        <button className="primary">Crear regla</button>
      </form>
      <div className="suite-list">
        {rows.map((r) => (
          <article key={r.id}>
            <CheckCircle2 />
            <div>
              <b>{r.datos.nombre}</b>
              <span>
                {r.datos.entidad} · {(r.datos.etapas || []).join(" → ")}
              </span>
            </div>
            <button
              onClick={async () => {
                await updateProductRecord("regla_aprobacion", r.id, {
                  ...r.datos,
                  activa: !r.datos.activa,
                });
                load();
              }}
            >
              {r.datos.activa ? "Desactivar" : "Activar"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Adoption() {
  const [data, setData] = useState<any>({
    events: 0,
    activeUsers: 0,
    byModule: {},
    recent: [],
  });
  useEffect(() => {
    fetchAdoptionSummary().then(setData);
  }, []);
  return (
    <section className="suite-card">
      <h3>Adopción digital · últimos 30 días</h3>
      <div className="suite-kpis">
        <article>
          <b>{data.activeUsers}</b>
          <span>Usuarios activos</span>
        </article>
        <article>
          <b>{data.events}</b>
          <span>Interacciones</span>
        </article>
        <article>
          <b>{Object.keys(data.byModule).length}</b>
          <span>Módulos usados</span>
        </article>
      </div>
      <div className="adoption-bars">
        {Object.entries(data.byModule)
          .sort((a: any, b: any) => b[1] - a[1])
          .map(([name, value]: any) => (
            <div key={name}>
              <span>{name}</span>
              <i>
                <b
                  style={{
                    width: `${Math.max(5, (value / data.events) * 100)}%`,
                  }}
                />
              </i>
              <strong>{value}</strong>
            </div>
          ))}
      </div>
    </section>
  );
}

function Integrations() {
  const providers = [
    "Microsoft 365",
    "Outlook",
    "Teams",
    "Google Calendar",
    "OneDrive SharePoint",
  ];
  const [rows, setRows] = useState<any[]>([]);
  const load = () => fetchProductRecords("integracion").then(setRows);
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="suite-card">
      <h3>Integraciones corporativas</h3>
      <p className="suite-note">
        El portal guarda la configuración, nunca credenciales. La conexión real
        se activa cuando TI registra las credenciales corporativas en el
        servidor.
      </p>
      <div className="integration-grid">
        {providers.map((provider) => {
          const row = rows.find((r) => r.datos.proveedor === provider);
          return (
            <article key={provider}>
              <Plug />
              <div>
                <b>{provider}</b>
                <span>
                  {row?.datos.credentialConfigured
                    ? "Credencial disponible"
                    : "Pendiente de credenciales TI"}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (row)
                    await updateProductRecord("integracion", row.id, {
                      ...row.datos,
                      habilitada: !row.datos.habilitada,
                    });
                  else
                    await saveProductRecord("integracion", {
                      proveedor: provider,
                      habilitada: true,
                    });
                  load();
                }}
              >
                {row?.datos.habilitada ? "Desactivar" : "Configurar"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Research({ user }: { user: any }) {
  const [rows, setRows] = useState<any[]>([]), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const load = () => fetchProductRecords("feedback_usuario").then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="suite-card continuous-improvement">
      <div className="continuous-guide">
        <div className="continuous-guide-icon" aria-hidden="true">
          <Sparkles />
        </div>
        <div className="continuous-guide-copy">
          <span className="continuous-eyebrow">MEJORA CONTINUA</span>
          <h2>Ayúdanos a mejorar EJB Manager</h2>
          <p>
            Registra una dificultad, sugerencia o necesidad que encuentres al
            trabajar. Tu reporte permitirá analizarla, priorizarla y darle
            seguimiento hasta su solución.
          </p>
        </div>
        <div className="continuous-guide-steps" aria-label="Cómo registrar una mejora">
          <span><MessageSquareText /><b>1. Describe</b><small>Indica qué sucede y en qué módulo.</small></span>
          <span><Target /><b>2. Define</b><small>Explica cómo debería funcionar.</small></span>
          <span><CheckCircle2 /><b>3. Envía</b><small>Revisa luego el estado de tu hallazgo.</small></span>
        </div>
      </div>
      <div className="continuous-section-heading">
        <div>
          <span className="continuous-eyebrow">NUEVO HALLAZGO</span>
          <h3>Cuéntanos qué podemos mejorar</h3>
        </div>
        <small>Completa los campos con información clara y concreta.</small>
      </div>
      <form
        className="suite-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget, f = new FormData(form);
          setSaving(true); setError("");
          try {
            await saveProductRecord("feedback_usuario", { modulo:f.get("modulo"), tipo:f.get("tipo"), prioridad:f.get("prioridad"), impacto:f.get("impacto"), detalle:f.get("detalle"), resultadoEsperado:f.get("resultadoEsperado"), evidencia:f.get("evidencia"), solicitante:`${user.nombres} ${user.apellidos}`, solicitanteId:user.id, estado:"Nuevo" });
            form.reset(); await load();
          } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
        }}
      >
        <input name="modulo" placeholder="Módulo evaluado" required />
        <select name="tipo">
          <option>Problema de usabilidad</option>
          <option>Sugerencia</option>
          <option>Error</option>
          <option>Necesidad de capacitación</option>
        </select>
        <select name="prioridad"><option>Normal</option><option>Alta</option><option>Urgente</option><option>Baja</option></select>
        <select name="impacto"><option>Impacto individual</option><option>Impacto en un equipo</option><option>Impacto general</option><option>Bloquea una operación</option></select>
        <textarea
          name="detalle"
          placeholder="Describe la observación y el resultado esperado"
          required
        />
        <textarea name="resultadoEsperado" placeholder="¿Cómo debería funcionar o verse?" required />
        <input name="evidencia" placeholder="Enlace o referencia de evidencia (opcional)" />
        {error && <p className="inline-error" role="alert">{error}</p>}
        <button className="primary" disabled={saving}>{saving ? "Registrando..." : "Registrar hallazgo"}</button>
      </form>
      <div className="continuous-history-heading">
        <div>
          <span className="continuous-eyebrow">SEGUIMIENTO</span>
          <h3>Hallazgos recientes</h3>
        </div>
        <span>{rows.length} registro{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="suite-list continuous-history">
        {rows.slice(0, 10).map((r) => (
          <article key={r.id}>
            <div>
              <b>
                {r.datos.modulo} · {r.datos.tipo}
              </b>
              <span>
                {r.datos.detalle} · {date(r.createdAt)}
                {management(user) && r.creador
                  ? ` · ${r.creador.nombres} ${r.creador.apellidos}`
                  : ""}
              </span>
            </div>
            <div className="research-actions">
              <small>{r.datos.prioridad || "Normal"} · {r.datos.solicitante || `${r.creador?.nombres || ""} ${r.creador?.apellidos || ""}`}</small>
              <select value={r.datos.estado || "Nuevo"} onChange={async (event) => { await updateProductRecord("feedback_usuario", r.id, {...r.datos, estado:event.target.value}); load(); }}><option>Nuevo</option><option>En análisis</option><option>En implementación</option><option>Resuelto</option><option>Descartado</option></select>
            </div>
          </article>
        ))}
        {!rows.length && !error && (
          <div className="suite-empty">Aún no hay hallazgos registrados.</div>
        )}
      </div>
    </section>
  );
}

export function EnterpriseAdmin({ user, areas }: { user: any; areas: any[] }) {
  const [tab, setTab] = useState("admin");
  const tabs = [
    ["admin", "Administración"],
    ["rules", "Aprobaciones"],
    ["adoption", "Adopción"],
    ["integrations", "Integraciones"],
    ["research", "Pruebas UX"],
  ];
  return (
    <div className="suite-admin suite-dashboard">
      <section className="suite-hero suite-admin-hero">
        <ShieldCheck />
        <div>
          <span>GOBIERNO DE PLATAFORMA</span>
          <h2>Centro de administración</h2>
          <p>
            Usuarios, seguridad, automatizaciones e integraciones bajo una
            gestión centralizada.
          </p>
        </div>
        <span className="suite-security-badge">
          <i /> Sistema operativo
        </span>
      </section>
      <div className="suite-tabs">
        {tabs.map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "admin" && <AdministrationHub user={user} areas={areas} />}{" "}
      {tab === "rules" && <ApprovalRules areas={areas} />}
      {tab === "adoption" && <Adoption />}
      {tab === "integrations" && <Integrations />}
      {tab === "research" && <Research user={user} />}
    </div>
  );
}

export function UserFeedback({ user }: { user: any }) {
  return <Research user={user} />;
}

export function ReportingCenter({ items }: { items: any[] }) {
  const [worker, setWorker] = useState("Todos"), [client, setClient] = useState("Todos"), [exporting, setExporting] = useState(""), [exportError, setExportError] = useState("");
  const workers = Array.from(new Set(items.flatMap((item) => [item.responsable,...(item.tareas || []).map((task:any) => task.responsable ? `${task.responsable.nombres} ${task.responsable.apellidos}` : null)]).filter(Boolean)));
  const clients = Array.from(new Set(items.map((item) => item.cliente).filter(Boolean)));
  const rows = items.filter((item) => (worker === "Todos" || item.responsable === worker || (item.tareas || []).some((task:any) => task.responsable && `${task.responsable.nombres} ${task.responsable.apellidos}` === worker)) && (client === "Todos" || item.cliente === client));
  const tasks = rows.flatMap((project) => (project.tareas || []).map((task:any) => ({...task, proyecto:project.titulo, codigo:project.codigo, cliente:project.cliente || "Sin cliente", responsable:task.responsable ? `${task.responsable.nombres} ${task.responsable.apellidos}` : project.responsable || "Sin asignar"}))).filter((task:any) => worker === "Todos" || task.responsable === worker);
  const download = () => { const header=["Código","Proyecto","Cliente","Responsable","Avance","Tarea","Estado tarea","Inicio","Fin estimado","Finalizada"], lines=tasks.map((task:any)=>[task.codigo,task.proyecto,task.cliente,task.responsable,rows.find(r=>r.codigo===task.codigo)?.avance||0,task.titulo,task.estado,task.fechaInicio||"",task.fechaFin||"",task.completadaAt||""]); const csv=[header,...lines].map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\n"); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"})); a.download=`reporte-operativo-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href); };
  const workerId = items.find((item) => item.responsable === worker)?.responsableId || items.flatMap((item) => item.tareas || []).find((task:any) => task.responsable && `${task.responsable.nombres} ${task.responsable.apellidos}` === worker)?.responsableId;
  const exportReport = async (format:"pdf"|"xls", key:string, filters:any) => { try { setExportError(""); setExporting(key); await downloadMonthlyReport(format, filters); } catch (error) { setExportError(error instanceof Error ? error.message : `No se pudo generar el reporte ${format === "xls" ? "de Excel" : "PDF"}`); } finally { setExporting(""); } };
  const pdf = (key:string, filters:any) => exportReport("pdf", key, filters);
  const excel = (key:string, filters:any) => exportReport("xls", key, filters);
  const completed=tasks.filter((task:any)=>task.completada).length, avg=rows.length?Math.round(rows.reduce((sum,item)=>sum+item.avance,0)/rows.length):0;
  const filters = {client:client === "Todos" ? undefined : client,workerId:worker === "Todos" ? undefined : workerId};
  return <div className="suite-grid suite-dashboard reporting-center"><section className="suite-hero"><Download/><div><span>REPORTERÍA OPERATIVA</span><h2>Centro de reportes</h2><p>Descarga el portafolio filtrado o el detalle individual de cada proyecto y tarea.</p></div><div className="reporting-main-actions"><button onClick={download}><Download/>CSV</button><button disabled={Boolean(exporting)} onClick={()=>excel("excel-filtered",filters)}><FileSpreadsheet/>{exporting === "excel-filtered" ? "Generando…" : "Excel"}</button><button className="primary" disabled={Boolean(exporting)} onClick={()=>pdf("pdf-filtered",filters)}><FileText/>{exporting === "pdf-filtered" ? "Generando…" : "PDF filtrado"}</button></div></section><div className="reporting-filters"><label>Trabajador<select value={worker} onChange={e=>setWorker(e.target.value)}><option>Todos</option>{workers.map(value=><option key={value}>{value}</option>)}</select></label><label>Cliente<select value={client} onChange={e=>setClient(e.target.value)}><option>Todos</option>{clients.map(value=><option key={value}>{value}</option>)}</select></label></div>{exportError&&<div className="reporting-error">{exportError}</div>}<div className="suite-kpis"><article className="suite-kpi blue"><b>{rows.length}</b><span>Proyectos</span></article><article className="suite-kpi violet"><b>{avg}%</b><span>Avance promedio</span></article><article className="suite-kpi green"><b>{completed}/{tasks.length}</b><span>Tareas completadas</span></article></div><section className="suite-card suite-span"><h3>Proyectos</h3><div className="suite-table"><table><thead><tr><th>Proyecto</th><th>Cliente</th><th>Responsable</th><th>Avance</th><th>Tareas</th><th>Duración</th><th>Reporte</th></tr></thead><tbody>{rows.map(item=>{const start=item.fechaInicio?new Date(item.fechaInicio):null,end=item.fechaFin?new Date(item.fechaFin):null,days=start&&end?Math.max(1,Math.ceil((end.getTime()-start.getTime())/86400000)):null;return <tr key={item.id}><td><b>{item.codigo}</b><small>{item.titulo}</small></td><td>{item.cliente||"Sin cliente"}</td><td>{item.responsable||"Sin asignar"}</td><td>{item.avance}%</td><td>{item.tareas?.filter((t:any)=>t.completada).length||0}/{item.tareas?.length||0}</td><td>{days?`${days} días`:"Sin fechas"}</td><td><div className="report-format-actions"><button className="report-pdf-button" disabled={Boolean(exporting)} onClick={()=>excel(`project-xls-${item.id}`,{projectId:item.id})}><FileSpreadsheet/>{exporting === `project-xls-${item.id}` ? "…" : "Excel"}</button><button className="report-pdf-button" disabled={Boolean(exporting)} onClick={()=>pdf(`project-pdf-${item.id}`,{projectId:item.id})}><FileText/>{exporting === `project-pdf-${item.id}` ? "…" : "PDF"}</button></div></td></tr>})}</tbody></table></div></section><section className="suite-card suite-span"><h3>Tareas del resultado filtrado</h3><div className="suite-table"><table><thead><tr><th>Tarea</th><th>Proyecto</th><th>Cliente</th><th>Trabajador</th><th>Estado</th><th>Reporte</th></tr></thead><tbody>{tasks.map((task:any)=><tr key={task.id}><td><b>{task.titulo}</b><small>{task.fechaInicio||"Sin fecha"} · {task.fechaFin||"Sin fecha fin"}</small></td><td>{task.codigo} · {task.proyecto}</td><td>{task.cliente}</td><td>{task.responsable}</td><td>{task.completada?"Completada":task.estado||"Pendiente"}</td><td><div className="report-format-actions"><button className="report-pdf-button" disabled={Boolean(exporting)} onClick={()=>excel(`task-xls-${task.id}`,{taskId:task.id})}><FileSpreadsheet/>{exporting === `task-xls-${task.id}` ? "…" : "Excel"}</button><button className="report-pdf-button" disabled={Boolean(exporting)} onClick={()=>pdf(`task-pdf-${task.id}`,{taskId:task.id})}><FileText/>{exporting === `task-pdf-${task.id}` ? "…" : "PDF"}</button></div></td></tr>)}</tbody></table></div></section></div>;
}
