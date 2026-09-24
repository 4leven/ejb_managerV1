export const score = (impacto:number, esfuerzo:'Bajo'|'Medio'|'Alto') => Number(((impacto / ({Bajo:1,Medio:2,Alto:4}[esfuerzo])) * 10).toFixed(2));
export const codigo = (count:number) => `INV-${String(count + 1).padStart(4,'0')}`;
