import { type DragEvent, type FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  GripVertical,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { transitionInitiative } from "../api/iniciativas";
import { canDeriveInitiative } from "../utils/access";

type SystemStatus = "Pendiente" | "En evaluación" | "Priorizado" | "En proceso" | "Finalizado";
type SystemTask = { id: string; completada: boolean };
type SystemInitiative = {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  cliente?: string;
  area: string;
  color: string;
  estado: SystemStatus;
  avance: number;
  score: number;
  responsable: string;
  responsableId?: string | null;
  fechaInicio?: string;
  fechaFin?: string;
  tareas: SystemTask[];
};
type SystemMember = {
  id: string;
  nombres: string;
  apellidos: string;
  fotoPerfil?: string | null;
  area: { nombre: string };
};
type SystemUser = {
  id: string;
  cargo: string;
  rol: string;
  isSuperAdmin: boolean;
  permisos?: Record<string, boolean>;
  area: { nombre: string };
};

const columns: Array<{ status: SystemStatus; description: string }> = [
  { status: "Pendiente", description: "Nuevos proyectos por revisar" },
  { status: "En evaluación", description: "Análisis técnico y alcance" },
  { status: "Priorizado", description: "Listos para programación" },
  { status: "En proceso", description: "Trabajo actualmente en ejecución" },
  { status: "Finalizado", description: "Proyectos con todas sus tareas completadas" },
];
const allowed: Record<SystemStatus, SystemStatus[]> = {
  Pendiente: ["En evaluación"],
  "En evaluación": ["Pendiente", "Priorizado"],
  Priorizado: ["En evaluación", "En proceso"],
  "En proceso": ["Priorizado"],
  Finalizado: [],
};
const apiStatus: Record<SystemStatus, "Pendiente" | "En_evaluacion" | "Priorizado" | "En_desarrollo" | "Finalizado"> = {
  Pendiente: "Pendiente",
  "En evaluación": "En_evaluacion",
  Priorizado: "Priorizado",
  "En proceso": "En_desarrollo",
  Finalizado: "Finalizado",
};
const statusSlug = (status: SystemStatus) =>
  status.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replaceAll(" ", "-");
const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Sin fecha";

export default function SystemsKanban({
  items,
  user,
  team,
  onChanged,
  onOpen,
  onProgress,
}: {
  items: SystemInitiative[];
  user: SystemUser;
  team: SystemMember[];
  onChanged: () => void | Promise<void>;
  onOpen: (item: any) => void;
  onProgress: (item: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [client, setClient] = useState("Todos");
  const [owner, setOwner] = useState("Todos");
  const [onlyMine, setOnlyMine] = useState(false);
  const [draggingId, setDraggingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string }>();
  const [assignment, setAssignment] = useState<{ item: SystemInitiative; target: SystemStatus }>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleCard = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const systemItems = useMemo(
    () => items.filter((item) => item.area.trim().toLocaleLowerCase("es-PE") === "sistemas"),
    [items],
  );
  const systemTeam = useMemo(
    () => team.filter((member) => member.area.nombre.trim().toLocaleLowerCase("es-PE") === "sistemas"),
    [team],
  );
  const clients = useMemo(
    () => [...new Set(systemItems.map((item) => item.cliente).filter(Boolean) as string[])].sort(),
    [systemItems],
  );
  const owners = useMemo(
    () => [...new Set(systemItems.map((item) => item.responsable).filter((name) => name !== "Sin asignar"))].sort(),
    [systemItems],
  );
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("es-PE");
    return systemItems
      .filter((item) =>
        (!search || `${item.codigo} ${item.titulo} ${item.descripcion} ${item.cliente ?? ""} ${item.responsable}`.toLocaleLowerCase("es-PE").includes(search)) &&
        (client === "Todos" || (client === "Sin cliente" ? !item.cliente : item.cliente === client)) &&
        (owner === "Todos" || (owner === "Sin asignar" ? !item.responsableId : item.responsable === owner)) &&
        (!onlyMine || item.responsableId === user.id),
      )
      .sort((a, b) => b.score - a.score || a.codigo.localeCompare(b.codigo));
  }, [systemItems, query, client, owner, onlyMine, user.id]);

  const average = systemItems.length
    ? Math.round(systemItems.reduce((sum, item) => sum + item.avance, 0) / systemItems.length)
    : 0;
  const overdue = systemItems.filter((item) =>
    item.fechaFin && new Date(item.fechaFin).setHours(23, 59, 59, 999) < Date.now() && item.avance < 100,
  ).length;
  const canMove = (item: SystemInitiative) =>
    user.isSuperAdmin ||
    user.rol === "Admin" ||
    Boolean(user.permisos?.editarProyectos) ||
    item.responsableId === user.id ||
    (["Jefe","Gerente"].includes(user.cargo) && user.area.nombre.toLocaleLowerCase("es-PE") === "sistemas");

  const executeMove = async (item: SystemInitiative, target: SystemStatus, responsableId?: string) => {
    setBusyId(item.id);
    setFeedback(undefined);
    try {
      await transitionInitiative(item.id, apiStatus[target], responsableId ?? item.responsableId ?? undefined);
      await onChanged();
      setAssignment(undefined);
      setFeedback({ type: "success", text: `${item.codigo} se movió a ${target}.` });
    } catch (cause) {
      setFeedback({
        type: "error",
        text: cause instanceof Error ? cause.message : "No se pudo cambiar el estado del proyecto.",
      });
    } finally {
      setBusyId("");
      setDraggingId("");
    }
  };
  const requestMove = (item: SystemInitiative, target: SystemStatus) => {
    if (!canMove(item)) {
      setFeedback({ type: "error", text: "No tienes permisos para mover este proyecto." });
      return;
    }
    if (target === item.estado) return;
    if (!allowed[item.estado].includes(target)) {
      setFeedback({ type: "error", text: `La transición de ${item.estado} a ${target} no está permitida.` });
      return;
    }
    if (target === "Priorizado" && !item.responsableId) {
      // Asignar responsable es "derivar": solo jefatura o admin global. El
      // backend lo exige; aquí se avisa antes de mostrar un formulario inútil.
      if (!canDeriveInitiative(user)) {
        setFeedback({ type: "error", text: "Un jefe o gerente debe asignar el responsable antes de priorizar este proyecto." });
        return;
      }
      setAssignment({ item, target });
      return;
    }
    void executeMove(item, target);
  };
  const drop = (event: DragEvent<HTMLElement>, target: SystemStatus) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || draggingId;
    const item = systemItems.find((candidate) => candidate.id === id);
    if (item) requestMove(item, target);
  };
  const assignAndMove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignment) return;
    const responsableId = String(new FormData(event.currentTarget).get("responsableId") ?? "");
    if (responsableId) void executeMove(assignment.item, assignment.target, responsableId);
  };

  return (
    <div className="systems-kanban">
      <p className="systems-recognition">
        Reconocimiento a <strong>Christian Matamoros</strong> por su brillante idea
      </p>

      {feedback && (
        <div className={`systems-feedback ${feedback.type}`} role="status">
          {feedback.type === "success" ? <CheckCircle2 /> : <AlertTriangle />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(undefined)} aria-label="Cerrar aviso"><X /></button>
        </div>
      )}

      <section className="systems-kpis" aria-label="Indicadores de Sistemas">
        <article><span><BarChart3 /></span><div><b>{systemItems.length}</b><small>Proyectos de Sistemas</small></div></article>
        <article><span><TrendingUp /></span><div><b>{average}%</b><small>Avance promedio</small></div></article>
        <article><span><Users /></span><div><b>{systemTeam.length}</b><small>Integrantes del área</small></div></article>
        <article className={overdue ? "warning" : ""}><span><Clock3 /></span><div><b>{overdue}</b><small>Proyectos vencidos</small></div></article>
      </section>

      <section className="systems-toolbar" aria-label="Filtros del Kanban">
        <label className="systems-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código, proyecto, cliente o responsable" /></label>
        <select value={client} onChange={(event) => setClient(event.target.value)} aria-label="Filtrar por cliente"><option>Todos</option><option>Sin cliente</option>{clients.map((name) => <option key={name}>{name}</option>)}</select>
        <select value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Filtrar por responsable"><option>Todos</option><option>Sin asignar</option>{owners.map((name) => <option key={name}>{name}</option>)}</select>
        <label className="systems-mine"><input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} /><span>Solo mis proyectos</span></label>
        <button type="button" onClick={() => { setQuery(""); setClient("Todos"); setOwner("Todos"); setOnlyMine(false); }}>Limpiar</button>
      </section>

      <section className="systems-board" aria-label="Tablero Kanban del área Sistemas">
        {columns.map((column) => {
          const columnItems = filtered.filter((item) => item.estado === column.status);
          return (
            <section
              className={`systems-column state-${statusSlug(column.status)} ${draggingId ? "drag-active" : ""}`}
              key={column.status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, column.status)}
            >
              <header><div><i /><h2>{column.status}</h2><span>{columnItems.length}</span></div><p>{column.description}</p></header>
              <div className="systems-column-body">
                {columnItems.map((item) => {
                  const done = item.tareas.filter((task) => task.completada).length;
                  const movable = canMove(item);
                  const expanded = expandedIds.has(item.id);
                  return (
                    <article
                      className={`systems-card ${expanded ? "expanded" : "compact"} ${draggingId === item.id ? "dragging" : ""}`}
                      key={item.id}
                      draggable={movable && busyId !== item.id}
                      onDragStart={(event) => { setDraggingId(item.id); event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => setDraggingId("")}
                    >
                      <div className="systems-card-top"><span>{item.codigo}</span><b>Score {item.score}</b>{movable && <GripVertical />}</div>
                      <button className="systems-card-summary" type="button" aria-expanded={expanded} onClick={() => toggleCard(item.id)}>
                        <span><strong>{item.titulo}</strong><small>{item.cliente || "Sin cliente asignado"}</small></span>
                        <span className="systems-card-quick"><b>{item.avance}%</b><small>{done}/{item.tareas.length} tareas</small><ChevronDown /></span>
                      </button>
                      <div className="systems-card-details">
                        <p className="systems-card-description">{item.descripcion || "Sin descripción registrada"}</p>
                        <p className="systems-client">{item.cliente || "Sin cliente asignado"}</p>
                        <dl>
                          <div><dt>Responsable</dt><dd>{item.responsable}</dd></div>
                          <div><dt>Fecha fin</dt><dd><CalendarDays />{formatDate(item.fechaFin)}</dd></div>
                        </dl>
                        <div className="systems-progress"><span><b>Avance</b><em>{item.avance}%</em></span><i><u style={{ width: `${item.avance}%` }} /></i></div>
                        <div className="systems-card-actions">
                          <span>{done}/{item.tareas.length} tareas</span>
                          <button type="button" onClick={() => onOpen(item)} title="Abrir detalle"><Eye /></button>
                          <button type="button" onClick={() => onProgress(item)} title="Registrar progreso"><TrendingUp /></button>
                        </div>
                        {movable && allowed[item.estado].length > 0 && (
                          <label className="systems-move-select"><span>Mover proyecto</span><select value="" disabled={busyId === item.id} onChange={(event) => event.target.value && requestMove(item, event.target.value as SystemStatus)}><option value="">Seleccionar estado…</option>{allowed[item.estado].map((target) => <option key={target}>{target}</option>)}</select></label>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!columnItems.length && <div className="systems-column-empty"><ArrowRight /><span>{systemItems.length ? "Arrastra aquí un proyecto compatible" : "Aún no hay proyectos de Sistemas"}</span></div>}
              </div>
            </section>
          );
        })}
      </section>

      {assignment && createPortal(
        <div className="overlay systems-assignment-overlay" onMouseDown={(event) => event.target === event.currentTarget && setAssignment(undefined)}>
          <form className="systems-assignment" onSubmit={assignAndMove}>
            <button type="button" className="close" onClick={() => setAssignment(undefined)} aria-label="Cerrar"><X /></button>
            <span className="systems-assignment-icon"><Users /></span>
            <h2>Asignar responsable</h2>
            <p>Para priorizar <b>{assignment.item.codigo}</b> debes seleccionar un integrante del área Sistemas.</p>
            <label>Responsable<select name="responsableId" required defaultValue=""><option value="" disabled>Seleccionar integrante</option>{systemTeam.map((member) => <option key={member.id} value={member.id}>{member.nombres} {member.apellidos}</option>)}</select></label>
            {!systemTeam.length && <div className="systems-no-team"><AlertTriangle />No hay integrantes registrados en el área Sistemas.</div>}
            <footer><button type="button" onClick={() => setAssignment(undefined)}>Cancelar</button><button className="primary" disabled={!systemTeam.length || Boolean(busyId)}>Asignar y priorizar</button></footer>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
