import { playChatTone } from "./utils/chat-tools";
import {
  ClipboardEvent,
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
  Award,
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
  Trophy,
  Trash2,
  TrendingUp,
  UserCog,
  UserRound,
  Users,
  MoreVertical,
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
  fetchClientes,
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
  saveTeamArea,
  updateUserPermissions,
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
import { MarketingCenter } from "./components/MarketingCenter";
import { ClientSelect } from "./components/ClientSelect";
import { DateField } from "./components/DateField";
import { FilterCombobox } from "./components/FilterCombobox";
import { uiAlert, uiConfirm, uiPrompt } from "./utils/dialog";
import { canOperateGlobally, cargoLabel, hasFullPortalAccess, isTechnicalUser, isAreaLeaderUser, isAdministrationUser, canPublishAnnouncements, canDeleteOwned, canReadMarketing, canManageInitiative, canCreateInAnyArea, canDeriveInitiative, canLeadInitiative } from "./utils/access";
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
  | "encuestas"
  | "aprobaciones"
  | "marketing"
  | "perfil"
  | "ayuda"
  | "personalizacion";

const isWorkerPortalUser = (user?: { cargo?: string; rol?: string } | null) =>
  /trabajador|empleado/i.test(`${user?.cargo ?? ""} ${user?.rol ?? ""}`);

// Páginas donde el atajo "+ Nueva iniciativa" de la cabecera tiene sentido.
// "iniciativas" ya tiene su propio botón "Registrar iniciativa" en el toolbar;
// este es solo un acceso rápido desde las vistas de trabajo relacionadas.
const QUICK_CREATE_INITIATIVE_PAGES: Page[] = ["resumen", "iniciativas", "mi-trabajo", "cronograma"];

const workerPanelPages = new Set<Page>([
  "resumen",
  "notificaciones",
  "iniciativas",
  "mi-trabajo",
  "equipo",
  "clientes",
  "ticketera",
  "kanban-sistemas",
  "mensajes",
  "calendario",
  "encuestas",
  "aprobaciones",
  "feedback",
  "personalizacion",
  "ayuda",
  "perfil",
]);

// Claves del catálogo de permisos (backend/src/constants/paginas.ts) por
// página — mismo mapeo que replica el backend para exigirlo de verdad, no
// solo ocultar el link. "opt-out": permisos[clave] === false quita acceso
// aunque la regla de cargo/área de abajo diría que sí puede verla; ausente
// o true no cambia nada (nunca da acceso de más).
const PAGE_PERMISO_KEY: Partial<Record<Page, string>> = {
  resumen: "verResumen",
  notificaciones: "verNotificaciones",
  iniciativas: "verProyectos",
  "mi-trabajo": "verMiTrabajo",
  objetivos: "verObjetivos",
  equipo: "verEquipo",
  clientes: "verClientes",
  ticketera: "verTicketera",
  "kanban-sistemas": "verKanbanSistemas",
  mensajes: "verMensajes",
  cronograma: "verCronograma",
  calendario: "verCalendario",
  informes: "verInformesBI",
  requerimientos: "verRequerimientos",
  reporteria: "verReporteria",
  flujos: "verFlujosAreas",
  encuestas: "verEncuestas",
  aprobaciones: "verAprobaciones",
  marketing: "verMarketing",
  administracion: "verAdministracion",
  feedback: "verMejoraContinua",
  personalizacion: "verPersonalizacion",
};

const canAccessPortalPage = (user: User, target: Page) => {
  const leadership = isAreaLeaderUser(user);
  const baseline =
    hasFullPortalAccess(user) ||
    (["cronograma", "informes", "reporteria", "flujos", "administracion"].includes(target)
      ? leadership
      : !isWorkerPortalUser(user) || workerPanelPages.has(target));
  if (!baseline) return false;
  if (user?.isSuperAdmin) return true;
  const key = PAGE_PERMISO_KEY[target];
  return !key || (user as any)?.permisos?.[key] !== false;
};

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
    encuestas: "encuestas",
    marketing: "marketing",
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
  puedeVerTicketera?: boolean;
  puedeRegistrarTickets?: boolean;
};
type Item = {
  creadorId?:string|null;
  areaId?:string;
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  cliente?: string;
  clienteId?: string | null;
  software?: string | null;
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
  permisos?: Record<string, boolean> | null;
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
  clienteId: r.clienteId,
  software: r.software,
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
  const [mode, setMode] = useState<"register" | "login">(() =>
      localStorage.getItem("ejb_remembered_email") ? "login" : "register",
    ),
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
      const nombres = String(f.get("nombres") ?? "").trim();
      const apellidos = String(f.get("apellidos") ?? "").trim();
      const email = String(f.get("email") ?? "").trim();
      const password = String(f.get("password") ?? "");
      const areaId = String(f.get("areaId") ?? "");
      const cargo = String(f.get("cargo") ?? "");
      if (mode === "register") {
        if (nombres.length < 2 || apellidos.length < 2) {
          setError("Escribe tus nombres y apellidos.");
          return;
        }
        if (!areaId) {
          setError("Selecciona tu área antes de continuar.");
          return;
        }
        if (!cargo) {
          setError("Selecciona tu cargo antes de continuar.");
          return;
        }
      }
      if (!email) {
        setError("Escribe tu correo corporativo.");
        return;
      }
      if (password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
      let approvalCode = "";
      if (mode === "register" && ["Gerente", "Jefe"].includes(cargo)) {
        const value = await uiPrompt("Código de aprobación", "", { message: "Para crear una cuenta de Jefe o Gerente, introduce el código autorizado por administración.", placeholder: "Código de aprobación" });
        if (value === null) return;
        approvalCode = value.trim();
      }
      const data =
        mode === "login"
          ? await login(email, password)
          : await register({
              nombres,
              apellidos,
              email,
              password,
              areaId,
              cargo,
              approvalCode,
            });
      if (mode === "login") {
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
          src={`${import.meta.env.BASE_URL}ejb-manager-logo.svg`}
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
          <form ref={loginForm} onSubmit={submit} noValidate>
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
            {mode === "register" && (
              <small className="privacy">
                Acceso protegido exclusivo para colaboradores de <b>EJB</b>. Al continuar,
                aceptas las políticas de seguridad interna.
              </small>
            )}
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

async function askProjectChange(
  item: Item,
  accion: "Editar" | "Eliminar",
  onError: (error: unknown, fallback: string) => void,
) {
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
  try {
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
  } catch (error) {
    onError(error, "No se pudo enviar la solicitud.");
  }
}
function InitiativeList({
  items,
  onProgress,
  onAppearance,
  onSelect,
  user,
  areas,
  team,
  onChanged,
  onError,
}: {
  items: Item[];
  onProgress: (i: Item) => void;
  onAppearance: (i: Item) => void;
  onSelect: (i: Item) => void;
  onError: (error: unknown, fallback: string) => void;
  user: User;
  areas: Area[];
  team: TeamMember[];
  onChanged: () => void;
}) {
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editAreaName, setEditAreaName] = useState("");
  // Área, impacto y esfuerzo los cambia la jefatura; "Derivar a" también. El
  // resto de campos, cualquiera que pueda editar (canManageInitiative).
  const editCanLead = Boolean(editItem) && canLeadInitiative(user, editItem);
  const editCanDerive = canDeriveInitiative(user);
  if (!items.length)
    return (
      <div className="empty-state">
        <div>
          <Lightbulb />
        </div>
        <h3>Aún no hay proyectos</h3>
        <p>Registra la primera idea para comenzar el portafolio.</p>
      </div>
    );
  return (
    <>
      <div className="list-head">
        <span>PROYECTO</span>
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
                <h3>
                  {i.titulo}
                  <span className="initiative-owner">
                    <UserRound />
                    {i.responsable}
                  </span>
                </h3>
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
                  className="row-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Misma regla que el backend (canManageInitiative): quien
                    // puede editar abre el formulario; el resto sigue pidiendo
                    // aprobación.
                    if (canManageInitiative(user, i)) {
                      setEditItem(i);
                      setEditAreaName(i.area);
                    } else void askProjectChange(i, "Editar", onError);
                  }}
                  title="Editar proyecto"
                  aria-label={`Editar proyecto ${i.codigo}`}
                >
                  <Edit3 />
                  <span>Editar</span>
                </button>
              )}
              {canDeleteOwned(user,i.creadorId,i.areaId) && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user.isSuperAdmin && ["Asistente","Trabajador"].includes(user.cargo)) {
                      await askProjectChange(i, "Eliminar", onError); onChanged(); return;
                    }
                    if (
                      await uiConfirm(
                        "Eliminar proyecto",
                        `¿Deseas enviar ${i.codigo} a la papelera?`,
                      )
                    ) {
                      try {
                        await deleteInitiative(i.id);
                        onChanged();
                      } catch (error) {
                        onError(error, "No se pudo eliminar el proyecto.");
                      }
                    }
                  }}
                  title="Eliminar proyecto"
                >
                  <Trash2 />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {editItem && createPortal(
        <div
          className="overlay initiative-edit-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditItem(null);
          }}
        >
          <form
            className="event-modal initiative-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="initiative-edit-title"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const clienteIdRaw = String(f.get("clienteId") || "");
              const clienteQueryRaw = String(f.get("clienteIdQuery") || "").trim();
              // Si no se eligió un cliente pero tampoco se borró el texto (se
              // dejó el nombre legacy tal cual se precargó), no se toca el
              // cliente guardado: evita desvincularlo solo por no interactuar
              // con el campo.
              const clienteId = clienteIdRaw
                ? clienteIdRaw
                : clienteQueryRaw
                  ? undefined
                  : null;
              const fechaInicio = String(f.get("fechaInicio") || "");
              const fechaFin = String(f.get("fechaFin") || "");
              try {
                await updateInitiative(editItem.id, {
                  titulo: String(f.get("titulo")),
                  descripcion: String(f.get("descripcion")),
                  clienteId,
                  software: String(f.get("software") || "").trim() || null,
                  // Los campos deshabilitados no viajan: el backend solo los
                  // acepta de la jefatura y rechazaría cualquier cambio.
                  ...(editCanLead
                    ? {
                        areaId: String(f.get("areaId")),
                        impacto: Number(f.get("impacto")),
                        esfuerzo: String(f.get("esfuerzo")),
                      }
                    : {}),
                  ...(editCanDerive
                    ? { responsableId: String(f.get("responsableId") || "") || null }
                    : {}),
                  fechaInicio: fechaInicio || null,
                  fechaFin: fechaFin || null,
                });
                await saveInitiativeAppearance(editItem.id, {
                  icono: String(f.get("icono")),
                  colorIcono: String(f.get("colorIcono")),
                });
                setEditItem(null);
                onChanged();
              } catch (error) {
                onError(error, "No se pudo guardar el proyecto.");
              }
            }}
          >
            <button
              type="button"
              className="close"
              onClick={() => setEditItem(null)}
              aria-label="Cerrar edición"
            >
              <X />
            </button>
            <header className="initiative-edit-header">
              <span className="initiative-edit-heading-icon" aria-hidden="true">
                <Edit3 />
              </span>
              <div>
                <small>GESTIÓN DEL PROYECTO</small>
                <h2 id="initiative-edit-title">Editar proyecto</h2>
                <p>
                  {editItem.codigo} ·{" "}
                  {editCanLead
                    ? "Jefatura del área o administración global."
                    : "Área, responsable, impacto y esfuerzo los cambia la jefatura del área."}
                </p>
              </div>
            </header>
            <div className="initiative-edit-body">
            <label>
              Área
              <select
                name="areaId"
                defaultValue={areas.find((a) => a.nombre === editItem.area)?.id}
                disabled={!editCanLead}
                onChange={(event) => {
                  const areaName = areas.find((a) => a.id === event.target.value)?.nombre;
                  setEditAreaName(areaName ?? editItem.area);
                }}
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
            <div className="two-fields">
              <label>
                Cliente
                <ClientSelect
                  name="clienteId"
                  initialId={editItem.clienteId ?? ""}
                  initialLabel={editItem.cliente ?? ""}
                />
              </label>
              <label>
                Software
                <input
                  name="software"
                  defaultValue={editItem.software ?? ""}
                  placeholder="Ej. ERP, Power BI"
                  maxLength={120}
                />
              </label>
            </div>
            <div className="form-grid">
              {editCanDerive && (
                <label>
                  Derivar a
                  <select
                    name="responsableId"
                    defaultValue={editItem.responsableId ?? ""}
                    key={editAreaName}
                  >
                    <option value="">Sin derivar</option>
                    {team
                      .filter((member) => member.area.nombre === (editAreaName || editItem.area))
                      .sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, "es"))
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.nombres} {member.apellidos}
                        </option>
                      ))}
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
                  defaultValue={editItem.impacto}
                  disabled={!editCanLead}
                />
              </label>
              <label>
                Esfuerzo
                <select name="esfuerzo" defaultValue={editItem.esfuerzo} disabled={!editCanLead}>
                  <option>Bajo</option>
                  <option>Medio</option>
                  <option>Alto</option>
                </select>
              </label>
            </div>
            <div className="two-fields schedule-fields">
              <label>
                Fecha de inicio
                <input
                  name="fechaInicio"
                  type="date"
                  defaultValue={editItem.fechaInicio?.slice(0, 10) ?? ""}
                />
              </label>
              <label>
                Fecha estimada de fin
                <input
                  name="fechaFin"
                  type="date"
                  defaultValue={editItem.fechaFin?.slice(0, 10) ?? ""}
                />
              </label>
            </div>
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
            </div>
            <div className="modal-actions initiative-edit-footer">
              <button type="button" onClick={() => setEditItem(null)}>
                Cancelar
              </button>
              <button className="primary" type="submit">
                <Edit3 /> Guardar cambios
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}

function App() {
  const [areas, setAreas] = useState<Area[]>([]),
    [permisosCatalogo, setPermisosCatalogo] = useState<{ clave: string; etiqueta: string; modulo: string }[]>([]),
    [paginasCatalogo, setPaginasCatalogo] = useState<{ clave: string; etiqueta: string }[]>([]),
    [permisosMenuOpen, setPermisosMenuOpen] = useState<{ id: string; top: number; right: number } | null>(null),
    [user, setUser] = useState<User | null>(null),
    [booting, setBooting] = useState(true),
    [page, setPage] = useState<Page>(() =>
      notificationPage(sessionStorage.getItem("ejb_active_page") ?? "") ?? "resumen",
    ),
    [items, setItems] = useState<Item[]>([]),
    [projectClients, setProjectClients] = useState<Array<{ id: string; razonSocial: string; ruc?: string | null }>>([]),
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
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [dateFilterEnabled, setDateFilterEnabled] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [sidebarScale, setSidebarScale] = useState(() =>
      Number(localStorage.getItem("ejb_sidebar_scale") || 0.7),
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
    [createTasks, setCreateTasks] = useState<string[]>([]),
    [createTaskDraft, setCreateTaskDraft] = useState(""),
    [progressItem, setProgressItem] = useState<Item | null>(null),
    [history, setHistory] = useState<Progress[]>([]),
    [alerts, setAlerts] = useState<any[]>([]),
    [notificationUnreadCount, setNotificationUnreadCount] = useState(0),
    [notificationReturnVisible, setNotificationReturnVisible] = useState(false),
    [alertNotices, setAlertNotices] = useState<any[]>([]),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [userMenuOpen, setUserMenuOpen] = useState(false),
    [toast, setToast] = useState(""),
    [errorToast, setErrorToast] = useState(""),
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
    alertNoticeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
      new Map(),
    ),
    lastMessageNotice = useRef({ key: "", at: 0 });
  const closeTransientPanels = () => {
    setNotificationsOpen(false);
    setUserMenuOpen(false);
    setFiltersOpen(false);
    setGlobalResults([]);
  };
  const openFromNotification = (target: Page) => {
    closeTransientPanels();
    setNotificationReturnVisible(target !== "notificaciones");
    setPage(target);
  };
  const returnToNotifications = () => {
    closeTransientPanels();
    setNotificationReturnVisible(false);
    setPage("notificaciones");
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
  const alertKey = (row: any) =>
    `${row.type}|${row.initiativeId}|${row.title}|${row.message}`;
  const alertSignature = (rows: any[]) =>
    rows
      .map(alertKey)
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
        icon: photo || `${import.meta.env.BASE_URL}ejb-manager-isotipo.svg`,
        badge: `${import.meta.env.BASE_URL}ejb-manager-isotipo.svg`,
        tag: `ejb-message-${name}`,
      });
      notification.onclick = () => {
        window.focus();
        openFromNotification("mensajes");
        notification.close();
      };
    }
  };
  const applyLiveAlerts = (rows: any[]) => {
    const previous = lastAlertSignature.current,
      signature = alertSignature(rows),
      previousKeys = new Set(previous ? previous.split("::") : []),
      newAlerts = alertsInitialized.current
        ? rows.filter((row: any) => !previousKeys.has(alertKey(row)))
        : [];
    if (newAlerts.length) {
      setAlertNotices((current) => {
        const seen = new Set(current.map(alertKey));
        return [
          ...current,
          ...newAlerts.filter((row: any) => !seen.has(alertKey(row))),
        ];
      });
      playNotificationSound("alert");
      newAlerts.forEach((alert: any) => {
        const key = alertKey(alert);
        const previousTimer = alertNoticeTimers.current.get(key);
        if (previousTimer) clearTimeout(previousTimer);
        const timer = setTimeout(() => {
          setAlertNotices((current) =>
            current.filter((row: any) => alertKey(row) !== key),
          );
          alertNoticeTimers.current.delete(key);
        }, 6500);
        alertNoticeTimers.current.set(key, timer);
      });
      if ("Notification" in window && Notification.permission === "granted") {
        newAlerts.forEach((alert: any) => {
          const notification = new Notification(alert.title, {
            body: alert.message,
            icon: `${import.meta.env.BASE_URL}ejb-manager-isotipo.svg`,
            badge: `${import.meta.env.BASE_URL}ejb-manager-isotipo.svg`,
            tag: `ejb-alert-${alertKey(alert)}`,
          });
          notification.onclick = () => {
            window.focus();
            openFromNotification("cronograma");
            notification.close();
          };
        });
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
    // El catálogo (áreas, permisos, páginas) solo se pedía una vez: si el
    // backend aún no estaba listo, quedaba vacío hasta recargar. Ahora se
    // reintenta con espera creciente y, si sigue fallando, se avisa por toast.
    let cancelled = false;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];
    const loadCatalogo = async (attempt: number): Promise<void> => {
      try {
        const c = await fetchCatalogo();
        if (cancelled) return;
        setAreas(c.areas);
        setPermisosCatalogo(c.permisos ?? []);
        setPaginasCatalogo(c.paginas ?? []);
        setBooting(false);
      } catch (error) {
        if (cancelled) return;
        setBooting(false);
        if (attempt < 4)
          retryTimers.push(setTimeout(() => loadCatalogo(attempt + 1), 1500 * (attempt + 1)));
        else reportError(error, "No se pudo cargar el catálogo. Recarga la página.");
      }
    };
    // La sesión solo se descarta si el backend dice que el token no sirve
    // (401). Ante un backend caído o reiniciándose (red, 5xx) se conserva el
    // token y se reintenta, en vez de cerrar la sesión del usuario.
    const loadSession = async (attempt: number): Promise<void> => {
      try {
        const current = await me();
        if (!cancelled) setUser(current);
      } catch (error) {
        if (cancelled) return;
        if ((error as { status?: number }).status === 401) {
          localStorage.removeItem("ejb_token");
          sessionStorage.removeItem("ejb_token");
        } else if (attempt < 4)
          retryTimers.push(setTimeout(() => loadSession(attempt + 1), 1500 * (attempt + 1)));
      }
    };
    loadCatalogo(0);
    if (
      localStorage.getItem("ejb_token") ||
      sessionStorage.getItem("ejb_token")
    )
      loadSession(0);
    return () => {
      cancelled = true;
      retryTimers.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    fetchIniciativas().then((r: any[]) => setItems(r.map(mapItem)));
    fetchClientes().then(setProjectClients).catch(() => setProjectClients([]));
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
    if (user && !canAccessPortalPage(user, page)) setPage("resumen");
  }, [user, page]);
  useEffect(() => {
    document.documentElement.dataset.currentPage = page;
    sessionStorage.setItem("ejb_active_page", page);
    if (page === "notificaciones") setNotificationReturnVisible(false);
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
    if (!errorToast) return;
    const timer = setTimeout(
      () => setErrorToast(""),
      errorToast.length > 55 ? 3500 : 2500,
    );
    return () => clearTimeout(timer);
  }, [errorToast]);
  // Punto central para mostrar cualquier error de la API por toast (el mismo
  // sistema de toasts que ya usa toda la app — setToast/"✓" para éxito — no se
  // agregó ninguna librería nueva, solo la variante de error que faltaba).
  const reportError = (error: unknown, fallback: string) =>
    setErrorToast(error instanceof Error ? error.message : fallback);
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
  const clearProjectFilters = () => {
    setArea("Todas");
    setClientFilter("Todos");
    setWorkerFilter("Todos");
    setStatusFilter("Todos");
    setEffortFilter("Todos");
    setSortFilter("score");
    setDateFrom("");
    setDateTo("");
    setDateFilterEnabled(false);
  };
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
            (workerFilter === "Todos" ||
              (workerFilter === "Sin asignar" ? !i.responsableId : i.responsableId === workerFilter)) &&
            (statusFilter === "Todos" || i.estado === statusFilter) &&
            (effortFilter === "Todos" || i.esfuerzo === effortFilter) &&
            (() => {
              // El filtro de fecha solo aplica si está activado con el check
              // — así siempre hay una forma explícita de quitarlo, sin
              // depender de vaciar los dos campos de fecha nativos.
              if (!dateFilterEnabled) return true;
              // El proyecto queda si su rango [fechaInicio, fechaFin] se
              // solapa con el rango elegido (mismo criterio que Cronograma).
              const start = i.fechaInicio?.slice(0, 10);
              const end = i.fechaFin?.slice(0, 10);
              if (dateFrom && (end || start) && (end ?? start)! < dateFrom) return false;
              if (dateTo && start && start > dateTo) return false;
              return true;
            })() &&
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
    [items, query, area, clientFilter, workerFilter, statusFilter, effortFilter, sortFilter, dateFrom, dateTo, dateFilterEnabled],
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
  const portfolioAverage = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.avance, 0) / items.length)
    : 0;
  const portfolioStatusOrder = useMemo(
    () => ["Pendiente", "En evaluación", "Priorizado", "En proceso", "Finalizado"] as Estado[],
    [],
  );
  const portfolioStatusPalette: Record<Estado, string> = {
    Pendiente: "#9aa9bb",
    "En evaluación": "#2f6fed",
    Priorizado: "#9333ea",
    "En proceso": "#f59e0b",
    Finalizado: "#19bd87",
  };
  const portfolioStatusCounts = useMemo(
    () =>
      portfolioStatusOrder.map((status) => ({
        status,
        count: items.filter((item) => item.estado === status).length,
      })),
    [items, portfolioStatusOrder],
  );
  const portfolioGradient = useMemo(() => {
    const total = portfolioStatusCounts.reduce((sum, row) => sum + row.count, 0);
    if (!total) return "#e6edf7";
    let cursor = 0;
    const segments = portfolioStatusCounts
      .filter((row) => row.count > 0)
      .map((row) => {
        const start = cursor;
        const end = cursor + (row.count / total) * 100;
        cursor = end;
        return `${portfolioStatusPalette[row.status]} ${start}% ${end}%`;
      })
      .join(", ");
    return `conic-gradient(${segments})`;
  }, [portfolioStatusCounts]);
  const workerPerformanceRanking = useMemo(() => {
    const sameAreaWorkers = team.filter((member) =>
      isWorkerPortalUser(member) && (!user?.area?.id || member.area?.id === user.area.id),
    );
    return sameAreaWorkers
      .map((member) => {
        const assignedTasks = items.flatMap((project) =>
          (project.tareas ?? []).filter((task) => task.responsableId === member.id),
        );
        const completed = assignedTasks.filter((task) => task.completada).length;
        const managedProjects = items.filter((project) => project.responsableId === member.id);
        const projectProgress = managedProjects.length
          ? managedProjects.reduce((sum, project) => sum + project.avance, 0) / managedProjects.length
          : 0;
        const taskProgress = assignedTasks.length ? (completed / assignedTasks.length) * 100 : 0;
        const points = Math.round(
          assignedTasks.length && managedProjects.length
            ? taskProgress * 0.8 + projectProgress * 0.2
            : assignedTasks.length ? taskProgress : projectProgress,
        );
        return { member, assigned: assignedTasks.length, completed, points };
      })
      .sort((left, right) =>
        right.points - left.points || right.completed - left.completed ||
        `${left.member.nombres} ${left.member.apellidos}`.localeCompare(`${right.member.nombres} ${right.member.apellidos}`, "es"),
      );
  }, [team, items, user?.area?.id]);
  const openProgress = async (i: Item) => {
    setProgressItem(i);
    setHistory(await fetchProgresos(i.id));
  };
  const customizeInitiative = async (i: Item) => {
    setAppearanceItem(i);
  };
  const changeTeamCargo = async (member: TeamMember, cargo: string) => {
    try {
      await saveTeamCargo(member.id, cargo);
      setTeam((rows) =>
        rows.map((row) => (row.id === member.id ? { ...row, cargo } : row)),
      );
      setToast(`${member.nombres} ahora tiene el rol ${cargo}`);
    } catch (error) {
      reportError(error, "No se pudo cambiar el cargo.");
    }
  };
  const changeTeamArea = async (member: TeamMember, areaId: string) => {
    try {
      await saveTeamArea(member.id, areaId);
      const area = areas.find((a) => a.id === areaId);
      if (area)
        setTeam((rows) =>
          rows.map((row) => (row.id === member.id ? { ...row, area } : row)),
        );
      setToast(`${member.nombres} ahora está en ${area?.nombre ?? "la nueva área"}`);
    } catch (error) {
      reportError(error, "No se pudo cambiar el área.");
    }
  };
  // Solo el administrador global puede ver este menú (botón oculto salvo
  // user.isSuperAdmin) y solo el administrador global puede guardarlo de
  // verdad: el backend (PATCH /admin/usuarios/:id/permisos) vuelve a exigir
  // isSuperAdmin por su cuenta, sin confiar en lo que oculte o muestre el
  // frontend.
  const toggleMemberPermiso = async (
    member: any,
    clave: string,
    checked: boolean,
  ) => {
    const next = { ...(member.permisos || {}), [clave]: checked };
    await updateUserPermissions(member.id, next);
    setTeam((rows) =>
      rows.map((row) => (row.id === member.id ? { ...row, permisos: next } : row)),
    );
  };
  useEffect(() => {
    if (!permisosMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".team-permisos-wrap,.team-permisos-menu"))
        setPermisosMenuOpen(null);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setPermisosMenuOpen(null);
    // La posición del popover se calcula una sola vez, al abrirlo (coordenadas
    // fijas vía getBoundingClientRect). Si se recalculara en cada scroll para
    // mantenerlo anclado, la tarjeta lo recortaría igual (tiene overflow:hidden
    // por el diseño de la tarjeta) y sería una animación costosa sin necesidad.
    // Más simple y predecible: cerrarlo al hacer scroll de la página — pero
    // el propio popover también hace scroll interno (la lista de permisos +
    // páginas ya no cabe entera), y ese scroll interno NO debe cerrarlo.
    const closeOnScroll = (event: Event) => {
      if ((event.target as HTMLElement | null)?.closest?.(".team-permisos-menu")) return;
      setPermisosMenuOpen(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [permisosMenuOpen]);
  // Áreas que el backend acepta hoy para crear: todas con permiso/técnico/admin;
  // si no, solo la propia (canCreateInitiativeInArea).
  const creatableAreas = canCreateInAnyArea(user)
    ? areas
    : areas.filter((a) => a.id === user?.area?.id);
  const addInitiative = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      selected = areas.find((a) => a.nombre === String(f.get("area")));
    if (!selected) return;
    try {
      const r = await createIniciativa({
        titulo: String(f.get("titulo")),
        descripcion: String(f.get("descripcion")),
        clienteId: String(f.get("clienteId") || "") || undefined,
        software: String(f.get("software") || "").trim() || undefined,
        areaId: selected.id,
        responsableId: String(f.get("responsableId") || "") || undefined,
        impacto: Number(f.get("impacto")),
        esfuerzo: String(f.get("esfuerzo")),
        fechaInicio: String(f.get("fechaInicio") || "") || undefined,
        fechaFin: String(f.get("fechaFin") || "") || undefined,
        tareas: createTasks,
      });
      setItems((v) => [mapItem(r), ...v]);
      setModal(false);
      setCreateTasks([]);
      setCreateTaskDraft("");
      setToast("Proyecto guardado como Pendiente");
    } catch (x) {
      reportError(x, "No se pudo guardar el proyecto.");
    }
  };
  const closeCreateModal = () => {
    setModal(false);
    setCreateTasks([]);
    setCreateTaskDraft("");
  };
  // Acepta una tarea por línea (igual que el textarea original) o pegar
  // varias de un tirón — cualquiera de las dos formas parte por saltos de
  // línea y agrega todas como chips de una vez.
  const addCreateTasksFromText = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    setCreateTasks((tasks) => [...tasks, ...lines]);
    setCreateTaskDraft("");
  };
  const addCreateTask = () => addCreateTasksFromText(createTaskDraft);
  const handleCreateTaskPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes("\n")) return; // una sola línea: se comporta como escribir normal
    event.preventDefault();
    addCreateTasksFromText(`${createTaskDraft}${pasted}`);
  };
  const addProgress = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!progressItem) return;
    const f = new FormData(e.currentTarget),
      porcentaje = Number(f.get("porcentaje"));
    try {
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
    } catch (error) {
      reportError(error, "No se pudo registrar el progreso.");
    }
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
    encuestas: [
      "Encuestas EJB",
      "Consulta al equipo y visualiza los resultados en tiempo real.",
    ],
    aprobaciones: [
      "Aprobaciones",
      "Solicitudes de edición y eliminación de tu área.",
    ],
    marketing: [
      "Marketing",
      "Prospectos captados y proyección de cierre de mes.",
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
        {!sidebarCollapsed && (
          <div className="sidebar-zoom">
            <button
              onClick={() =>
                setSidebarScale((v) => Math.max(0.7, +(v - 0.06).toFixed(2)))
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
        )}
        <nav onClickCapture={() => setMobileMenuOpen(false)}>
          {canAccessPortalPage(user, "resumen") && (
            <button
              className={page === "resumen" ? "active" : ""}
              onClick={() => setPage("resumen")}
            >
              <LayoutDashboard />
              Resumen
            </button>
          )}
          {canAccessPortalPage(user, "notificaciones") && (
            <button
              className={page === "notificaciones" ? "active" : ""}
              onClick={() => setPage("notificaciones")}
            >
              <Bell /> Notificaciones
              {notificationUnreadCount > 0 && <span>{notificationUnreadCount}</span>}
            </button>
          )}
          {canAccessPortalPage(user, "iniciativas") && (
            <button
              className={page === "iniciativas" ? "active" : ""}
              onClick={() => setPage("iniciativas")}
            >
              <Lightbulb />
              Proyectos<span>{items.length}</span>
            </button>
          )}
          {canAccessPortalPage(user, "mi-trabajo") && (
            <button
              className={page === "mi-trabajo" ? "active" : ""}
              onClick={() => setPage("mi-trabajo")}
            >
              <BriefcaseBusiness /> Mi trabajo
            </button>
          )}
          {canAccessPortalPage(user, "objetivos") && (
            <button
              className={page === "objetivos" ? "active" : ""}
              onClick={() => setPage("objetivos")}
            >
              <Target />
              Objetivos
            </button>
          )}
          {canAccessPortalPage(user, "equipo") && (
            <button
              className={page === "equipo" ? "active" : ""}
              onClick={() => setPage("equipo")}
            >
              <Users />
              Equipo
            </button>
          )}
          {canAccessPortalPage(user, "clientes") && (
            <button
              className={page === "clientes" ? "active" : ""}
              onClick={() => setPage("clientes")}
            >
              <Building2 /> Clientes
            </button>
          )}
          {canAccessPortalPage(user, "ticketera") && (
            <button
              className={page === "ticketera" ? "active" : ""}
              onClick={() => setPage("ticketera")}
            >
              <BarChart3 /> Ticketera Consultoría
            </button>
          )}
          {canAccessPortalPage(user, "kanban-sistemas") && (
            <button
              className={page === "kanban-sistemas" ? "active" : ""}
              onClick={() => setPage("kanban-sistemas")}
            >
              <PanelsTopLeft /> Kanban Sistemas
              {items.filter((item) => item.area === "Sistemas").length > 0 && (
                <span>{items.filter((item) => item.area === "Sistemas").length}</span>
              )}
            </button>
          )}
          {canAccessPortalPage(user, "mensajes") && (
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
          )}
          {canAccessPortalPage(user, "cronograma") && (
            <button
              className={page === "cronograma" ? "active" : ""}
              onClick={() => setPage("cronograma")}
            >
              <BellRing />
              Cronogramas y alertas
            </button>
          )}
          {canAccessPortalPage(user, "calendario") && (
            <button
              className={page === "calendario" ? "active" : ""}
              onClick={() => setPage("calendario")}
            >
              <CalendarDays /> Calendario
            </button>
          )}
          {canAccessPortalPage(user, "informes") && (
            <button
              className={page === "informes" ? "active" : ""}
              onClick={() => setPage("informes")}
            >
              <BarChart3 /> Informes BI
            </button>
          )}
          {canAccessPortalPage(user, "requerimientos") && (
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
          )}
          {canAccessPortalPage(user, "reporteria") && (
            <button
              className={page === "reporteria" ? "active" : ""}
              onClick={() => setPage("reporteria")}
            >
              <Download /> Reportería
            </button>
          )}
          {canAccessPortalPage(user, "flujos") && (
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
          )}
          {canAccessPortalPage(user, "encuestas") && (
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
          )}
          {canAccessPortalPage(user, "aprobaciones") && (
            <button
              className={page === "aprobaciones" ? "active" : ""}
              onClick={() => setPage("aprobaciones")}
            >
              <CheckSquare />
              Aprobaciones
            </button>
          )}
          {canAccessPortalPage(user, "marketing") && canReadMarketing(user) && (
            <button
              className={page === "marketing" ? "active" : ""}
              onClick={() => setPage("marketing")}
            >
              <TrendingUp /> Marketing
            </button>
          )}
          {canAccessPortalPage(user, "administracion") && (
            <button
              className={page === "administracion" ? "active" : ""}
              onClick={() => setPage("administracion")}
            >
              <Settings /> Administración
            </button>
          )}
          {canAccessPortalPage(user, "feedback") && (
            <button
              className={page === "feedback" ? "active" : ""}
              onClick={() => setPage("feedback")}
            >
              <Sparkles /> Mejora continua
            </button>
          )}
          {canAccessPortalPage(user, "personalizacion") && (
            <button
              className={page === "personalizacion" ? "active" : ""}
              onClick={() => setPage("personalizacion")}
            >
              <Palette />
              Personalización
            </button>
          )}
        </nav>
        <div className="nav-foot">
          <div className="app-version">
            <span>EJB MANAGER</span>
            <b>V. 0.3.42</b>
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
                src={`${import.meta.env.BASE_URL}ejb-manager-logo.svg`}
                alt="EJB Manager"
              />
              <img
                className="topbar-logo-compact"
                src={`${import.meta.env.BASE_URL}ejb-manager-isotipo.svg`}
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
              <div className="notifications-popover notifications-popover--refined" role="dialog" aria-label="Notificaciones y alertas">
                <div className="notifications-popover-header">
                  <div className="notifications-popover-heading">
                    <span><BellRing /></span>
                    <p>
                      <b>Notificaciones</b>
                      <small>{alerts.length ? `${alerts.length} alerta${alerts.length === 1 ? "" : "s"} activa${alerts.length === 1 ? "" : "s"}` : "Sin alertas pendientes"}</small>
                    </p>
                  </div>
                  <button type="button" className="notifications-popover-close" aria-label="Cerrar notificaciones" onClick={() => setNotificationsOpen(false)}>
                    <X />
                  </button>
                </div>
                {!!alerts.length && (
                  <div className="notifications-popover-summary">
                    <span className="summary-priority">
                      <i><BellRing /></i>
                      <p><b>{alerts.filter((alert) => alert.severity === "high").length}</b> prioritarias</p>
                      <ArrowRight />
                    </span>
                    <span className="summary-follow">
                      <i><Clock3 /></i>
                      <p><b>{alerts.filter((alert) => alert.severity !== "high").length}</b> de seguimiento</p>
                      <ArrowRight />
                    </span>
                  </div>
                )}
                <div className="notifications-popover-list">
                  {alerts.map((alert, index) => {
                    const AlertIcon = alert.type === "completado"
                      ? CheckCircle2
                      : alert.type === "reunion"
                        ? CalendarDays
                        : alert.type === "tarea"
                          ? CheckSquare
                          : Clock3;
                    const category = alert.severity === "high"
                      ? "Prioridad"
                      : alert.type === "reunion"
                        ? "Reunión"
                        : alert.type === "tarea"
                          ? "Tarea"
                          : "Seguimiento";
                    return (
                      <button
                        type="button"
                        key={`${alert.type}-${alert.initiativeId ?? alert.code ?? index}-${index}`}
                        className={`notification-popover-item ${alert.severity}`}
                        onClick={() => {
                          openFromNotification("cronograma");
                        }}
                      >
                        <span className="notification-popover-item-icon"><AlertIcon /></span>
                        <p>
                          <b>{alert.title}</b>
                          <small>{alert.message}</small>
                        </p>
                        <em>{category}</em>
                        <ArrowRight />
                      </button>
                    );
                  })}
                  {!alerts.length && (
                    <div className="notifications-empty">
                      <span><CheckCircle2 /></span>
                      <b>Todo al día</b>
                      <small>No tienes alertas pendientes.</small>
                    </div>
                  )}
                </div>
                <button
                  className="view-all"
                  type="button"
                  onClick={() => {
                    openFromNotification("notificaciones");
                  }}
                >
                  <span>Ver todas las notificaciones</span><ArrowRight />
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
              user.puedeRegistrarTickets && (
                <button
                  className="primary"
                  onClick={() => window.dispatchEvent(new CustomEvent("ticket:new"))}
                >
                  <Plus />
                  Registrar caso
                </button>
              )
            ) : page === "calendario" ? (
              <button className="primary" onClick={() => window.dispatchEvent(new CustomEvent("calendar:new"))}>
                <Plus />
                Evento nuevo
              </button>
            ) : page === "kanban-sistemas" ? (
              // El backend solo acepta registros en Sistemas de gente de esa
              // área o con permiso para crear en cualquier área.
              canCreateInAnyArea(user) || user.area.nombre === "Sistemas" ? (
                <button className="primary" onClick={() => { setCreateAreaName("Sistemas"); setModal(true); }}>
                  <Plus />
                  Nuevo registro Kanban
                </button>
              ) : null
            ) : QUICK_CREATE_INITIATIVE_PAGES.includes(page) ? (
              <button className="primary" onClick={() => { setCreateAreaName(user.area.nombre); setModal(true); }}>
                <Plus />
                Registrar Proyecto
              </button>
            ) : null}
          </header>
          <section
            className={
              page === "mensajes" ? "content chat-page-content" : "content"
            }
          >
            {notificationReturnVisible && page !== "notificaciones" && (
              <button
                type="button"
                className="notification-return-button"
                onClick={returnToNotifications}
                title="Volver a notificaciones"
                aria-label="Volver a notificaciones"
              >
                <ArrowLeft />
                <span>Notificaciones</span>
              </button>
            )}
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
                  openFromNotification(target);
                }}
              />
            )}
            {page === "administracion" && (hasFullPortalAccess(user) || isAreaLeaderUser(user)) && (
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
                {isWorkerPortalUser(user) && (
                  <article className="report-card monthly-ranking dashboard-worker-ranking">
                    <div className="ranking-head">
                      <div>
                        <Trophy />
                        <div>
                          <h3>Ranking de cumplimiento del equipo</h3>
                          <p>Resultados según tareas asignadas, tareas realizadas y avance de proyectos.</p>
                        </div>
                      </div>
                      <span>{user.area?.nombre || "Mi área"}</span>
                    </div>
                    <div className="ranking-list">
                      {workerPerformanceRanking.slice(0, 5).map((entry, index) => (
                        <div
                          className={`rank rank-${index + 1}${entry.member.id === user.id ? " current-worker" : ""}`}
                          key={entry.member.id}
                        >
                          <strong>{index + 1}</strong>
                          <i style={{ background: entry.member.area?.colorHex || "#2f6fed" }} />
                          <div>
                            <b>{entry.member.nombres} {entry.member.apellidos}{entry.member.id === user.id ? " · Tú" : ""}</b>
                            <small>{entry.completed}/{entry.assigned} tareas realizadas</small>
                          </div>
                          <em>{entry.points} pts</em>
                          <Award />
                        </div>
                      ))}
                      {!workerPerformanceRanking.length && (
                        <div className="suite-empty">Aún no hay datos suficientes para calcular el ranking.</div>
                      )}
                    </div>
                  </article>
                )}
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
                        className="donut portfolio-donut"
                        style={
                          {
                            background: portfolioGradient,
                          } as CSSProperties
                        }
                      >
                        <div>
                          <strong>
                            {portfolioAverage}%
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
                        clients={projectClients.map((client) => client.razonSocial)}
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
                        onClearFilters={clearProjectFilters}
                      />
                    </div>
                    <InitiativeList
                      items={filtered.slice(0, 5)}
                      onProgress={openProgress}
                      onAppearance={customizeInitiative}
                      onSelect={setSelectedItem}
                      user={user}
                      areas={areas}
                      team={team}
                      onChanged={reloadItems}
                      onError={reportError}
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
                    <h2>Prioriza y acompaña cada proyecto</h2>
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
                    <FilterCombobox
                      value={workerFilter}
                      onChange={setWorkerFilter}
                      ariaLabel="Filtrar proyectos por trabajador"
                      placeholder="Buscar trabajador…"
                      options={[
                        { value: "Todos", label: "Todos los trabajadores" },
                        { value: "Sin asignar", label: "Sin asignar" },
                        ...team
                          .slice()
                          .sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, "es"))
                          .map((member) => ({ value: member.id, label: `${member.nombres} ${member.apellidos}` })),
                      ]}
                    />
                  </label>
                  <div className="initiative-date-filter">
                    <label className="date-filter-toggle">
                      <input
                        type="checkbox"
                        checked={dateFilterEnabled}
                        onChange={(event) => setDateFilterEnabled(event.target.checked)}
                      />
                      Filtrar por fecha
                    </label>
                    <label>
                      Desde
                      <input
                        type="date"
                        value={dateFrom}
                        disabled={!dateFilterEnabled}
                        onChange={(event) => setDateFrom(event.target.value)}
                        aria-label="Filtrar proyectos desde esta fecha"
                      />
                    </label>
                    <label>
                      Hasta
                      <input
                        type="date"
                        value={dateTo}
                        disabled={!dateFilterEnabled}
                        onChange={(event) => setDateTo(event.target.value)}
                        aria-label="Filtrar proyectos hasta esta fecha"
                      />
                    </label>
                  </div>
                  <SectionTools
                    areas={areas}
                    area={area}
                    setArea={setArea}
                    clients={projectClients.map((client) => client.razonSocial)}
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
                    onClearFilters={clearProjectFilters}
                  />
                  <button className="primary" onClick={() => setModal(true)}>
                    <Plus />
                    Registrar Proyecto
                  </button>
                </div>
                <InitiativeList
                  items={filtered}
                  onProgress={openProgress}
                  onAppearance={customizeInitiative}
                  onSelect={setSelectedItem}
                  user={user}
                  areas={areas}
                  team={team}
                  onChanged={reloadItems}
                  onError={reportError}
                />
                </section>
              </div>
            )}
            {page === "objetivos" && !isWorkerPortalUser(user) && (
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
                          <div className="team-permisos-wrap">
                            <button
                              type="button"
                              className="team-permisos-trigger"
                              aria-label={`Permisos de ${m.nombres}`}
                              aria-haspopup="menu"
                              aria-expanded={permisosMenuOpen?.id === m.id}
                              onClick={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                setPermisosMenuOpen((current) =>
                                  current?.id === m.id
                                    ? null
                                    : { id: m.id, top: rect.bottom + 6, right: window.innerWidth - rect.right },
                                );
                              }}
                            >
                              <MoreVertical />
                            </button>
                            {permisosMenuOpen?.id === m.id &&
                              createPortal(
                                <div
                                  className="team-permisos-menu"
                                  role="menu"
                                  style={{ top: permisosMenuOpen.top, right: permisosMenuOpen.right }}
                                >
                                  <h4>Permisos de {m.nombres}</h4>
                                  {Object.entries(
                                    permisosCatalogo.reduce<Record<string, typeof permisosCatalogo>>(
                                      (groups, permiso) => {
                                        (groups[permiso.modulo] ??= []).push(permiso);
                                        return groups;
                                      },
                                      {},
                                    ),
                                  ).map(([modulo, permisos]) => (
                                    <div key={modulo} className="team-permisos-group">
                                      <b>{modulo}</b>
                                      {permisos.map((permiso) => (
                                        <label key={permiso.clave}>
                                          <input
                                            type="checkbox"
                                            defaultChecked={Boolean((m.permisos as any)?.[permiso.clave])}
                                            onChange={(event) =>
                                              toggleMemberPermiso(m, permiso.clave, event.target.checked)
                                            }
                                          />
                                          {permiso.etiqueta}
                                        </label>
                                      ))}
                                    </div>
                                  ))}
                                  <div className="team-permisos-group">
                                    <b>Páginas visibles del menú</b>
                                    <p className="team-permisos-hint">
                                      Todas activadas por defecto. Desactiva solo las que no debe ver.
                                    </p>
                                    {paginasCatalogo.map((pagina) => (
                                      <label key={pagina.clave}>
                                        <input
                                          type="checkbox"
                                          defaultChecked={(m.permisos as any)?.[pagina.clave] !== false}
                                          onChange={(event) =>
                                            toggleMemberPermiso(m, pagina.clave, event.target.checked)
                                          }
                                        />
                                        {pagina.etiqueta}
                                      </label>
                                    ))}
                                  </div>
                                </div>,
                                document.body,
                              )}
                          </div>
                        )}
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
                        {user.isSuperAdmin && (
                          <select
                            className="team-role"
                            aria-label={`Cambiar área de ${m.nombres}`}
                            value={m.area.id}
                            disabled={m.isSuperAdmin && m.id !== user.id}
                            onChange={(e) => changeTeamArea(m, e.target.value)}
                          >
                            {areas.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre}
                              </option>
                            ))}
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
                              try {
                                await deleteTeamMember(m.id);
                                setTeam((v) => v.filter((x) => x.id !== m.id));
                                setToast("Perfil eliminado");
                              } catch (error) {
                                reportError(error, "No se pudo eliminar el perfil.");
                              }
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
                      onNavigate={(destination) => openFromNotification(destination)}
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
            {page === "cronograma" && (hasFullPortalAccess(user) || isAreaLeaderUser(user)) && (
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
            {page === "informes" && (hasFullPortalAccess(user) || isAreaLeaderUser(user)) && (
              <BIReports items={items} areas={areas} user={user} />
            )}
            {page === "reporteria" && (hasFullPortalAccess(user) || isAreaLeaderUser(user)) && <ReportingCenter items={items} />}
            {page === "requerimientos" && !isWorkerPortalUser(user) && <Requirements user={user} />}
            {page === "flujos" && (hasFullPortalAccess(user) || isAreaLeaderUser(user)) && <AreaFlows user={user} />}
            {page === "encuestas" && <Surveys user={user} />}
            {page === "aprobaciones" && <Approvals user={user} />}
            {page === "marketing" && !isWorkerPortalUser(user) && <MarketingCenter user={user} />}
            {page === "perfil" && (
              <Profile user={user} onUpdate={setUser} areas={areas} onError={reportError} />
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
                onClick={closeCreateModal}
              >
                <X />
              </button>
              <div className="modal-icon">
                <Lightbulb />
              </div>
              <h2>{page === "kanban-sistemas" ? "Nuevo registro de Sistemas" : "Nuevo proyecto"}</h2>
              <p>{page === "kanban-sistemas" ? "Se agregará al Kanban de Sistemas como Pendiente." : "Se registrará inicialmente como Pendiente."}</p>
              <div className="initiative-create-body">
              <label>
                Título
                <input name="titulo" required minLength={3} />
              </label>
              <label>
                Descripción
                <textarea name="descripcion" required minLength={10} />
              </label>
              <div className="two-fields">
                <label>
                  Cliente
                  <ClientSelect name="clienteId" />
                </label>
                <label>
                  Software
                  <input
                    name="software"
                    placeholder="Ej. ERP, Power BI"
                    maxLength={120}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Área
                  {page === "kanban-sistemas" && (
                    <input type="hidden" name="area" value="Sistemas" />
                  )}
                  <select
                    name="area"
                    value={page === "kanban-sistemas" ? "Sistemas" : (creatableAreas.some((a) => a.nombre === createAreaName) ? createAreaName : user.area.nombre)}
                    onChange={(event) => setCreateAreaName(event.target.value)}
                    disabled={page === "kanban-sistemas"}
                  >
                    {(page === "kanban-sistemas" ? areas : creatableAreas).map((a) => (
                      <option key={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </label>
                {(hasFullPortalAccess(user) || isAreaLeaderUser(user)) && (
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
              <div className="initiative-tasks-field">
                <span>Tareas por agregar</span>
                <div className="initiative-tasks-add">
                  <textarea
                    value={createTaskDraft}
                    onChange={(event) => setCreateTaskDraft(event.target.value)}
                    onPaste={handleCreateTaskPaste}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        addCreateTask();
                      }
                    }}
                    placeholder={"Una tarea por línea, o pega varias de un tirón\nEj. Preparar propuesta\nEj. Validar con Gerencia"}
                  />
                  <button type="button" onClick={addCreateTask}>
                    Agregar
                  </button>
                </div>
                {createTasks.length > 0 && (
                  <ul className="initiative-tasks-list">
                    {createTasks.map((task, index) => (
                      <li key={`${task}-${index}`}>
                        <span>{task}</span>
                        <button
                          type="button"
                          aria-label={`Quitar "${task}"`}
                          onClick={() =>
                            setCreateTasks((tasks) => tasks.filter((_, i) => i !== index))
                          }
                        >
                          <X />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <small>
                  Podrás marcarlas y comentarlas desde el detalle del
                  proyecto.
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeCreateModal}>
                  Cancelar
                </button>
                <button className="primary">
                  Registrar
                  <ArrowRight />
                </button>
              </div>
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
                            <u
                              className={statusClass[status]}
                              style={{
                                width: `${portion}%`,
                                minWidth: portion > 0 ? "8px" : "0",
                              }}
                            />
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
            try {
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
            } catch (error) {
              reportError(error, "No se pudo guardar la apariencia.");
            }
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
              user={user}
              onError={reportError}
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
      {alertNotices.length > 0 && (
        <div className="live-alert-stack" aria-live="polite" aria-label="Alertas en tiempo real">
          {alertNotices.map((alert) => {
            const key = alertKey(alert);
            return (
              <button
                key={key}
                className={`live-alert-notice ${alert.severity}`}
                onClick={() => {
                  setPage("cronograma");
                  setAlertNotices((current) =>
                    current.filter((row: any) => alertKey(row) !== key),
                  );
                }}
              >
                <span>{alert.type === "completado" ? "✓" : "!"}</span>
                <div>
                  <small>ALERTA EN TIEMPO REAL</small>
                  <b>{alert.title}</b>
                  <p>{alert.message}</p>
                </div>
                <ArrowRight />
              </button>
            );
          })}
        </div>
      )}
      {toast && createPortal(<div className="toast">✓ {toast}</div>, document.body)}
      {errorToast && createPortal(<div className="toast toast-error">✕ {errorToast}</div>, document.body)}
    </div>
  );
}
function InitiativeTasks({
  item,
  onUpdate,
  onError,
}: {
  item: Item;
  onUpdate: (item: Item) => void;
  onError: (error: unknown, fallback: string) => void;
}) {
  const saveTask = async (task: Item["tareas"][number], estado: string) => {
    const completing = estado === "Completada";
    const reopening = task.completada && estado !== "Completada";
    try {
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
    } catch (error) {
      onError(
        error,
        reopening
          ? "No tienes permisos para reabrir esta tarea"
          : "No se pudo actualizar la tarea.",
      );
    }
  };
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      title = String(new FormData(form).get("titulo") || "").trim();
    if (!title) return;
    try {
      const response = await addInitiativeTask(item.id, { titulo: title }),
        { porcentajeAvance, estadoProyecto, ...saved } = response;
      onUpdate({
        ...item,
        avance: Number(porcentajeAvance ?? item.avance),
        estado: mapProjectStatus(estadoProyecto ?? item.estado),
        tareas: [...item.tareas, saved],
      });
      form.reset();
    } catch (error) {
      onError(error, "No se pudo agregar la tarea.");
    }
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
  user,
  onUpdate,
  onError,
}: {
  item: Item;
  team?: TeamMember[];
  user: User;
  onUpdate: (item: Item) => void;
  onError: (error: unknown, fallback: string) => void;
}) {
  const canManage = canManageInitiative(user, item);
  const [addOpen, setAddOpen] = useState(false),
    [taskError, setTaskError] = useState(""),
    [editTaskItem, setEditTaskItem] = useState<Item["tareas"][number] | null>(null),
    [editTaskError, setEditTaskError] = useState(""),
    [editComment, setEditComment] = useState(""),
    [editSaving, setEditSaving] = useState(false),
    // Ver comentarios/adjuntos de una tarea sin tener que abrir "Editar
    // tarea" — se despliegan inline, aquí mismo en el detalle del proyecto.
    [expandedTaskInfo, setExpandedTaskInfo] = useState<{ id: string; section: "comentarios" | "adjuntos" } | null>(null);
  const saveTask = async (
    task: Item["tareas"][number],
    estado = task.estado,
    comentario?: string,
  ) => {
    try {
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
      return saved;
    } catch (error) {
      onError(error, "No se pudo guardar la tarea.");
      return undefined;
    }
  };
  const openEditTask = (task: Item["tareas"][number]) => {
    setEditTaskError("");
    setEditComment("");
    setEditTaskItem(task);
  };
  const saveEditComment = async () => {
    if (!editTaskItem || !editComment.trim()) return;
    const saved = await saveTask(editTaskItem, editTaskItem.estado, editComment);
    if (!saved) return;
    setEditTaskItem(saved);
    setEditComment("");
  };
  const submitEditTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTaskItem) return;
    const form = event.currentTarget,
      data = new FormData(form),
      titulo = String(data.get("titulo") || "").trim(),
      fechaInicio = String(data.get("fechaInicio") || ""),
      fechaFin = String(data.get("fechaFin") || ""),
      attachment = data.get("adjunto") as File;
    if (!titulo) {
      setEditTaskError("El nombre de la tarea es obligatorio.");
      return;
    }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      setEditTaskError("La fecha estimada de fin no puede ser anterior al inicio.");
      return;
    }
    if (attachment?.size > 3 * 1024 * 1024) {
      setEditTaskError("El archivo adjunto no puede superar los 3 MB.");
      return;
    }
    setEditSaving(true);
    setEditTaskError("");
    try {
      const existing = editTaskItem.adjuntos ?? [];
      const newAttachment = attachment?.size
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
        : [];
      const response = await updateInitiativeTask(item.id, editTaskItem.id, {
        titulo,
        estado: editTaskItem.estado,
        prioridad: String(data.get("prioridad") || "Normal"),
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        recordatorioAt: String(data.get("recordatorioAt") || "") || null,
        responsableId: String(data.get("responsableId") || "") || null,
        adjuntos: [...existing, ...newAttachment],
      });
      const { porcentajeAvance, estadoProyecto, ...saved } = response;
      onUpdate({
        ...item,
        avance: porcentajeAvance,
        estado: mapProjectStatus(estadoProyecto ?? item.estado),
        tareas: item.tareas.map((row) => (row.id === editTaskItem.id ? saved : row)),
      });
      setEditTaskItem(null);
    } catch (cause) {
      setEditTaskError(cause instanceof Error ? cause.message : "No se pudo guardar la tarea.");
      onError(cause, "No se pudo guardar la tarea.");
    } finally {
      setEditSaving(false);
    }
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
    setTaskError("");
    try {
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
      setAddOpen(false);
    } catch (cause) {
      setTaskError(cause instanceof Error ? cause.message : "No se pudo agregar la tarea.");
      onError(cause, "No se pudo agregar la tarea.");
    }
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
                {task.recordatorioAt && (
                  <span>
                    Recordatorio:{" "}
                    {new Date(task.recordatorioAt).toLocaleString("es-PE")}
                  </span>
                )}
              </div>
              <div className="task-assignee">
                <span>Asignado</span>
                <b>
                  <UserRound />
                  {task.responsable
                    ? `${task.responsable.nombres} ${task.responsable.apellidos}`
                    : "Sin asignar"}
                </b>
              </div>
              {(Boolean(task.comentarios?.length) || Boolean(task.adjuntos?.length)) && (
                <div className="task-meta-badges">
                  {Boolean(task.comentarios?.length) && (
                    <button
                      type="button"
                      className={expandedTaskInfo?.id === task.id && expandedTaskInfo.section === "comentarios" ? "active" : ""}
                      onClick={() =>
                        setExpandedTaskInfo((current) =>
                          current?.id === task.id && current.section === "comentarios"
                            ? null
                            : { id: task.id, section: "comentarios" },
                        )
                      }
                    >
                      {task.comentarios!.length} comentario{task.comentarios!.length === 1 ? "" : "s"}
                      <ChevronDown />
                    </button>
                  )}
                  {Boolean(task.adjuntos?.length) && (
                    <button
                      type="button"
                      className={expandedTaskInfo?.id === task.id && expandedTaskInfo.section === "adjuntos" ? "active" : ""}
                      onClick={() =>
                        setExpandedTaskInfo((current) =>
                          current?.id === task.id && current.section === "adjuntos"
                            ? null
                            : { id: task.id, section: "adjuntos" },
                        )
                      }
                    >
                      {task.adjuntos!.length} adjunto{task.adjuntos!.length === 1 ? "" : "s"}
                      <ChevronDown />
                    </button>
                  )}
                </div>
              )}
              {expandedTaskInfo?.id === task.id && expandedTaskInfo.section === "comentarios" && (
                <div className="task-comment-history task-inline-dropdown">
                  {task.comentarios!.map((comment) => (
                    <article key={comment.id}>
                      <div>
                        {comment.usuario.fotoPerfil ? (
                          <img src={comment.usuario.fotoPerfil} alt="" />
                        ) : (
                          <span>
                            {initials(`${comment.usuario.nombres} ${comment.usuario.apellidos}`)}
                          </span>
                        )}
                        <p>
                          <b>{comment.usuario.nombres} {comment.usuario.apellidos}</b>
                          <time>
                            {new Date(comment.createdAt).toLocaleString("es-PE", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </time>
                        </p>
                      </div>
                      <blockquote>{comment.contenido}</blockquote>
                    </article>
                  ))}
                </div>
              )}
              {expandedTaskInfo?.id === task.id && expandedTaskInfo.section === "adjuntos" && (
                <ul className="task-inline-dropdown task-inline-attachments">
                  {task.adjuntos!.map((file, index) => (
                    <li key={`${file.nombre}-${index}`}>
                      <a href={file.data} download={file.nombre}>
                        <Download />
                        {file.nombre}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <div className="task-actions">
                <button type="button" onClick={() => openEditTask(task)}>
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
      {canManage ? (
        <button
          type="button"
          className="open-task-modal"
          onClick={() => setAddOpen(true)}
        >
          <Plus />
          Agregar tarea
        </button>
      ) : (
        <p className="tasks-empty">
          Solo la jefatura del área, quien creó el proyecto o su responsable pueden agregar tareas.
        </p>
      )}
      {addOpen &&
        createPortal(
          <div
            className="task-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setAddOpen(false);
            }}
          >
            <form className="task-create-modal" onSubmit={add}>
              <header className="task-modal-header">
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
              </header>
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
                <DateField name="fechaInicio" label="Fecha de inicio" />
                <DateField name="fechaFin" label="Fin estimado" />
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
          </div>,
          document.body,
        )}
      {editTaskItem &&
        createPortal(
          <div
            className="task-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setEditTaskItem(null);
            }}
          >
            <form className="task-create-modal task-edit-modal" onSubmit={submitEditTask}>
              <header className="task-modal-header">
                <button
                  type="button"
                  className="close"
                  onClick={() => setEditTaskItem(null)}
                >
                  <X />
                </button>
                <div className="modal-icon">
                  <Edit3 />
                </div>
                <h2>Editar tarea</h2>
                <p>Actualiza todos los parámetros de la tarea desde un solo lugar.</p>
              </header>
              <label>
                Título
                <input
                  name="titulo"
                  required
                  minLength={2}
                  maxLength={220}
                  defaultValue={editTaskItem.titulo}
                />
              </label>
              <div className="task-edit-comments">
                <span>Comentarios</span>
                {Boolean(editTaskItem.comentarios?.length) ? (
                  <div className="task-comment-history">
                    {editTaskItem.comentarios!.map((comment) => (
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
                              {comment.usuario.nombres} {comment.usuario.apellidos}
                            </b>
                            <time>
                              {new Date(comment.createdAt).toLocaleString("es-PE", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </time>
                          </p>
                        </div>
                        <blockquote>{comment.contenido}</blockquote>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="tasks-empty">Sin comentarios todavía.</p>
                )}
                <div className="task-comment-compose">
                  <textarea
                    value={editComment}
                    onChange={(event) => setEditComment(event.target.value)}
                    placeholder="Escribe un nuevo comentario"
                    maxLength={600}
                  />
                  <button
                    type="button"
                    disabled={!editComment.trim()}
                    onClick={saveEditComment}
                  >
                    Guardar comentario
                  </button>
                </div>
              </div>
              <div className="two-fields">
                <DateField
                  name="fechaInicio"
                  label="Fecha de inicio"
                  defaultValue={editTaskItem.fechaInicio}
                />
                <DateField
                  name="fechaFin"
                  label="Fin estimado"
                  defaultValue={editTaskItem.fechaFin}
                />
              </div>
              <div className="two-fields">
                <label>
                  Prioridad
                  <select name="prioridad" defaultValue={editTaskItem.prioridad || "Normal"}>
                    <option>Baja</option>
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </select>
                </label>
                <label>
                  Responsable
                  <select name="responsableId" defaultValue={editTaskItem.responsableId ?? ""}>
                    <option value="">Sin asignar</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nombres} {member.apellidos}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Recordatorio
                <input
                  name="recordatorioAt"
                  type="datetime-local"
                  defaultValue={editTaskItem.recordatorioAt?.slice(0, 16) ?? ""}
                />
              </label>
              <div className="task-edit-attachments">
                <span>Adjuntos</span>
                {Boolean(editTaskItem.adjuntos?.length) ? (
                  <ul>
                    {editTaskItem.adjuntos!.map((file, index) => (
                      <li key={`${file.nombre}-${index}`}>
                        <a href={file.data} download={file.nombre}>
                          <Download />
                          {file.nombre}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tasks-empty">Sin adjuntos todavía.</p>
                )}
                <label>
                  Agregar otro adjunto (máx. 3 MB)
                  <input name="adjunto" type="file" />
                </label>
              </div>
              {editTaskError && <div className="auth-error">{editTaskError}</div>}
              <div className="modal-actions">
                <button type="button" onClick={() => setEditTaskItem(null)}>
                  Cancelar
                </button>
                <button className="primary" disabled={editSaving}>
                  {editSaving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
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
  onClearFilters,
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
  onClearFilters: () => void;
}) {
  return (
    <div className="filters">
      <FilterCombobox
        value={area}
        onChange={setArea}
        ariaLabel="Filtrar por área"
        placeholder="Área"
        options={[
          { value: "Todas", label: "Área: Todas" },
          ...areas.map((item) => ({ value: item.nombre, label: item.nombre })),
        ]}
      />
      <FilterCombobox
        value={client}
        onChange={setClient}
        ariaLabel="Filtrar por cliente"
        placeholder="Cliente"
        options={[
          { value: "Todos", label: "Todos los clientes" },
          { value: "Sin cliente", label: "Sin cliente" },
          ...clients.map((value) => ({ value, label: value })),
        ]}
      />
      <span className="filter-menu">
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
          <button onClick={onClearFilters}>
            Limpiar filtros
          </button>
          </div>
        )}
      </span>
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
        <h2>Personalizar proyecto</h2>
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
