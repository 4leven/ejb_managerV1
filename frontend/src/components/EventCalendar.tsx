import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { createEvent, deleteEvent, fetchEvents, updateEvent } from "../api/iniciativas";
import { uiConfirm, uiPrompt } from "../utils/dialog";

const icons = ["📅", "🚀", "🎯", "📊", "💡", "⚠️", "🤝", "✅"];

function DateTimePicker({ name, label }: { name: string; label: string }) {
  return <label className="datetime-picker-label"><span>{label}</span><input type="datetime-local" name={name} step="60" required aria-label={`${label}: fecha y hora exacta`} /></label>;
}

function parseEventDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute ? date : null;
}

function formatWeekRange(start: Date, end: Date) {
  const format = (date: Date) => date.toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "");
  return `${format(start)} — ${format(end)} ${end.getFullYear()}`;
}

function layoutDayEvents(dayEvents: any[]) {
  const sorted = [...dayEvents].sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime() || new Date(a.fin).getTime() - new Date(b.fin).getTime());
  const result: Array<{ event: any; lane: number; laneCount: number }> = [];
  let cluster: Array<{ event: any; lane: number }> = [];
  let clusterEnd = -Infinity;
  const finishCluster = () => {
    if (!cluster.length) return;
    const laneCount = Math.max(...cluster.map(item => item.lane)) + 1;
    cluster.forEach(item => result.push({ ...item, laneCount }));
    cluster = [];
  };
  for (const event of sorted) {
    const start = new Date(event.inicio).getTime(), end = new Date(event.fin).getTime();
    if (cluster.length && start >= clusterEnd) { finishCluster(); clusterEnd = -Infinity; }
    const laneEnds: number[] = [];
    cluster.forEach(item => { laneEnds[item.lane] = Math.max(laneEnds[item.lane] ?? -Infinity, new Date(item.event.fin).getTime()); });
    let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
    if (lane < 0) lane = laneEnds.length;
    cluster.push({ event, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  finishCluster();
  return result;
}

export function CalendarModule({ areas, team, items, currentUserId, canManageAll = false, onProjectsChanged }: { areas: any[]; team: any[]; items: any[]; currentUserId: string; canManageAll?: boolean; onProjectsChanged?:()=>void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());
  const load = () => fetchEvents().then(setEvents);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const openNewEvent = () => { setFormError(""); setModal(true); };
    window.addEventListener("calendar:new", openNewEvent);
    return () => window.removeEventListener("calendar:new", openNewEvent);
  }, []);

  const monday = useMemo(() => {
    const date = new Date(anchor), day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [anchor]);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return date;
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startValue=String(form.get("inicio")),endValue=String(form.get("fin"));
    if(!startValue||!endValue){setFormError("Selecciona la fecha y hora exactas de inicio y fin.");return}
    const startDate=parseEventDate(startValue),endDate=parseEventDate(endValue);
    if(!startDate||!endDate){setFormError("Revisa que las fechas y horas ingresadas sean válidas.");return}
    if(endDate<=startDate){setFormError("La fecha y hora final debe ser posterior al inicio.");return}
    setSaving(true);setFormError("");
    try{await createEvent({
      titulo: String(form.get("titulo")), descripcion: String(form.get("descripcion")),
      inicio: startDate.toISOString(), fin: endDate.toISOString(),
      icono: String(form.get("icono")), colorHex: String(form.get("colorHex")), prioridad: String(form.get("prioridad")),
      estado: String(form.get("estado")), areaId: String(form.get("areaId")),
      software: String(form.get("software")||"")||undefined,
      plataforma: String(form.get("plataforma")||"")||undefined,
      empresa: String(form.get("empresa")||"")||undefined,
      sala: String(form.get("sala")||"")||undefined,
      comentarios: String(form.get("comentarios")||"")||undefined,
      ...(form.get("asignadoId") ? { asignadoId: String(form.get("asignadoId")) } : {}),
      ...(form.get("iniciativaId") ? { iniciativaId: String(form.get("iniciativaId")) } : {}),
    });
      await load();
      onProjectsChanged?.();
      setModal(false);
    }catch(error){setFormError(error instanceof Error?error.message:"No se pudo guardar el evento.")}
    finally{setSaving(false)}
  };
  const edit = async (event: any) => {
    const titulo = await uiPrompt("Editar evento", event.titulo, { message: "Actualiza el título del evento." });
    const estado = await uiPrompt("Estado del evento", event.estado, { message: "Programado, En curso, Completado o Cancelado." });
    if (!titulo || !estado) return;
    await updateEvent(event.id, { titulo, estado });
    load();
  };
  const remove = async (event: any) => {
    if (await uiConfirm("Eliminar evento", `¿Deseas eliminar “${event.titulo}”?`)) {
      await deleteEvent(event.id);
      load();
      onProjectsChanged?.();
    }
  };

  return <>
    <div className="calendar-toolbar"><button className="primary" onClick={() => {setFormError("");setModal(true)}}><Plus />Evento nuevo</button><div><button onClick={() => setAnchor(new Date())}>Hoy</button><button onClick={() => setAnchor(new Date(anchor.getTime() - 604800000))}><ChevronLeft /></button><button onClick={() => setAnchor(new Date(anchor.getTime() + 604800000))}><ChevronRight /></button><b>{formatWeekRange(days[0], days[6])}</b></div></div>
    <section className="week-calendar">
      <div className="time-column"><b>GMT<br /><small>-05:00</small></b>{[8, 10, 12, 14, 16, 18, 20].map(hour => <span key={hour}>{hour}:00</span>)}</div>
      {days.map(day => <div className="calendar-day" key={day.toISOString()}><header><b>{day.getDate()}</b><span>{day.toLocaleDateString("es", { weekday: "short" })}</span></header><div>
        {layoutDayEvents(events.filter(event => new Date(event.inicio).toDateString() === day.toDateString())).map(({ event, lane, laneCount }) => {
          const start = new Date(event.inicio), end = new Date(event.fin), own = event.canEdit;
          return <article key={event.id} className={laneCount > 1 ? "concurrent-event" : ""} role="button" tabIndex={0} aria-label={`Ver información de ${event.titulo}`} onClick={() => setSelectedEvent(event)} onKeyDown={key => { if (key.key === "Enter" || key.key === " ") { key.preventDefault(); setSelectedEvent(event); } }} style={{ top: `${Math.max(0, (start.getHours() - 8) * 42 + start.getMinutes() * .7)}px`, height: `${Math.max(52, (end.getTime() - start.getTime()) / 60000 * .7)}px`, left: `calc(${lane * 100 / laneCount}% + 4px)`, right: "auto", width: `calc(${100 / laneCount}% - 6px)`, background: `color-mix(in srgb,${event.colorHex} 22%,var(--surface))`, borderColor: event.colorHex }}><b>{event.icono} {event.titulo}</b><small>{start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small><em>{event.prioridad} · {event.estado}</em>{own && <div className="event-actions"><button onClick={click => { click.stopPropagation(); edit(event); }}>Editar</button>{event.canDelete&&<button onClick={click => { click.stopPropagation(); remove(event); }}>Eliminar</button>}</div>}</article>;
        })}
      </div></div>)}
    </section>

    {selectedEvent && <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedEvent(null); }}><section className="event-detail-modal" style={{ "--event-color": selectedEvent.colorHex } as React.CSSProperties}><button type="button" className="close" onClick={() => setSelectedEvent(null)} aria-label="Cerrar información del evento"><X /></button><div className="event-detail-heading"><span>{selectedEvent.icono}</span><div><small>INFORMACIÓN DEL EVENTO</small><h2>{selectedEvent.titulo}</h2><p>{selectedEvent.estado} · Prioridad {selectedEvent.prioridad}</p></div></div><div className="event-detail-description">{selectedEvent.descripcion || "Este evento no tiene una descripción adicional."}</div><div className="event-detail-grid"><div><small>Fecha y hora</small><b>{new Date(selectedEvent.inicio).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</b><span>{new Date(selectedEvent.inicio).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })} — {new Date(selectedEvent.fin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span></div><div><small>Área</small><b>{selectedEvent.area?.nombre || "Sin área"}</b></div><div><small>Responsable</small><b>{selectedEvent.asignado ? `${selectedEvent.asignado.nombres} ${selectedEvent.asignado.apellidos}` : "Todo el área"}</b></div><div><small>Proyecto relacionado</small><b>{selectedEvent.iniciativa ? `${selectedEvent.iniciativa.codigo} · ${selectedEvent.iniciativa.titulo}` : "Sin proyecto relacionado"}</b></div><div><small>Software</small><b>{selectedEvent.software||"No especificado"}</b></div><div><small>Plataforma</small><b>{selectedEvent.plataforma||"No especificada"}</b></div><div><small>Empresa</small><b>{selectedEvent.empresa||"No especificada"}</b></div><div><small>Sala</small><b>{selectedEvent.sala||"No especificada"}</b></div><div><small>Comentarios</small><b>{selectedEvent.comentarios||"Sin comentarios"}</b></div><div><small>Creado por</small><b>{selectedEvent.creador ? `${selectedEvent.creador.nombres} ${selectedEvent.creador.apellidos}` : "Usuario"}</b></div></div>{selectedEvent.canEdit && <div className="event-detail-actions"><button onClick={() => { setSelectedEvent(null); edit(selectedEvent); }}>Editar evento</button>{selectedEvent.canDelete&&<button onClick={async () => { await remove(selectedEvent); setSelectedEvent(null); }}>Eliminar evento</button>}</div>}</section></div>}

    {modal && <div className="overlay"><form className="event-modal" onSubmit={submit}>
      <button type="button" className="close event-close" onClick={() => setModal(false)} aria-label="Cerrar formulario"><X /></button><div className="event-modal-body"><CalendarPlus /><h2>Nuevo evento</h2>
      <label>Título<input name="titulo" required /></label><label>Descripción<textarea name="descripcion" /></label>
      <div className="event-grid"><DateTimePicker name="inicio" label="Inicio" /><DateTimePicker name="fin" label="Fin" /><label>Área<select name="areaId">{areas.map(area => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label><label>Responsable<select name="asignadoId"><option value="">Todo el área</option>{team.map(member => <option key={member.id} value={member.id}>{member.nombres} {member.apellidos}</option>)}</select></label><label>Proyecto<select name="iniciativaId"><option value="">Sin proyecto</option>{items.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.titulo}</option>)}</select></label><label>Prioridad<select name="prioridad"><option>Baja</option><option>Normal</option><option>Alta</option><option>Urgente</option></select></label><label>Estado<select name="estado"><option>Programado</option><option>En curso</option><option>Completado</option><option>Cancelado</option></select></label><label>Color<input name="colorHex" type="color" defaultValue="#2f6fed" /></label><label>Software<input name="software" placeholder="Ej. Teams, ERP, Power BI" /></label><label>Plataforma<select name="plataforma"><option value="">Seleccionar</option><option>Zoom 1</option><option>Zoom 2</option><option>Meet 1</option><option>Meet 2</option></select></label><label>Empresa<input name="empresa" placeholder="Nombre de la empresa" /></label><label>Sala<select name="sala"><option value="">Seleccionar</option><option>Piso 11 - Sala 1</option><option>Piso 11 - Sala 2</option><option>Piso 13 - Sala 1</option><option>Piso 14 - Sala 1</option><option>Piso 14 - Sala 2</option></select></label></div>
      <label>Comentarios<textarea name="comentarios" placeholder="Indicaciones, accesos o información adicional" /></label>
      <label>Icono<div className="event-icons">{icons.map((icon, index) => <label key={icon}><input type="radio" name="icono" value={icon} defaultChecked={!index} /><span>{icon}</span></label>)}</div></label>{formError&&<div className="event-form-error" role="alert">{formError}</div>}</div><footer className="event-modal-footer"><button type="button" onClick={() => setModal(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving?"Guardando…":"Guardar evento"}</button></footer>
    </form></div>}
  </>;
}
