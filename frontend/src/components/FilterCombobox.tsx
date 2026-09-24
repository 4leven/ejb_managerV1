import { useEffect, useRef, useState } from "react";

export type ComboOption = { value: string; label: string };

/**
 * Combobox de un solo valor con autocomplete: se escribe para buscar/filtrar
 * entre las opciones, y al elegir una se dispara onChange con su "value"
 * (compatible con lo que ya esperaba el <select> que reemplaza — id de
 * trabajador o nombre resuelto de cliente, según el caso). No requiere
 * ninguna librería nueva: mismo patrón que ClientSelect.tsx.
 */
export function FilterCombobox({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.label ?? "");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [selected]);

  const term = query.trim().toLocaleLowerCase("es");
  const matches = term
    ? options.filter((option) => option.label.toLocaleLowerCase("es").includes(term))
    : options;

  return (
    <div className="filter-combobox" ref={boxRef}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="filter-combobox-menu">
          {matches.map((option) => (
            <button
              type="button"
              key={option.value || "__all__"}
              className={option.value === value ? "active" : ""}
              onClick={() => {
                onChange(option.value);
                setQuery(option.label);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
          {!matches.length && <p className="filter-combobox-empty">Sin resultados</p>}
        </div>
      )}
    </div>
  );
}
