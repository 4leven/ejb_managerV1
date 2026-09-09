import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const source = readFileSync(resolve(root, "outputs/LEVANTAR_PROYECTO.md"), "utf8");
const logo = readFileSync(resolve(root, "frontend/public/ejb-manager-logo.png")).toString("base64");

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const inline = (value) => escapeHtml(value)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const lines = source.split(/\r?\n/);
const parts = [];
let index = 0;
let inCode = false;
let codeLanguage = "";
let code = [];
let sectionOpen = false;

while (index < lines.length) {
  const line = lines[index];
  if (line.startsWith("```")) {
    if (!inCode) {
      inCode = true;
      codeLanguage = line.slice(3).trim();
      code = [];
    } else {
      parts.push(`<pre data-language="${escapeHtml(codeLanguage || "texto")}"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      inCode = false;
    }
    index += 1;
    continue;
  }
  if (inCode) {
    code.push(line);
    index += 1;
    continue;
  }
  if (/^\|.+\|$/.test(line) && /^\|[-: |]+\|$/.test(lines[index + 1] || "")) {
    const rows = [];
    const header = line.split("|").slice(1, -1).map((cell) => cell.trim());
    index += 2;
    while (index < lines.length && /^\|.+\|$/.test(lines[index])) {
      rows.push(lines[index].split("|").slice(1, -1).map((cell) => cell.trim()));
      index += 1;
    }
    parts.push(`<table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    continue;
  }
  if (/^- /.test(line)) {
    const items = [];
    while (index < lines.length && /^- /.test(lines[index])) {
      items.push(lines[index].slice(2));
      index += 1;
    }
    parts.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    continue;
  }
  if (line.startsWith("> ")) {
    const quote = [];
    while (index < lines.length && lines[index].startsWith("> ")) {
      quote.push(lines[index].slice(2));
      index += 1;
    }
    parts.push(`<aside class="warning">${quote.map(inline).join(" ")}</aside>`);
    continue;
  }
  if (line.startsWith("### ")) parts.push(`<h3>${inline(line.slice(4))}</h3>`);
  else if (line.startsWith("## ")) {
    if (sectionOpen) parts.push("</section>");
    parts.push(`<section class="guide-section"><h2>${inline(line.slice(3))}</h2>`);
    sectionOpen = true;
  }
  else if (line.startsWith("# ")) {
    // El título principal se presenta en la portada.
  } else if (line.trim()) {
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#|```|> |\|.+\||- )/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    parts.push(`<p>${inline(paragraph.join(" "))}</p>`);
    continue;
  }
  index += 1;
}
if (sectionOpen) parts.push("</section>");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Cómo levantar EJB MANAGER</title>
<style>
  @page { size: A4; margin: 17mm 16mm 18mm; }
  * { box-sizing: border-box; }
  html { background: #eaf0f8; }
  body { margin: 0; color: #172033; background: #fff; font-family: "Segoe UI", Arial, sans-serif; font-size: 10.2pt; line-height: 1.52; }
  .cover { position: relative; height: 260mm; display: flex; flex-direction: column; justify-content: center; padding: 28mm 19mm; overflow: hidden; color: #fff; background: radial-gradient(circle at 85% 16%, rgba(48,126,255,.42), transparent 30%), linear-gradient(145deg,#061a3a 0%,#0b3478 56%,#126bd4 100%); break-after: page; }
  .cover:before { content: ""; position: absolute; width: 145mm; height: 145mm; right: -55mm; bottom: -45mm; border: 18mm solid rgba(255,255,255,.07); border-radius: 50%; }
  .cover:after { content: ""; position: absolute; inset: 0; opacity: .16; background-image: linear-gradient(30deg, transparent 49%, #fff 50%, transparent 51%); background-size: 34px 34px; mask-image: linear-gradient(to left,#000,transparent 58%); }
  .cover img { position: absolute; z-index: 2; top: 18mm; left: 19mm; width: 58mm; height: 18mm; object-fit: contain; object-position: left center; filter: drop-shadow(0 5px 12px rgba(0,0,0,.18)); }
  .cover-main { position: relative; z-index: 2; max-width: 150mm; }
  .cover-kicker { display: inline-block; margin-bottom: 8mm; padding: 2.2mm 4mm; border: 1px solid rgba(255,255,255,.35); border-radius: 99px; color: #dceaff; font-size: 9pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .cover h1 { max-width: 145mm; margin: 0; font-size: 34pt; line-height: 1.04; letter-spacing: -.035em; }
  .cover p { max-width: 125mm; margin: 8mm 0 0; color: #d6e6ff; font-size: 13pt; }
  .cover-meta { position: absolute; z-index: 2; left: 19mm; right: 19mm; bottom: 17mm; display: flex; justify-content: space-between; padding-top: 5mm; border-top: 1px solid rgba(255,255,255,.25); color: #c9dcfa; font-size: 9pt; }
  .content { padding: 0; }
  .guide-section { break-inside: auto; }
  h2 { margin: 8mm 0 3mm; padding: 3.2mm 4mm; border-left: 4px solid #2f6fed; border-radius: 0 7px 7px 0; color: #0b2347; background: #f1f6ff; font-size: 17pt; line-height: 1.15; break-after: avoid-page; page-break-after: avoid; }
  h2:first-child { margin-top: 0; }
  h3 { margin: 6mm 0 2mm; color: #184d9c; font-size: 12.5pt; break-after: avoid; }
  p { margin: 0 0 3.2mm; }
  ul { margin: 1mm 0 4mm; padding-left: 6mm; }
  li { margin: 1.2mm 0; padding-left: 1mm; }
  li::marker { color: #2f6fed; }
  code { padding: .5mm 1.3mm; border-radius: 4px; color: #174b92; background: #eef4ff; font-family: Consolas, "Courier New", monospace; font-size: 9pt; }
  pre { position: relative; margin: 2.5mm 0 4.5mm; padding: 8mm 5mm 4.5mm; border-radius: 9px; color: #eaf2ff; background: #071a38; box-shadow: 0 3px 10px rgba(7,26,56,.12); font-size: 8.7pt; line-height: 1.48; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid; }
  pre:before { content: attr(data-language); position: absolute; top: 2.1mm; left: 5mm; color: #7fa6dc; font: 700 7pt "Segoe UI",Arial,sans-serif; letter-spacing: .09em; text-transform: uppercase; }
  pre code { padding: 0; color: inherit; background: none; font-size: inherit; }
  table { width: 100%; margin: 3mm 0 5mm; overflow: hidden; border-collapse: separate; border-spacing: 0; border: 1px solid #d7e2f1; border-radius: 8px; break-inside: avoid; }
  th, td { padding: 2.6mm 3.2mm; text-align: left; border-bottom: 1px solid #e2eaf5; }
  th { color: #fff; background: #174d99; font-size: 9pt; }
  tr:last-child td { border-bottom: 0; }
  tbody tr:nth-child(even) { background: #f7f9fc; }
  .warning { margin: 4mm 0 5mm; padding: 4mm 5mm; border: 1px solid #f3c56f; border-left: 5px solid #e79a13; border-radius: 8px; color: #70470a; background: #fff8e7; break-inside: avoid; }
  strong { color: #0b2347; }
  @media print { html { background: #fff; } }
</style>
</head>
<body>
  <section class="cover">
    <img src="data:image/png;base64,${logo}" alt="EJB MANAGER">
    <div class="cover-main">
      <span class="cover-kicker">Guía técnica de instalación</span>
      <h1>Cómo levantar EJB MANAGER</h1>
      <p>Preparación del entorno, base de datos, ejecución local, validación y solución de problemas.</p>
    </div>
    <div class="cover-meta"><span>EJB Solutions</span><span>Actualizado: septiembre de 2026</span></div>
  </section>
  <main class="content">${parts.join("\n")}</main>
</body>
</html>`;

writeFileSync(resolve(root, "tmp/pdfs/LEVANTAR_PROYECTO.html"), html, "utf8");
