import { writeFile } from "node:fs/promises";
import { createMarketingReportPdf } from "../../backend/dist/services/marketingReport.js";

const prospectos = [{
  fechaContacto: new Date(Date.UTC(2026, 8, 9)), nombreCliente: "Empresa de prueba", ruc: "20123456789",
  empresa: "Cliente Corporativo SAC", celular: "999999999", correo: "contacto@empresa.pe",
  canal: "GOOGLE ADS", sistemaEjb: "EJB CONTABLE, EJB PLANILLA, EJB ERP",
  notas: "Interesado en tres soluciones EJB.", creadoPor: { nombres: "Equipo", apellidos: "Marketing" },
}];
const bytes = await createMarketingReportPdf({
  anio: 2026, mes: 9, prospectos,
  resumen: {
    proyeccion: { prospectosCaptados: 1, metaMensual: 80, proyeccionFinDeMes: 3, ritmoDiario: 0.1, estado: "En seguimiento", ritmoNecesarioDia: 3, diaActualMes: 11, diasTotalesMes: 30 },
    porCanal: { "GOOGLE ADS": 1 },
    porSistema: { "EJB CONTABLE": 1, "EJB PLANILLA": 1, "EJB ERP": 1 }, multiproducto: { cantidad: 1, porcentaje: 100 },
  },
  actor: { nombres: "Santiago", apellidos: "Villanueva" },
});
await writeFile(new URL("./multiple-systems.pdf", import.meta.url), bytes);
