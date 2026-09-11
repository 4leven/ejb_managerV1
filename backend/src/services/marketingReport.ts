import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { splitMarketingSystems } from "./marketing.service.js";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 34;
const INK = rgb(0.04, 0.12, 0.24);
const MUTED = rgb(0.31, 0.39, 0.5);
const BLUE = rgb(0.12, 0.35, 0.75);
const LINE = rgb(0.86, 0.89, 0.94);
const SOFT = rgb(0.96, 0.98, 1);

type Color = { background: string; foreground: string };

const CANAL_COLORS: Record<string, Color> = {
  socialmedia: { background: "#39745a", foreground: "#ffffff" },
  googleads: { background: "#8ec84a", foreground: "#ffffff" },
  difusioncomercial: { background: "#3679f5", foreground: "#ffffff" },
  socialmediareactivacion: { background: "#f08b18", foreground: "#ffffff" },
  b2breactivacion: { background: "#5234e7", foreground: "#ffffff" },
  publicidadpartner: { background: "#1118ee", foreground: "#ffffff" },
};

const SISTEMA_COLORS: Record<string, Color> = {
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

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const normalizeKey = (value: unknown) => String(value ?? "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/[^a-z0-9]/g, "");

const safeText = (value: unknown) => String(value ?? "")
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

function hexColor(value: string) {
  const hex = value.replace("#", "");
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
}

function colorFor(value: string, palette: Record<string, Color>) {
  return palette[normalizeKey(value)] ?? { background: "#e8edf5", foreground: "#334155" };
}

function fitText(value: unknown, font: PDFFont, size: number, maxWidth: number) {
  const text = safeText(value) || "-";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) result = result.slice(0, -1);
  return `${result.trimEnd()}...`;
}

function wrapText(value: unknown, font: PDFFont, size: number, maxWidth: number, maxLines = 2) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  if (!words.length) return ["-"];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = fitText(word, font, size, maxWidth);
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = fitText(`${lines[maxLines - 1]}...`, font, size, maxWidth);
  }
  return lines;
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function drawHeader(page: PDFPage, title: string, subtitle: string, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x: 0, y: 520, width: PAGE_WIDTH, height: 75, color: INK });
  page.drawRectangle({ x: 0, y: 520, width: 8, height: 75, color: rgb(0.13, 0.47, 0.91) });
  page.drawText("EJB MANAGER", { x: MARGIN, y: 559, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText(safeText(title), { x: MARGIN, y: 539, size: 11, font: regular, color: rgb(0.63, 0.79, 1) });
  subtitle.split("\n").slice(0, 2).forEach((line, index) => {
    page.drawText(fitText(safeText(line), regular, 7.5, 180), { x: 628, y: 553 - index * 12, size: 7.5, font: regular, color: rgb(0.79, 0.86, 0.96) });
  });
}

function drawKpi(page: PDFPage, x: number, y: number, width: number, label: string, value: string, accent: ReturnType<typeof rgb>, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x, y, width, height: 58, color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 0.8 });
  page.drawRectangle({ x, y, width: 5, height: 58, color: accent });
  page.drawText(safeText(value), { x: x + 15, y: y + 28, size: 19, font: bold, color: INK });
  page.drawText(safeText(label).toUpperCase(), { x: x + 15, y: y + 12, size: 7, font: regular, color: MUTED });
}

function drawCategoryList(page: PDFPage, title: string, rows: [string, number][], x: number, y: number, width: number, palette: Record<string, Color>, regular: PDFFont, bold: PDFFont) {
  page.drawText(safeText(title), { x, y, size: 10, font: bold, color: BLUE });
  const max = Math.max(1, ...rows.map(([, count]) => count));
  let currentY = y - 20;
  for (const [label, count] of rows) {
    const color = colorFor(label, palette);
    page.drawText(fitText(label, regular, 7.5, width - 54), { x, y: currentY + 2, size: 7.5, font: regular, color: INK });
    page.drawText(String(count), { x: x + width - 17, y: currentY + 2, size: 7.5, font: bold, color: INK });
    page.drawRectangle({ x, y: currentY - 5, width: width - 4, height: 3.5, color: rgb(0.91, 0.94, 0.97) });
    page.drawRectangle({ x, y: currentY - 5, width: Math.max(3, (width - 4) * (count / max)), height: 3.5, color: hexColor(color.background) });
    currentY -= 16;
  }
}

export async function createMarketingReportPdf(input: {
  anio: number;
  mes: number;
  prospectos: any[];
  resumen: any;
  actor: { nombres: string; apellidos: string };
}) {
  const { anio, mes, prospectos, resumen, actor } = input;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const period = `${MONTHS[mes - 1]} ${anio}`;
  const generated = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
  const author = `${actor.nombres} ${actor.apellidos}`.trim();
  pdf.setTitle(`Reporte mensual de prospectos - ${period}`);
  pdf.setAuthor("EJB Manager");
  pdf.setSubject("Reporte corporativo mensual de Marketing");

  const cover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(cover, `Reporte mensual de prospectos - ${period}`, `Generado por ${author}\n${generated}`, regular, bold);
  cover.drawText("RESUMEN EJECUTIVO", { x: MARGIN, y: 493, size: 11, font: bold, color: BLUE });
  const projection = resumen.proyeccion;
  const kpiWidth = 184;
  drawKpi(cover, 34, 416, kpiWidth, "Prospectos captados", String(projection.prospectosCaptados), BLUE, regular, bold);
  drawKpi(cover, 230, 416, kpiWidth, "Meta mensual", String(projection.metaMensual), rgb(0.49, 0.34, 0.85), regular, bold);
  drawKpi(cover, 426, 416, kpiWidth, "Proyeccion de cierre", String(projection.proyeccionFinDeMes), rgb(0.03, 0.58, 0.33), regular, bold);
  drawKpi(cover, 622, 416, kpiWidth, "Ritmo diario", String(projection.ritmoDiario), rgb(0.93, 0.42, 0.07), regular, bold);
  cover.drawRectangle({ x: MARGIN, y: 371, width: PAGE_WIDTH - MARGIN * 2, height: 28, color: SOFT });
  const multiproduct = resumen.multiproducto ?? { cantidad: 0, porcentaje: 0 };
  cover.drawText(fitText(`Estado: ${projection.estado} | Ritmo necesario: ${projection.ritmoNecesarioDia}/dia | Oportunidad multiproducto: ${multiproduct.cantidad} (${multiproduct.porcentaje}%) | Dia ${projection.diaActualMes} de ${projection.diasTotalesMes}`, bold, 8.5, PAGE_WIDTH - MARGIN * 2 - 22), { x: MARGIN + 11, y: 381, size: 8.5, font: bold, color: INK });

  const channelRows = Object.entries(resumen.porCanal ?? {}).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const systemRows = Object.entries(resumen.porSistema ?? {}).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  drawCategoryList(cover, "PROSPECTOS POR CANAL", channelRows, 34, 345, 350, CANAL_COLORS, regular, bold);
  drawCategoryList(cover, "PROSPECTOS POR SISTEMA EJB", systemRows, 426, 345, 380, SISTEMA_COLORS, regular, bold);

  const columns = [
    { label: "N", width: 22 }, { label: "Fecha", width: 45 }, { label: "Cliente", width: 111 },
    { label: "RUC", width: 65 }, { label: "Empresa", width: 108 }, { label: "Contacto", width: 126 },
    { label: "Canal", width: 96 }, { label: "Sistema", width: 100 }, { label: "Registrado por", width: 71 },
  ];
  let page: PDFPage;
  let y = 0;
  const addDetailPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, `Detalle de prospectos - ${period}`, `${prospectos.length} registros`, regular, bold);
    page.drawText("LISTADO CONSOLIDADO", { x: MARGIN, y: 493, size: 11, font: bold, color: BLUE });
    y = 474;
    page.drawRectangle({ x: MARGIN, y: y - 24, width: PAGE_WIDTH - MARGIN * 2, height: 24, color: rgb(0.1, 0.25, 0.47) });
    let x = MARGIN;
    for (const column of columns) {
      page.drawText(column.label, { x: x + 4, y: y - 15, size: 6.5, font: bold, color: rgb(1, 1, 1) });
      x += column.width;
    }
    y -= 24;
  };

  addDetailPage();
  prospectos.forEach((row, index) => {
    const hasNotes = Boolean(row.notas);
    const systems = splitMarketingSystems(row.sistemaEjb);
    const tagsHeight = Math.max(36, 8 + systems.length * 12);
    const rowHeight = tagsHeight + (hasNotes ? 12 : 0);
    if (y - rowHeight < 42) addDetailPage();
    if (index % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: PAGE_WIDTH - MARGIN * 2, height: rowHeight, color: rgb(0.975, 0.985, 0.998) });
    page.drawLine({ start: { x: MARGIN, y: y - rowHeight }, end: { x: PAGE_WIDTH - MARGIN, y: y - rowHeight }, thickness: 0.45, color: LINE });
    const contact = [row.celular, row.correo].filter(Boolean).join("\n") || "-";
    const values = [index + 1, formatDate(row.fechaContacto), row.nombreCliente, row.ruc || "-", row.empresa || "-", contact];
    let x = MARGIN;
    values.forEach((value, columnIndex) => {
      const column = columns[columnIndex];
      const lines = String(value).split("\n").flatMap((part) => wrapText(part, regular, 6.8, column.width - 8, 2)).slice(0, 2);
      lines.forEach((line, lineIndex) => page.drawText(line, { x: x + 4, y: y - 13 - lineIndex * 9, size: 6.8, font: columnIndex === 2 ? bold : regular, color: INK }));
      x += column.width;
    });
    const channelColor = colorFor(row.canal, CANAL_COLORS);
    page.drawRectangle({ x: x + 3, y: y - 24, width: columns[6].width - 6, height: 16, color: hexColor(channelColor.background) });
    page.drawText(fitText(row.canal, bold, 5.8, columns[6].width - 12), { x: x + 6, y: y - 19, size: 5.8, font: bold, color: hexColor(channelColor.foreground) });
    x += columns[6].width;
    systems.forEach((system, systemIndex) => {
      const systemColor = colorFor(system, SISTEMA_COLORS);
      const tagY = y - 19 - systemIndex * 12;
      page.drawRectangle({ x: x + 3, y: tagY - 4, width: columns[7].width - 6, height: 10, color: hexColor(systemColor.background) });
      page.drawText(fitText(system, bold, 5.2, columns[7].width - 12), { x: x + 6, y: tagY - 1, size: 5.2, font: bold, color: hexColor(systemColor.foreground) });
    });
    x += columns[7].width;
    const registeredBy = row.creadoPor ? `${row.creadoPor.nombres} ${row.creadoPor.apellidos}` : "-";
    wrapText(registeredBy, regular, 6.3, columns[8].width - 8, 2).forEach((line, lineIndex) => page.drawText(line, { x: x + 4, y: y - 13 - lineIndex * 8, size: 6.3, font: regular, color: INK }));
    if (hasNotes) {
      const notesY = y - tagsHeight - 3;
      page.drawText("Notas:", { x: MARGIN + 26, y: notesY, size: 6.2, font: bold, color: MUTED });
      page.drawText(fitText(row.notas, regular, 6.2, PAGE_WIDTH - MARGIN * 2 - 68), { x: MARGIN + 51, y: notesY, size: 6.2, font: regular, color: MUTED });
    }
    y -= rowHeight;
  });

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 27 }, end: { x: PAGE_WIDTH - MARGIN, y: 27 }, thickness: 0.5, color: LINE });
    currentPage.drawText("EJB Solutions - Eficiencia, Justicia y Balance | Uso interno", { x: MARGIN, y: 14, size: 6.5, font: regular, color: MUTED });
    const pageLabel = `Pagina ${index + 1} de ${pages.length}`;
    currentPage.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageLabel, 6.5), y: 14, size: 6.5, font: regular, color: MUTED });
  });

  return pdf.save();
}
