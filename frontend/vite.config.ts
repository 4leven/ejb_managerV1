import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const certificado = resolve(__dirname, "../.certs/ejb-manager-local.pfx");

export default defineConfig({
  plugins: [react()],
  build:{rollupOptions:{output:{manualChunks(id){if(id.includes("emoji-picker-react"))return"emoji-picker";if(id.includes("react-dom")||id.includes("/react/"))return"react-vendor";if(id.includes("lucide-react"))return"icons"}}}},
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: existsSync(certificado)
      ? { pfx: readFileSync(certificado), passphrase: "EJB-Manager-Local-2026" }
      : undefined,
    proxy: {
      "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    https: existsSync(certificado)
      ? { pfx: readFileSync(certificado), passphrase: "EJB-Manager-Local-2026" }
      : undefined,
    proxy: {
      "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
});
