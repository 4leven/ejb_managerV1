import { prisma } from "../config/db.js";
import { z } from "zod";
import { isAdministration, isAreaLeader } from "../services/permissions.js";
export async function updateSurvey(id:string,userId:string,input:any){
 const actor=await prisma.usuario.findUniqueOrThrow({where:{id:userId}});
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM registros_portal WITH (UPDLOCK, ROWLOCK) WHERE id = ${id}`;
  const row=await tx.registroPortal.findUniqueOrThrow({where:{id},include:{creador:{select:{areaId:true}}}});
  if(row.tipo!=="encuesta")throw new Error("Encuesta no disponible.");
  const data=row.datos as any;
  if(input.action==="vote"){
   if(data.activa===false)throw new Error("Esta encuesta está cerrada.");
   const index=z.number().int().min(0).max(data.opciones.length-1).parse(input.opcion);
   data.votos={...data.votos,[userId]:{opcion:index,nombre:`${actor.nombres} ${actor.apellidos}`}};
  }else{
   if(!actor.isSuperAdmin&&!isAdministration(actor)&&row.creadorId!==userId&&!(isAreaLeader(actor)&&actor.areaId===row.creador.areaId))throw new Error("No puedes editar esta encuesta.");
   const changes=z.object({pregunta:z.string().trim().min(3).max(200).optional(),descripcion:z.string().max(1000).optional(),opciones:z.array(z.string().trim().min(1).max(200)).min(2).max(30).optional(),activa:z.boolean().optional()}).parse(input);
   if(changes.opciones&&Object.keys(data.votos??{}).length&&JSON.stringify(changes.opciones)!==JSON.stringify(data.opciones))throw new Error("No se pueden cambiar las opciones después de recibir votos. Puedes editar el título, descripción o cerrar la encuesta.");
   Object.assign(data,changes);
  }
  return tx.registroPortal.update({where:{id},data:{datos:data}});
 });
}
