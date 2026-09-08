import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  createFlow,
  addFlowVersion,
  deleteFlow,
  createRequirement,
  deleteRequirement,
  fetchFlows,
  fetchRequirements,
  requestChange,
  updateRequirement,
} from "../api/iniciativas";
import { uiAlert, uiConfirm, uiPrompt } from "../utils/dialog";
import { canDeleteOwned, isAdministrationUser, canOperateGlobally } from "../utils/access";

const statuses = [
  "Pendiente",
  "En curso",
  "Aprobado",
  "Entregado",
  "Desaprobado",
];
const requirementAreaColor = (areaName = "", fallback = "#2f6fed") => {
  const normalized = areaName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const palette: Record<string, string> = {
    MARKETING: "#6fcf97",
    GERENCIA: "#f79009",
    "CONSULTORIA PLANILLA": "#eaaa08",
    "CONSULTORIA CONTABLE": "#2f6fed",
    PROYECTOS: "#8b5cf6",
    SISTEMAS: "#14b8a6",
    VENTAS: "#ef4444",
    "INNOVACION Y PRODUCTO": "#1683ff",
    ADMINISTRACION: "#ec4899",
  };
  return palette[normalized] || fallback;
};
export function Requirements({ user }: { user: any }) {
  const [rows, setRows] = useState<any[]>([]),
    [modal, setModal] = useState(false);
  const load = () => fetchRequirements().then(setRows);
  useEffect(() => {
    load();
  }, []);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await createRequirement({
      titulo: String(f.get("titulo")),
      descripcion: String(f.get("descripcion")),
      cantidad: Number(f.get("cantidad")),
      prioridad: String(f.get("prioridad")),
      estado: "Pendiente",
      fechaNecesaria: String(f.get("fechaNecesaria")),
    });
    setModal(false);
    load();
  };
  const edit = async (r: any) => {
    const titulo = await uiPrompt("Editar requerimiento", r.titulo, {
      message: "Nombre del producto o recurso solicitado.",
    });
    if (!titulo) return;
    const descripcion = await uiPrompt(
      "Detalle del requerimiento",
      r.descripcion ?? "",
      { multiline: true },
    );
    if (descripcion === null) return;
    const cantidad = Number(await uiPrompt("Cantidad", String(r.cantidad)));
    if (!cantidad) return;
    if (canOperateGlobally(user)||isAdministrationUser(user)||r.usuario.id===user.id)
      await updateRequirement(r.id, { titulo, descripcion, cantidad });
    else {
      const motivo = await uiPrompt("Motivo del cambio", "", {
        multiline: true,
      });
      if (!motivo) return;
      await requestChange({
        tipoEntidad: "Requerimiento",
        entidadId: r.id,
        accion: "Editar",
        payload: { titulo, descripcion, cantidad },
        motivo,
      });
      await uiAlert(
        "Solicitud enviada",
        "El cambio será aplicado al completar la ruta de aprobación.",
      );
    }
    load();
  };
  const remove = async (r: any) => {
    if (
      await uiConfirm(
        "Eliminar requerimiento",
        `¿Deseas eliminar “${r.titulo}”?`,
      )
    ) {
      if (canDeleteOwned(user,r.usuario.id,r.area.id)) await deleteRequirement(r.id);
      else {
        const motivo = await uiPrompt("Motivo de eliminación", "", {
          multiline: true,
        });
        if (!motivo) return;
        await requestChange({
          tipoEntidad: "Requerimiento",
          entidadId: r.id,
          accion: "Eliminar",
          motivo,
        });
        await uiAlert(
          "Solicitud enviada",
          "El requerimiento seguirá visible hasta que sea aprobado.",
        );
      }
      load();
    }
  };
  const setStatus = async (r: any, estado: string) => {
    await updateRequirement(r.id, { estado });
    load();
  };
  const isAdministration = isAdministrationUser(user),
    canOwn = (r: any) => canOperateGlobally(user) || r.usuario.id === user.id;
  return (
    <>
      <div className="module-actions">
        <div className="request-intro">
          <ClipboardList />
          <div>
            <b>Solicitudes internas</b>
            <small>Café, útiles, materiales, equipos y otros recursos.</small>
          </div>
        </div>
        <button className="primary" onClick={() => setModal(true)}>
          <Plus />
          Nuevo requerimiento
        </button>
      </div>
      <div className="request-grid">
        {rows.map((r) => {
          const areaColor = requirementAreaColor(r.area?.nombre, r.area?.colorHex);
          return (
          <article className="requirement-card" key={r.id} style={{ "--request-area": areaColor } as CSSProperties}>
            <header className="requirement-card-header">
              <span className="requirement-area-icon"><ClipboardList /></span>
              <div>
                <small>Área solicitante</small>
                <b>{r.area?.nombre || "Sin área"}</b>
              </div>
              <span className={`request-priority ${String(r.prioridad || "Normal").toLowerCase()}`}>
                {r.prioridad || "Normal"}
              </span>
            </header>
            <div className="requirement-card-copy">
              <h3>{r.titulo}</h3>
              <p>{r.descripcion || "Sin descripción"}</p>
            </div>
            <div className="requirement-meta-grid">
              <span><Package /><small>Cantidad</small><b>{r.cantidad} unidad(es)</b></span>
              <span><CalendarDays /><small>Fecha necesaria</small><b>{r.fechaNecesaria ? new Date(`${r.fechaNecesaria}T12:00:00`).toLocaleDateString("es-PE") : "Sin fecha"}</b></span>
              <span className="requirement-requester"><UserRound /><small>Solicitado por</small><b>{r.usuario.nombres} {r.usuario.apellidos}</b><em>{new Date(r.createdAt).toLocaleDateString("es-PE")}</em></span>
            </div>
            <div className="requirement-footer">
              <span className={`requirement-status status-${String(r.estado || "Pendiente").toLowerCase().replaceAll(" ", "-")}`}>{r.estado}</span>
              {isAdministration || canOperateGlobally(user) ? (
                <select
                  aria-label={`Estado de ${r.titulo}`}
                  value={statuses.includes(r.estado) ? r.estado : "Pendiente"}
                  onChange={(e) => setStatus(r, e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : null}
              <div className="requirement-actions">
                {(canOwn(r)||isAdministration) && (
                  <button onClick={() => edit(r)}>
                    <Pencil />
                    Editar
                  </button>
                )}
                {canDeleteOwned(user,r.usuario.id,r.area.id) && (
                  <button className="danger" onClick={() => remove(r)}>
                    <Trash2 />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </article>
        )})}
        {!rows.length && <div className="requirement-empty"><ClipboardList /><b>No hay requerimientos registrados</b><span>Las solicitudes internas aparecerán aquí cuando se registren.</span></div>}
      </div>
      {modal && (
        <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}>
          <form className="event-modal" onSubmit={submit}>
            <button
              type="button"
              className="close"
              aria-label="Cerrar"
              onClick={() => setModal(false)}
            >
              <X />
            </button>
            <ClipboardList />
            <h2>Nuevo requerimiento</h2>
            <div className="requester-summary">
              <label>
                Solicitante
                <input value={`${user.nombres} ${user.apellidos}`} readOnly />
              </label>
              <label>
                Área
                <input value={user.area?.nombre ?? "Sin área"} readOnly />
              </label>
            </div>
            <label>
              ¿Qué necesitas?
              <input name="titulo" required placeholder="Ej. Hojas bond A4" />
            </label>
            <label>
              Detalle
              <textarea name="descripcion" />
            </label>
            <div className="event-grid">
              <label>
                Cantidad
                <input name="cantidad" type="number" min="1" defaultValue="1" />
              </label>
              <label>
                Fecha necesaria
                <input name="fechaNecesaria" type="date" />
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
            </div>
            <button className="primary">Enviar solicitud</button>
          </form>
        </div>
      )}
    </>
  );
}

export function AreaFlows({ user }: { user: any }) {
  const [rows, setRows] = useState<any[]>([]),
    [preview, setPreview] = useState<any>(null),
    [message, setMessage] = useState("");
  const load = () => fetchFlows().then(setRows);
  useEffect(() => {
    load();
  }, []);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form),
      file = f.get("pdf") as File;
    if (!file || file.type !== "application/pdf" || file.size > 3000000)
      return alert("Selecciona un PDF menor a 3 MB");
    const data = await new Promise<string>((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.readAsDataURL(file);
    });
    await createFlow({
      titulo: String(f.get("titulo")),
      descripcion: String(f.get("descripcion")),
      archivoNombre: file.name,
      archivoData: data,
    });
    form.reset();
    setMessage("PDF publicado correctamente. Ya puedes previsualizarlo.");
    await load();
  };
  const addVersion = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file || !preview) return;
    if (file.type !== "application/pdf" || file.size > 3000000)
      return uiAlert("Archivo inválido", "Selecciona un PDF menor a 3 MB");
    const data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    await addFlowVersion(preview.id, {
      archivoNombre: file.name,
      archivoData: data,
    });
    setMessage("Nueva versión publicada correctamente.");
    setPreview(null);
    await load();
  };
  return (
    <div className="flows-layout">
      <form className="flow-upload" onSubmit={submit}>
        <Upload />
        <h3>Subir flujo de trabajo</h3>
        <p>Comparte procedimientos y manuales PDF con tu área.</p>
        {message && (
          <div className="inline-success">
            <CheckCircle2 />
            {message}
          </div>
        )}
        <label>
          Título
          <input name="titulo" required />
        </label>
        <label>
          Descripción
          <textarea name="descripcion" />
        </label>
        <label className="pdf-drop">
          <FileText />
          Seleccionar PDF
          <input name="pdf" type="file" accept="application/pdf" required />
        </label>
        <button className="primary">Publicar flujo</button>
      </form>
      <div className="flow-list">
        {rows.map((r) => (
          <article key={r.id} onClick={() => setPreview(r)}>
            <FileText />
            <div>
              <b>{r.titulo}</b>
              <p>{r.descripcion || r.archivoNombre}</p>
              <small>
                {r.area.nombre} · {r.usuario.nombres} {r.usuario.apellidos}
              </small>
              <small>{r.versiones?.length || 1} versión(es)</small>
            </div>
            <span>Previsualizar</span>
          </article>
        ))}
      </div>
      {preview && (
        <div className="overlay">
          <section className="pdf-modal">
            <button
              className="close"
              aria-label="Cerrar"
              onClick={() => setPreview(null)}
            >
              <X />
            </button>
            <h2>{preview.titulo}</h2>
            <div className="document-version-tools">
              <a href={preview.archivoData} download={preview.archivoNombre}>
                Descargar versión actual
              </a>
              <label>
                <Upload />
                Subir nueva versión
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => addVersion(e.currentTarget)}
                />
              </label>
              <button
                className="danger"
                disabled={!canDeleteOwned(user,preview.usuarioId,preview.areaId)}
                onClick={async () => {
                  if (
                    await uiConfirm(
                      "Enviar a la papelera",
                      `¿Deseas retirar ${preview.titulo}?`,
                    )
                  ) {
                    if (canDeleteOwned(user,preview.usuarioId,preview.areaId)) await deleteFlow(preview.id);
                    else {
                      const motivo = await uiPrompt("Motivo de retiro", "", {
                        multiline: true,
                      });
                      if (!motivo) return;
                      await requestChange({
                        tipoEntidad: "Documento",
                        entidadId: preview.id,
                        accion: "Eliminar",
                        motivo,
                      });
                      await uiAlert(
                        "Solicitud enviada",
                        "El documento pasará a la papelera cuando finalice su aprobación.",
                      );
                    }
                    setPreview(null);
                    load();
                  }
                }}
              >
                <Trash2 />
                Papelera
              </button>
            </div>
            <div className="document-version-history">
              <b>Historial de versiones</b>
              {preview.versiones?.map((version: any) => (
                <span key={version.id}>
                  v{version.version} · {version.archivoNombre} ·{" "}
                  {new Date(version.createdAt).toLocaleString("es-PE")}
                </span>
              ))}
            </div>
            <iframe src={preview.archivoData} title={preview.titulo} />
          </section>
        </div>
      )}
    </div>
  );
}
