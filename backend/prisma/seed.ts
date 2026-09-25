import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const areas = [
  ['Marketing', '#2563EB'],
  ['Consultoría Contable', '#1D4ED8'],
  ['Consultoría Planilla', '#3B82F6'],
  ['Ventas', '#1E40AF'],
  ['Sistemas', '#2563EB'],
  ['Gerencia', '#0B2347'],
  ['Administración', '#B7791F'],
  ['Innovación y Producto', '#D97706'],
  ['Proyectos', '#8B5CF6']
] as const;

async function main(){
  await prisma.iniciativa.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.objetivoNegocio.deleteMany();
  await prisma.area.deleteMany();
  await prisma.area.createMany({data:areas.map(([nombre,colorHex])=>({nombre,colorHex}))});
}

main().finally(()=>prisma.$disconnect());
