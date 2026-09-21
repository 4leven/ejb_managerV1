export const TICKET_MODULES = [
  "EJBPLANILLAS",
  "EJBCONTABLE",
  "EJBERP",
  "EJBCOMERCIAL",
  "EJBCONTRATOS",
  "EJBPAGOS",
  "EJBFACTURACIÓN",
  "EJBACTIVO FIJOS",
  "ROBOTS",
] as const;

export const TICKET_AREA_KEYS = ["consultoria contable", "consultoria planilla"] as const;

export const TICKET_DESTINATION_AREAS = ["Ventas", "Instalación", "Consultoría"] as const;

export const TICKET_CHANNELS = ["TELEFONO", "WHATSAPP", "CORREO", "OTRO"] as const;

export const TICKET_PRIORITIES = ["BAJA", "NORMAL", "ALTA", "URGENTE"] as const;
