import { playChatTone } from "./utils/chat-tools";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowLeft,
  Bell,
  BellRing,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  ChevronDown,
  CircleHelp,
  Clock3,
  Edit3,
  Download,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageCircle,
  Menu,
  FileText,
  FileSignature,
  Palette,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Moon,
  Sun,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  PanelsTopLeft,
  Target,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
  BriefcaseBusiness,
  Building2,
  Settings,
  Vote,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  addProgreso,
  addInitiativeTask,
  createIniciativa,
  createObjetivo,
  fetchCatalogo,
  fetchConversations,
  fetchAlerts,
  fetchNotifications,
  subscribeAlerts,
  fetchEquipo,
  fetchIniciativas,
  fetchObjetivos,
  fetchProgresos,
  forgotPassword,
  globalSearch,
  login,
  me,
  register,
  requestChange,
  resetPassword,
  savePortalColor,
  saveInitiativeAppearance,
  saveTeamCargo,
  deleteTeamMember,
  savePreferences,
  updateInitiative,
  updateInitiativeTask,
  deleteInitiative,
  trackAdoption,
} from "./api/iniciativas";
import Messages from "./components/Messages";
import { Approvals, Profile, Timeline } from "./components/ManagerModules";
import { BIReports } from "./components/AnalyticsCalendar";
import { CalendarModule } from "./components/EventCalendar";
import { AreaFlows, Requirements } from "./components/Operations";
import { Surveys } from "./components/CollaborationModules";
import SecureSignature from "./components/SecureSignature";
import ObjectivesModule from "./components/ObjectivesModule";
import TicketWorkspace from "./components/TicketWorkspace";
import SystemsKanban from "./components/SystemsKanban";
import {
  Clients360,
  EnterpriseAdmin,
  MyWork,
  NotificationCenter,
  ReportingCenter,
  UserFeedback,
} from "./components/ProductSuite";
import { uiAlert, uiConfirm, uiPrompt } from "./utils/dialog";
import { canOperateGlobally, cargoLabel, isTechnicalUser, isAreaLeaderUser, isAdministrationUser, canPublishAnnouncements, canDeleteOwned } from "./utils/access";
import {
  clearRememberedCredentials,
  loadRememberedCredentials,
  saveRememberedCredentials,
} from "./utils/credentialVault";

type Page =
  | "resumen"
  | "mi-trabajo"
  | "clientes"
  | "ticketera"
  | "kanban-sistemas"
  | "notificaciones"
  | "administracion"
  | "feedback"
  | "iniciativas"
  | "objetivos"
  | "equipo"
  | "mensajes"
  | "cronograma"
  | "calendario"
  | "informes"
  | "reporteria"
  | "requerimientos"
  | "flujos"
  | "firmas"
  | "encuestas"
  | "aprobaciones"
  | "perfil"
  | "ayuda"
  | "personalizacion";

const notificationPage = (value: string): Page | null => {
  const key = value
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .split(/[?#]/)[0]
    .toLowerCase();
  const aliases: Record<string, Page> = {
    dashboard: "resumen",
    resumen: "resumen",
    proyectos: "iniciativas",
    iniciativas: "iniciativas",
    tareas: "mi-trabajo",
    "mi-trabajo": "mi-trabajo",
    notificaciones: "notificaciones",
    calendario: "calendario",
    cronograma: "cronograma",
    mensajes: "mensajes",
    aprobaciones: "aprobaciones",
    ticketera: "ticketera",
    "kanban-sistemas": "kanban-sistemas",
    clientes: "clientes",
    equipo: "equipo",
    objetivos: "objetivos",
    administracion: "administracion",
    feedback: "feedback",
    informes: "informes",
    reporteria: "reporteria",
    requerimientos: "requerimientos",
    flujos: "flujos",
    firmas: "firmas",
    encuestas: "encuestas",
    perfil: "perfil",
    ayuda: "ayuda",
    personalizacion: "personalizacion",
  };
  return aliases[key] ?? null;
};
type Estado = "Pendiente" | "En evaluación" | "Priorizado" | "En proceso" | "Finalizado";
type Area = { id: string; nombre: string; colorHex: string };
type User = {
  id: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  email: string;
  cargo: string;
  rol: string;
  portalColor: string;
  darkMode: boolean;
  fotoPerfil?: string | null;
  estadoMensaje: string;
  isSuperAdmin: boolean;
  permisos?: Record<string, boolean>;
  area: Area;
};
type Item = {
  creadorId?:string|null;
  areaId?:string;
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  cliente?: string;
  area: string;
  color: string;
  impacto: number;
  esfuerzo: string;
  score: number;
  estado: Estado;
  avance: number;
  responsable: string;
  responsableId?: string | null;
  fecha: string;
  fechaInicio?: string;
  fechaFin?: string;
  fechaActualizacion?: string;
  objetivoId?: string;
  icono?: string;
  colorIcono?: string;
  progresos?: { porcentaje: number; createdAt: string }[];
  reuniones: number;
  tareas: {
    id: string;
    titulo: string;
    estado: string;
    completada: boolean;
    comentario?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    prioridad?: string;
    recordatorioAt?: string | null;
    responsableId?: string | null;
    responsable?: {
      id: string;
      nombres: string;
      apellidos: string;
      fotoPerfil?: string | null;
    } | null;
    adjuntos?: { nombre: string; mime: string; data: string }[];
    comentarios?: {
      id: string;
      contenido: string;
      createdAt: string;
      usuario: {
        id: string;
        nombres: string;
        apellidos: string;
        fotoPerfil?: string | null;
      };
    }[];
  }[];
};
type Objetivo = {
  id: string;
  nombre: string;
  descripcion?: string;
  _count?: { iniciativas: number };
  progresos?: {
    id?: string;
    porcentaje: number;
    comentario?: string;
    createdAt: string;
    usuario?: { nombres: string; apellidos: string; fotoPerfil?: string };
  }[];
};
type TeamMember = {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  cargo: string;
  area: Area;
  isSuperAdmin: boolean;
  fotoPerfil?: string | null;
};
type HelpTopic = { title: string; text: string; detail: string };
type Progress = {
  id: string;
  porcentaje: number;
  comentario: string;
  createdAt: string;
  usuario: { nombres: string; apellidos: string };
};
const statusClass: Record<Estado, string> = {
  Pendiente: "neutral",
  "En evaluación": "blue",
  Priorizado: "purple",
  "En proceso": "amber",
  Finalizado: "green",
};
const mapProjectStatus = (value: unknown): Estado => {
  const status = String(value ?? "Pendiente");
  if (status === "Finalizado") return "Finalizado";
  if (status === "En_desarrollo" || status === "En desarrollo" || status === "En proceso") return "En proceso";
  if (status === "En_evaluacion" || status === "En evaluación") return "En evaluación";
  if (status === "Priorizado") return "Priorizado";
  return "Pendiente";
};
const initials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const projectAreaAccent = (areaName: string, fallback = "#2f6fed") => {
  const normalized = areaName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  const colors: Record<string, string> = {
    MARKETING: "#72cf8c",
    GERENCIA: "#f28c28",
    "CONSULTORIA PLANILLA": "#f4c430",
    "CONSULTORIA CONTABLE": "#2f6fed",
    PROYECTOS: "#8b5cf6",
    SISTEMAS: "#14b8a6",
    VENTAS: "#ef4444",
    "INNOVACION Y PRODUCTO": "#1683ff",
    ADMINISTRACION: "#ec4899",
  };
  return colors[normalized] ?? fallback;
};
const mapItem = (r: any): Item => ({
  id: r.id,
  codigo: r.codigo,
  titulo: r.titulo,
  descripcion: r.descripcion,
  cliente: r.cliente,
  area: r.area.nombre,
  areaId:r.areaId??r.area.id,
  creadorId:r.creadorId,
  color: r.area.colorHex,
  impacto: r.impacto,
  esfuerzo: r.esfuerzo,
  score: Number.isFinite(Number(r.score)) ? Number(r.score) : 0,
  estado: mapProjectStatus(r.estado),
  avance: r.porcentajeAvance,
  responsable: r.responsable
    ? `${r.responsable.nombres} ${r.responsable.apellidos}`
    : "Sin asignar",
  responsableId: r.responsableId,
  fecha: "Ahora",
  fechaInicio: r.fechaInicio,
  fechaFin: r.fechaFin,
  fechaActualizacion: r.fechaActualizacion,
  objetivoId: r.objetivo?.id,
  icono: r.icono,
  colorIcono: r.colorIcono,
  progresos: r.progresos ?? [],
  reuniones: r._count?.eventos ?? 0,
  tareas: r.tareas ?? [],
});

const readableText = (color: string) => {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#0b1830" : "#ffffff";
};

function Access({
  areas,
  onAccess,
}: {
  areas: Area[];
  onAccess: (u: User, t: string, remember: boolean) => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [rememberPassword, setRememberPassword] = useState(() =>
      Boolean(localStorage.getItem("ejb_remembered_email")),
    ),
    loginForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (mode !== "login" || !rememberPassword) return;
    const savedEmail = localStorage.getItem("ejb_remembered_email");
    const emailInput = loginForm.current?.elements.namedItem(
      "email",
    ) as HTMLInputElement | null;
    if (savedEmail && emailInput) emailInput.value = savedEmail;
    void loadRememberedCredentials().then((credential) => {
      if (!credential || !loginForm.current) return;
      const email = loginForm.current.elements.namedItem(
        "email",
      ) as HTMLInputElement;
      const password = loginForm.current.elements.namedItem(
        "password",
      ) as HTMLInputElement;
      email.value = credential.email;
      password.value = credential.password;
    });
    const credentials = navigator.credentials as any;
    if (!credentials?.get) return;
    credentials
      .get({ password: true, mediation: "optional" })
      .then((credential: any) => {
        if (!credential || !loginForm.current) return;
        const email = loginForm.current.elements.namedItem(
          "email",
        ) as HTMLInputElement;
        const password = loginForm.current.elements.namedItem(
          "password",
        ) as HTMLInputElement;
        if (credential.id) email.value = credential.id;
        if (credential.password) password.value = credential.password;
      })
      .catch(() => undefined);
  }, [mode, rememberPassword]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      let approvalCode = "";
      if (mode === "register" && ["Gerente", "Jefe"].includes(String(f.get("cargo")))) {
        const value = await uiPrompt("Código de aprobación", "", { message: "Para crear una cuenta de Jefe o Gerente, introduce el código autorizado por administración.", placeholder: "Código de aprobación" });
        if (value === null) return;
        approvalCode = value.trim();
      }
      const data =
        mode === "login"
          ? await login(String(f.get("email")), String(f.get("password")))
          : await register({
              nombres: String(f.get("nombres")),
              apellidos: String(f.get("apellidos")),
              email: String(f.get("email")),
              password: String(f.get("password")),
              areaId: String(f.get("areaId")),
              cargo: String(f.get("cargo")),
              approvalCode,
            });
      if (mode === "login") {
        const email = String(f.get("email")),
          password = String(f.get("password"));
        if (rememberPassword) {
          localStorage.setItem("ejb_remembered_email", email);
          await saveRememberedCredentials(email, password).catch(() => false);
          const PasswordCredentialClass = (window as any).PasswordCredential;
          if (PasswordCredentialClass && navigator.credentials?.store)
            await navigator.credentials
              .store(
                new PasswordCredentialClass({
                  id: email,
                  name: email,
                  password,
                }),
              )
              .catch(() => undefined);
        } else {
          localStorage.removeItem("ejb_remembered_email");
          await clearRememberedCredentials().catch(() => undefined);
          await (navigator.credentials as any)
            ?.preventSilentAccess?.()
            .catch(() => undefined);
        }
      }
      onAccess(data.usuario, data.token, mode === "login" && rememberPassword);
    } catch (x) {
      setError(x instanceof Error ? x.message : "No se pudo continuar");
    } finally {
      setBusy(false);
    }
  };
  const forgot = async () => {
    const email = await uiPrompt("Recuperar contraseña", "", {
      message: "Escribe tu correo registrado.",
      placeholder: "correo@empresa.com",
    });
    if (!email) return;
    const result = await forgotPassword(email);
    if (result.developmentToken) {
      const password = await uiPrompt("Nueva contraseña", "", {
        message: "Modo local: escribe una contraseña de mínimo 8 caracteres.",
      });
      if (password) {
        await resetPassword(result.developmentToken, password);
        await uiAlert(
          "Contraseña actualizada",
          "Ya puedes ingresar con tu nueva contraseña.",
        );
      }
    } else
      await uiAlert(
        "Solicitud recibida",
        "Si el correo existe, recibirás un enlace de recuperación.",
      );
  };
  return (
    <div className="access-page">
      <section className="access-brand">
        <img
          className="login-logo"
          src="/ejb-manager-logo.svg"
          alt="EJB Manager"
        />
        <div>
          <small>GESTIÓN DE PROYECTOS Y PROGRESOS</small>
          <h1>
            Transformamos ideas
            <br />
            en valor medible.
          </h1>
          <p>
            Propón, evalúa y acelera las iniciativas que hacen avanzar a EJB.
          </p>
        </div>
        <ul>
          <li>
            <ShieldCheck />
            Datos protegidos
          </li>
          <li>
            <Users />
            Trabajo por áreas
          </li>
          <li>
            <Target />
            Prioridad compartida
          </li>
        </ul>
      </section>
      <section className="access-form">
        <div className="access-card">
          <div className="auth-tabs">
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              Crear cuenta
            </button>
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Ingresar
            </button>
          </div>
          <h2>
            {mode === "register"
              ? "Bienvenido a EJB MANAGER"
              : "Qué bueno verte"}
          </h2>
          <p>
            {mode === "register"
              ? "Regístrate con tus datos corporativos."
              : "Ingresa con tu correo y contraseña."}
          </p>
          <form ref={loginForm} onSubmit={submit}>
            {mode === "register" && (
              <>
                <div className="two-fields">
                  <label>
                    Nombres
                    <input name="nombres" required minLength={2} />
                  </label>
                  <label>
                    Apellidos
                    <input name="apellidos" required minLength={2} />
                  </label>
                </div>
                <label>
                  Área
                  <select name="areaId" required defaultValue="">
                    <option value="" disabled>
                      Selecciona tu área
                    </option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cargo
                  <select name="cargo" required defaultValue="">
                    <option value="" disabled>
                      Selecciona tu cargo
                    </option>
                    <option>Jefe</option><option>Gerente</option>
                    <option>Asistente</option>
                    <option>Trabajador</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Correo corporativo
              <input
                name="email"
                type="email"
                autoComplete="username"
                defaultValue={
                  mode === "login"
                    ? (localStorage.getItem("ejb_remembered_email") ?? "")
                    : ""
                }
                required
              />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={8}
              />
            </label>
            {mode === "login" && (
              <label className="remember-password">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(event) => {
                    setRememberPassword(event.target.checked);
                    if (!event.target.checked)
                      localStorage.removeItem("ejb_remembered_email");
                    if (!event.target.checked)
                      void clearRememberedCredentials();
                  }}
                />
                <span>
                  <b>Guardar contraseña</b>
                  <small>
                    Mantener mi sesión y usar el gestor seguro del navegador.
                  </small>
                </span>
              </label>
            )}
            {error && <div className="auth-error">{error}</div>}
            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? "Procesando..."
                : mode === "register"
                  ? "Crear mi cuenta"
                  : "Ingresar"}
              <ArrowRight />
            </button>
          </form>
          {mode === "login" && (
            <button className="forgot-link" onClick={forgot}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

async function askProjectChange(item: Item, accion: "Editar" | "Eliminar") {
  const motivo = await uiPrompt(
    `Solicitar ${accion.toLowerCase()} proyecto`,
    "",
    { message: "Indica el motivo de la solicitud.", multiline: true },
  );
  if (!motivo) return;
  let payload: Record<string, unknown> | undefined;
  if (accion === "Editar") {
    const titulo = await uiPrompt("Nuevo título", item.titulo);
    const descripcion = await uiPrompt("Nueva descripción", item.descripcion, {
      multiline: true,
    });
    if (!titulo || !descripcion) return;
    payload = { titulo, descripcion };
  }
  const result = await requestChange({
    tipoEntidad: "Iniciativa",
    entidadId: item.id,
    accion,
    payload,
    motivo,
  });
  await uiAlert(
    "Solicitud enviada",
    result.appliedDirectly ? "El cambio ya fue aplicado." : `El proyecto seguirá visible hasta recibir aprobación. Basta con uno de los siguientes responsables:\n${(result.approvers??[]).map((a:any)=>`${a.nombre} — ${cargoLabel(a.cargo)}`).join("\n")}`,
  );
}
function InitiativeList({
  items,
  onProgress,
  onAppearance,
  onSelect,
  user,
  areas,
  onChanged,
}: {
  items: Item[];
  onProgress: (i: Item) => void;
  onAppearance: (i: Item) => void;
  onSelect: (i: Item) => void;
  user: User;
  areas: Area[];
  onChanged: () => void;
}) {
  const [editItem, setEditItem] = useState<Item | null>(null);
  if (!items.length)
    return (
      <div className="empty-state">
        <div>
          <Lightbulb />
        </div>
        <h3>Aún no hay iniciativas</h3>
        <p>Registra la primera idea para comenzar el portafolio.</p>
      </div>
    );
  return (
    <>
      <div className="list-head">
        <span>INICIATIVA</span>
        <span>PRIORIDAD</span>
        <span>ESTADO</span>
        <span>AVANCE</span>
        <span>ACCIONES</span>
      </div>
      <div className="initiative-list">
        {items.map((i) => (
          <article
            className="initiative"
            key={i.id}
            onClick={() => onSelect(i)}
            style={{ "--initiative-area": projectAreaAccent(i.area, i.color) } as CSSProperties}
          >
            <div className="initiative-main">
              <div
                className="area-icon"
                style={{
                  background: i.colorIcono ?? i.color,
                  color: readableText(i.colorIcono ?? i.color),
                }}
              >
                {i.icono ?? i.area[0]}
              </div>
              <div>
                <div className="code">
                  <i style={{ background: projectAreaAccent(i.area, i.color) }} />
                  {i.area} · {i.codigo}
                </div>
                <h3>{i.titulo}</h3>
                <p>{i.descripcion}</p>
              </div>
            </div>
            <div className="score">
              <b>{i.score}</b>
              <span>Score</span>
            </div>
            <div>
              <button
                type="button"
                className={`status ${statusClass[i.estado]}`}
                title={`Abrir detalles del proyecto en estado ${i.estado}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(i);
                }}
              >
                <span className="initiative-status-icon" aria-hidden="true">
                  {i.estado === "Pendiente" ? (
                    <Clock3 />
                  ) : i.estado === "En evaluación" ? (
                    <Search />
                  ) : i.estado === "Priorizado" ? (
                    <Sparkles />
                  ) : i.estado === "Finalizado" ? (
                    <CheckCircle2 />
                  ) : (
                    <TrendingUp />
                  )}
                </span>
                <span>{i.estado}</span>
              </button>
            </div>
            <div className="progress-cell">
              <div>
                <i style={{ width: `${i.avance}%` }} />
              </div>
              <b>{i.avance}%</b>
            </div>
            <div className="row-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAppearance(i);
                }}
                title="Personalizar icono"
              >
                <Paintbrush />
              </button>
              {true && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canOperateGlobally(user)) setEditItem(i);
                    else void askProjectChange(i, "Editar");
                  }}
                  title="Editar iniciativa"
                >
                  <Edit3 />
                </button>
              )}
              {canDeleteOwned(user,i.creadorId,i.areaId) && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user.isSuperAdmin && ["Asistente","Trabajador"].includes(user.cargo)) {
                      await askProjectChange(i, "Eliminar"); onChanged(); return;
                    }
                    if (
                      await uiConfirm(
                        "Eliminar iniciativa",
                        `¿Deseas enviar ${i.codigo} a la papelera?`,
                      )
                    ) {
                      await deleteInitiative(i.id);
                      onChanged();
                    }
                  }}
                  title="Eliminar iniciativa"
                >
                  <Trash2 />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {editItem && (
        <div className="overlay">
          <form
            className="event-modal initiative-edit-modal"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await updateInitiative(editItem.id, {
                titulo: String(f.get("titulo")),
                descripcion: String(f.get("descripcion")),
                areaId: String(f.get("areaId")),
              });
              await saveInitiativeAppearance(editItem.id, {
                icono: String(f.get("icono")),
                colorIcono: String(f.get("colorIcono")),
              });
              setEditItem(null);
              onChanged();
            }}
          >
            <button
              type="button"
              className="close"
              onClick={() => setEditItem(null)}
            >
              <X />
            </button>
            <Edit3 />
            <h2>Editar iniciativa</h2>
            <p>
              {editItem.codigo} · Solo jefatura del área o administración
              global.
            </p>
            <label>
              Área
              <select
                name="areaId"
                defaultValue={areas.find((a) => a.nombre === editItem.area)?.id}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Título
              <input
                name="titulo"
                defaultValue={editItem.titulo}
                required
                minLength={3}
              />
            </label>
            <label>
              Descripción
              <textarea
                name="descripcion"
                defaultValue={editItem.descripcion}
                required
                minLength={10}
              />
            </label>
            <div className="initiative-icon-editor">
              <div
                className="icon-edit-preview"
                style={{
                  background: editItem.colorIcono ?? editItem.color,
                  color: readableText(editItem.colorIcono ?? editItem.color),
                }}
              >
                {editItem.icono ?? editItem.area.slice(0, 2).toUpperCase()}
              </div>
              <label>
                Letras o emoji
                <input
                  name="icono"
                  defaultValue={
                    editItem.icono ?? editItem.area.slice(0, 2).toUpperCase()
                  }
                  maxLength={12}
                  required
                />
              </label>
              <label>
                Color del icono
                <input
                  name="colorIcono"
                  type="color"
                  defaultValue={editItem.colorIcono ?? editItem.color}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setEditItem(null)}>
                Cancelar
              </button>
              <button className="primary">Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function App() {
  const [areas, setAreas] = useState<Area[]>([]),
    [user, setUser] = useState<User | null>(null),
    [booting, setBooting] = useState(true),
    [page, setPage] = useState<Page>(() =>
      notificationPage(sessionStorage.getItem("ejb_active_page") ?? "") ?? "resumen",
    ),
    [items, setItems] = useState<Item[]>([]),
    [objetivos, setObjetivos] = useState<Objetivo[]>([]),
    [team, setTeam] = useState<TeamMember[]>([]),
    [teamQuery, setTeamQuery] = useState(""),
    [teamArea, setTeamArea] = useState("Todas"),
    [teamSort, setTeamSort] = useState("nombre"),
    [query, setQuery] = useState(""),
    [globalResults, setGlobalResults] = useState<any[]>([]),
    [area, setArea] = useState("Todas"),
    [clientFilter, setClientFilter] = useState("Todos"),
    [workerFilter, setWorkerFilter] = useState("Todos"),
    [statusFilter, setStatusFilter] = useState("Todos"),
    [effortFilter, setEffortFilter] = useState("Todos"),
    [sortFilter, setSortFilter] = useState("score"),
    [filtersOpen, setFiltersOpen] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [sidebarScale, setSidebarScale] = useState(() =>
      Number(localStorage.getItem("ejb_sidebar_scale") || 1),
    ),
    [mainScale, setMainScale] = useState(() =>
      Number(localStorage.getItem("ejb_main_scale") || 1),
    ),
    [chatScale, setChatScale] = useState(() =>
      Number(localStorage.getItem("ejb_chat_scale") || 1),
    ),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false),
    [selectedItem, setSelectedItem] = useState<Item | null>(null),
    [appearanceItem, setAppearanceItem] = useState<Item | null>(null),
    [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null),
    [modal, setModal] = useState(false),
    [createAreaName, setCreateAreaName] = useState(""),
    [progressItem, setProgressItem] = useState<Item | null>(null),
    [history, setHistory] = useState<Progress[]>([]),
    [alerts, setAlerts] = useState<any[]>([]),
    [notificationUnreadCount, setNotificationUnreadCount] = useState(0),
    [alertNotice, setAlertNotice] = useState<any | null>(null),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [userMenuOpen, setUserMenuOpen] = useState(false),
    [toast, setToast] = useState(""),
    [unreadMessages, setUnreadMessages] = useState(0),
    [messageNotice, setMessageNotice] = useState<{
      name: string;
      message: string;
      photo?: string | null;
    } | null>(null),
    [dashboardDetail, setDashboardDetail] = useState<
      "portfolio" | "areas" | null
    >(null),
    [hiddenDashboardWidgets, setHiddenDashboardWidgets] = useState<string[]>(
      () => {
        try {
          return JSON.parse(
            localStorage.getItem("ejb_dashboard_hidden") || "[]",
          );
        } catch {
          return [];
        }
      },
    );
  const zoomZone = useRef<"sidebar" | "main" | "chat">("main");
  const notificationAudio = useRef<AudioContext | null>(null),
    lastAlertCount = useRef(0),
    alertsInitialized = useRef(false),
    lastAlertSignature = useRef(""),
    currentAlerts = useRef<any[]>([]),
    alertsSoundedAfterUnlock = useRef(false),
    messageNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    alertNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    lastMessageNotice = useRef({ key: "", at: 0 });
  const closeTransientPanels = () => {
    setNotificationsOpen(false);
    setUserMenuOpen(false);
    setFiltersOpen(false);
    setGlobalResults([]);
  };
  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target;

      const overlay = target.matches(
        ".overlay, .ticket-detail-backdrop, .app-dialog-overlay",
      )
        ? target
        : null;
      if (overlay) {
        const closeButton = overlay.querySelector<HTMLButtonElement>(
          ".close, .app-dialog-close, [aria-label^='Cerrar'], [aria-label*='Cerrar']",
        );
        closeButton?.click();
      }

      const profile = document.querySelector(".header-profile");
      if (userMenuOpen && profile && !profile.contains(target))
        setUserMenuOpen(false);

      const notifications = document.querySelector(".notifications-popover");
      const notificationButton = document.querySelector(
        '.main-panel-inner>header .icon[aria-label="Ver alertas"]',
      );
      if (
        notificationsOpen &&
        !notifications?.contains(target) &&
        !notificationButton?.contains(target)
      )
        setNotificationsOpen(false);

      if (filtersOpen && !target.closest(".filters")) setFiltersOpen(false);
      if (
        globalResults.length > 0 &&
        !target.closest(".main-panel-inner>header .search")
      )
        setGlobalResults([]);
      if (
        mobileMenuOpen &&
        !target.closest(".shell>aside") &&
        !target.closest(".mobile-menu-button")
      )
        setMobileMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [
    filtersOpen,
    globalResults.length,
    mobileMenuOpen,
    notificationsOpen,
    userMenuOpen,
  ]);
  useEffect(() => {
    const dismissPopupWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const selectors = [
        ".app-dialog-overlay",
        ".overlay",
        ".task-modal-backdrop",
        ".ticket-detail-backdrop",
        ".notifications-popover",
        ".chat-notifications-popover",
        ".wallpaper-popover",
        ".schedule-popover",
        ".chat-chip-popover",
      ].join(",");
      const popups = Array.from(document.querySelectorAll<HTMLElement>(selectors))
        .filter((element) => {
          const style = window.getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element, index) => ({
          element,
          index,
          zIndex: Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0,
        }))
        .sort((left, right) => left.zIndex - right.zIndex || left.index - right.index);
      const popup = popups.at(-1)?.element;
      if (!popup) return;

      const closeButton = popup.querySelector<HTMLButtonElement>(
        ".close, .app-dialog-close, [aria-label*='Cerrar'], .notifications-close-action, :scope > header button:last-child, :scope > div:first-child > button:last-child, :scope > button:last-child",
      );
      if (closeButton) closeButton.click();
      else popup.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("keydown", dismissPopupWithEscape, true);
    return () => document.removeEventListener("keydown", dismissPopupWithEscape, true);
  }, []);
  const alertSignature = (rows: any[]) =>
    rows
      .map(
        (row) => `${row.type}|${row.initiativeId}|${row.title}|${row.message}`,
      )
      .sort()
      .join("::");
  const playNotificationSound = (kind: "message" | "alert") => {
    const context = notificationAudio.current;
    if (!context || context.state !== "running") return;
    if (kind === "message") {
      let preferences: any = {};
      try { preferences = JSON.parse(localStorage.getItem(`ejb_chat_preferences_${user?.id}`) || "{}"); } catch {}
      if (user?.estadoMensaje !== "No_molestar") void playChatTone(preferences.sound || "Tonos", context).catch(() => undefined);
      return;
    }
    const now = context.currentTime,
      tones =
        kind === "alert"
          ? [
              { frequency: 660, start: 0, duration: 0.16 },
              { frequency: 880, start: 0.2, duration: 0.2 },
            ]
          : [{ frequency: 740, start: 0, duration: 0.23 }];
    tones.forEach((tone) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        start = now + tone.start;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        tone.frequency * 1.12,
        start + tone.duration * 0.65,
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        kind === "alert" ? 0.15 : 0.12,
        start + 0.018,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.02);
    });
  };
  const showIncomingMessage = (
    name: string,
    message: string,
    photo?: string | null,
  ) => {
    const now = Date.now(),
      key = `${name}|${message}`;
    if (
      lastMessageNotice.current.key === key &&
      now - lastMessageNotice.current.at < 6000
    )
      return;
    lastMessageNotice.current = { key, at: now };
    setMessageNotice({ name, message, photo });
    playNotificationSound("message");
    if (messageNoticeTimer.current) clearTimeout(messageNoticeTimer.current);
    messageNoticeTimer.current = setTimeout(() => setMessageNotice(null), 4000);
    let chatPreferences: any = {};
    try { chatPreferences = JSON.parse(localStorage.getItem(`ejb_chat_preferences_${user?.id}`) || "{}"); } catch {}
    if (chatPreferences.desktop !== false && user?.estadoMensaje !== "No_molestar" && "Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`Mensaje de ${name}`, {
        body: message,
        icon: photo || "/ejb-manager-isotipo.svg",
        badge: "/ejb-manager-isotipo.svg",
        tag: `ejb-message-${name}`,
      });
      notification.onclick = () => {
        window.focus();
        setPage("mensajes");
        notification.close();
      };
    }
  };
  const applyLiveAlerts = (rows: any[]) => {
    const previous = lastAlertSignature.current,
      signature = alertSignature(rows),
      newAlert = alertsInitialized.current
        ? rows.find(
            (row: any) =>
              !previous.includes(
                `${row.type}|${row.initiativeId}|${row.title}|${row.message}`,
              ),
          )
        : undefined;
    if (newAlert) {
      setAlertNotice(newAlert);
      playNotificationSound("alert");
      if (alertNoticeTimer.current) clearTimeout(alertNoticeTimer.current);
      alertNoticeTimer.current = setTimeout(() => setAlertNotice(null), 5000);
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(newAlert.title, {
          body: newAlert.message,
          icon: "/ejb-manager-isotipo.svg",
          badge: "/ejb-manager-isotipo.svg",
          tag: `ejb-alert-${newAlert.type}-${newAlert.initiativeId}`,
        });
        notification.onclick = () => {
          window.focus();
          setPage("cronograma");
          notification.close();
        };
      }
    }
    lastAlertCount.current = rows.length;
    lastAlertSignature.current = signature;
    currentAlerts.current = rows;
    alertsInitialized.current = true;
    setAlerts(rows);
  };
  const reloadItems = () =>
    fetchIniciativas().then((r: any[]) => setItems(r.map(mapItem)));
  const toggleTheme = async () => {
    if (!user) return;
    const darkMode = !user.darkMode;
    await savePreferences(darkMode);
    setUser({ ...user, darkMode });
  };
  useEffect(() => {
    fetchCatalogo()
      .then((c) => setAreas(c.areas))
      .finally(() => setBooting(false));
    if (
      localStorage.getItem("ejb_token") ||
      sessionStorage.getItem("ejb_token")
    )
      me()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem("ejb_token");
          sessionStorage.removeItem("ejb_token");
        });
  }, []);
  useEffect(() => {
    if (!user) return;
    fetchIniciativas().then((r: any[]) => setItems(r.map(mapItem)));
    fetchObjetivos().then(setObjetivos);
    fetchEquipo().then(setTeam);
    fetchAlerts().then((rows) => {
      setAlerts(rows);
      currentAlerts.current = rows;
      lastAlertCount.current = rows.length;
      lastAlertSignature.current = alertSignature(rows);
      alertsInitialized.current = true;
    });
  }, [user]);
  useEffect(() => {
    if (!user) {
      setNotificationUnreadCount(0);
      return;
    }
    let active = true;
    const syncNotificationCount = () =>
      fetchNotifications(false)
        .then((rows: any[]) => {
          if (active)
            setNotificationUnreadCount(rows.filter((row) => !row.leidaAt).length);
        })
        .catch(() => undefined);
    void syncNotificationCount();
    const timer = window.setInterval(syncNotificationCount, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    const reload = () => {
      reloadItems();
      fetchObjetivos().then(setObjetivos);
    };
    window.addEventListener("ejb-data-changed", reload);
    return () => window.removeEventListener("ejb-data-changed", reload);
  }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(
      () => trackAdoption(page, "ver_modulo").catch(() => undefined),
      900,
    );
    return () => window.clearTimeout(timer);
  }, [page, user?.id]);
  useEffect(() => {
    if (!user) return;
    let stopped = false,
      reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const controller = new AbortController();
      subscribeAlerts(applyLiveAlerts, controller.signal).catch(() => {
        if (!stopped) reconnectTimer = setTimeout(connect, 1800);
      });
      return controller;
    };
    let controller = connect();
    const fallback = window.setInterval(
      () =>
        fetchAlerts()
          .then(applyLiveAlerts)
          .catch(() => undefined),
      30000,
    );
    return () => {
      stopped = true;
      controller.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallback);
    };
  }, [user?.id]);
  useEffect(() => {
    const unlock = async () => {
      if (!notificationAudio.current)
        notificationAudio.current = new AudioContext();
      await notificationAudio.current.resume().catch(() => undefined);
      if (currentAlerts.current.length && !alertsSoundedAfterUnlock.current) {
        alertsSoundedAfterUnlock.current = true;
        playNotificationSound("alert");
      }
      if ("Notification" in window && Notification.permission === "default")
        Notification.requestPermission().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--portal-color",
      user?.portalColor ?? "#0B2347",
    );
  }, [user?.portalColor]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", Boolean(user?.darkMode));
    const color = user?.portalColor ?? "#0B2347",
      rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)),
      luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    document.documentElement.style.setProperty(
      "--portal-on-color",
      luminance > 150 ? "#0b1830" : "#ffffff",
    );
  }, [user?.darkMode, user?.portalColor]);
  useEffect(() => {
    localStorage.setItem("ejb_sidebar_scale", String(sidebarScale));
  }, [sidebarScale]);
  useEffect(() => {
    localStorage.setItem("ejb_main_scale", String(mainScale));
  }, [mainScale]);
  useEffect(() => {
    localStorage.setItem("ejb_chat_scale", String(chatScale));
  }, [chatScale]);
  useEffect(() => {
    localStorage.setItem(
      "ejb_dashboard_hidden",
      JSON.stringify(hiddenDashboardWidgets),
    );
    document.documentElement.dataset.dashboardHidden =
      hiddenDashboardWidgets.join(" ");
  }, [hiddenDashboardWidgets]);
  useEffect(() => {
    if (page === "mensajes") zoomZone.current = "chat";
  }, [page]);
  useEffect(() => {
    document.documentElement.dataset.currentPage = page;
    sessionStorage.setItem("ejb_active_page", page);
  }, [page]);
  useEffect(() => {
    const adjust = (direction: number) => {
      const update = (value: number) =>
        Math.min(1.3, Math.max(0.7, +(value + direction * 0.05).toFixed(2)));
      if (zoomZone.current === "sidebar") setSidebarScale(update);
      else if (zoomZone.current === "chat") setChatScale(update);
      else setMainScale(update);
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      adjust(event.deltaY < 0 ? 1 : -1);
    };
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      if (event.key === "0") {
        event.preventDefault();
        zoomZone.current === "sidebar"
          ? setSidebarScale(1)
          : zoomZone.current === "chat"
            ? setChatScale(1)
            : setMainScale(1);
      } else if (["+", "=", "Add"].includes(event.key)) {
        event.preventDefault();
        adjust(1);
      } else if (["-", "_", "Subtract"].includes(event.key)) {
        event.preventDefault();
        adjust(-1);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(""),
      toast.length > 55 ? 2000 : 1500,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!user || query.trim().length < 2) {
      setGlobalResults([]);
      return;
    }
    const timer = setTimeout(
      () =>
        globalSearch(query)
          .then(setGlobalResults)
          .catch(() => setGlobalResults([])),
      250,
    );
    return () => clearTimeout(timer);
  }, [query, user?.id]);
  useEffect(() => {
    if (!user) return;
    let initialized = false,
      lastUnread = 0;
    const loadMessages = async () => {
      const rows = await fetchConversations();
      const total = rows.reduce(
        (sum: number, row: any) => sum + Number(row.unread || 0),
        0,
      );
      if (initialized && total > lastUnread) {
        const sender = rows.find((row: any) => row.unread > 0);
        if (sender)
          showIncomingMessage(
            `${sender.nombres} ${sender.apellidos}`,
            sender.lastMessage?.contenido ?? "Nuevo mensaje",
            sender.fotoPerfil,
          );
      }
      lastUnread = total;
      setUnreadMessages(total);
      initialized = true;
    };
    loadMessages();
    const timer = setInterval(loadMessages, 3500);
    return () => clearInterval(timer);
  }, [user?.id, page]);
  const filtered = useMemo(
    () =>
      items
        .filter(
          (i) =>
            (area === "Todas" || i.area === area) &&
            (clientFilter === "Todos" ||
              (clientFilter === "Sin cliente"
                ? !i.cliente
                : i.cliente === clientFilter)) &&
            (workerFilter === "Todos" || i.responsable === workerFilter) &&
            (statusFilter === "Todos" || i.estado === statusFilter) &&
            (effortFilter === "Todos" || i.esfuerzo === effortFilter) &&
            `${i.titulo} ${i.codigo}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sortFilter === "avance"
            ? b.avance - a.avance
            : sortFilter === "recientes"
              ? b.codigo.localeCompare(a.codigo)
              : b.score - a.score,
        ),
    [items, query, area, clientFilter, workerFilter, statusFilter, effortFilter, sortFilter],
  );
  const visibleTeam = useMemo(() => {
    const term = teamQuery.trim().toLocaleLowerCase("es");
    return team
      .filter((member) =>
        (teamArea === "Todas" || member.area.nombre === teamArea) &&
        (!term || `${member.nombres} ${member.apellidos} ${member.cargo} ${member.area.nombre} ${member.email}`.toLocaleLowerCase("es").includes(term)),
      )
      .sort((left, right) => {
        if (teamSort === "area") return left.area.nombre.localeCompare(right.area.nombre, "es");
        if (teamSort === "cargo") return cargoLabel(left.cargo).localeCompare(cargoLabel(right.cargo), "es");
        return `${left.nombres} ${left.apellidos}`.localeCompare(`${right.nombres} ${right.apellidos}`, "es");
      });
  }, [team, teamArea, teamQuery, teamSort]);
  const openProgress = async (i: Item) => {
    setProgressItem(i);
    setHistory(await fetchProgresos(i.id));
  };
  const customizeInitiative = async (i: Item) => {
    setAppearanceItem(i);
  };
  const changeTeamCargo = async (member: TeamMember, cargo: string) => {
    await saveTeamCargo(member.id, cargo);
    setTeam((rows) =>
      rows.map((row) => (row.id === member.id ? { ...row, cargo } : row)),
    );
    setToast(`${member.nombres} ahora tiene el rol ${cargo}`);
  };
  const addInitiative = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      selected = areas.find((a) => a.nombre === String(f.get("area")));
    if (!selected) return;
    try {
      const r = await createIniciativa({
        titulo: String(f.get("titulo")),
        descripcion: String(f.get("descripcion")),
        cliente: String(f.get("cliente") || "").trim() || undefined,
        areaId: selected.id,
        responsableId: String(f.get("responsableId") || "") || undefined,
        impacto: Number(f.get("impacto")),
        esfuerzo: String(f.get("esfuerzo")),
        fechaInicio: String(f.get("fechaInicio") || "") || undefined,
        fechaFin: String(f.get("fechaFin") || "") || undefined,
        tareas: String(f.get("tareas") || "")
          .split("\n")
          .map((task) => task.trim())
          .filter(Boolean),
      });
      setItems((v) => [mapItem(r), ...v]);
      setModal(false);
      setToast("Iniciativa guardada como Pendiente");
    } catch (x) {
      setToast(x instanceof Error ? x.message : "No se pudo guardar");
    }
  };
  const addProgress = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!progressItem) return;
    const f = new FormData(e.currentTarget),
      porcentaje = Number(f.get("porcentaje"));
    const p = await addProgreso(progressItem.id, {
      porcentaje,
      comentario: String(f.get("comentario")),
    }),
      projectProgress = Number(p.porcentajeAvance ?? porcentaje),
      projectStatus = mapProjectStatus(p.estadoProyecto ?? (projectProgress >= 100 ? "Finalizado" : projectProgress > 0 ? "En_desarrollo" : progressItem.estado));
    setHistory((v) => [p, ...v]);
    setItems((v) =>
      v.map((i) =>
        i.id === progressItem.id ? { ...i, avance: projectProgress, estado: projectStatus } : i,
      ),
    );
    setProgressItem({ ...progressItem, avance: projectProgress, estado: projectStatus });
    const nextAlerts = await fetchAlerts();
    setAlerts(nextAlerts);
    currentAlerts.current = nextAlerts;
    lastAlertCount.current = nextAlerts.length;
    lastAlertSignature.current = alertSignature(nextAlerts);
    setToast(
      porcentaje >= 100
        ? "Tarea completada y notificaciones actualizadas"
        : "Progreso registrado",
    );
  };
  const addGoal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const goal = await createObjetivo({
      nombre: String(f.get("nombre")),
      descripcion: String(f.get("descripcion")),
    });
    setObjetivos((v) => [goal, ...v]);
    e.currentTarget.reset();
    setToast("Objetivo creado");
  };
  const askGoalChange = async (
    goal: Objetivo,
    accion: "Editar" | "Eliminar",
  ) => {
    if (canOperateGlobally(user)) {
      if (accion === "Eliminar") {
        if (
          !(await uiConfirm(
            "Eliminar objetivo",
            `¿Deseas eliminar definitivamente “${goal.nombre}”?`,
          ))
        )
          return;
        await requestChange({
          tipoEntidad: "Objetivo",
          entidadId: goal.id,
          accion,
          motivo: user?.isSuperAdmin
            ? "Acción directa de administración global"
            : "Acción directa del rol técnico",
        });
        setObjetivos((value) => value.filter((item) => item.id !== goal.id));
        setToast("Objetivo eliminado");
        return;
      }
      const nombre = await uiPrompt("Editar objetivo", goal.nombre, {
        message: "Actualiza el nombre del objetivo.",
      });
      if (!nombre) return;
      const descripcion = await uiPrompt(
        "Descripción del objetivo",
        goal.descripcion ?? "",
        { message: "Actualiza la descripción estratégica.", multiline: true },
      );
      if (descripcion === null) return;
      await requestChange({
        tipoEntidad: "Objetivo",
        entidadId: goal.id,
        accion,
        payload: { nombre, descripcion },
        motivo: user?.isSuperAdmin
          ? "Edición directa de administración global"
          : "Edición directa del rol técnico",
      });
      setObjetivos((value) =>
        value.map((item) =>
          item.id === goal.id ? { ...item, nombre, descripcion } : item,
        ),
      );
      setToast("Objetivo actualizado");
      return;
    }
    const motivo = await uiPrompt(
      `Solicitar ${accion.toLowerCase()} objetivo`,
      "",
      { message: "Indica el motivo de la solicitud.", multiline: true },
    );
    if (!motivo) return;
    let payload: Record<string, unknown> | undefined;
    if (accion === "Editar") {
      const nombre = await uiPrompt("Nuevo nombre", goal.nombre);
      const descripcion = await uiPrompt(
        "Nueva descripción",
        goal.descripcion ?? "",
        { multiline: true },
      );
      if (!nombre) return;
      payload = { nombre, descripcion };
    }
    await requestChange({
      tipoEntidad: "Objetivo",
      entidadId: goal.id,
      accion,
      payload,
      motivo,
    });
    setToast("Solicitud enviada para aprobación");
  };
  const changeColor = async (color: string) => {
    await savePortalColor(color);
    setUser((u) => (u ? { ...u, portalColor: color } : u));
    setToast("Color del portal actualizado");
  };
  const access = (u: User, t: string, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    storage.setItem("ejb_token", t);
    otherStorage.removeItem("ejb_token");
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem("ejb_token");
    sessionStorage.removeItem("ejb_token");
    sessionStorage.removeItem("ejb_active_page");
    setUser(null);
  };
  if (booting)
    return (
      <div className="loading">
        <div className="access-logo">E</div>Cargando EJB Hub…
      </div>
    );
  if (!user) return <Access areas={areas} onAccess={access} />;
  const titles: Record<Page, [string, string]> = {
    resumen: [
      "Resumen del portafolio",
      "Una vista clara de lo que estamos construyendo.",
    ],
    "mi-trabajo": [
      "Mi trabajo",
      "Prioridades, tareas y próximos vencimientos en un solo lugar.",
    ],
    clientes: [
      "Clientes",
      "Relación integral entre clientes, proyectos, tareas y reuniones.",
    ],
    ticketera: [
      "Ticketera – Consultoría",
      "Seguimiento y atención de consultas de clientes.",
    ],
    "kanban-sistemas": [
      "Kanban Sistemas",
      "Seguimiento operativo de los proyectos e iniciativas del área Sistemas.",
    ],
    notificaciones: [
      "Notificaciones",
      "Consulta y organiza toda la actividad relevante del portal.",
    ],
    administracion: [
      "Administración",
      "Gobierno, seguridad, automatización y adopción de la plataforma.",
    ],
    feedback: [
      "Mejora continua",
      "Registra pruebas, observaciones y oportunidades de mejora.",
    ],
    iniciativas: [
      "Proyectos",
      "Registra, prioriza y actualiza el avance de cada proyecto.",
    ],
    objetivos: [
      "Objetivos de negocio",
      "Define hacia dónde debe apuntar la gestión.",
    ],
    equipo: ["Equipo EJB", "Personas registradas, áreas y cargos."],
    mensajes: ["Mensajes", "Conversaciones privadas entre compañeros."],
    cronograma: [
      "Alertas",
      "Duración, avance diario y retrasos de proyectos.",
    ],
    calendario: [
      "Calendario del equipo",
      "Organiza eventos, responsables y prioridades por área.",
    ],
    informes: [
      "Informes BI",
      "Estadísticas avanzadas, trazabilidad y planificación ejecutiva.",
    ],
    reporteria: [
      "Reportería",
      "Reportes operativos por cliente, trabajador, proyecto y tarea.",
    ],
    requerimientos: [
      "Requerimientos Administración",
      "Solicita y da seguimiento a los recursos que necesita tu área.",
    ],
    flujos: [
      "Flujos de Áreas",
      "Documenta, comparte y previsualiza procesos de trabajo en PDF.",
    ],
    firmas: [
      "Firma Electrónica",
      "Carga, revisa y firma documentos internos con trazabilidad.",
    ],
    encuestas: [
      "Encuestas EJB",
      "Consulta al equipo y visualiza los resultados en tiempo real.",
    ],
    aprobaciones: [
      "Aprobaciones",
      "Solicitudes de edición y eliminación de tu área.",
    ],
    perfil: ["Mi perfil", "Actualiza tus datos, foto y preferencias."],
    ayuda: ["Centro de ayuda", "Respuestas rápidas para usar EJB MANAGER."],
    personalizacion: [
      "Personaliza tu portal",
      "Elige el color que mejor represente tu espacio.",
    ],
  };
  return (
    <div
      className={`shell ${page === "mensajes" ? "chat-immersive" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileMenuOpen ? "mobile-menu-open" : ""} ${mainScale >= 1.16 ? "main-zoom-large" : ""} ${mainScale <= 0.84 ? "main-zoom-small" : ""}`}
      style={
        {
          "--sidebar-scale": sidebarScale,
          "--main-scale": mainScale,
          "--main-scale-inverse": 1 / mainScale,
          "--chat-scale": chatScale,
          "--chat-message-font": `${13 * chatScale}px`,
          "--chat-meta-font": `${9 * chatScale}px`,
          "--chat-sticker-font": `${46 * chatScale}px`,
          "--chat-media-width": `${340 * chatScale}px`,
          "--chat-media-height": `${300 * chatScale}px`,
        } as CSSProperties
      }
    >
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <aside
        onPointerEnter={() => {
          zoomZone.current = "sidebar";
        }}
        onFocusCapture={() => {
          zoomZone.current = "sidebar";
        }}
      >
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? "Abrir menú" : "Cerrar menú"}
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
        <div className="sidebar-zoom">
          <button
            onClick={() =>
              setSidebarScale((v) => Math.max(0.82, +(v - 0.06).toFixed(2)))
            }
            title="Reducir menú"
          >
            <ZoomOut />
          </button>
          <span>{Math.round(sidebarScale * 100)}%</span>
          <button
            onClick={() =>
              setSidebarScale((v) => Math.min(1.18, +(v + 0.06).toFixed(2)))
            }
            title="Ampliar menú"
          >
            <ZoomIn />
          </button>
        </div>
        <nav onClickCapture={() => setMobileMenuOpen(false)}>
          <button
            className={page === "resumen" ? "active" : ""}
            onClick={() => setPage("resumen")}
          >
            <LayoutDashboard />
            Resumen
          </button>
          <button
            className={page === "notificaciones" ? "active" : ""}
            onClick={() => setPage("notificaciones")}
          >
            <Bell /> Notificaciones
            {notificationUnreadCount > 0 && <span>{notificationUnreadCount}</span>}
          </button>
          <button
            className={page === "iniciativas" ? "active" : ""}
            onClick={() => setPage("iniciativas")}
          >
            <Lightbulb />
            Proyectos<span>{items.length}</span>
          </button>
          <button
            className={page === "mi-trabajo" ? "active" : ""}
            onClick={() => setPage("mi-trabajo")}
          >
            <BriefcaseBusiness /> Mi trabajo
          </button>
          <button
            className={page === "objetivos" ? "active" : ""}
            onClick={() => setPage("objetivos")}
          >
            <Target />
            Objetivos
          </button>
          <button
            className={page === "equipo" ? "active" : ""}
            onClick={() => setPage("equipo")}
          >
            <Users />
            Equipo
          </button>
          <button
            className={page === "clientes" ? "active" : ""}
            onClick={() => setPage("clientes")}
          >
            <Building2 /> Clientes
          </button>
          <button
            className={page === "ticketera" ? "active" : ""}
            onClick={() => setPage("ticketera")}
          >
            <BarChart3 /> Ticketera Consultoría
          </button>
          <button
            className={page === "kanban-sistemas" ? "active" : ""}
            onClick={() => setPage("kanban-sistemas")}
          >
            <PanelsTopLeft /> Kanban Sistemas
            {items.filter((item) => item.area === "Sistemas").length > 0 && (
              <span>{items.filter((item) => item.area === "Sistemas").length}</span>
            )}
          </button>
          <button
            className={page === "mensajes" ? "active" : ""}
            onClick={() => {
              setPage("mensajes");
              setMessageNotice(null);
            }}
          >
            <MessageCircle />
            Mensajes{unreadMessages > 0 && <span>{unreadMessages}</span>}
          </button>
          <button
            className={page === "cronograma" ? "active" : ""}
            onClick={() => setPage("cronograma")}
          >
            <BellRing />
            Alertas
          </button>
          <button
            className={page === "calendario" ? "active" : ""}
            onClick={() => setPage("calendario")}
          >
            <CalendarDays /> Calendario
          </button>
          <button
            className={page === "informes" ? "active" : ""}
            onClick={() => setPage("informes")}
          >
            <BarChart3 /> Informes BI
          </button>
          <button
            className={page === "requerimientos" ? "active" : ""}
            onClick={() => {
              setPage("requerimientos");
              setMobileMenuOpen(false);
            }}
          >
            <ClipboardList />
            Requerimientos
          </button>
          <button
            className={page === "reporteria" ? "active" : ""}
            onClick={() => setPage("reporteria")}
          >
            <Download /> Reportería
          </button>
          <button
            className={page === "flujos" ? "active" : ""}
            onClick={() => {
              setPage("flujos");
              setMobileMenuOpen(false);
            }}
          >
            <FileText />
            Flujos de Áreas
          </button>
          <button
            className={page === "firmas" ? "active" : ""}
            onClick={() => {
              setPage("firmas");
              setMobileMenuOpen(false);
            }}
          >
            <FileSignature />
            Firma Electrónica
          </button>
          <button
            className={page === "encuestas" ? "active" : ""}
            onClick={() => {
              setPage("encuestas");
              setMobileMenuOpen(false);
            }}
          >
            <Vote />
            Encuestas
          </button>
          <button
            className={page === "aprobaciones" ? "active" : ""}
            onClick={() => setPage("aprobaciones")}
          >
            <CheckSquare />
            Aprobaciones
          </button>
          {(user.isSuperAdmin || isAreaLeaderUser(user)) && (
            <button
              className={page === "administracion" ? "active" : ""}
              onClick={() => setPage("administracion")}
            >
              <Settings /> Administración
            </button>
          )}
          <button
            className={page === "feedback" ? "active" : ""}
            onClick={() => setPage("feedback")}
          >
            <Sparkles /> Mejora continua
          </button>
          <button
            className={page === "personalizacion" ? "active" : ""}
            onClick={() => setPage("personalizacion")}
          >
            <Palette />
            Personalización
          </button>
        </nav>
        <div className="nav-foot">
          <button onClick={() => setPage("ayuda")}>
            <CircleHelp />
            Centro de ayuda
          </button>
          <div className="app-version">
            <span>EJB MANAGER</span>
            <b>V. 0.3.28</b>
          </div>
        </div>
      </aside>
      <main
        id="main-content"
        tabIndex={-1}
        className={page === "mensajes" ? "chat-workspace" : ""}
        onPointerEnter={() => {
          zoomZone.current = page === "mensajes" ? "chat" : "main";
        }}
        onFocusCapture={() => {
          zoomZone.current = page === "mensajes" ? "chat" : "main";
        }}
      >
        <div className="main-panel-inner">
          <header>
            <button
              type="button"
              className="topbar-brand"
              aria-label="Ir al resumen"
              title="Volver al inicio"
              onClick={() => {
                setPage("resumen");
                setMobileMenuOpen(false);
                setNotificationsOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <img
                className="topbar-logo-full"
                src="/ejb-manager-logo.svg"
                alt="EJB Manager"
              />
              <img
                className="topbar-logo-compact"
                src="/ejb-manager-isotipo.svg"
                alt="EJB"
              />
            </button>
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <Menu />
            </button>
            <div className="mobile-brand">
              EJB <b>MANAGER</b>
            </div>
            <div
              className="workspace-switch"
              aria-label="Cambiar espacio de trabajo"
            >
              <button
                className={page !== "mensajes" ? "active" : ""}
                onClick={() => setPage("resumen")}
              >
                <LayoutDashboard />
                <span>Intranet</span>
              </button>
              <button
                className={page === "mensajes" ? "active" : ""}
                onClick={() => {
                  setPage("mensajes");
                  setMessageNotice(null);
                }}
              >
                <MessageCircle />
                <span>EJB Chat</span>
              </button>
            </div>
            <div className="search">
              <Search />
              <input
                placeholder="Buscar iniciativas..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {globalResults.length > 0 && (
                <div
                  className="global-search-results"
                  role="listbox"
                  aria-label="Resultados de búsqueda"
                >
                  {globalResults.map((result) => (
                    <button
                      type="button"
                      role="option"
                      key={`${result.tipo}-${result.id}`}
                      onClick={() => {
                        setPage(result.destino as Page);
                        setQuery("");
                        setGlobalResults([]);
                      }}
                    >
                      <span>{result.tipo}</span>
                      <p>
                        <b>{result.titulo}</b>
                        <small>{String(result.detalle ?? "")}</small>
                      </p>
                      <ArrowRight />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="header-theme"
              onClick={() => {
                closeTransientPanels();
                toggleTheme();
              }}
              aria-label={
                user.darkMode ? "Activar modo claro" : "Activar modo oscuro"
              }
              title={user.darkMode ? "Modo claro" : "Modo oscuro"}
            >
              {user.darkMode ? <Sun /> : <Moon />}
              <span>{user.darkMode ? "Claro" : "Oscuro"}</span>
            </button>
            <button
              className="icon"
              onClick={() => {
                const nextOpen = !notificationsOpen;
                closeTransientPanels();
                setMobileMenuOpen(false);
                setNotificationsOpen(nextOpen);
              }}
              aria-label="Ver alertas"
              aria-expanded={notificationsOpen}
            >
              <Bell />
              {notificationUnreadCount > 0 && <i />}
            </button>
            {notificationsOpen && (
              <div className="notifications-popover">
                <div>
                  <b>Notificaciones</b>
                  <button onClick={() => setNotificationsOpen(false)}>
                    <X />
                  </button>
                </div>
                {alerts.map((alert, index) => (
                  <button
                    key={index}
                    className={alert.severity}
                    onClick={() => {
                      setPage("cronograma");
                      setNotificationsOpen(false);
                    }}
                  >
                    <span>{alert.type === "completado" ? "✓" : "!"}</span>
                    <p>
                      <b>{alert.title}</b>
                      <small>{alert.message}</small>
                    </p>
                  </button>
                ))}
                {!alerts.length && (
                  <div className="notifications-empty">
                    <Bell />
                    <b>Todo al día</b>
                    <small>No tienes alertas pendientes.</small>
                  </div>
                )}
                <button
                  className="view-all"
                  onClick={() => {
                    setPage("cronograma");
                    setNotificationsOpen(false);
                  }}
                >
                  Ver alertas <ArrowRight />
                </button>
              </div>
            )}
            <div className="header-profile">
              <button
                className="header-profile-button"
                onClick={() => {
                  const nextOpen = !userMenuOpen;
                  closeTransientPanels();
                  setMobileMenuOpen(false);
                  setUserMenuOpen(nextOpen);
                }}
                aria-expanded={userMenuOpen}
                aria-label="Abrir menú de usuario"
              >
                <span>
                  {user.fotoPerfil ? (
                    <img src={user.fotoPerfil} alt="Foto de perfil" />
                  ) : (
                    initials(user.nombreCompleto)
                  )}
                </span>
                <div>
                  <b>{user.nombreCompleto}</b>
                  <small>
                    {cargoLabel(user.cargo)} · {user.area.nombre}
                  </small>
                </div>
                <ChevronDown />
              </button>
              {userMenuOpen && (
                <div className="header-profile-menu">
                  <div className="header-profile-summary">
                    <span>
                      {user.fotoPerfil ? (
                        <img src={user.fotoPerfil} alt="" />
                      ) : (
                        initials(user.nombreCompleto)
                      )}
                    </span>
                    <p>
                      <b>{user.nombreCompleto}</b>
                      <small>{user.email}</small>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setPage("perfil");
                      setUserMenuOpen(false);
                    }}
                  >
                    <UserCog />
                    <span>
                      <b>Editar perfil</b>
                      <small>Datos, foto, área y contraseña</small>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setPage("personalizacion");
                      setUserMenuOpen(false);
                    }}
                  >
                    <Palette />
                    <span>
                      <b>Apariencia</b>
                      <small>Color y modo de la interfaz</small>
                    </span>
                  </button>
                  <button className="header-logout" onClick={logout}>
                    <LogOut />
                    <span>
                      <b>Cerrar sesión</b>
                      <small>Salir de EJB MANAGER</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
            {page === "ticketera" ? (
              <button
                className="primary"
                onClick={() => window.dispatchEvent(new CustomEvent("ticket:new"))}
              >
                <Plus />
                Registrar caso
              </button>
            ) : page !== "mensajes" && (
              <button className="primary" onClick={() => { setCreateAreaName(page === "kanban-sistemas" ? "Sistemas" : user.area.nombre); setModal(true); }}>
                <Plus />
                {page === "kanban-sistemas" ? "Nuevo registro Kanban" : "Nuevo Proyecto"}
              </button>
            )}
          </header>
          <section
            className={
              page === "mensajes" ? "content chat-page-content" : "content"
            }
          >
            {page === "perfil" && <div className="title-row">
              <div>
                <button
                  className="back-button"
                  onClick={() => setPage("resumen")}
                >
                  <ArrowLeft />
                  Volver al resumen
                </button>
                <h1>{titles[page][0]}</h1>
                <p>{titles[page][1]}</p>
              </div>
            </div>}
            {page === "mi-trabajo" && <MyWork user={user} items={items} />}
            {page === "clientes" && <Clients360 items={items} />}
            {page === "ticketera" && <TicketWorkspace user={user} />}
            {page === "kanban-sistemas" && (
              <SystemsKanban
                items={items}
                user={user}
                team={team}
                onChanged={reloadItems}
                onOpen={setSelectedItem}
                onProgress={openProgress}
              />
            )}
            {page === "notificaciones" && (
              <NotificationCenter
                onUnreadChange={setNotificationUnreadCount}
                onNavigate={(destination) => {
                  const target = notificationPage(destination);
                  if (!target) return;
                  closeTransientPanels();
                  setPage(target);
                }}
              />
            )}
            {page === "administracion" && (user.isSuperAdmin || isAreaLeaderUser(user)) && (
              <EnterpriseAdmin user={user} areas={areas} />
            )}
            {page === "feedback" && <UserFeedback user={user} />}
            {page === "resumen" && (
              <>
                <div className="dashboard-customizer">
                  <SlidersHorizontal />
                  <span>
                    <b>Personalizar panel</b>
                    <small>Elige qué información quieres ver primero.</small>
                  </span>
                  {[
                    ["metrics", "Indicadores"],
                    ["portfolio", "Portafolio"],
                    ["areas", "Áreas"],
                    ["recent", "Proyectos"],
                  ].map(([id, label]) => (
                    <button
                      type="button"
                      className={
                        !hiddenDashboardWidgets.includes(id) ? "active" : ""
                      }
                      key={id}
                      onClick={() =>
                        setHiddenDashboardWidgets((current) =>
                          current.includes(id)
                            ? current.filter((value) => value !== id)
                            : [...current, id],
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="stats">
                  <article>
                    <small>INICIATIVAS</small>
                    <strong>{items.length}</strong>
                    <span>
                      {items.length ? "en portafolio" : "Sin registros"}
                    </span>
                  </article>
                  <article>
                    <small>EN PROCESO</small>
                    <strong>
                      {items.filter((i) => i.estado === "En proceso").length}
                    </strong>
                    <span>proyectos activos</span>
                  </article>
                  <article>
                    <small>AVANCE PROMEDIO</small>
                    <strong>
                      {items.length
                        ? Math.round(
                            items.reduce((s, i) => s + i.avance, 0) /
                              items.length,
                          )
                        : 0}
                      %
                    </strong>
                    <span>actualizado por el equipo</span>
                  </article>
                  <article className="highlight">
                    <small>OBJETIVOS</small>
                    <strong>{objetivos.length}</strong>
                    <span>líneas estratégicas</span>
                  </article>
                </div>
                <div className="bi-grid">
                  <article
                    className="bi-card portfolio-health dashboard-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDashboardDetail("portfolio")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        setDashboardDetail("portfolio");
                    }}
                    aria-label="Ver detalle de salud del portafolio"
                  >
                    <div className="bi-heading">
                      <div>
                        <small>RENDIMIENTO</small>
                        <h3>Salud del portafolio</h3>
                      </div>
                      <span>Actualizado ahora</span>
                    </div>
                    <div className="health-body">
                      <div
                        className="donut"
                        style={
                          {
                            "--value": `${items.length ? Math.round(items.reduce((s, i) => s + i.avance, 0) / items.length) : 0}%`,
                          } as CSSProperties
                        }
                      >
                        <div>
                          <strong>
                            {items.length
                              ? Math.round(
                                  items.reduce((s, i) => s + i.avance, 0) /
                                    items.length,
                                )
                              : 0}
                            %
                          </strong>
                          <small>avance</small>
                        </div>
                      </div>
                      <div className="health-legend">
                        {(
                          [
                            "Pendiente",
                            "En evaluación",
                            "Priorizado",
                            "En proceso",
                            "Finalizado",
                          ] as Estado[]
                        ).map((status) => {
                          const count = items.filter(
                            (i) => i.estado === status,
                          ).length;
                          return (
                            <div key={status}>
                              <span>
                                <i className={statusClass[status]} />
                                {status}
                              </span>
                              <b>{count}</b>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                  <article
                    className="bi-card area-performance dashboard-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDashboardDetail("areas")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        setDashboardDetail("areas");
                    }}
                    aria-label="Ver detalle de participación de los equipos"
                  >
                    <div className="bi-heading">
                      <div>
                        <small>AVANCE POR ÁREA</small>
                        <h3>Participación de los equipos</h3>
                      </div>
                      <span>{areas.length} áreas</span>
                    </div>
                    <div className="area-bars">
                      {areas.map((a) => {
                        const rows = items.filter((i) => i.area === a.nombre);
                        const value = rows.length
                          ? Math.round(
                              rows.reduce((s, i) => s + i.avance, 0) /
                                rows.length,
                            )
                          : 0;
                        return (
                          <div key={a.id}>
                            <span>
                              {a.nombre}
                              <b>{value}%</b>
                            </span>
                            <div>
                              <i
                                style={{
                                  width: `${value}%`,
                                  background: a.colorHex,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                </div>
                <section className="projects-center projects-summary-center">
                  <section className="projects-workspace">
                    <div className="projects-workspace-heading">
                      <div>
                        <small>PROYECTOS RECIENTES</small>
                        <h3>Portafolio de proyectos</h3>
                        <p>La misma vista operativa del módulo de Proyectos.</p>
                      </div>
                      <strong>{Math.min(filtered.length, 5)} de {filtered.length}</strong>
                    </div>
                    <div className="module-actions">
                      <SectionTools
                        areas={areas}
                        area={area}
                        setArea={setArea}
                        clients={[
                          ...new Set(
                            items
                              .map((item) => item.cliente)
                              .filter(Boolean) as string[],
                          ),
                        ]}
                        client={clientFilter}
                        setClient={setClientFilter}
                        open={filtersOpen}
                        setOpen={setFiltersOpen}
                        status={statusFilter}
                        setStatus={setStatusFilter}
                        effort={effortFilter}
                        setEffort={setEffortFilter}
                        sort={sortFilter}
                        setSort={setSortFilter}
                      />
                    </div>
                    <InitiativeList
                      items={filtered.slice(0, 5)}
                      onProgress={openProgress}
                      onAppearance={customizeInitiative}
                      onSelect={setSelectedItem}
                      user={user}
                      areas={areas}
                      onChanged={reloadItems}
                    />
                  </section>
                </section>
              </>
            )}
            {page === "iniciativas" && (
              <div className="projects-center">
                <section className="projects-hero">
                  <div className="projects-hero-icon">
                    <ClipboardList />
                  </div>
                  <div className="projects-hero-copy">
                    <small>PORTAFOLIO DE PROYECTOS</small>
                    <h2>Prioriza y acompaña cada iniciativa</h2>
                    <p>
                      Consulta responsables, score y avance sin perder de vista
                      las acciones operativas de cada proyecto.
                    </p>
                  </div>
                  <div className="projects-hero-visual" aria-hidden="true">
                    <span><i />Planificar</span>
                    <span><i />Ejecutar</span>
                    <span><i />Medir</span>
                  </div>
                </section>

                <div className="projects-kpis">
                  <article className="project-kpi project-kpi-blue">
                    <span><ClipboardList /></span>
                    <div>
                      <small>Proyectos visibles</small>
                      <b>{filtered.length}</b>
                      <em>Según los filtros aplicados</em>
                    </div>
                  </article>
                  <article className="project-kpi project-kpi-amber">
                    <span><Sparkles /></span>
                    <div>
                      <small>Score promedio</small>
                      <b>
                        {filtered.length
                          ? Math.round(
                              filtered.reduce((sum, item) => sum + item.score, 0) /
                                filtered.length,
                            )
                          : 0}
                      </b>
                      <em>Prioridad del portafolio</em>
                    </div>
                  </article>
                  <article className="project-kpi project-kpi-purple">
                    <span><TrendingUp /></span>
                    <div>
                      <small>Avance promedio</small>
                      <b>
                        {filtered.length
                          ? Math.round(
                              filtered.reduce((sum, item) => sum + item.avance, 0) /
                                filtered.length,
                            )
                          : 0}
                        %
                      </b>
                      <em>Progreso consolidado</em>
                    </div>
                  </article>
                  <article className="project-kpi project-kpi-green">
                    <span><CheckSquare /></span>
                    <div>
                      <small>En proceso</small>
                      <b>
                        {filtered.filter((item) => item.estado === "En proceso").length}
                      </b>
                      <em>Proyectos activos</em>
                    </div>
                  </article>
                </div>

                <section className="projects-workspace">
                  <div className="projects-workspace-heading">
                    <div>
                      <small>VISTA OPERATIVA</small>
                      <h3>Portafolio de proyectos</h3>
                      <p>Filtra y gestiona los proyectos disponibles.</p>
                    </div>
                    <strong>{filtered.length} resultados</strong>
                  </div>
                <div className="module-actions">
                  <label className="worker-project-filter">
                    <Users />
                    <select value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)} aria-label="Filtrar proyectos por trabajador">
                      <option value="Todos">Todos los trabajadores</option>
                      <option value="Sin asignar">Sin asignar</option>
                      {team.map((member) => <option key={member.id} value={`${member.nombres} ${member.apellidos}`}>{member.nombres} {member.apellidos}</option>)}
                    </select>
                  </label>
                  <SectionTools
                    areas={areas}
                    area={area}
                    setArea={setArea}
                    clients={[
                      ...new Set(
                        items
                          .map((item) => item.cliente)
                          .filter(Boolean) as string[],
                      ),
                    ]}
                    client={clientFilter}
                    setClient={setClientFilter}
                    open={filtersOpen}
                    setOpen={setFiltersOpen}
                    status={statusFilter}
                    setStatus={setStatusFilter}
                    effort={effortFilter}
                    setEffort={setEffortFilter}
                    sort={sortFilter}
                    setSort={setSortFilter}
                  />
                  <button className="primary" onClick={() => setModal(true)}>
                    <Plus />
                    Registrar iniciativa
                  </button>
                </div>
                <InitiativeList
                  items={filtered}
                  onProgress={openProgress}
                  onAppearance={customizeInitiative}
                  onSelect={setSelectedItem}
                  user={user}
                  areas={areas}
                  onChanged={reloadItems}
                />
                </section>
              </div>
            )}
            {page === "objetivos" && (
              <ObjectivesModule
                objetivos={objetivos}
                items={items}
                isSuperAdmin={Boolean(user.isSuperAdmin)}
                canManageAll={canOperateGlobally(user)}
                onCreate={addGoal}
                onChange={askGoalChange}
              />
            )}
            {page === "equipo" && (
              <div className="team-directory">
                <section className="team-directory-intro">
                  <small>Inicio <ArrowRight /> Equipo</small>
                  <h1>Equipo <span>EJB</span></h1>
                  <h2>Talento que impulsa soluciones</h2>
                  <p>Conoce a las personas que hacen posible el crecimiento de EJB. Explora sus perfiles, áreas y roles.</p>
                </section>
                <section className="team-directory-banner" aria-label="Banner del equipo EJB Solutions">
                  <img src="/team-ejb-banner-2026.jpeg" alt="Equipo de EJB Solutions colaborando" />
                </section>
                <section className="team-overview">
                  <div className="team-overview-copy">
                    <span>
                      <Users />
                    </span>
                    <div>
                      <small>DIRECTORIO COLABORATIVO</small>
                      <h2>Personas que hacen avanzar EJB</h2>
                      <p>
                        Conoce al equipo, identifica responsables y comunícate
                        sin salir de la plataforma.
                      </p>
                    </div>
                  </div>
                  <div className="team-overview-kpis">
                    <article>
                      <strong>{team.length}</strong>
                      <span>integrantes</span>
                    </article>
                    <article>
                      <strong>
                        {new Set(team.map((member) => member.area.nombre)).size}
                      </strong>
                      <span>áreas activas</span>
                    </article>
                    <article>
                      <strong>
                        {
                          team.filter((member) => member.cargo === "Gerente")
                            .length
                        }
                      </strong>
                      <span>responsables</span>
                    </article>
                    <article>
                      <strong>100%</strong>
                      <span>compromiso</span>
                    </article>
                  </div>
                </section>
                <div className="team-area-legend">
                  <button className={teamArea === "Todas" ? "active" : ""} onClick={() => setTeamArea("Todas")}>
                    Todos <b>{team.length}</b>
                  </button>
                  {areas.map((area) => (
                    <button className={teamArea === area.nombre ? "active" : ""} key={area.id} onClick={() => setTeamArea(area.nombre)}>
                      <i style={{ background: area.colorHex }} />
                      {area.nombre}
                      <b>
                        {
                          team.filter(
                            (member) => member.area.nombre === area.nombre,
                          ).length
                        }
                      </b>
                    </button>
                  ))}
                </div>
                <div className="team-directory-toolbar">
                  <label>
                    <Search />
                    <input value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} placeholder="Buscar por nombre, cargo o área..." />
                  </label>
                  <select aria-label="Ordenar equipo" value={teamSort} onChange={(event) => setTeamSort(event.target.value)}>
                    <option value="nombre">Ordenar por: Nombre</option>
                    <option value="area">Ordenar por: Área</option>
                    <option value="cargo">Ordenar por: Cargo</option>
                  </select>
                </div>
                <div className="team-grid team-grid-modern">
                  {visibleTeam.map((m) => (
                    <article
                      className="team-card team-card-modern"
                      key={m.id}
                      style={
                        { "--team-color": m.area.colorHex } as CSSProperties
                      }
                    >
                      <div className="team-card-cover">
                        <span>{m.area.nombre}</span>
                        {m.isSuperAdmin && (
                          <b>
                            <ShieldCheck />
                            Administrador global
                          </b>
                        )}
                      </div>
                      <div
                        className="team-avatar"
                        style={{
                          background: m.area.colorHex,
                          color: readableText(m.area.colorHex),
                        }}
                      >
                        {m.fotoPerfil ? (
                          <img
                            src={m.fotoPerfil}
                            alt={`Foto de ${m.nombres} ${m.apellidos}`}
                          />
                        ) : (
                          initials(`${m.nombres} ${m.apellidos}`)
                        )}
                        <i title="Usuario activo" />
                      </div>
                      <div className="team-card-info">
                        <h3>
                          {m.nombres} {m.apellidos}
                        </h3>
                        <small>{cargoLabel(m.cargo)}</small>
                        <span
                          className={`team-position role-${m.cargo.toLowerCase()}`}
                        >
                          {m.area.nombre}
                        </span>
                        {m.isSuperAdmin ? (
                          <em className="team-recognition">Fundador EJB Manager</em>
                        ) : `${m.nombres} ${m.apellidos}`.toLocaleLowerCase("es").includes("luis huaman") ? (
                          <em className="team-recognition">Co-fundador EJB Mananger</em>
                        ) : null}
                        <p>{m.email}</p>
                      </div>
                      <div className="team-card-actions">
                        <button
                          type="button"
                          className="team-message-button"
                          onClick={() => setPage("mensajes")}
                        >
                          <MessageCircle />
                          Enviar mensaje
                        </button>
                        {user.isSuperAdmin && (
                          <select
                            className="team-role"
                            aria-label={`Cambiar cargo de ${m.nombres}`}
                            value={m.cargo}
                            onChange={(e) => changeTeamCargo(m, e.target.value)}
                          >
                            <option>Trabajador</option>
                            <option>Asistente</option>
                            <option value="Tecnico">Técnico</option>
                            <option>Jefe</option><option>Gerente</option><option value="Administracion">Administración</option>
                          </select>
                        )}
                      </div>
                      {user.isSuperAdmin && !m.isSuperAdmin && (
                        <button
                          className="delete-profile"
                          onClick={async () => {
                            if (
                              await uiConfirm(
                                "Eliminar perfil",
                                `¿Deseas eliminar el perfil de ${m.nombres}?`,
                              )
                            ) {
                              await deleteTeamMember(m.id);
                              setTeam((v) => v.filter((x) => x.id !== m.id));
                              setToast("Perfil eliminado");
                            }
                          }}
                        >
                          <Trash2 />
                          Eliminar perfil
                        </button>
                      )}
                    </article>
                  ))}
                  {!visibleTeam.length && <div className="team-directory-empty">No se encontraron integrantes con estos filtros.</div>}
                </div>
              </div>
            )}
            {page === "mensajes" && (
                <div
                  className="chat-zoom-zone"
                  onPointerEnter={() => {
                    zoomZone.current = "chat";
                  }}
                  onPointerLeave={() => {
                    zoomZone.current = "chat";
                  }}
                  onFocusCapture={() => {
                    zoomZone.current = "chat";
                  }}
                >
                  <div className="chat-own-scale">
                    <Messages
                      currentUserId={user.id}
                      notificationCount={notificationUnreadCount}
                      notifications={alerts}
                      onBackToDashboard={() => setPage("resumen")}
                      onNavigate={(destination) => setPage(destination)}
                      canPublishAnnouncements={canPublishAnnouncements(user)}
                      currentStatus={user.estadoMensaje}
                      onStatusChange={(estadoMensaje) =>
                        setUser({ ...user, estadoMensaje })
                      }
                      onIncomingMessage={showIncomingMessage}
                    />
                  </div>
                </div>
            )}
            {page === "cronograma" && (
              <Timeline
                items={items}
                onBack={() => setPage("resumen")}
                canManageActions={canOperateGlobally(user) || isAreaLeaderUser(user)}
                onOpen={setSelectedItem}
                onProgress={openProgress}
              />
            )}
            {page === "calendario" && (
              <CalendarModule
                areas={areas}
                team={team}
                items={items}
                currentUserId={user.id}
                canManageAll={canOperateGlobally(user)}
                onProjectsChanged={reloadItems}
              />
            )}
            {page === "informes" && (
              <BIReports items={items} areas={areas} user={user} />
            )}
            {page === "reporteria" && <ReportingCenter items={items} />}
            {page === "requerimientos" && <Requirements user={user} />}
            {page === "flujos" && <AreaFlows user={user} />}
            {page === "firmas" && <SecureSignature user={user} team={team} />}
            {page === "encuestas" && <Surveys user={user} />}
            {page === "aprobaciones" && <Approvals user={user} />}
            {page === "perfil" && (
              <Profile user={user} onUpdate={setUser} areas={areas} />
            )}
            {page === "ayuda" && (
              <div className="help-grid">
                <Help
                  title="¿Cómo registro una iniciativa?"
                  text="Usa Nueva iniciativa, completa impacto y esfuerzo. Se creará como Pendiente."
                  detail="Selecciona Nueva iniciativa en la parte superior. Escribe título y descripción, elige el área, impacto, esfuerzo y fechas estimadas. Al guardar se generará automáticamente el código INV-XXX y quedará lista para evaluación."
                  onOpen={setHelpTopic}
                />
                <Help
                  title="¿Cómo actualizo un proyecto?"
                  text="En Iniciativas selecciona Agregar progreso, indica porcentaje y deja un comentario."
                  detail="Abre Proyectos y pulsa el icono de gráfico ascendente. Mueve el porcentaje, describe lo completado y guarda. Cada actualización conserva autor, fecha y comentario en el historial."
                  onOpen={setHelpTopic}
                />
                <Help
                  title="¿Cómo se calcula el score?"
                  text="Impacto dividido entre el peso del esfuerzo, multiplicado por diez."
                  detail="El sistema asigna un peso al esfuerzo: Bajo 1, Medio 2 y Alto 4. El score se calcula como impacto dividido por ese peso, multiplicado por diez. Un score mayor ayuda a identificar oportunidades prioritarias."
                  onOpen={setHelpTopic}
                />
                <Help
                  title="¿Dónde están mis datos?"
                  text="Los perfiles, proyectos y progresos se guardan en PostgreSQL, no en el navegador."
                  detail="PostgreSQL conserva usuarios, áreas, proyectos, objetivos, progresos, mensajes, adjuntos, preferencias, iconos y solicitudes. El navegador solo guarda temporalmente el token de sesión."
                  onOpen={setHelpTopic}
                />
              </div>
            )}
            {page === "personalizacion" && (
              <div className="theme-panel">
                <div
                  className="theme-preview"
                  style={{ background: user.portalColor }}
                >
                  <span>EJB</span>
                  <h3>Tu portal, tu color</h3>
                  <p>La selección se guarda en tu perfil.</p>
                </div>
                <div>
                  <h3>Color principal</h3>
                  <p>Elige una opción o utiliza el selector.</p>
                  <div className="swatches">
                    {[
                      "#0B2347",
                      "#123A70",
                      "#1D4ED8",
                      "#0F4C5C",
                      "#4C1D95",
                      "#7C2D12",
                    ].map((c) => (
                      <button
                        key={c}
                        style={{ background: c }}
                        className={user.portalColor === c ? "selected" : ""}
                        onClick={() => changeColor(c)}
                        aria-label={c}
                      />
                    ))}
                  </div>
                  <label className="color-picker">
                    Color personalizado
                    <input
                      type="color"
                      value={user.portalColor}
                      onChange={(e) => changeColor(e.target.value)}
                    />
                    <b>{user.portalColor}</b>
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      {modal &&
        createPortal(
          <div className="overlay initiative-create-overlay">
            <form
              className="modal initiative-create-modal"
              onSubmit={addInitiative}
            >
              <button
                type="button"
                className="close"
                onClick={() => setModal(false)}
              >
                <X />
              </button>
              <div className="modal-icon">
                <Lightbulb />
              </div>
              <h2>{page === "kanban-sistemas" ? "Nuevo registro de Sistemas" : "Nueva iniciativa"}</h2>
              <p>{page === "kanban-sistemas" ? "Se agregará al Kanban de Sistemas como Pendiente." : "Se registrará inicialmente como Pendiente."}</p>
              <label>
                Título
                <input name="titulo" required minLength={3} />
              </label>
              <label>
                Descripción
                <textarea name="descripcion" required minLength={10} />
              </label>
              <label>
                Cliente
                <input
                  name="cliente"
                  placeholder="Nombre del cliente"
                  maxLength={160}
                />
              </label>
              <div className="form-grid">
                <label>
                  Área
                  {page === "kanban-sistemas" && (
                    <input type="hidden" name="area" value="Sistemas" />
                  )}
                  <select
                    name="area"
                    value={page === "kanban-sistemas" ? "Sistemas" : (createAreaName || user.area.nombre)}
                    onChange={(event) => setCreateAreaName(event.target.value)}
                    disabled={page === "kanban-sistemas"}
                  >
                    {areas.map((a) => (
                      <option key={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </label>
                {(user.isSuperAdmin || isAreaLeaderUser(user)) && (
                  <label>
                    Derivar a
                    <select name="responsableId" defaultValue="" key={page === "kanban-sistemas" ? "Sistemas" : createAreaName}>
                      <option value="">Sin derivar</option>
                      {team
                        .filter((member) => member.area.nombre === (page === "kanban-sistemas" ? "Sistemas" : (createAreaName || user.area.nombre)))
                        .sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, "es"))
                        .map((member) => <option key={member.id} value={member.id}>{member.nombres} {member.apellidos}</option>)}
                    </select>
                  </label>
                )}
                <label>
                  Impacto
                  <input
                    name="impacto"
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="7"
                  />
                </label>
                <label>
                  Esfuerzo
                  <select name="esfuerzo">
                    <option>Bajo</option>
                    <option>Medio</option>
                    <option>Alto</option>
                  </select>
                </label>
              </div>
              <div className="two-fields schedule-fields">
                <label>
                  Fecha de inicio
                  <input name="fechaInicio" type="date" />
                </label>
                <label>
                  Fecha estimada de fin
                  <input name="fechaFin" type="date" />
                </label>
              </div>
              <div className="modal-actions">
                <label className="initiative-tasks-field">
                  Tareas por agregar
                  <textarea
                    name="tareas"
                    placeholder={
                      "Una tarea por línea\nEj. Preparar propuesta\nEj. Validar con Gerencia"
                    }
                  />
                  <small>
                    Podrás marcarlas y comentarlas desde el detalle del
                    proyecto.
                  </small>
                </label>
                <button type="button" onClick={() => setModal(false)}>
                  Cancelar
                </button>
                <button className="primary">
                  Registrar
                  <ArrowRight />
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
      {dashboardDetail && (
        <div
          className="overlay dashboard-detail-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDashboardDetail(null);
          }}
        >
          <section className="dashboard-detail-modal">
            <button
              className="close"
              onClick={() => setDashboardDetail(null)}
              aria-label="Cerrar detalle"
            >
              <X />
            </button>
            {dashboardDetail === "portfolio" ? (
              <>
                <div className="dashboard-detail-title">
                  <span>
                    <TrendingUp />
                  </span>
                  <div>
                    <small>RENDIMIENTO GENERAL</small>
                    <h2>Salud del portafolio</h2>
                    <p>
                      Distribución, avance y situación actual de todas las
                      iniciativas.
                    </p>
                  </div>
                </div>
                <div className="dashboard-detail-summary">
                  <div
                    className="donut large"
                    style={
                      {
                        "--value": `${items.length ? Math.round(items.reduce((sum, item) => sum + item.avance, 0) / items.length) : 0}%`,
                      } as CSSProperties
                    }
                  >
                    <div>
                      <strong>
                        {items.length
                          ? Math.round(
                              items.reduce(
                                (sum, item) => sum + item.avance,
                                0,
                              ) / items.length,
                            )
                          : 0}
                        %
                      </strong>
                      <small>avance promedio</small>
                    </div>
                  </div>
                  <div className="dashboard-detail-kpis">
                    <article>
                      <small>Total de iniciativas</small>
                      <b>{items.length}</b>
                    </article>
                    <article>
                      <small>Completadas</small>
                      <b>{items.filter((item) => item.avance >= 100).length}</b>
                    </article>
                    <article>
                      <small>Con avance pendiente</small>
                      <b>{items.filter((item) => item.avance < 100).length}</b>
                    </article>
                    <article>
                      <small>Sin progreso</small>
                      <b>{items.filter((item) => item.avance === 0).length}</b>
                    </article>
                  </div>
                </div>
                <h3>Distribución por estado</h3>
                <div className="dashboard-detail-list">
                  {(
                    [
                      "Pendiente",
                      "En evaluación",
                      "Priorizado",
                      "En proceso",
                      "Finalizado",
                    ] as Estado[]
                  ).map((status) => {
                    const rows = items.filter((item) => item.estado === status),
                      portion = items.length
                        ? Math.round((rows.length / items.length) * 100)
                        : 0;
                    return (
                      <article key={status}>
                        <i className={statusClass[status]} />
                        <div>
                          <b>{status}</b>
                          <span>{rows.length} iniciativa(s)</span>
                          <em>
                            <u style={{ width: `${portion}%` }} />
                          </em>
                        </div>
                        <strong>{portion}%</strong>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="dashboard-detail-title">
                  <span>
                    <Users />
                  </span>
                  <div>
                    <small>AVANCE POR ÁREA</small>
                    <h2>Participación de los equipos</h2>
                    <p>
                      Comparativo completo del desempeño y la actividad
                      registrada por cada área.
                    </p>
                  </div>
                </div>
                <div className="area-detail-grid">
                  {areas.map((areaRow) => {
                    const rows = items.filter(
                        (item) => item.area === areaRow.nombre,
                      ),
                      value = rows.length
                        ? Math.round(
                            rows.reduce((sum, item) => sum + item.avance, 0) /
                              rows.length,
                          )
                        : 0,
                      completedRows = rows.filter(
                        (item) => item.avance >= 100,
                      ).length;
                    return (
                      <article key={areaRow.id}>
                        <header>
                          <span style={{ background: areaRow.colorHex }}>
                            {areaRow.nombre.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <b>{areaRow.nombre}</b>
                            <small>{rows.length} iniciativa(s)</small>
                          </div>
                          <strong>{value}%</strong>
                        </header>
                        <div className="area-detail-bar">
                          <i
                            style={{
                              width: `${value}%`,
                              background: areaRow.colorHex,
                            }}
                          />
                        </div>
                        <footer>
                          <span>{completedRows} completada(s)</span>
                          <span>
                            {rows.length - completedRows} en seguimiento
                          </span>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {progressItem && (
        <div className="overlay">
          <div className="progress-modal">
            <button className="close" onClick={() => setProgressItem(null)}>
              <X />
            </button>
            <div className="modal-icon">
              <TrendingUp />
            </div>
            <h2>Progreso · {progressItem.codigo}</h2>
            <p>{progressItem.titulo}</p>
            <form onSubmit={addProgress}>
              <label>
                Porcentaje de avance <b>{progressItem.avance}% actual</b>
                <input
                  name="porcentaje"
                  type="range"
                  min="0"
                  max="100"
                  defaultValue={progressItem.avance}
                />
              </label>
              <label>
                Comentario
                <textarea
                  name="comentario"
                  required
                  minLength={3}
                  placeholder="Describe qué se completó y el siguiente paso"
                />
              </label>
              <button className="primary">Guardar progreso</button>
            </form>
            <h3>Historial</h3>
            <div className="history">
              {history.map((h) => (
                <article key={h.id}>
                  <div>
                    <Clock3 />
                    <b>{h.porcentaje}%</b>
                  </div>
                  <p>{h.comentario}</p>
                  <small>
                    {h.usuario.nombres} {h.usuario.apellidos} ·{" "}
                    {new Date(h.createdAt).toLocaleString()}
                  </small>
                </article>
              ))}
              {!history.length && <span>Sin actualizaciones todavía.</span>}
            </div>
          </div>
        </div>
      )}
      {appearanceItem && (
        <AppearanceModal
          item={appearanceItem}
          onClose={() => setAppearanceItem(null)}
          onSave={async (icono, colorIcono) => {
            const saved = await saveInitiativeAppearance(appearanceItem.id, {
              icono,
              colorIcono,
            });
            setItems((rows) =>
              rows.map((row) =>
                row.id === appearanceItem.id ? mapItem(saved) : row,
              ),
            );
            setAppearanceItem(null);
            setToast("Apariencia actualizada");
          }}
        />
      )}
      {selectedItem && (
        <div className="overlay">
          <section className="initiative-detail">
            <button className="close" onClick={() => setSelectedItem(null)}>
              <X />
            </button>
            <div className="detail-head">
              <div
                className="area-icon"
                style={{
                  background: selectedItem.colorIcono ?? selectedItem.color,
                  color: readableText(
                    selectedItem.colorIcono ?? selectedItem.color,
                  ),
                }}
              >
                {selectedItem.icono ?? selectedItem.area[0]}
              </div>
              <div>
                <small>
                  {selectedItem.area} · {selectedItem.codigo}
                </small>
                <h2>{selectedItem.titulo}</h2>
                <p>
                  {selectedItem.cliente
                    ? `Cliente: ${selectedItem.cliente}`
                    : "Sin cliente asignado"}
                </p>
              </div>
            </div>
            <p>{selectedItem.descripcion}</p>
            <div className="detail-stats">
              <div>
                <span>Estado</span>
                <b>{selectedItem.estado}</b>
              </div>
              <div>
                <span>Score</span>
                <b>{selectedItem.score}</b>
              </div>
              <div>
                <span>Número de reuniones</span>
                <b>{selectedItem.reuniones}</b>
              </div>
              <div>
                <span>Avance por tareas</span>
                <b>{selectedItem.avance}%</b>
              </div>
            </div>
            <div className="detail-progress">
              <i style={{ width: `${selectedItem.avance}%` }} />
            </div>
            <div className="detail-dates">
              <span>
                Inicio:{" "}
                {selectedItem.fechaInicio
                  ? new Date(selectedItem.fechaInicio).toLocaleDateString()
                  : "Sin fecha"}
              </span>
              <span>
                Fin:{" "}
                {selectedItem.fechaFin
                  ? new Date(selectedItem.fechaFin).toLocaleDateString()
                  : "Sin fecha"}
              </span>
            </div>
            <ProjectTasks
              item={selectedItem}
              team={team}
              onUpdate={(updated) => {
                setSelectedItem(updated);
                setItems((rows) =>
                  rows.map((row) => (row.id === updated.id ? updated : row)),
                );
              }}
            />
          </section>
        </div>
      )}
      {helpTopic && (
        <div className="overlay">
          <section className="help-modal">
            <button className="close" onClick={() => setHelpTopic(null)}>
              <X />
            </button>
            <div className="modal-icon">
              <CircleHelp />
            </div>
            <h2>{helpTopic.title}</h2>
            <p>{helpTopic.detail}</p>
            <button className="primary" onClick={() => setHelpTopic(null)}>
              Entendido
            </button>
          </section>
        </div>
      )}
      {messageNotice && (
        <button
          className="message-notice"
          onClick={() => {
            setPage("mensajes");
            setMessageNotice(null);
          }}
        >
          {messageNotice.photo ? (
            <img src={messageNotice.photo} />
          ) : (
            <span>
              <MessageCircle />
            </span>
          )}
          <div>
            <b>{messageNotice.name}</b>
            <p>{messageNotice.message}</p>
          </div>
        </button>
      )}
      {alertNotice && (
        <button
          className={`live-alert-notice ${alertNotice.severity}`}
          onClick={() => {
            setPage("cronograma");
            setAlertNotice(null);
          }}
        >
          <span>{alertNotice.type === "completado" ? "✓" : "!"}</span>
          <div>
            <small>ALERTA EN TIEMPO REAL</small>
            <b>{alertNotice.title}</b>
            <p>{alertNotice.message}</p>
          </div>
          <ArrowRight />
        </button>
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}
function InitiativeTasks({
  item,
  onUpdate,
}: {
  item: Item;
  onUpdate: (item: Item) => void;
}) {
  const saveTask = async (task: Item["tareas"][number], estado: string) => {
    const completing = estado === "Completada";
    const comentario = await uiPrompt(
      completing ? "Completar tarea" : "Actualizar tarea",
      task.comentario ?? "",
      {
        message: completing
          ? "Describe brevemente qué se completó."
          : "Añade un comentario sobre el cambio.",
        multiline: true,
      },
    );
    if (completing && !comentario) return;
    const response = await updateInitiativeTask(item.id, task.id, {
      estado,
      comentario: comentario || undefined,
    }),
      { porcentajeAvance, estadoProyecto, ...saved } = response;
    onUpdate({
      ...item,
      avance: Number(porcentajeAvance ?? item.avance),
      estado: mapProjectStatus(estadoProyecto ?? item.estado),
      tareas: item.tareas.map((row) => (row.id === task.id ? saved : row)),
    });
  };
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      title = String(new FormData(form).get("titulo") || "").trim();
    if (!title) return;
    const response = await addInitiativeTask(item.id, { titulo: title }),
      { porcentajeAvance, estadoProyecto, ...saved } = response;
    onUpdate({
      ...item,
      avance: Number(porcentajeAvance ?? item.avance),
      estado: mapProjectStatus(estadoProyecto ?? item.estado),
      tareas: [...item.tareas, saved],
    });
    form.reset();
  };
  return (
    <section className="initiative-tasks">
      <div className="tasks-heading">
        <div>
          <h3>Checklist de tareas</h3>
          <p>
            {item.tareas.filter((task) => task.completada).length} de{" "}
            {item.tareas.length} completadas
          </p>
        </div>
        <span>
          {item.tareas.length
            ? Math.round(
                (item.tareas.filter((task) => task.completada).length /
                  item.tareas.length) *
                  100,
              )
            : 0}
          %
        </span>
      </div>
      <div className="tasks-progress">
        <i
          style={{
            width: `${item.tareas.length ? (item.tareas.filter((task) => task.completada).length / item.tareas.length) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="task-list">
        {item.tareas.map((task) => (
          <article className={task.completada ? "completed" : ""} key={task.id}>
            <button
              className="task-check"
              onClick={() =>
                saveTask(task, task.completada ? "Pendiente" : "Completada")
              }
              aria-label={task.completada ? "Reabrir tarea" : "Completar tarea"}
            >
              {task.completada ? "✓" : ""}
            </button>
            <div>
              <b>{task.titulo}</b>
              {task.comentario && <small>{task.comentario}</small>}
            </div>
            <select
              className={`task-status ${task.estado.toLowerCase().replace("_", "-")}`}
              value={task.estado}
              onChange={(e) => saveTask(task, e.target.value)}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Iniciado">Iniciado</option>
              <option value="En_progreso">En progreso</option>
              <option value="Completada">Completada</option>
            </select>
          </article>
        ))}
        {!item.tareas.length && (
          <p className="tasks-empty">Aún no hay tareas para esta iniciativa.</p>
        )}
      </div>
      <form className="add-task" onSubmit={add}>
        <input
          name="titulo"
          placeholder="Agregar una nueva tarea"
          required
          minLength={2}
        />
        <button>Agregar</button>
      </form>
    </section>
  );
}
function ProjectTasks({
  item,
  team = [],
  onUpdate,
}: {
  item: Item;
  team?: TeamMember[];
  onUpdate: (item: Item) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({}),
    [addOpen, setAddOpen] = useState(false),
    [taskError, setTaskError] = useState("");
  const saveTask = async (
    task: Item["tareas"][number],
    estado = task.estado,
    comentario?: string,
  ) => {
    const response = await updateInitiativeTask(item.id, task.id, {
        estado,
        comentario: comentario?.trim() || undefined,
        fechaInicio: task.fechaInicio?.slice(0, 10),
        fechaFin: task.fechaFin?.slice(0, 10),
      }),
      { porcentajeAvance, estadoProyecto, ...saved } = response;
    onUpdate({
      ...item,
      avance: porcentajeAvance,
      estado: mapProjectStatus(estadoProyecto ?? item.estado),
      tareas: item.tareas.map((row) => (row.id === task.id ? saved : row)),
    });
    if (comentario) setDrafts((values) => ({ ...values, [task.id]: "" }));
  };
  const editTask = async (task: Item["tareas"][number]) => {
    const title = await uiPrompt(
      "Nombre de la tarea",
      task.titulo,
      { message: "Actualiza el nombre que se mostrará en el proyecto y sus reportes." },
    );
    if (!title?.trim()) return;
    const priority = await uiPrompt(
      "Prioridad de la tarea",
      task.prioridad || "Normal",
      { message: "Baja, Normal, Alta o Urgente" },
    );
    if (!priority) return;
    const start = await uiPrompt(
      "Fecha de inicio",
      task.fechaInicio?.slice(0, 10) || "",
      { message: "Formato AAAA-MM-DD; puede quedar vacío." },
    );
    if (start === null) return;
    const end = await uiPrompt(
      "Fin estimado",
      task.fechaFin?.slice(0, 10) || "",
      { message: "Formato AAAA-MM-DD; puede quedar vacío." },
    );
    if (end === null) return;
    const reminder = await uiPrompt(
      "Recordatorio",
      task.recordatorioAt?.slice(0, 16) || "",
      { message: "Formato AAAA-MM-DDTHH:mm; puede quedar vacío." },
    );
    if (reminder === null) return;
    const response = await updateInitiativeTask(item.id, task.id, {
      titulo: title.trim(),
      estado: task.estado,
      prioridad: priority,
      fechaInicio: start || undefined,
      fechaFin: end || undefined,
      recordatorioAt: reminder || null,
      responsableId: task.responsableId || null,
    });
    const { porcentajeAvance, estadoProyecto, ...saved } = response;
    onUpdate({
      ...item,
      avance: porcentajeAvance,
      estado: mapProjectStatus(estadoProyecto ?? item.estado),
      tareas: item.tareas.map((row) => (row.id === task.id ? saved : row)),
    });
  };
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      titulo = String(data.get("titulo") || "").trim(),
      fechaInicio = String(data.get("fechaInicio") || ""),
      fechaFin = String(data.get("fechaFin") || ""),
      attachment = data.get("adjunto") as File;
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      setTaskError("La fecha estimada de fin no puede ser anterior al inicio.");
      return;
    }
    if (attachment?.size > 3 * 1024 * 1024) {
      setTaskError("El archivo adjunto no puede superar los 3 MB.");
      return;
    }
    const adjuntos = attachment?.size
      ? [
          {
            nombre: attachment.name,
            mime: attachment.type || "application/octet-stream",
            data: await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(attachment);
            }),
          },
        ]
      : undefined;
    const response = await addInitiativeTask(item.id, {
        titulo,
        comentario: String(data.get("comentario") || "").trim() || undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        prioridad: String(data.get("prioridad") || "Normal"),
        responsableId: String(data.get("responsableId") || "") || null,
        recordatorioAt: String(data.get("recordatorioAt") || "") || null,
        adjuntos,
      }),
      { porcentajeAvance, estadoProyecto, ...saved } = response;
    onUpdate({
      ...item,
      avance: porcentajeAvance,
      estado: mapProjectStatus(estadoProyecto ?? item.estado),
      tareas: [...item.tareas, saved],
    });
    form.reset();
    setTaskError("");
    setAddOpen(false);
  };
  const progress = item.tareas.length
    ? Math.round(
        (item.tareas.filter((task) => task.completada).length /
          item.tareas.length) *
          100,
      )
    : 0;
  return (
    <section className="initiative-tasks project-tasks">
      <div className="tasks-heading">
        <div>
          <h3>Tareas del proyecto</h3>
          <p>
            {item.tareas.filter((task) => task.completada).length} de{" "}
            {item.tareas.length} finalizadas · el avance se calcula
            automáticamente
          </p>
        </div>
        <span>{progress}%</span>
      </div>
      <div className="tasks-progress">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="task-list">
        {item.tareas.map((task) => (
          <article className={task.completada ? "completed" : ""} key={task.id}>
            <div className="task-main">
              <b>{task.titulo}</b>
              <div className="task-dates">
                <span>
                  Inicio:{" "}
                  {task.fechaInicio
                    ? new Date(task.fechaInicio).toLocaleDateString("es-PE")
                    : "Sin fecha"}
                </span>
                <span>
                  Fin estimado:{" "}
                  {task.fechaFin
                    ? new Date(task.fechaFin).toLocaleDateString("es-PE")
                    : "Sin fecha"}
                </span>
              </div>
              <div className="task-metadata">
                <span className={`priority ${task.prioridad?.toLowerCase()}`}>
                  Prioridad {task.prioridad || "Media"}
                </span>
                <span>
                  Responsable:{" "}
                  {task.responsable
                    ? `${task.responsable.nombres} ${task.responsable.apellidos}`
                    : "Sin asignar"}
                </span>
                {task.recordatorioAt && (
                  <span>
                    Recordatorio:{" "}
                    {new Date(task.recordatorioAt).toLocaleString("es-PE")}
                  </span>
                )}
              </div>
              <div className="task-comment-compose">
                <textarea
                  value={drafts[task.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((values) => ({
                      ...values,
                      [task.id]: event.target.value,
                    }))
                  }
                  placeholder="Escribe un nuevo comentario"
                  maxLength={600}
                />
                <button
                  type="button"
                  disabled={!drafts[task.id]?.trim()}
                  onClick={() => saveTask(task, task.estado, drafts[task.id])}
                >
                  Guardar comentario
                </button>
              </div>
              {Boolean(task.comentarios?.length) && (
                <section className="task-comment-history">
                  <h4>Historial de comentarios</h4>
                  {task.comentarios!.map((comment) => (
                    <article key={comment.id}>
                      <div>
                        {comment.usuario.fotoPerfil ? (
                          <img src={comment.usuario.fotoPerfil} alt="" />
                        ) : (
                          <span>
                            {initials(
                              `${comment.usuario.nombres} ${comment.usuario.apellidos}`,
                            )}
                          </span>
                        )}
                        <p>
                          <b>
                            {comment.usuario.nombres}{" "}
                            {comment.usuario.apellidos}
                          </b>
                          <time>
                            {new Date(comment.createdAt).toLocaleString(
                              "es-PE",
                              { dateStyle: "short", timeStyle: "short" },
                            )}
                          </time>
                        </p>
                      </div>
                      <blockquote>{comment.contenido}</blockquote>
                    </article>
                  ))}
                </section>
              )}
              <div className="task-actions">
                <button type="button" onClick={() => editTask(task)}>
                  Editar tarea
                </button>
                <select
                  className={`task-status ${task.estado.toLowerCase().replace("_", "-")}`}
                  value={task.estado}
                  onChange={(event) => saveTask(task, event.target.value)}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Iniciado">Iniciado</option>
                  <option value="En_progreso">En progreso</option>
                  <option value="Completada">Completada</option>
                </select>
                <button
                  type="button"
                  className={task.completada ? "task-reopen" : "task-finish"}
                  onClick={() =>
                    saveTask(task, task.completada ? "Pendiente" : "Completada")
                  }
                >
                  {task.completada ? "Reabrir" : "Finalizar tarea"}
                </button>
              </div>
            </div>
          </article>
        ))}
        {!item.tareas.length && (
          <p className="tasks-empty">Aún no hay tareas para esta iniciativa.</p>
        )}
      </div>
      <button
        type="button"
        className="open-task-modal"
        onClick={() => setAddOpen(true)}
      >
        <Plus />
        Agregar tarea
      </button>
      {addOpen && (
        <div
          className="task-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAddOpen(false);
          }}
        >
          <form className="task-create-modal" onSubmit={add}>
            <button
              type="button"
              className="close"
              onClick={() => setAddOpen(false)}
            >
              <X />
            </button>
            <div className="modal-icon">
              <CheckSquare />
            </div>
            <h2>Agregar tarea</h2>
            <p>
              Registra la planificación y el primer comentario de seguimiento.
            </p>
            <label>
              Título
              <input
                name="titulo"
                required
                minLength={2}
                maxLength={220}
                placeholder="Ej. Validar propuesta con el cliente"
              />
            </label>
            <div className="two-fields">
              <label>
                Fecha de inicio
                <input name="fechaInicio" type="date" />
              </label>
              <label>
                Fin estimado
                <input name="fechaFin" type="date" />
              </label>
            </div>
            <div className="two-fields">
              <label>
                Prioridad
                <select name="prioridad" defaultValue="Normal">
                  <option>Baja</option>
                  <option>Normal</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </select>
              </label>
              <label>
                Responsable
                <select name="responsableId" defaultValue="">
                  <option value="">Sin asignar</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nombres} {member.apellidos}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="two-fields">
              <label>
                Recordatorio
                <input name="recordatorioAt" type="datetime-local" />
              </label>
              <label>
                Archivo adjunto (máx. 3 MB)
                <input name="adjunto" type="file" />
              </label>
            </div>
            <label>
              Comentario inicial
              <textarea
                name="comentario"
                maxLength={600}
                placeholder="Contexto, alcance o indicaciones para esta tarea"
              />
            </label>
            {taskError && <div className="auth-error">{taskError}</div>}
            <div className="modal-actions">
              <button type="button" onClick={() => setAddOpen(false)}>
                Cancelar
              </button>
              <button className="primary">Guardar tarea</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function SectionTools({
  areas,
  area,
  setArea,
  clients,
  client,
  setClient,
  open,
  setOpen,
  status,
  setStatus,
  effort,
  setEffort,
  sort,
  setSort,
}: {
  areas: Area[];
  area: string;
  setArea: (a: string) => void;
  clients: string[];
  client: string;
  setClient: (value: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  status: string;
  setStatus: (v: string) => void;
  effort: string;
  setEffort: (v: string) => void;
  sort: string;
  setSort: (v: string) => void;
}) {
  return (
    <div className="filters">
      <select value={area} onChange={(e) => setArea(e.target.value)}>
        <option>Todas</option>
        {areas.map((a) => (
          <option key={a.id}>{a.nombre}</option>
        ))}
      </select>
      <select
        value={client}
        onChange={(event) => setClient(event.target.value)}
        aria-label="Filtrar por cliente"
      >
        <option value="Todos">Cliente</option>
        <option>Sin cliente</option>
        {clients.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <button className={open ? "active" : ""} onClick={() => setOpen(!open)}>
        <SlidersHorizontal />
        Filtros
      </button>
      {open && (
        <div className="filter-popover">
          <label>
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Todos</option>
              <option>Pendiente</option>
              <option>En evaluación</option>
              <option>Priorizado</option>
              <option>En proceso</option>
              <option>Finalizado</option>
            </select>
          </label>
          <label>
            Esfuerzo
            <select value={effort} onChange={(e) => setEffort(e.target.value)}>
              <option>Todos</option>
              <option>Bajo</option>
              <option>Medio</option>
              <option>Alto</option>
            </select>
          </label>
          <label>
            Ordenar
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="score">Mayor score</option>
              <option value="avance">Mayor avance</option>
              <option value="recientes">Más recientes</option>
            </select>
          </label>
          <button
            onClick={() => {
              setStatus("Todos");
              setEffort("Todos");
              setSort("score");
              setArea("Todas");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
function Help({
  title,
  text,
  detail,
  onOpen,
}: HelpTopic & { onOpen: (topic: HelpTopic) => void }) {
  return (
    <button
      className="help-card"
      onClick={() => onOpen({ title, text, detail })}
    >
      <div>
        <CircleHelp />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <span>
        Ver explicación <ArrowRight />
      </span>
    </button>
  );
}

function AppearanceModal({
  item,
  onClose,
  onSave,
}: {
  item: Item;
  onClose: () => void;
  onSave: (icono: string, color: string) => void;
}) {
  const [icono, setIcono] = useState(item.icono ?? item.area[0]),
    [color, setColor] = useState(item.colorIcono ?? item.color);
  return (
    <div className="overlay">
      <section className="appearance-modal">
        <button className="close" onClick={onClose}>
          <X />
        </button>
        <h2>Personalizar iniciativa</h2>
        <p>Elige un emoji o escribe hasta dos iniciales.</p>
        <div
          className="appearance-preview"
          style={{ background: color, color: readableText(color) }}
        >
          {icono}
        </div>
        <div className="emoji-options">
          {["💡", "🚀", "📊", "🎯", "⚙️", "📣", "💼", "✨"].map((e) => (
            <button
              key={e}
              className={icono === e ? "selected" : ""}
              onClick={() => setIcono(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <label>
          Iniciales o emoji
          <input
            value={icono}
            maxLength={12}
            onChange={(e) => setIcono(e.target.value)}
          />
        </label>
        <label>
          Color del icono
          <div className="visual-color">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <span style={{ background: color }} />
            <b>{color.toUpperCase()}</b>
          </div>
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={() => onSave(icono, color)}>
            Guardar
          </button>
        </div>
      </section>
    </div>
  );
}
export default App;
