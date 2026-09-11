import { ChangeEvent, FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Edit3, FileSpreadsheet, FileText, Layers3, Plus, Target, TrendingUp, Trash2, Upload, Users } from "lucide-react";
import {
  ImportResult,
  MetaMarketing,
  Prospecto,
  ProspectoInput,
  ResumenMarketing,
  createProspecto,
  deleteProspecto,
  downloadMarketingReport,
  fetchMesesMarketing,
  fetchMetaMarketing,
  fetchProspectos,
  fetchResumenMarketing,
  importProspectosBulk,
  updateMetaMarketing,
  updateProspecto,
} from "../api/marketing";
import { canManageMarketing } from "../utils/access";

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");

const HEADER_ALIASES: Record<string, string[]> = {
  fechaContacto: ["fecha", "fechacontacto", "fechadecontacto", "date", "fecharegistro"],
  nombreCliente: ["cliente", "nombre", "nombrecliente", "razonsocial", "contacto"],
  ruc: ["ruc"],
  empresa: ["empresa"],
  celular: ["celular", "telefono", "movil", "numero", "phone", "whatsapp"],
  correo: ["correo", "email", "mail"],
  canal: ["canal", "mediocaptacion", "mediodecaptacion", "medio", "fuente"],
  sistemaEjb: ["sistema", "sistemaejb", "producto", "modulo", "interes"],
  notas: ["notas", "observaciones", "comentario", "comentarios"],
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDateOnly(value: string | Date) {
  const text = value instanceof Date ? value.toISOString() : String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}` : "-";
}

function daysInMonth(anio: number, mes: number) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function extractDateParts(value: unknown): { anio: number; mes: number; dia: number } | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { anio: value.getUTCFullYear(), mes: value.getUTCMonth() + 1, dia: value.getUTCDate() };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Fecha serial de Excel (días desde 1899-12-30).
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  }
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    // dd/mm/aaaa (o dd-mm, dd.mm), con año opcional: en el Excel de Marketing
    // las fechas van en formato día/mes, no mes/día como asume `Date` por defecto.
    const diaMes = text.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
    if (diaMes) {
      const dia = Number(diaMes[1]), mes = Number(diaMes[2]);
      let anio = diaMes[3] ? Number(diaMes[3]) : new Date().getFullYear();
      if (anio < 100) anio += 2000;
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) return { anio, mes, dia };
    }
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return { anio: Number(iso[1]), mes: Number(iso[2]), dia: Number(iso[3]) };
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return { anio: parsed.getUTCFullYear(), mes: parsed.getUTCMonth() + 1, dia: parsed.getUTCDate() };
  }
  return undefined;
}

/**
 * Convierte el valor crudo de la celda a una fecha ISO (aaaa-mm-dd). Cuando se
 * indica `mesForzado` (el mes que corresponde según el nombre de la pestaña,
 * p.ej. "ABRIL"), se usa ese mes en vez del que traiga la celda: el Excel
 * original tiene fechas corrompidas por el autocompletado de Google Sheets
 * (arrastran el mes en vez del día), pero el día y el año de la celda siguen
 * siendo confiables.
 */
function toIsoDate(value: unknown, mesForzado?: number): string | undefined {
  const parts = extractDateParts(value);
  if (!parts) return undefined;
  const mes = mesForzado ?? parts.mes;
  // Excel interpreta fechas ambiguas como MM/DD. En una hoja mensual esto
  // convierte, por ejemplo, 02/09 (2 de septiembre) en 9 de febrero:
  // mes interno=2, día interno=9. Si el día interno coincide con el mes de
  // la pestaña, el mes interno es en realidad el día que escribió el usuario.
  const diaOriginal = mesForzado !== undefined && parts.dia === mesForzado && parts.mes !== mesForzado
    ? parts.mes
    : parts.dia;
  const dia = Math.min(diaOriginal, daysInMonth(parts.anio, mes));
  return `${parts.anio}-${pad2(mes)}-${pad2(dia)}`;
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Si el nombre de la pestaña contiene el nombre de un mes en español, se usa
 * como el mes real de todas sus filas (ver nota en `toIsoDate`). */
function monthFromSheetName(hoja: string): number | undefined {
  const norm = normalizeKey(hoja);
  for (const [nombre, numero] of Object.entries(SPANISH_MONTHS)) {
    if (norm.includes(nombre)) return numero;
  }
  return undefined;
}

type ImportRow = ProspectoInput & { _fila: number; _hoja: string; _problemas: string[] };

/**
 * Algunas hojas (como el Excel original de Marketing) tienen un título
 * decorativo en la fila 1 y los encabezados reales más abajo. Se busca entre
 * las primeras filas cuál calza mejor con los campos conocidos, en vez de
 * asumir que la fila 1 siempre es el encabezado.
 */
function detectHeader(grid: unknown[][]) {
  let best: { rowIndex: number; columnMap: Record<string, number>; score: number } | null = null;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = grid[r] ?? [];
    const columnMap: Record<string, number> = {};
    for (let c = 0; c < row.length; c++) {
      const key = normalizeKey(row[c]);
      if (!key) continue;
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (columnMap[field] === undefined && aliases.includes(key)) columnMap[field] = c;
      }
    }
    const score = Object.keys(columnMap).length;
    if (score >= 3 && (!best || score > best.score)) best = { rowIndex: r, columnMap, score };
  }
  return best;
}

/** Solo se leen las columnas que calzaron con un encabezado conocido (p.ej. hasta
 * la columna del "SISTEMA EJB"); cualquier panel o gráfico a la derecha se ignora. */
function parseSheetRows(grid: unknown[][], hoja: string): ImportRow[] {
  const header = detectHeader(grid);
  if (!header) return [];
  const { rowIndex, columnMap } = header;
  const mesForzado = monthFromSheetName(hoja);
  const get = (row: unknown[], field: string) => {
    const col = columnMap[field];
    return col === undefined ? "" : String(row[col] ?? "").trim();
  };
  const rows: ImportRow[] = [];
  for (let r = rowIndex + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const fechaContacto = toIsoDate(columnMap.fechaContacto !== undefined ? row[columnMap.fechaContacto] : undefined, mesForzado);
    const nombreCliente = get(row, "nombreCliente");
    const canal = get(row, "canal");
    const sistemaEjb = get(row, "sistemaEjb");
    const ruc = get(row, "ruc");
    const empresa = get(row, "empresa");
    const celular = get(row, "celular");
    const correo = get(row, "correo");
    const notas = get(row, "notas");
    // Sin fecha, cliente/empresa, canal ni sistema: es una fila separadora
    // ("CIERRE DE MES", "FIN DE SEMANA"...) o vacía de la plantilla, no un prospecto.
    const nombreEfectivo = nombreCliente || empresa;
    const isBlank = !fechaContacto && !nombreEfectivo && !canal && !sistemaEjb;
    if (isBlank) continue;
    const problemas: string[] = [];
    if (!fechaContacto) problemas.push("fecha inválida o vacía");
    if (!nombreEfectivo) problemas.push("falta el cliente");
    rows.push({
      _fila: r + 1,
      _hoja: hoja,
      _problemas: problemas,
      fechaContacto: fechaContacto ?? "",
      nombreCliente: nombreEfectivo,
      ruc: ruc || undefined,
      empresa: empresa || undefined,
      celular: celular || undefined,
      correo: correo || undefined,
      // El canal y el sistema pueden faltar en registros históricos: se
      // guarda igual el prospecto en vez de descartarlo por un dato de menos.
      canal: canal || "Sin especificar",
      sistemaEjb: sistemaEjb || "Sin especificar",
      notas: notas || undefined,
    });
  }
  return rows;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const CANALES = [
  "SOCIAL MEDIA",
  "GOOGLE ADS",
  "DIFUSIÓN COMERCIAL",
  "SOCIAL MEDIA/REACTIVACIÓN",
  "B2B/REACTIVACIÓN",
  "PUBLICIDAD PARTNER",
];
const SISTEMAS = [
  "EJB CONTABLE",
  "EJB PLANILLA",
  "EJB ERP",
  "EJB COMERCIAL",
  "EJB INFORMES BI",
  "EJB ACTIVO FIJO",
  "EJB PRODUCCIÓN",
  "EJB TALLERES",
  "EJB ALMACENES",
  "EJB PAGOS",
  "EJB MÓVIL",
  "EJB FACTURACIÓN",
  "EJB COBRANZAS",
  "EJB LOGÍSTICA",
  "EJB PEDIDOS",
];

type MarketingColor = { background: string; foreground: string };

const CANAL_COLORS: Record<string, MarketingColor> = {
  socialmedia: { background: "#39745a", foreground: "#ffffff" },
  googleads: { background: "#8ec84a", foreground: "#ffffff" },
  difusioncomercial: { background: "#3679f5", foreground: "#ffffff" },
  socialmediareactivacion: { background: "#f08b18", foreground: "#ffffff" },
  b2breactivacion: { background: "#5234e7", foreground: "#ffffff" },
  publicidadpartner: { background: "#1118ee", foreground: "#ffffff" },
};

const SISTEMA_COLORS: Record<string, MarketingColor> = {
  ejbcontable: { background: "#2367a5", foreground: "#ffffff" },
  ejbplanilla: { background: "#2473c5", foreground: "#ffffff" },
  ejberp: { background: "#c5e4fb", foreground: "#25638f" },
  ejbcomercial: { background: "#93744b", foreground: "#ffffff" },
  ejbinformesbi: { background: "#79aa50", foreground: "#ffffff" },
  ejbactivofijo: { background: "#d7191c", foreground: "#ffffff" },
  ejbproduccion: { background: "#764998", foreground: "#ffffff" },
  ejbtalleres: { background: "#8a5d40", foreground: "#ffffff" },
  ejbalmacenes: { background: "#f0d63d", foreground: "#365314" },
  ejbpagos: { background: "#34a853", foreground: "#ffffff" },
  ejbmovil: { background: "#35c68a", foreground: "#ffffff" },
  ejbfacturacion: { background: "#d8d8d8", foreground: "#4b5563" },
  ejbcobranzas: { background: "#45b83f", foreground: "#ffffff" },
  ejblogistica: { background: "#f1b500", foreground: "#443500" },
  ejbpedidos: { background: "#ef3939", foreground: "#ffffff" },
};

function marketingColor(value: string, palette: Record<string, MarketingColor>) {
  return palette[normalizeKey(value)] ?? { background: "var(--e-soft)", foreground: "var(--e-text)" };
}

function marketingColorStyle(value: string, palette: Record<string, MarketingColor>): CSSProperties {
  const color = marketingColor(value, palette);
  return {
    "--marketing-tag-bg": color.background,
    "--marketing-tag-fg": color.foreground,
  } as CSSProperties;
}

function canonicalCatalogValue(value: string, options: string[]) {
  return options.find((option) => normalizeKey(option) === normalizeKey(value)) ?? value;
}

function splitSystemValues(value: string) {
  return value
    .split(/[,;|\n]+|(?=\bEJB\s+)/i)
    .map((item) => item.replace(/^[\s/]+|[\s/]+$/g, "").trim())
    .filter(Boolean);
}

function systemTags(value: string) {
  return (
    <span className="marketing-tags">
      {splitSystemValues(value).map((system, index) => (
        <span className="marketing-tag" style={marketingColorStyle(system, SISTEMA_COLORS)} key={`${system}-${index}`}>
          {system}
        </span>
      ))}
    </span>
  );
}

const emptyForm: ProspectoInput = {
  fechaContacto: new Date().toISOString().slice(0, 10),
  nombreCliente: "",
  ruc: "",
  empresa: "",
  celular: "",
  correo: "",
  canal: CANALES[0],
  sistemaEjb: SISTEMAS[0],
  notas: "",
};

export function MarketingCenter({ user }: { user: any }) {
  const canManage = canManageMarketing(user);
  const hoy = new Date();
  const [periodos, setPeriodos] = useState<{ anio: number; mes: number }[]>([
    { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 },
  ]);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [resumen, setResumen] = useState<ResumenMarketing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProspectoInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ metaMensual: "", metaSemanal: "" });
  const [savingMeta, setSavingMeta] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const monthTabsRef = useRef<HTMLDivElement>(null);
  const scrollMonths = (direction: 1 | -1) => {
    monthTabsRef.current?.scrollBy({ left: direction * 240, behavior: "smooth" });
  };

  useEffect(() => {
    void fetchMesesMarketing().then(setPeriodos).catch(() => undefined);
  }, []);

  useEffect(() => {
    monthTabsRef.current?.querySelector(".active")?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [periodos, anio, mes]);

  const load = async (targetAnio: number, targetMes: number) => {
    setLoading(true);
    setError("");
    try {
      const [rows, sum] = await Promise.all([
        fetchProspectos(targetAnio, targetMes),
        fetchResumenMarketing(targetAnio, targetMes),
      ]);
      setProspectos(rows);
      setResumen(sum);
      setMetaDraft({
        metaMensual: String(sum.proyeccion.metaMensual),
        metaSemanal: String(sum.proyeccion.metaSemanal),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar Marketing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(anio, mes); }, [anio, mes]);

  const startEdit = (row: Prospecto) => {
    setEditingId(row.id);
    setForm({
      fechaContacto: row.fechaContacto.slice(0, 10),
      nombreCliente: row.nombreCliente,
      ruc: row.ruc ?? "",
      empresa: row.empresa ?? "",
      celular: row.celular ?? "",
      correo: row.correo ?? "",
      canal: canonicalCatalogValue(row.canal, CANALES),
      sistemaEjb: canonicalCatalogValue(row.sistemaEjb, SISTEMAS),
      notas: row.notas ?? "",
    });
    setFormOpen(true);
  };

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setFormOpen(false); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) await updateProspecto(editingId, form);
      else await createProspecto(form);
      resetForm();
      await load(anio, mes);
      const meses = await fetchMesesMarketing();
      setPeriodos(meses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el prospecto");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Prospecto) => {
    if (!confirm(`¿Eliminar el prospecto de ${row.nombreCliente}?`)) return;
    try {
      await deleteProspecto(row.id);
      await load(anio, mes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el prospecto");
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setImportResult(null);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const rows: ImportRow[] = [];
      for (const sheetName of book.SheetNames) {
        const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, defval: "" });
        rows.push(...parseSheetRows(grid, sheetName));
      }
      if (!rows.length) {
        setError("No se reconocieron columnas de fecha, cliente, canal o sistema en ninguna hoja del archivo.");
        return;
      }
      setImportRows(rows.slice(0, 500));
    } catch {
      setError("No se pudo leer el archivo. Verifica que sea un Excel válido (.xlsx).");
    }
  };

  const confirmImport = async () => {
    if (!importRows) return;
    const validRows = importRows.filter((row) => !row._problemas.length);
    if (!validRows.length) return;
    setImporting(true);
    setError("");
    try {
      const result = await importProspectosBulk(validRows.map(({ _fila, _hoja, _problemas, ...row }) => row));
      setImportResult(result);
      setImportRows(null);
      await load(anio, mes);
      setPeriodos(await fetchMesesMarketing());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar el archivo");
    } finally {
      setImporting(false);
    }
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    setError("");
    try {
      const metaMensual = Number(metaDraft.metaMensual);
      const metaSemanal = Number(metaDraft.metaSemanal);
      const row: MetaMarketing = await updateMetaMarketing(anio, mes, { metaMensual, metaSemanal });
      setResumen((current) => current && {
        ...current,
        proyeccion: { ...current.proyeccion, metaMensual: row.metaMensual, metaSemanal: row.metaSemanal },
      });
      await load(anio, mes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la meta");
    } finally {
      setSavingMeta(false);
    }
  };

  const exportMonthlyReport = async () => {
    if (!prospectos.length) return;
    setExporting(true);
    setError("");
    try {
      await downloadMarketingReport(anio, mes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el reporte mensual");
    } finally {
      setExporting(false);
    }
  };

  const proyeccion = resumen?.proyeccion;
  const enMeta = (proyeccion?.diferencia ?? 0) >= 0;
  const avancePct = proyeccion?.metaMensual
    ? Math.max(0, Math.min(100, Math.round((proyeccion.proyeccionFinDeMes / proyeccion.metaMensual) * 100)))
    : 0;
  const multiproductoCantidad = resumen?.multiproducto?.cantidad
    ?? prospectos.filter((row) => splitSystemValues(row.sistemaEjb).length >= 2).length;
  const multiproductoPorcentaje = resumen?.multiproducto?.porcentaje
    ?? (prospectos.length ? Math.round((multiproductoCantidad / prospectos.length) * 100) : 0);

  return (
    <div className="suite-grid suite-dashboard marketing-center">
      <section className="suite-hero">
        <TrendingUp />
        <div>
          <span>MARKETING</span>
          <h2>Prospectos y proyección de cierre de mes</h2>
          <p>Registra los prospectos captados y sigue el ritmo frente a la meta mensual, mes a mes.</p>
        </div>
      </section>

      <div className="marketing-month-nav-wrap">
        <button type="button" className="marketing-month-nav prev" aria-label="Meses anteriores" onClick={() => scrollMonths(-1)}>
          <ChevronLeft />
        </button>
        <div className="suite-tabs marketing-month-tabs" ref={monthTabsRef}>
          {periodos.map((p) => (
            <button
              type="button"
              key={`${p.anio}-${p.mes}`}
              className={anio === p.anio && mes === p.mes ? "active" : ""}
              onClick={() => { setAnio(p.anio); setMes(p.mes); }}
            >
              {MESES[p.mes - 1]} {p.anio}
            </button>
          ))}
        </div>
        <button type="button" className="marketing-month-nav next" aria-label="Meses siguientes" onClick={() => scrollMonths(1)}>
          <ChevronRight />
        </button>
      </div>

      {error && <div className="reporting-error">{error}</div>}

      <div className="suite-kpis">
        <article className="suite-kpi blue">
          <span className="suite-kpi-icon"><Users /></span>
          <b>{loading ? "…" : proyeccion?.prospectosCaptados ?? 0}</b>
          <span>Prospectos captados</span>
        </article>
        <article className="suite-kpi violet">
          <span className="suite-kpi-icon"><TrendingUp /></span>
          <b>{loading ? "…" : proyeccion?.ritmoDiario ?? 0}</b>
          <span>Ritmo diario promedio</span>
        </article>
        <article className={`suite-kpi ${enMeta ? "green" : "red"}`}>
          <span className="suite-kpi-icon"><Target /></span>
          <b>{loading ? "…" : proyeccion?.proyeccionFinDeMes ?? 0}</b>
          <span>Proyección de cierre de mes</span>
        </article>
        <article className="suite-kpi amber">
          <span className="suite-kpi-icon"><Layers3 /></span>
          <b>{loading ? "…" : `${multiproductoPorcentaje}%`}</b>
          <span>Oportunidad multiproducto</span>
          <small className="marketing-kpi-detail">
            {loading ? "Calculando..." : `${multiproductoCantidad} de ${prospectos.length} prospectos con 2+ sistemas`}
          </small>
        </article>
      </div>

      <section className="suite-card suite-span marketing-status-card">
        <h3>Estado del mes</h3>
        <div className="marketing-status-body">
          <div className="donut" style={{ "--value": `${avancePct}%` } as CSSProperties}>
            <div>
              <strong>{avancePct}%</strong>
              <small>de la meta</small>
            </div>
          </div>
          <div className="marketing-status-info">
            <p className={`marketing-status-banner ${enMeta ? "positivo" : "negativo"}`}>
              {proyeccion?.estado ?? "Cargando…"}
            </p>
            <div className="marketing-status-facts">
              <span>Día {proyeccion?.diaActualMes} de {proyeccion?.diasTotalesMes}</span>
              <span>Ritmo necesario para el resto del mes: <b>{String(proyeccion?.ritmoNecesarioDia ?? "-")}</b></span>
            </div>
            {canManage && (
              <div className="marketing-meta-form">
                <label>
                  Meta mensual
                  <input type="number" min={0} value={metaDraft.metaMensual}
                    onChange={(e) => setMetaDraft((v) => ({ ...v, metaMensual: e.target.value }))} />
                </label>
                <label>
                  Meta semanal
                  <input type="number" min={0} value={metaDraft.metaSemanal}
                    onChange={(e) => setMetaDraft((v) => ({ ...v, metaSemanal: e.target.value }))} />
                </label>
                <button type="button" className="primary" disabled={savingMeta} onClick={() => void saveMeta()}>
                  {savingMeta ? "Guardando…" : "Guardar meta"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="suite-card">
        <h3>Prospectos por canal</h3>
        <div className="area-bars">
          {Object.entries(resumen?.porCanal ?? {}).map(([canal, count]) => (
            <div key={canal}>
              <span>{canal}<b>{count}</b></span>
              <div><i style={{ width: `${proyeccion?.prospectosCaptados ? Math.round((count / proyeccion.prospectosCaptados) * 100) : 0}%`, background: marketingColor(canal, CANAL_COLORS).background }} /></div>
            </div>
          ))}
          {!Object.keys(resumen?.porCanal ?? {}).length && <span className="marketing-empty-hint">Sin datos este mes.</span>}
        </div>
      </section>
      <section className="suite-card">
        <h3>Prospectos por sistema EJB</h3>
        <div className="area-bars">
          {Object.entries(resumen?.porSistema ?? {}).map(([sistema, count]) => (
            <div key={sistema}>
              <span>{sistema}<b>{count}</b></span>
              <div><i style={{ width: `${proyeccion?.prospectosCaptados ? Math.round((count / proyeccion.prospectosCaptados) * 100) : 0}%`, background: marketingColor(sistema, SISTEMA_COLORS).background }} /></div>
            </div>
          ))}
          {!Object.keys(resumen?.porSistema ?? {}).length && <span className="marketing-empty-hint">Sin datos este mes.</span>}
        </div>
      </section>

      <section className="suite-card suite-span">
        <div className="suite-toolbar">
          <h3>Prospectos de {MESES[mes - 1]} {anio}</h3>
          <button
            type="button"
            disabled={loading || exporting || !prospectos.length}
            onClick={() => void exportMonthlyReport()}
          >
            <FileText /> {exporting ? "Generando PDF..." : "Exportar reporte PDF"}
          </button>
          {canManage && (
            <>
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => void handleFile(e)} />
              <button type="button" onClick={() => fileInput.current?.click()}>
                <Upload /> Importar Excel
              </button>
              <button type="button" className="primary" onClick={() => (formOpen ? resetForm() : setFormOpen(true))}>
                <Plus /> {formOpen ? "Cancelar" : "Nuevo prospecto"}
              </button>
            </>
          )}
        </div>
        {importResult && (
          <div className={importResult.errors.length ? "reporting-error" : "marketing-import-ok"}>
            {importResult.created} prospecto(s) importado(s).
            {importResult.skipped > 0 && ` ${importResult.skipped} duplicado(s) omitido(s).`}
            {importResult.errors.length > 0 && ` ${importResult.errors.length} fila(s) con observaciones: ${importResult.errors.map((e) => `fila ${e.fila} (${e.message})`).join("; ")}`}
          </div>
        )}
        {importRows && canManage && (
          <div className="marketing-import-preview">
            <h4><FileSpreadsheet /> Vista previa: {importRows.filter((r) => !r._problemas.length).length} de {importRows.length} filas listas para importar</h4>
            <div className="suite-table">
              <table>
                <thead><tr><th>Hoja</th><th>Fila</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Sistema</th><th>Estado</th></tr></thead>
                <tbody>
                  {importRows.map((row, index) => (
                    <tr key={`${row._hoja}-${row._fila}-${index}`} className={row._problemas.length ? "marketing-import-row-error" : ""}>
                      <td>{row._hoja}</td>
                      <td>{row._fila}</td>
                      <td>{row.fechaContacto ? formatDateOnly(row.fechaContacto) : "-"}</td>
                      <td>{row.nombreCliente || "-"}</td>
                      <td>{row.canal ? <span className="marketing-tag" style={marketingColorStyle(row.canal, CANAL_COLORS)}>{row.canal}</span> : "-"}</td>
                      <td>{row.sistemaEjb ? systemTags(row.sistemaEjb) : "-"}</td>
                      <td>{row._problemas.length ? row._problemas.join(", ") : "Lista"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="marketing-import-actions">
              <button type="button" onClick={() => setImportRows(null)}>Cancelar</button>
              <button type="button" className="primary" disabled={importing || !importRows.some((r) => !r._problemas.length)} onClick={() => void confirmImport()}>
                {importing ? "Importando…" : "Confirmar importación"}
              </button>
            </div>
          </div>
        )}
        {formOpen && canManage && (
          <form className="suite-form" onSubmit={submit}>
            <label>Fecha de contacto
              <input type="date" required value={form.fechaContacto}
                onChange={(e) => setForm((v) => ({ ...v, fechaContacto: e.target.value }))} />
            </label>
            <label>Nombre del cliente
              <input required maxLength={160} value={form.nombreCliente}
                onChange={(e) => setForm((v) => ({ ...v, nombreCliente: e.target.value }))} />
            </label>
            <label>RUC
              <input maxLength={20} value={form.ruc}
                onChange={(e) => setForm((v) => ({ ...v, ruc: e.target.value }))} />
            </label>
            <label>Empresa
              <input maxLength={160} value={form.empresa}
                onChange={(e) => setForm((v) => ({ ...v, empresa: e.target.value }))} />
            </label>
            <label>Celular (opcional)
              <input maxLength={30} value={form.celular}
                onChange={(e) => setForm((v) => ({ ...v, celular: e.target.value }))} />
            </label>
            <label>Correo (opcional)
              <input type="text" maxLength={160} value={form.correo}
                onChange={(e) => setForm((v) => ({ ...v, correo: e.target.value }))} />
            </label>
            <label>Canal de captación
              <select className="marketing-color-select" style={marketingColorStyle(form.canal, CANAL_COLORS)} value={form.canal} onChange={(e) => setForm((v) => ({ ...v, canal: e.target.value }))}>
                {!CANALES.some((c) => normalizeKey(c) === normalizeKey(form.canal)) && <option>{form.canal}</option>}
                {CANALES.map((c) => {
                  const color = marketingColor(c, CANAL_COLORS);
                  return <option key={c} style={{ backgroundColor: color.background, color: color.foreground }}>{c}</option>;
                })}
              </select>
            </label>
            <label>Sistema EJB de interés
              <select className="marketing-color-select" style={marketingColorStyle(form.sistemaEjb, SISTEMA_COLORS)} value={form.sistemaEjb} onChange={(e) => setForm((v) => ({ ...v, sistemaEjb: e.target.value }))}>
                {!SISTEMAS.some((s) => normalizeKey(s) === normalizeKey(form.sistemaEjb)) && <option>{form.sistemaEjb}</option>}
                {SISTEMAS.map((s) => {
                  const color = marketingColor(s, SISTEMA_COLORS);
                  return <option key={s} style={{ backgroundColor: color.background, color: color.foreground }}>{s}</option>;
                })}
              </select>
            </label>
            <label>Notas
              <textarea maxLength={2000} value={form.notas}
                onChange={(e) => setForm((v) => ({ ...v, notas: e.target.value }))} />
            </label>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Registrar prospecto"}
            </button>
          </form>
        )}
        <div className="suite-table marketing-prospects-table">
          <table>
            <thead>
              <tr>
                <th>N°</th><th>Fecha</th><th>Cliente</th><th>RUC</th><th>Empresa</th>
                <th>Contacto</th><th>Canal</th><th>Sistema</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {prospectos.map((row, index) => (
                <tr key={row.id}>
                  <td><b>{index + 1}</b></td>
                  <td>{formatDateOnly(row.fechaContacto)}</td>
                  <td><b>{row.nombreCliente}</b>{row.creadoPor && <small>Registrado por {row.creadoPor.nombres}</small>}</td>
                  <td>{row.ruc || "-"}</td>
                  <td>{row.empresa || "-"}</td>
                  <td>{row.celular || row.correo || "-"}</td>
                  <td><span className="marketing-tag" style={marketingColorStyle(row.canal, CANAL_COLORS)}>{row.canal}</span></td>
                  <td>{systemTags(row.sistemaEjb)}</td>
                  {canManage && (
                    <td>
                      <div className="report-format-actions">
                        <button type="button" className="report-pdf-button" onClick={() => startEdit(row)}><Edit3 /></button>
                        <button type="button" className="report-pdf-button" onClick={() => void remove(row)}><Trash2 /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !prospectos.length && (
            <div className="suite-empty">Sin prospectos registrados en {MESES[mes - 1]} {anio}.</div>
          )}
        </div>
      </section>
    </div>
  );
}
