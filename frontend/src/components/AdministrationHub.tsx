import { ChangeEvent, useEffect, useState } from "react";
import {
  ArchiveRestore,
  Bell,
  BookOpen,
  FileSpreadsheet,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  bulkImport,
  completeOnboarding,
  archiveNotification,
  fetchNotifications,
  fetchEquipo,
  fetchTrash,
  purgeTrash,
  restoreTrash,
  readAllNotifications,
  saveNotificationPreferences,
} from "../api/iniciativas";
export function AdministrationHub({
  user,
  areas,
}: {
  user: any;
  areas: any[];
}) {
  const [tab, setTab] = useState("help"),
    [team, setTeam] = useState<any[]>([]),
    [trash, setTrash] = useState<any[]>([]),
    [notifications, setNotifications] = useState<any[]>([]),
    [preview, setPreview] = useState<any[]>([]),
    [result, setResult] = useState("");
  const management =
    user.isSuperAdmin || ["Jefe","Gerente"].includes(user.cargo);
  const load = () => {
    fetchNotifications().then(setNotifications);
    if (management) {
      fetchEquipo().then(setTeam);
      fetchTrash().then(setTrash);
    }
  };
  useEffect(load, []);
  const excel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const XLSX = await import("xlsx"),
      book = XLSX.read(await file.arrayBuffer()),
      raw = XLSX.utils.sheet_to_json<any>(book.Sheets[book.SheetNames[0]], {
        defval: "",
      }),
      fallbackArea = areas[0]?.id;
    setPreview(
      raw
        .map((row) => ({
          tipo: String(row.tipo || "proyecto").toLowerCase(),
          titulo: String(row.titulo || ""),
          descripcion: String(row.descripcion || ""),
          cliente: String(row.cliente || ""),
          email: String(row.email || ""),
          nombres: String(row.nombres || ""),
          apellidos: String(row.apellidos || ""),
          areaId: String(row.areaId || fallbackArea),
          iniciativaId: String(row.iniciativaId || "") || undefined,
        }))
        .slice(0, 500),
    );
    event.target.value = "";
  };
  const importRows = async () => {
    const response = await bulkImport(preview);
    setResult(
      `${response.created} registros creados · ${response.errors.length} observaciones`,
    );
    setPreview([]);
  };
  return (
    <section className="administration-hub">
      <header>
        <div>
          <ShieldCheck />
          <span>
            <h3>Centro de administración y ayuda</h3>
            <p>Seguridad, importación, papelera, permisos y preferencias.</p>
          </span>
        </div>
        <nav>
          {[
            ["help", "Ayuda"],
            ["notifications", "Avisos"],
            ...(management
              ? [
                  ["import", "Importar"],
                  ["trash", "Papelera"],
                ]
              : []),
          ].map(([id, label]) => (
            <button
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      {tab === "help" && (
        <div className="help-center">
          <BookOpen />
          <div>
            <h4>Guía rápida de EJB MANAGER</h4>
            <ol>
              <li>Registra proyectos y asigna responsables.</li>
              <li>Divide el trabajo en tareas con fechas y recordatorios.</li>
              <li>Agenda reuniones vinculadas al proyecto.</li>
              <li>Consulta Informes BI y exporta el resumen mensual.</li>
              <li>Usa Mensajes para grupos privados y coordinación.</li>
            </ol>
            <p>
              Los elementos eliminados permanecen en la papelera antes de su
              eliminación definitiva.
            </p>
            {!user.onboardingCompleted && <button className="primary" onClick={async()=>{await completeOnboarding();setResult("Recorrido inicial completado")}}>Marcar guía como completada</button>}
          </div>
        </div>
      )}
      {tab === "notifications" && (
        <form
          className="notification-preferences"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await saveNotificationPreferences({
              email: f.has("email"),
              tareas: f.has("tareas"),
              reuniones: f.has("reuniones"),
              aprobaciones: f.has("aprobaciones"),
              resumenSemanal: f.has("resumenSemanal"),
            });
            setResult("Preferencias guardadas");
          }}
        >
          <Bell />
          <h4>Preferencias de avisos</h4>
          {[
            ["email", "Recibir correos"],
            ["tareas", "Tareas y vencimientos"],
            ["reuniones", "Reuniones próximas"],
            ["aprobaciones", "Aprobaciones"],
            ["resumenSemanal", "Resumen semanal"],
          ].map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                name={id}
                defaultChecked={user.notificationPreferences?.[id] ?? true}
              />
              {label}
            </label>
          ))}
          <section className="persistent-notifications"><header><b>Bandeja persistente</b><button type="button" onClick={async()=>{await readAllNotifications();load()}}>Marcar todo como leído</button></header>{notifications.slice(0,20).map(note=><article className={note.leidaAt?"read":"unread"} key={note.id}><span><b>{note.titulo}</b><small>{note.mensaje}</small><time>{new Date(note.createdAt).toLocaleString("es-PE")}</time></span><button type="button" onClick={async()=>{await archiveNotification(note.id);load()}}>Archivar</button></article>)}{!notifications.length&&<p>No tienes notificaciones guardadas.</p>}</section>
          <button className="primary">Guardar preferencias</button>
        </form>
      )}
      {tab === "import" && (
        <div className="bulk-import">
          <FileSpreadsheet />
          <h4>Importación desde Excel</h4>
          <p>
            Columnas admitidas: tipo, título, descripción, cliente, email,
            nombres, apellidos, areaId e iniciativaId.
          </p>
          <label>
            <Upload />
            Seleccionar .xlsx o .xls
            <input type="file" accept=".xlsx,.xls" onChange={excel} />
          </label>
          {preview.length > 0 && (
            <>
              <div className="import-preview">
                <b>{preview.length} filas listas</b>
                {preview.slice(0, 8).map((row, index) => (
                  <span key={index}>
                    {index + 2}. {row.tipo} ·{" "}
                    {row.titulo || row.email || "Sin título"}
                  </span>
                ))}
              </div>
              <button className="primary" onClick={importRows}>
                Confirmar importación
              </button>
            </>
          )}
        </div>
      )}
      {tab === "trash" && (
        <div className="trash-list">
          {trash.map((row) => (
            <article key={`${row.type}-${row.id}`}>
              <span>
                <b>{row.titulo}</b>
                <small>
                  {row.type} · eliminado{" "}
                  {new Date(row.deletedAt).toLocaleString("es-PE")}
                </small>
              </span>
              <button
                onClick={async () => {
                  await restoreTrash(row.id, row.type);
                  load();
                }}
              >
                <ArchiveRestore />
                Restaurar
              </button>
              {user.isSuperAdmin && (
                <button
                  className="danger"
                  onClick={async () => {
                    await purgeTrash(row.id, row.type);
                    load();
                  }}
                >
                  <Trash2 />
                  Eliminar definitivamente
                </button>
              )}
            </article>
          ))}
          {!trash.length && <p>La papelera está vacía.</p>}
        </div>
      )}
      {result && <div className="inline-success">✓ {result}</div>}
    </section>
  );
}
