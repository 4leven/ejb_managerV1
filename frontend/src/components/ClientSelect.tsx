import { useEffect, useRef, useState } from "react";
import { fetchClientes, createCliente } from "../api/iniciativas";

type Cliente = { id: string; razonSocial: string; ruc?: string | null };

/**
 * Selector de cliente sobre los clientes ya existentes (tabla Cliente), con una
 * vía aparte y controlada para dar de alta uno nuevo. Reemplaza al input de
 * texto libre para que no se puedan guardar nombres de cliente duplicados ni
 * editarlos por accidente desde un formulario de iniciativa.
 */
export function ClientSelect({
  name = "clienteId",
  initialLabel = "",
  initialId = "",
  onSelect,
}: {
  name?: string;
  initialLabel?: string;
  initialId?: string;
  onSelect?: (id: string, label: string) => void;
}) {
  const [query, setQuery] = useState(initialLabel);
  const [id, setId] = useState(initialId);
  const [options, setOptions] = useState<Cliente[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      fetchClientes(query.trim())
        .then(setOptions)
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (client: Cliente) => {
    setId(client.id);
    setQuery(client.razonSocial);
    onSelect?.(client.id, client.razonSocial);
    setOpen(false);
    setCreating(false);
  };

  const addClient = async () => {
    if (newName.trim().length < 2) {
      setError("Escribe al menos 2 caracteres.");
      return;
    }
    setError("");
    try {
      const client = await createCliente({ razonSocial: newName.trim() });
      setNewName("");
      pick(client);
    } catch (cause: any) {
      setError(cause?.message ?? "No se pudo registrar el cliente.");
    }
  };

  return (
    <div className="client-select" ref={boxRef}>
      <input type="hidden" name={name} value={id} />
      {/* Distingue "no se tocó el campo" (se deja el cliente actual tal cual)
          de "se borró el texto a propósito" (se quiere quitar el cliente). */}
      <input type="hidden" name={`${name}Query`} value={query} />
      <input
        type="text"
        value={query}
        placeholder="Buscar cliente…"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setId("");
          onSelect?.("", event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="client-select-menu">
          {options.map((client) => (
            <button type="button" key={client.id} onClick={() => pick(client)}>
              {client.razonSocial}
              {client.ruc ? ` · ${client.ruc}` : ""}
            </button>
          ))}
          {!options.length && !creating && (
            <p className="client-select-empty">Sin resultados</p>
          )}
          {!creating ? (
            <button
              type="button"
              className="client-select-new"
              onClick={() => {
                setCreating(true);
                setNewName(query);
                setError("");
              }}
            >
              + Registrar cliente nuevo
            </button>
          ) : (
            <div className="client-select-create">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Razón social del cliente"
                autoFocus
              />
              {error && <small>{error}</small>}
              <div>
                <button type="button" onClick={addClient}>
                  Guardar
                </button>
                <button type="button" onClick={() => setCreating(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
