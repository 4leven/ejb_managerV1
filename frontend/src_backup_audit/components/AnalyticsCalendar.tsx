import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Target,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import {
  createEvent,
  deleteEvent,
  downloadMonthlyReport,
  fetchAuditTrail,
  fetchEvents,
  updateEvent,
} from "../api/iniciativas";
import { uiConfirm, uiPrompt } from "../utils/dialog";
import { isTechnicalUser } from "../utils/access";
const icons = ["📅", "🚀", "🎯", "📊", "💡", "⚠️", "🤝", "✅"];

function AuditPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { fetchAuditTrail().then(setRows).catch(() => setRows([])); }, []);
  return <section className="audit-panel">
    <button type="button" onClick={() => setExpanded((value) => !value)}><Clock3 /><span><b>Actividad y auditoría</b><small>{rows.length} acciones recientes registradas</small></span><strong>{expanded ? "Ocultar" : "Ver historial"}</strong></button>
    {expanded && <div>{rows.map((row) => { const data = row.datos || {}; return <article key={row.id}><span>{row.creador?.fotoPerfil ? <img src={row.creador.fotoPerfil} alt="" /> : `${row.creador?.nombres?.[0] || "?"}${row.creador?.apellidos?.[0] || ""}`}</span><p><b>{row.creador?.nombres} {row.creador?.apellidos}</b><small>{data.accion} · {data.entidad}</small></p><time>{new Date(row.createdAt).toLocaleString("es-PE")}</time></article>; })}</div>}
  </section>;
}

export function CalendarModule({
  areas,
  team,
  items,
  currentUserId,
}: {
  areas: any[];
  team: any[];
  items: any[];
  currentUserId: string;
}) {
  const [events, setEvents] = useState<any[]>([]),
    [modal, setModal] = useState(false),
    [anchor, setAnchor] = useState(() => new Date());
  const load = () => fetchEvents().then(setEvents);
  useEffect(() => {
    load();
  }, []);
  const monday = useMemo(() => {
    const d = new Date(anchor),
      day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchor]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await createEvent({
      titulo: String(f.get("titulo")),
      descripcion: String(f.get("descripcion")),
      inicio: new Date(String(f.get("inicio"))).toISOString(),
      fin: new Date(String(f.get("fin"))).toISOString(),
      icono: String(f.get("icono")),
      colorHex: String(f.get("colorHex")),
      prioridad: String(f.get("prioridad")),
      estado: String(f.get("estado")),
      areaId: String(f.get("areaId")),
      ...(f.get("asignadoId")
        ? { asignadoId: String(f.get("asignadoId")) }
        : {}),
      ...(f.get("iniciativaId")
        ? { iniciativaId: String(f.get("iniciativaId")) }
        : {}),
    });
    setModal(false);
    load();
  };
  const edit = async (e: any) => {
    const titulo = await uiPrompt("Editar evento", e.titulo, {
        message: "Actualiza el título del evento.",
      }),
      estado = await uiPrompt("Estado del evento", e.estado, {
        message: "Programado, En curso, Completado o Cancelado.",
      });
    if (!titulo || !estado) return;
    await updateEvent(e.id, { titulo, estado });
    load();
  };
  const remove = async (e: any) => {
    if (await uiConfirm("Eliminar evento", `¿Deseas eliminar “${e.titulo}”?`)) {
      await deleteEvent(e.id);
      load();
    }
  };
  return (
    <>
      <div className="calendar-toolbar">
        <button className="primary" onClick={() => setModal(true)}>
          <Plus />
          Evento nuevo
        </button>
        <div>
          <button onClick={() => setAnchor(new Date())}>Hoy</button>
          <button
            onClick={() => setAnchor(new Date(anchor.getTime() - 604800000))}
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => setAnchor(new Date(anchor.getTime() + 604800000))}
          >
            <ChevronRight />
          </button>
          <b>
            {days[0].toLocaleDateString()} — {days[6].toLocaleDateString()}
          </b>
        </div>
      </div>
      <section className="week-calendar">
        <div className="time-column">
          <b>
            GMT
            <br />
            <small>-05:00</small>
          </b>
          {[8, 10, 12, 14, 16, 18, 20].map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
        {days.map((day) => (
          <div className="calendar-day" key={day.toISOString()}>
            <header>
              <b>{day.getDate()}</b>
              <span>{day.toLocaleDateString("es", { weekday: "short" })}</span>
            </header>
            <div>
              {events
                .filter(
                  (e) =>
                    new Date(e.inicio).toDateString() === day.toDateString(),
                )
                .map((e) => {
                  const start = new Date(e.inicio),
                    end = new Date(e.fin),
                    own = e.creador?.id === currentUserId;
                  return (
                    <article
                      key={e.id}
                      style={{
                        top: `${Math.max(0, (start.getHours() - 8) * 42 + start.getMinutes() * 0.7)}px`,
                        height: `${Math.max(52, ((end.getTime() - start.getTime()) / 60000) * 0.7)}px`,
                        background: `color-mix(in srgb,${e.colorHex} 22%,var(--surface))`,
                        borderColor: e.colorHex,
                      }}
                    >
                      <b>
                        {e.icono} {e.titulo}
                      </b>
                      <small>
                        {start.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        –
                        {end.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                      <em>
                        {e.prioridad} · {e.estado}
                      </em>
                      {own && (
                        <div className="event-actions">
                          <button onClick={() => edit(e)}>Editar</button>
                          <button onClick={() => remove(e)}>Eliminar</button>
                        </div>
                      )}
                    </article>
                  );
                })}
            </div>
          </div>
        ))}
      </section>
      {modal && (
        <div className="overlay">
          <form className="event-modal" onSubmit={submit}>
            <button
              type="button"
              className="close"
              onClick={() => setModal(false)}
            >
              <X />
            </button>
            <CalendarPlus />
            <h2>Nuevo evento</h2>
            <label>
              Título
              <input name="titulo" required />
            </label>
            <label>
              Descripción
              <textarea name="descripcion" />
            </label>
            <div className="event-grid">
              <label>
                Inicio
                <input name="inicio" type="datetime-local" required />
              </label>
              <label>
                Fin
                <input name="fin" type="datetime-local" required />
              </label>
              <label>
                Área
                <select name="areaId">
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Responsable
                <select name="asignadoId">
                  <option value="">Todo el área</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombres} {m.apellidos}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Proyecto
                <select name="iniciativaId">
                  <option value="">Sin proyecto</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.codigo} · {i.titulo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridad
                <select name="prioridad">
                  <option>Baja</option>
                  <option>Normal</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </select>
              </label>
              <label>
                Estado
                <select name="estado">
                  <option>Programado</option>
                  <option>En curso</option>
                  <option>Completado</option>
                  <option>Cancelado</option>
                </select>
              </label>
              <label>
                Color
                <input name="colorHex" type="color" defaultValue="#2f6fed" />
              </label>
            </div>
            <label>
              Icono
              <div className="event-icons">
                {icons.map((i, n) => (
                  <label key={i}>
                    <input
                      type="radio"
                      name="icono"
                      value={i}
                      defaultChecked={!n}
                    />
                    <span>{i}</span>
                  </label>
                ))}
              </div>
            </label>
            <button className="primary">Guardar evento</button>
          </form>
        </div>
      )}
    </>
  );
}

export function BIReports({
  items,
  areas,
  user,
}: {
  items: any[];
  areas: any[];
  user: any;
}) {
  const [selectedGantt, setSelectedGantt] = useState<any | null>(null),
    [ganttArea, setGanttArea] = useState("Todas"),
    [exporting, setExporting] = useState<"" | "pdf" | "xls">(""),
    [exportError, setExportError] = useState(""),
    [reportMonth, setReportMonth] = useState(
      new Date().toISOString().slice(0, 7),
    ),
    [reportArea, setReportArea] = useState(""),
    [reportClient, setReportClient] = useState(""),
    [compareReport, setCompareReport] = useState(false);
  const canExport = Boolean(
    user?.isSuperAdmin || isTechnicalUser(user) || user?.rol === "Admin" || user?.cargo === "Gerente" || Boolean(user?.permisos?.exportar),
  );
  const exportReport = async (format: "pdf" | "xls") => {
    try {
      setExportError("");
      setExporting(format);
      await downloadMonthlyReport(format, {
        month: reportMonth,
        area: reportArea,
        client: reportClient,
        compare: compareReport,
      });
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el reporte",
      );
    } finally {
      setExporting("");
    }
  };
  const now = new Date(),
    monthStart = new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0),
    elapsed = Math.max(1, now.getDate());
  const palette = [
    "#2563eb",
    "#ef4444",
    "#f59e0b",
    "#10b981",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
  ];
  const ranking = areas
    .map((a, index) => {
      const projects = items.filter((i) => i.area === a.nombre),
        updates = projects
          .flatMap((i) => i.progresos ?? [])
          .filter((p: any) => {
            const d = new Date(p.createdAt);
            return d >= monthStart && d <= monthEnd;
          }),
        days = new Set(
          updates.map((p: any) =>
            new Date(p.createdAt).toISOString().slice(0, 10),
          ),
        ).size,
        completed = projects.filter((i) => i.avance === 100),
        onTime = completed.filter((i) => {
          const last = i.progresos?.[0]?.createdAt;
          return !i.fechaFin || !last || new Date(last) <= new Date(i.fechaFin);
        }).length,
        punctuality = completed.length ? onTime / completed.length : 0,
        consistency = Math.min(1, days / elapsed),
        points = Math.round(punctuality * 60 + consistency * 40);
      return { ...a, index, points, days, onTime, total: completed.length };
    })
    .sort((a, b) => b.points - a.points || b.days - a.days);
  const avg = items.length
    ? Math.round(items.reduce((s, i) => s + i.avance, 0) / items.length)
    : 0;
  const ganttItems =
    ganttArea === "Todas" ? items : items.filter((i) => i.area === ganttArea);
  const ganttStart = new Date(
    Math.min(
      ...ganttItems.map((i) =>
        i.fechaInicio ? new Date(i.fechaInicio).getTime() : now.getTime(),
      ),
      now.getTime(),
    ),
  );
  ganttStart.setHours(0, 0, 0, 0);
  const dayMs = 86400000,
    ganttEnd = Math.max(
      now.getTime(),
      ...ganttItems.map((i) =>
        i.fechaFin
          ? new Date(i.fechaFin).getTime()
          : now.getTime() + 29 * dayMs,
      ),
    ),
    ganttDays = Math.max(
      30,
      Math.ceil((ganttEnd - ganttStart.getTime()) / dayMs) + 2,
    ),
    ganttWidth = Math.max(980, 260 + ganttDays * 38);
  if (canExport)
    return (
      <div className="bi-export-shell">
        <section className="bi-export-toolbar">
          <div>
            <Download />
            <span>
              <b>Resumen mensual</b>
              <small>Configura el periodo y descarga todas las métricas.</small>
            </span>
          </div>
          <div className="bi-report-filters">
            <label>
              Mes
              <input
                type="month"
                value={reportMonth}
                onChange={(event) => setReportMonth(event.target.value)}
              />
            </label>
            <label>
              Área
              <select
                value={reportArea}
                onChange={(event) => setReportArea(event.target.value)}
              >
                <option value="">Todas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cliente
              <select
                value={reportClient}
                onChange={(event) => setReportClient(event.target.value)}
              >
                <option value="">Todos</option>
                {[
                  ...new Set(items.map((item) => item.cliente).filter(Boolean)),
                ].map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            </label>
            <label className="compare-report">
              <input
                type="checkbox"
                checked={compareReport}
                onChange={(event) => setCompareReport(event.target.checked)}
              />
              Comparar mes anterior
            </label>
          </div>
          <div className="bi-export-actions">
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => exportReport("pdf")}
            >
              <FileText />
              {exporting === "pdf" ? "Generando…" : "Descargar PDF"}
            </button>
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => exportReport("xls")}
            >
              <FileSpreadsheet />
              {exporting === "xls" ? "Generando…" : "Descargar Excel (.xls)"}
            </button>
          </div>
          {exportError && <p>{exportError}</p>}
        </section>
        <AuditPanel />
        <BIReports items={items} areas={areas} user={null} />
      </div>
    );
  return (
    <div className="bi-report">
      <div className="report-kpis">
        <article>
          <TrendingUp />
          <span>Avance consolidado</span>
          <b>{avg}%</b>
        </article>
        <article>
          <Target />
          <span>Proyectos activos</span>
          <b>{items.filter((i) => i.estado === "En desarrollo").length}</b>
        </article>
        <article>
          <Clock3 />
          <span>Con retraso</span>
          <b>
            {
              items.filter(
                (i) =>
                  i.fechaFin && new Date(i.fechaFin) < now && i.avance < 100,
              ).length
            }
          </b>
        </article>
        <article>
          <BarChart3 />
          <span>Score promedio</span>
          <b>
            {items.length
              ? (items.reduce((s, i) => s + (Number.isFinite(Number(i.score)) ? Number(i.score) : 0), 0) / items.length).toFixed(
                  1,
                )
              : 0}
          </b>
        </article>
      </div>
      <article className="report-card monthly-ranking">
        <div className="ranking-head">
          <div>
            <Trophy />
            <div>
              <h3>Ranking mensual de cumplimiento</h3>
              <p>
                {monthStart.toLocaleDateString("es", {
                  month: "long",
                  year: "numeric",
                })}{" "}
                · entregas a tiempo 60% + constancia diaria 40%
              </p>
            </div>
          </div>
          <span>Reinicia el día 1</span>
        </div>
        <div className="ranking-list">
          {ranking.slice(0, 5).map((r, pos) => (
            <div className={`rank rank-${pos + 1}`} key={r.id}>
              <strong>{pos + 1}</strong>
              <i style={{ background: r.colorHex }} />
              <div>
                <b>{r.nombre}</b>
                <small>
                  {r.days} días con avances · {r.onTime}/{r.total} entregas a
                  tiempo
                </small>
              </div>
              <em>{r.points} pts</em>
              <Award />
            </div>
          ))}
        </div>
      </article>
      <div className="report-grid">
        <article className="report-card impact-matrix">
          <div className="matrix-heading">
            <h3>Matriz de impacto vs. esfuerzo</h3>
            <span>{items.length} iniciativas</span>
          </div>
          <div className="matrix-axis matrix-y">Esfuerzo →</div>
          <div className="matrix-box">
            <b>GANANCIA RÁPIDA</b>
            <b>APUESTA GRANDE</b>
            <b>RELLENO</b>
            <b>RECONSIDERAR</b>
            {items.map((i) => {
              const effort =
                i.esfuerzo === "Alto" ? 8 : i.esfuerzo === "Medio" ? 5 : 2;
              return (
                <span
                  className="matrix-point"
                  key={i.id}
                  title={`${i.codigo} · ${i.titulo}`}
                  style={{
                    left: `${Math.max(5, Math.min(95, i.impacto * 10))}%`,
                    bottom: `${effort * 10}%`,
                    background: i.color,
                  }}
                >
                  <small>{i.titulo}</small>
                </span>
              );
            })}
          </div>
          <div className="matrix-axis">Bajo impacto ← · → Alto impacto</div>
          <div className="matrix-legend">
            {areas.map((a) => (
              <span key={a.id}>
                <i style={{ background: a.colorHex }} />
                {a.nombre}
              </span>
            ))}
          </div>
        </article>
        <article className="report-card">
          <h3>Rendimiento por área</h3>
          <div className="report-bars">
            {areas.map((a, index) => {
              const r = items.filter((i) => i.area === a.nombre),
                v = r.length
                  ? Math.round(r.reduce((s, i) => s + i.avance, 0) / r.length)
                  : 0;
              return (
                <div key={a.id}>
                  <span>
                    {a.nombre}
                    <b>{v}%</b>
                  </span>
                  <i>
                    <em
                      style={{
                        width: `${v}%`,
                        background: palette[index % palette.length],
                      }}
                    />
                  </i>
                </div>
              );
            })}
          </div>
        </article>
      </div>
      <article className="report-card gantt-bi">
        <div className="gantt-bi-title">
          <div>
            <h3>Diagrama de Gantt · Portafolio</h3>
            <p>Fechas, duración y avance real de cada iniciativa</p>
          </div>
          <div className="gantt-bi-tools">
            <label>
              Área
              <select
                value={ganttArea}
                onChange={(event) => {
                  setGanttArea(event.target.value);
                  setSelectedGantt(null);
                }}
              >
                <option value="Todas">Todas las áreas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.nombre}>
                    {area.nombre}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {ganttItems.length}{" "}
              {ganttItems.length === 1 ? "iniciativa" : "iniciativas"} · desliza
              para ver más fechas
            </span>
          </div>
        </div>
        <div className="gantt-bi-scroll">
          <div style={{ minWidth: ganttWidth }}>
            <div className="gantt-bi-head">
              <b>Proyecto</b>
              <div
                style={{
                  gridTemplateColumns: `repeat(${Math.ceil(ganttDays / 3)},1fr)`,
                }}
              >
                {Array.from({ length: Math.ceil(ganttDays / 3) }, (_, d) => (
                  <span key={d}>
                    {new Date(
                      ganttStart.getTime() + d * 3 * dayMs,
                    ).toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                ))}
              </div>
            </div>
            <div className="gantt-bi-body">
              {ganttItems.length ? (
                ganttItems.map((i, index) => {
                  const start = i.fechaInicio
                      ? new Date(i.fechaInicio)
                      : new Date(ganttStart.getTime() + index * dayMs),
                    end = i.fechaFin
                      ? new Date(i.fechaFin)
                      : new Date(start.getTime() + 7 * dayMs),
                    left = Math.max(
                      0,
                      Math.min(
                        96,
                        ((start.getTime() - ganttStart.getTime()) /
                          dayMs /
                          ganttDays) *
                          100,
                      ),
                    ),
                    width = Math.max(
                      2,
                      Math.min(
                        100 - left,
                        ((end.getTime() - start.getTime() + dayMs) /
                          dayMs /
                          ganttDays) *
                          100,
                      ),
                    );
                  return (
                    <button key={i.id} onClick={() => setSelectedGantt(i)}>
                      <span>
                        <b>{i.codigo}</b>
                        <small>{i.titulo}</small>
                        <em>
                          {i.area} · {i.estado}
                        </em>
                      </span>
                      <div className="gantt-bi-track">
                        <i
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: `color-mix(in srgb,${palette[index % palette.length]} 38%,var(--surface))`,
                          }}
                        >
                          <strong
                            style={{
                              width: `${i.avance}%`,
                              background: palette[index % palette.length],
                            }}
                          />
                          <small>{i.avance}%</small>
                        </i>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="gantt-empty">
                  No hay iniciativas registradas para esta área.
                </div>
              )}
            </div>
          </div>
        </div>
        {selectedGantt && (
          <div className="gantt-selection">
            <b>
              {selectedGantt.codigo} · {selectedGantt.titulo}
            </b>
            <span>
              {selectedGantt.fechaInicio
                ? new Date(selectedGantt.fechaInicio).toLocaleDateString()
                : "Sin inicio"}{" "}
              —{" "}
              {selectedGantt.fechaFin
                ? new Date(selectedGantt.fechaFin).toLocaleDateString()
                : "Sin cierre"}
            </span>
            <em>{selectedGantt.avance}% completado</em>
            <button onClick={() => setSelectedGantt(null)}>Cerrar</button>
          </div>
        )}
      </article>
    </div>
  );
}
