import { createApprovalSimulation } from "../api/iniciativas";
import { uiAlert } from "../utils/dialog";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  History,
  Inbox,
  UserCog,
  X,
} from "lucide-react";
import { fetchApprovals, resolveApproval } from "../api/iniciativas";
import { isTechnicalUser } from "../utils/access";

const fields = [
  "titulo",
  "nombre",
  "descripcion",
  "cliente",
  "estado",
  "prioridad",
  "cantidad",
];
function Data({ title, value }: { title: string; value: any }) {
  const entries = Object.entries(value || {}).filter(([key]) =>
    fields.includes(key),
  );
  return (
    <div>
      <b>{title}</b>
      {entries.length ? (
        entries.map(([key, item]) => (
          <p key={key}>
            <small>{key}</small>
            <span>{String(item ?? "—")}</span>
          </p>
        ))
      ) : (
        <p>
          <span>Sin cambios de campos</span>
        </p>
      )}
    </div>
  );
}

export default function ApprovalWorkspace({ user }: { user: any }) {
  const canApprove =
    user.isSuperAdmin ||
    ["Jefe","Gerente"].includes(user.cargo);
  const [rows, setRows] = useState<any[]>([]),
    [scope, setScope] = useState<"pending" | "mine" | "history">(
      canApprove ? "pending" : "mine",
    ),
    [selected, setSelected] = useState<any | null>(null);
  const load = () =>
    fetchApprovals(scope).then((data) => {
      setRows(data);
      setSelected((current: any | null) =>
        current
          ? (data.find((row: any) => row.id === current.id) ?? null)
          : null,
      );
    });
  useEffect(() => {
    void load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [scope]);
  const resolve = async (approved: boolean) => {
    if (!selected) return;
    const comentario = prompt(
      approved ? "Comentario de aprobación" : "Motivo del rechazo",
      approved ? "Revisado y conforme." : "",
    );
    if (!comentario?.trim()) return;
    await resolveApproval(selected.id, approved, comentario.trim());
    window.dispatchEvent(new Event("ejb-data-changed"));
    setSelected(null);
    await load();
  };
  const scopeTitle =
    scope === "pending"
      ? "Solicitudes por atender"
      : scope === "mine"
        ? "Mis solicitudes"
        : "Historial de decisiones";
  const scopeDescription =
    scope === "pending"
      ? "Revisa el cambio solicitado antes de aprobar o rechazar."
      : scope === "mine"
        ? "Consulta el estado y el recorrido de tus solicitudes."
        : "Consulta las solicitudes que ya completaron su proceso.";
  return (
    <div className="approvals-workspace">
      <section className="approval-hero">
        <div className="approval-hero-icon"><ClipboardCheck /></div>
        <div>
          <span>CENTRO DE DECISIONES</span>
          <h2>Aprobaciones claras y trazables</h2>
          <p>Revisa qué se solicita, compara la información y consulta cada etapa antes de tomar una decisión.</p>
        </div>
        {user.isSuperAdmin && (
          <button onClick={async()=>{try{await createApprovalSimulation();if(scope==="pending") await load();else setScope("pending");}catch(error){await uiAlert("No se pudo crear la prueba",String(error));}}}>
            Crear solicitud de prueba
          </button>
        )}
      </section>
      <section className="approval-summary">
        <div className="pending">
          <Inbox />
          <span>
            <b>{rows.length}</b>
            <small>{scope === "pending" ? "En esta bandeja" : "Solicitudes visibles"}</small>
          </span>
        </div>
        <div className="in-progress">
          <Clock3 />
          <span>
            <b>{rows.filter((r) => r.estado === "Pendiente").length}</b>
            <small>En proceso</small>
          </span>
        </div>
        <div className="requesters">
          <UserCog />
          <span>
            <b>{new Set(rows.map((r) => r.solicitanteId)).size}</b>
            <small>Solicitantes</small>
          </span>
        </div>
      </section>
      <div className="approval-tabs">
        {canApprove && (
          <button
            className={scope === "pending" ? "active" : ""}
            onClick={() => setScope("pending")}
          >
            <Inbox /> Pendientes
          </button>
        )}
        <button
          className={scope === "mine" ? "active" : ""}
          onClick={() => setScope("mine")}
        >
          <UserCog /> Mis solicitudes
        </button>
        {canApprove && (
          <button
            className={scope === "history" ? "active" : ""}
            onClick={() => setScope("history")}
          >
            <History /> Historial
          </button>
        )}
      </div>
      <div className="approval-layout">
        <section className="approval-inbox">
          <header>
            <div>
              <span>BANDEJA</span>
              <h3>{scopeTitle}</h3>
              <p>{scopeDescription}</p>
            </div>
            <b>{rows.length}</b>
          </header>
          <div className="approval-list">
          {rows.map((r) => {
            const stages: string[] = r.etapas?.length ? r.etapas : ["Gerente"];
            return (
              <article
                className={selected?.id === r.id ? "selected" : ""}
                key={r.id}
                onClick={() => setSelected(r)}
              >
                <span className={`approval-state ${r.estado.toLowerCase()}`}>
                  {r.estado}
                </span>
                <div>
                  <b>
                    {r.snapshot?.simulacion?"[PRUEBA] ":""}{r.accion} {r.tipoEntidad}
                  </b>
                  <p>{r.motivo}</p>
                  <small>
                    {r.solicitante.nombres} {r.solicitante.apellidos} ·{" "}
                    {r.area.nombre} ·{" "}
                    {new Date(r.createdAt).toLocaleString("es-PE")}
                  </small>
                </div>
                <em>
                  Etapa {Math.min(r.etapaActual + 1, stages.length)}/
                  {stages.length}
                  <strong>{stages[r.etapaActual] || "Finalizada"}</strong>
                </em>
              </article>
            );
          })}
          {!rows.length && (
            <div className="module-empty">
              No hay solicitudes en esta vista.
            </div>
          )}
          </div>
        </section>
        <aside className="approval-detail">
          {selected ? (
            <>
              <header>
                <div>
                  <small>SOLICITUD DE CAMBIO</small>
                  <h3>
                    {selected.accion} {selected.tipoEntidad}
                  </h3>
                </div>
                <span
                  className={`approval-state ${selected.estado.toLowerCase()}`}
                >
                  {selected.estado}
                </span>
              </header>
              {selected.snapshot?.simulacion&&<p role="note" className="approval-simulation-note">SIMULACIÓN: puedes aprobar o rechazar. No se modificará ni eliminará ningún proyecto real.</p>}
              <section>
                <h4>Motivo de la solicitud</h4>
                <p>{selected.motivo}</p>
              </section>
              <section>
                <h4>Comparación de información</h4>
                {selected.accion === "Eliminar" ? (
                  <div className="delete-warning">
                    <AlertTriangle />
                    El elemento pasará a la papelera y podrá recuperarse.
                  </div>
                ) : (
                  <div className="comparison-grid">
                    <Data
                      title="Información actual"
                      value={selected.snapshot}
                    />
                    <Data title="Cambio solicitado" value={selected.payload} />
                  </div>
                )}
              </section>
              <section>
                <h4>Ruta de aprobación</h4>
                <div className="approval-route">
                  {(selected.etapas?.length
                    ? selected.etapas
                    : ["Gerente"]
                  ).map((stage: string, index: number) => (
                    <span
                      className={
                        index < selected.etapaActual ||
                        selected.estado === "Aprobada"
                          ? "done"
                          : index === selected.etapaActual &&
                              selected.estado === "Pendiente"
                            ? "current"
                            : ""
                      }
                      key={`${stage}-${index}`}
                    >
                      <i>{index + 1}</i>
                      <b>{stage}</b>
                    </span>
                  ))}
                </div>
              </section>
              {selected.decisiones?.length > 0 && (
                <section>
                  <h4>Historial de decisiones</h4>
                  <div className="decision-history">
                    {selected.decisiones.map((d: any, index: number) => (
                      <article key={index}>
                        <i className={d.approved ? "approved" : "rejected"}>
                          {d.approved ? "✓" : "×"}
                        </i>
                        <div>
                          <b>
                            {d.autor} · {d.etapa}
                          </b>
                          <p>{d.comentario}</p>
                          <small>
                            {new Date(d.fecha).toLocaleString("es-PE")}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {scope === "pending" && (
                <footer>
                  <button
                    className="reject"
                    onClick={() => void resolve(false)}
                  >
                    <X />
                    Rechazar
                  </button>
                  <button
                    className="approve"
                    onClick={() => void resolve(true)}
                  >
                    <Check />
                    Aprobar etapa
                  </button>
                </footer>
              )}
            </>
          ) : (
            <div className="approval-detail-empty">
              <CheckCircle2 />
              <b>Selecciona una solicitud</b>
              <span>
                Aquí verás el cambio, las etapas y toda su trazabilidad.
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
