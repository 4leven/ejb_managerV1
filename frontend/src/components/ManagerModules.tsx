import GmailConnection from "./GmailConnection";
import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Moon,
  Sun,
  Upload,
  UserCog,
  X,
} from "lucide-react";
import {
  fetchAlerts,
  fetchApprovals,
  resolveApproval,
  savePreferences,
  saveProfile,
  changePassword,
} from "../api/iniciativas";
import ApprovalWorkspace from "./ApprovalWorkspace";
import { isTechnicalUser } from "../utils/access";

export function Timeline({
  items,
  onBack,
  canManageActions,
}: {
  items: any[];
  onBack: () => void;
  canManageActions: boolean;
}) {
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    fetchAlerts().then(setAlerts);
  }, []);
  const now = Date.now();
  const inactivityWarnings = items
    .filter((item) => item.avance < 100)
    .map((item) => {
      const last = item.progresos?.[0]?.createdAt || item.fechaActualizacion;
      const hours = last ? (now - new Date(last).getTime()) / 3600000 : 24;
      return {
        ...item,
        inactiveHours: hours,
        hoursLeft: Math.max(0, 24 - hours),
      };
    })
    .filter((item) => item.inactiveHours >= 18)
    .sort((a, b) => b.inactiveHours - a.inactiveHours);
  const shortDate = (value?: string) => {
    if (!value) return "-";
    const [year, month, day] = value.slice(0, 10).split("-");
    return year && month && day ? `${day}/${month}` : "-";
  };
  const timelinePresentation = (item: any) => {
    const endParts = item.fechaFin?.slice(0, 10).split("-").map(Number);
    const end = endParts?.length === 3
      ? Date.UTC(endParts[0], endParts[1] - 1, endParts[2])
      : null;
    const today = new Date(now);
    const todayDate = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const completed = item.avance >= 100 || item.estado === "Finalizado";
    const delayed = !completed && end !== null && end < todayDate;
    const notStarted = !delayed && item.avance <= 0 && item.estado === "Pendiente";
    const status = completed
      ? { label: "Completado", className: "completed" }
      : delayed
        ? { label: "Con retraso", className: "delayed" }
        : notStarted
          ? { label: "Sin iniciar", className: "not-started" }
          : { label: "En progreso", className: "in-progress" };
    const remainingDays = !completed && end !== null
      ? Math.ceil((end - todayDate) / 86400000)
      : null;
    const days = remainingDays === null
      ? "-"
      : `${Math.abs(remainingDays)} ${Math.abs(remainingDays) === 1 ? "día" : "días"}`;
    return { status, days, delayed };
  };
  return (
    <>
      <div className="timeline-insights">
        <article>
          <CalendarDays />
          <span>Con fecha definida</span>
          <b>{items.filter((i) => i.fechaInicio && i.fechaFin).length}</b>
        </article>
        <article>
          <Clock3 />
          <span>Próximos a vencer</span>
          <b>
            {
              items.filter(
                (i) =>
                  i.fechaFin &&
                  new Date(i.fechaFin).getTime() > now &&
                  new Date(i.fechaFin).getTime() - now < 604800000,
              ).length
            }
          </b>
        </article>
        <article>
          <Check />
          <span>Avance superior al 75%</span>
          <b>{items.filter((i) => i.avance >= 75).length}</b>
        </article>
        <article>
          <AlertTriangle />
          <span>Alertas activas</span>
          <b>{alerts.length}</b>
        </article>
      </div>
      <div className="timeline-layout">
        <section className="gantt schedule-reading">
          <div className="gantt-explainer">
            <div><b>Lectura del cronograma</b><span>Compara el avance realizado con el tiempo consumido.</span></div>
          </div>
          <div className={`schedule-table ${canManageActions ? "" : "schedule-table-readonly"}`}>
            <div className="schedule-table-head">
              <b>Proyecto</b>
              <b>Área asignada</b>
              <b>Inicio</b>
              <b>Fin</b>
              <b>Avance</b>
              <b>Estado</b>
              <b>Días</b>
              {canManageActions && <b>Acciones</b>}
            </div>
            {items.map((i) => {
              const presentation = timelinePresentation(i);
              return (
                <article className="schedule-row" key={i.id}>
                  <div className="schedule-project" title={i.descripcion || i.titulo}>
                    <b>{i.codigo}</b>
                    <small>{i.descripcion || i.titulo}</small>
                  </div>
                  <div className="schedule-area">
                    <i style={{ background: i.color }} />
                    <span>{i.area}</span>
                  </div>
                  <time>{shortDate(i.fechaInicio)}</time>
                  <time>{shortDate(i.fechaFin)}</time>
                  <div className={`schedule-progress ${presentation.delayed ? "delayed" : ""}`} aria-label={`${i.avance}% de avance`}>
                    <span><i style={{ width: `${Math.max(0, Math.min(100, i.avance))}%` }} /></span>
                    <b>{i.avance}%</b>
                  </div>
                  <span className={`schedule-status ${presentation.status.className}`}>{presentation.status.label}</span>
                  <span className={`schedule-days ${presentation.delayed ? "delayed" : ""}`}>{presentation.days}</span>
                  {canManageActions && <button className="schedule-actions" type="button" aria-label={`Acciones de ${i.codigo}`}>...</button>}
                </article>
              );
            })}
            {!items.length && (
              <div className="module-empty">
                Registra proyectos con fechas para visualizar el cronograma.
              </div>
            )}
          </div>
        </section>
        <aside className="alerts-panel">
          <button className="alerts-home" onClick={onBack}>
            <ArrowLeft /> Volver al dashboard
          </button>
          <h3>
            <AlertTriangle />
            Alertas
          </h3>
          <div className="inactivity-watch">
            <div>
              <Clock3 />
              <span>
                <b>Vigilancia de actividad</b>
                <small>
                  Iniciativas próximas a cumplir 24 horas sin modificaciones
                </small>
              </span>
            </div>
            {inactivityWarnings.map((item) => (
              <article
                className={item.inactiveHours >= 24 ? "expired" : "soon"}
                key={item.id}
              >
                <span>
                  <b>
                    {item.codigo} · {item.titulo}
                  </b>
                  <small>
                    {item.inactiveHours >= 24
                      ? `${Math.floor(item.inactiveHours)} h sin actividad`
                      : `Faltan ${Math.max(1, Math.ceil(item.hoursLeft))} h para la alerta`}
                  </small>
                </span>
                <em>{item.avance}%</em>
              </article>
            ))}
            {!inactivityWarnings.length && (
              <p>
                <Check />
                Todas las iniciativas tienen actividad reciente.
              </p>
            )}
          </div>
          {alerts.map((a, i) => (
            <article className={a.severity} key={i}>
              <b>{a.title}</b>
              <p>{a.message}</p>
            </article>
          ))}
          {!alerts.length && (
            <div className="all-good">
              <Check />
              Sin retrasos ni alertas pendientes.
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function LegacyApprovals({ user }: { user: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => fetchApprovals().then(setRows);
  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);
  const resolve = async (id: string, approved: boolean) => {
    await resolveApproval(
      id,
      approved,
      approved ? "Revisado y conforme." : "Solicitud rechazada.",
    );
    load();
  };
  return (
    <div className="approval-list">
      {rows.map((r) => (
        <article key={r.id}>
          {(user.isSuperAdmin || isTechnicalUser(user) || ["Jefe","Gerente"].includes(user.cargo)) && (
            <div>
              <b>
                {r.accion} {r.tipoEntidad}
              </b>
              <p>{r.motivo}</p>
              <small>
                Solicitado por {r.solicitante.nombres} {r.solicitante.apellidos}{" "}
                · {r.area.nombre}
              </small>
            </div>
          )}
          <div>
            <button className="approve" onClick={() => resolve(r.id, true)}>
              <Check />
              Aprobar
            </button>
            <button className="reject" onClick={() => resolve(r.id, false)}>
              <X />
              Rechazar
            </button>
          </div>
        </article>
      ))}
      {!rows.length && (
        <div className="module-empty">
          No hay solicitudes pendientes. Esta bandeja se actualiza
          automáticamente.
        </div>
      )}
    </div>
  );
}

export function Approvals({ user }: { user: any }) {
  return <ApprovalWorkspace user={user} />;
}

export function Profile({
  user,
  onUpdate,
  areas,
}: {
  user: any;
  onUpdate: (u: any) => void;
  areas: any[];
}) {
  const [preview, setPreview] = useState<string | null>(
    user.fotoPerfil ?? null,
  );
  const [passwordMessage, setPasswordMessage] = useState("");
  const file = (input: HTMLInputElement) => {
    const selected = input.files?.[0];
    if (!selected) return;
    if (selected.size > 1000000) {
      alert("La imagen debe pesar menos de 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(selected);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      saved = await saveProfile({
        nombres: String(f.get("nombres")),
        apellidos: String(f.get("apellidos")),
        fotoPerfil: preview,
        ...(user.isSuperAdmin ? { cargo: String(f.get("cargo")) } : {}),
        areaId: String(f.get("areaId")),
      });
    onUpdate({
      ...user,
      ...saved,
      nombreCompleto: `${saved.nombres} ${saved.apellidos}`,
    });
  };
  const toggle = async () => {
    const darkMode = !user.darkMode;
    await savePreferences(darkMode);
    onUpdate({ ...user, darkMode });
  };
  return (
    <div className="profile-layout">
      <GmailConnection email={user.email}/>
      <form className="module-form profile-form" onSubmit={submit}>
        <div className="profile-photo">
          {preview ? <img src={preview} /> : <UserCog />}
          <label>
            <Upload />
            Cambiar foto
            <input
              type="file"
              accept="image/*"
              onChange={(e) => file(e.currentTarget)}
            />
          </label>
        </div>
        <label>
          Nombres
          <input name="nombres" defaultValue={user.nombres} required />
        </label>
        <label>
          Apellidos
          <input name="apellidos" defaultValue={user.apellidos} required />
        </label>
        <label>
          Correo
          <input value={user.email} disabled />
        </label>
        <label>
          Rol en el equipo
          <select
            name="cargo"
            defaultValue={user.cargo}
            disabled={!user.isSuperAdmin}
          >
            <option>Jefe</option><option>Gerente</option><option value="Administracion">Administración</option>
            <option value="Tecnico">Técnico</option>
            <option>Asistente</option>
            <option>Trabajador</option>
          </select>
        </label>
        <label>
          Área
          <select name="areaId" defaultValue={user.area.id}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nombre}
              </option>
            ))}
          </select>
        </label>
        {user.isSuperAdmin && (
          <div className="superadmin-note">
            Cuenta administradora global: solo tú puedes cambiar tu rol. El área
            permanece editable.
          </div>
        )}
        <button className="primary">Guardar perfil</button>
      </form>
      <section className="appearance-card">
        <div>
          {user.darkMode ? <Moon /> : <Sun />}
          <h3>Modo oscuro</h3>
          <p>
            Cambia toda la interfaz y mantiene el contraste automáticamente.
          </p>
        </div>
        <button
          className={`toggle ${user.darkMode ? "on" : ""}`}
          onClick={toggle}
        >
          <i />
        </button>
      </section>
      <form
        className="password-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setPasswordMessage("");
          const f = new FormData(e.currentTarget);
          const next = String(f.get("newPassword")),
            confirm = String(f.get("confirmPassword"));
          if (next !== confirm)
            return alert("Las nuevas contraseñas no coinciden");
          await changePassword(String(f.get("currentPassword")), next);
          e.currentTarget.reset();
          setPasswordMessage("Contraseña actualizada correctamente.");
        }}
      >
        <div>
          <UserCog />
          <h3>Cambiar contraseña</h3>
          <p>Confirma tu contraseña actual antes de establecer una nueva.</p>
        </div>
        {passwordMessage && (
          <div className="inline-success">✓ {passwordMessage}</div>
        )}
        <label>
          Contraseña actual
          <input name="currentPassword" type="password" required />
        </label>
        <label>
          Nueva contraseña
          <input name="newPassword" type="password" minLength={8} required />
        </label>
        <label>
          Confirmar nueva contraseña
          <input
            name="confirmPassword"
            type="password"
            minLength={8}
            required
          />
        </label>
        <button className="primary">Actualizar contraseña</button>
      </form>
    </div>
  );
}
