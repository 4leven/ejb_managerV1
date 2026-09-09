import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as pdfjs from "./pdf-tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "./pdf-tools/node_modules/@napi-rs/canvas/index.js";

const root = resolve(import.meta.dirname, "../..");
const input = process.argv[2] || "output/pdf/GUIA_LEVANTAR_EJB_MANAGER.pdf";
const outputDirectory = process.argv[3] || "tmp/pdfs/rendered";
mkdirSync(resolve(root, outputDirectory), { recursive: true });
const bytes = new Uint8Array(readFileSync(resolve(root, input)));
const document = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;

for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.45 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  writeFileSync(
    resolve(root, `${outputDirectory}/page-${String(pageNumber).padStart(2, "0")}.png`),
    canvas.toBuffer("image/png"),
  );
}

console.log(`Rendered ${document.numPages} pages`);
