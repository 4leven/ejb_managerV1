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

export type Prospecto = {
  id: string;
  fechaContacto: string;
  nombreCliente: string;
  ruc?: string | null;
  empresa?: string | null;
  celular?: string | null;
  correo?: string | null;
  canal: string;
  sistemaEjb: string;
  notas?: string | null;
  creadoPor?: { id: string; nombres: string; apellidos: string } | null;
};

export type ProspectoInput = {
  fechaContacto: string;
  nombreCliente: string;
  ruc?: string;
  empresa?: string;
  celular?: string;
  correo?: string;
  canal: string;
  sistemaEjb: string;
  notas?: string;
};

export type ProyeccionMarketing = {
  anio: number;
  mes: number;
  diasTotalesMes: number;
  diaActualMes: number;
  diasRestantes: number;
  prospectosCaptados: number;
  ritmoDiario: number;
  proyeccionFinDeMes: number;
  metaMensual: number;
  metaSemanal: number;
  diferencia: number;
  estado: string;
  ritmoNecesarioDia: number | string;
};

export type ResumenMarketing = {
  proyeccion: ProyeccionMarketing;
  porCanal: Record<string, number>;
  porSistema: Record<string, number>;
  multiproducto: { cantidad: number; porcentaje: number };
};

export type MetaMarketing = {
  id: string;
  anio: number;
  mes: number;
  metaMensual: number;
  metaSemanal: number;
};

const periodo = (anio: number, mes: number) => `anio=${anio}&mes=${mes}`;

export const fetchProspectos = (anio: number, mes: number): Promise<Prospecto[]> =>
  jsonRequest(`/marketing/prospectos?${periodo(anio, mes)}`);

export const createProspecto = (data: ProspectoInput): Promise<Prospecto> =>
  jsonRequest("/marketing/prospectos", { method: "POST", body: JSON.stringify(data) });

export type ImportResult = { created: number; skipped: number; errors: { fila: number; message: string }[] };

export const importProspectosBulk = (rows: Record<string, unknown>[]): Promise<ImportResult> =>
  jsonRequest("/marketing/prospectos/importar", { method: "POST", body: JSON.stringify({ rows }) });

export const updateProspecto = (id: string, data: Partial<ProspectoInput>): Promise<Prospecto> =>
  jsonRequest(`/marketing/prospectos/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteProspecto = (id: string): Promise<{ ok: true }> =>
  jsonRequest(`/marketing/prospectos/${id}`, { method: "DELETE" });

export const fetchResumenMarketing = (anio: number, mes: number): Promise<ResumenMarketing> =>
  jsonRequest(`/marketing/resumen?${periodo(anio, mes)}`);

export async function downloadMarketingReport(anio: number, mes: number) {
  const response = await fetch(`${API_URL}/marketing/reporte?${periodo(anio, mes)}`, { headers: authHeaders() });
  if (!response.ok) {
    const body = await readJsonSafely(response);
    throw new Error(apiError(body, "No se pudo generar el reporte PDF"));
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    ?? `reporte-prospectos-${anio}-${String(mes).padStart(2, "0")}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const fetchMesesMarketing = (): Promise<{ anio: number; mes: number }[]> =>
  jsonRequest("/marketing/meses");

export const fetchMetaMarketing = (anio: number, mes: number): Promise<MetaMarketing> =>
  jsonRequest(`/marketing/meta?${periodo(anio, mes)}`);

export const updateMetaMarketing = (
  anio: number,
  mes: number,
  data: { metaMensual?: number; metaSemanal?: number },
): Promise<MetaMarketing> =>
  jsonRequest(`/marketing/meta?${periodo(anio, mes)}`, { method: "PATCH", body: JSON.stringify(data) });
