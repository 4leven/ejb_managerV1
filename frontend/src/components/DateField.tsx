import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

/** Convierte "dd/mm/aaaa" a "aaaa-mm-dd" (lo que espera la API). Devuelve "" si la fecha no es válida. */
export function ddmmyyyyToIso(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return "";
  const day = Number(match[1]),
    month = Number(match[2]),
    year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Convierte "aaaa-mm-dd" (o un ISO con hora) a "dd/mm/aaaa" para mostrarlo. */
export function isoToDdmmyyyy(value?: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Fecha de hoy (hora local) en formato "aaaa-mm-dd". */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Campo de fecha con máscara dd/mm/aaaa: se escribe y se muestra en ese
 * formato, pero manda un input oculto con el valor en aaaa-mm-dd para la API.
 * Incluye un botón de calendario (selector nativo del navegador) para elegir
 * la fecha sin tener que tipearla, y si no llega un valor inicial arranca en
 * el día de hoy en vez de quedar vacío.
 */
export function DateField({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [text, setText] = useState(
    () => isoToDdmmyyyy(defaultValue) || isoToDdmmyyyy(todayIso()),
  );
  const iso = ddmmyyyyToIso(text);
  const invalid = text.length === 10 && !iso;
  const pickerRef = useRef<HTMLInputElement>(null);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4)
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2)
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(formatted);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.focus();
  };

  return (
    <label className="date-field">
      {label}
      <span className="date-field-row">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={text}
          maxLength={10}
          required={required}
          aria-invalid={invalid}
          onChange={(event) => handleChange(event.target.value)}
        />
        <button
          type="button"
          className="date-field-picker-btn"
          onClick={openPicker}
          aria-label="Elegir fecha en el calendario"
        >
          <CalendarDays />
        </button>
        <input
          ref={pickerRef}
          type="date"
          className="date-field-native"
          tabIndex={-1}
          aria-hidden="true"
          value={iso}
          onChange={(event) => setText(isoToDdmmyyyy(event.target.value))}
        />
      </span>
      {invalid && <small className="date-field-error">Fecha inválida</small>}
      <input type="hidden" name={name} value={iso} />
    </label>
  );
}
