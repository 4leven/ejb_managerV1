import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type ComboOption = { value: string; label: string };

type FilterComboboxProps = {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

/**
 * Selector desplegable con búsqueda interna. El control se comporta como los
 * demás filtros: un clic abre todas las opciones y escribir solo las refina.
 */
export function FilterCombobox({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: FilterComboboxProps) {
  const selected = options.find((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const term = query.trim().toLocaleLowerCase("es");
  const matches = term
    ? options.filter((option) => option.label.toLocaleLowerCase("es").includes(term))
    : options;

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    boxRef.current
      ?.querySelector<HTMLElement>(`[data-combo-option="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choose = (option: ComboOption) => {
    onChange(option.value);
    closeMenu(true);
  };

  return (
    <div className={`filter-combobox${open ? " open" : ""}`} ref={boxRef}>
      <button
        ref={triggerRef}
        type="button"
        className="filter-combobox-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
          }
        }}
      >
        <span>{selected?.label ?? placeholder ?? "Seleccionar"}</span>
        <ChevronDown className="filter-combobox-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="filter-combobox-menu">
          <input
            ref={searchRef}
            type="search"
            className="filter-combobox-search"
            value={query}
            placeholder="Buscar…"
            aria-label={`Buscar en ${ariaLabel?.toLocaleLowerCase("es") ?? "las opciones"}`}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => matches.length ? (current + 1) % matches.length : 0);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => matches.length ? (current - 1 + matches.length) % matches.length : 0);
              } else if (event.key === "Enter" && matches[activeIndex]) {
                event.preventDefault();
                choose(matches[activeIndex]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                closeMenu(true);
              }
            }}
          />
          <div className="filter-combobox-options" role="listbox">
            {matches.map((option, index) => (
              <button
                type="button"
                key={option.value || "__all__"}
                data-combo-option={index}
                role="option"
                aria-selected={option.value === value}
                className={index === activeIndex || option.value === value ? "active" : ""}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value && <small>Seleccionado</small>}
              </button>
            ))}
            {!matches.length && <p className="filter-combobox-empty">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  );
}
