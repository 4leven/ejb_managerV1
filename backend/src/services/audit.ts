import { prisma } from "../config/db.js";
import type { Prisma } from "@prisma/client";
export async function audit(usuarioId:string,accion:string,entidad:string,entidadId:string,detalle:Record<string,unknown>={}){
  const datos={accion,entidad,entidadId,detalle,fecha:new Date().toISOString()} as Prisma.InputJsonValue;
  await prisma.registroPortal.create({data:{tipo:"auditoria",creadorId:usuarioId,datos}});
}
