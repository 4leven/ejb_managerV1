export type ProyeccionMarketing = {
  anio: number;
  mes: number;
  diasTotalesMes: number;
  diaActualMes: number;
  diasRestantes: number;
  prospectosCaptados: number;
  ritmoDiario: number;
  proyeccionFinDeMes: number;
  metaMensual: number;
  metaSemanal: number;
  diferencia: number;
  estado: string;
  ritmoNecesarioDia: number | string;
};

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const roundUp = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.ceil(value * factor) / factor;
};

/**
 * Replica celda por celda el panel "Proyección de cierre de mes" del Excel
 * original: ritmo diario = captados / día actual del mes, y la proyección
 * extrapola ese ritmo sobre el total de días del mes (no solo los restantes).
 */
export function calcularProyeccion(params: {
  anio: number;
  mes: number; // 1-12
  prospectosCaptados: number;
  metaMensual: number;
  metaSemanal: number;
  hoy?: Date;
}): ProyeccionMarketing {
  const { anio, mes, prospectosCaptados, metaMensual, metaSemanal } = params;
  const hoy = params.hoy ?? new Date();
  const diasTotalesMes = new Date(anio, mes, 0).getDate();
  const inicioMes = new Date(anio, mes - 1, 1);
  const hoyUtc = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diffDias = Math.floor((hoyUtc.getTime() - inicioMes.getTime()) / 86_400_000) + 1;
  const diaActualMes = Math.min(Math.max(diffDias, 1), diasTotalesMes);
  const diasRestantes = diasTotalesMes - diaActualMes;

  const ritmoDiario = round(prospectosCaptados / diaActualMes, 2);
  const proyeccionFinDeMes = round(ritmoDiario * diasTotalesMes, 0);
  const diferencia = proyeccionFinDeMes - metaMensual;
  const estado = diferencia >= 0
    ? `✅ Vas a superar la meta en ${diferencia} prospectos`
    : `⚠️ Proyectas quedar ${Math.abs(diferencia)} por debajo de la meta`;

  let ritmoNecesarioDia: number | string;
  if (diasRestantes > 0) {
    const faltante = metaMensual - prospectosCaptados;
    ritmoNecesarioDia = faltante > 0 ? roundUp(faltante / diasRestantes, 1) : 0;
  } else {
    ritmoNecesarioDia = prospectosCaptados >= metaMensual ? "Meta alcanzada ✅" : "Mes cerrado, meta no alcanzada";
  }

  return {
    anio, mes, diasTotalesMes, diaActualMes, diasRestantes,
    prospectosCaptados, ritmoDiario, proyeccionFinDeMes,
    metaMensual, metaSemanal, diferencia, estado, ritmoNecesarioDia,
  };
}
