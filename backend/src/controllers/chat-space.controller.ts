import { canDeleteOwned } from "../services/permissions.js";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { randomUUID } from "node:crypto";

const include = {creador:{select:{id:true,nombres:true,apellidos:true,fotoPerfil:true,area:true}}} as const;
export const attachmentSchema = z.object({
  nombre:z.string().min(1).max(255), mime:z.string().max(120),
  data:z.string().max(2_800_000).regex(/^data:[a-zA-Z0-9.+/-]*;base64,[A-Za-z0-9+/=\r\n]+$/),
});
const actionSchema = z.object({
  action:z.enum(["post","comment","react","edit","remove","pin","follow","mute"]),
  messageId:z.string().uuid().optional(), texto:z.string().trim().max(2000).optional(),
  emoji:z.string().min(1).max(8).optional(), replyId:z.string().uuid().optional(),
  gif:z.string().url().startsWith("https://").optional(), attachment:attachmentSchema.optional(),
});
const membersOf = (row:any) => [...new Set([row.creadorId,...(row.datos.miembros??[])])];
const manages = (row:any,userId:string) => row.creadorId===userId||(row.datos.moderadores??[]).includes(userId);
const checkSpace = (row:any,type:string,userId:string) => {
  if(!row || !["grupo","canal"].includes(type) || row.tipo!==type) throw new Error("El espacio ya no está disponible.");
  if(type==="grupo"&&!membersOf(row).includes(userId)) throw new Error("No perteneces a este grupo.");
};

export async function spaceActivity(req:Request,res:Response,next:NextFunction) {
 try {
  const id=z.string().uuid().parse(req.params.id), type=String(req.params.tipo), userId=req.userId!;
  const input=actionSchema.parse(req.body);
  const actor=await prisma.usuario.findUniqueOrThrow({where:{id:userId},select:{id:true,areaId:true,cargo:true,rol:true,isSuperAdmin:true,nombres:true,apellidos:true}});
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM registros_portal WITH (UPDLOCK, ROWLOCK) WHERE id = ${id}`;
    const row=await tx.registroPortal.findUniqueOrThrow({where:{id}}); checkSpace(row,type,userId);
    const data=row.datos as any, owner=manages(row,userId);
    let mensajes:any[]=[...(data.mensajes??[])];
    const message=mensajes.find(m=>m.id===input.messageId), now=new Date().toISOString();
    const author={usuarioId:userId,autor:`${actor.nombres} ${actor.apellidos}`,fecha:now};
    if(input.action==="follow") {
      if(type!=="canal") throw new Error("Solo los canales admiten seguidores.");
      const followers:string[]=data.seguidores??[];
      data.seguidores=followers.includes(userId)?followers.filter(id=>id!==userId):[...followers,userId];
    } else if(input.action==="mute") {
      const muted:string[]=data.silenciados??[];
      data.silenciados=muted.includes(userId)?muted.filter(id=>id!==userId):[...muted,userId];
    } else if(input.action==="post") {
      if(type==="canal"&&!owner) throw new Error("Solo administradores y moderadores publican en el canal. Puedes comentar y reaccionar.");
      if(!input.texto&&!input.gif&&!input.attachment) throw new Error("Escribe un mensaje o adjunta un archivo.");
      const original=input.replyId?mensajes.find(m=>m.id===input.replyId):null;
      if(input.replyId&&!original) throw new Error("El mensaje al que respondes ya no está disponible.");
      mensajes.push({id:randomUUID(),...author,texto:input.texto??"",...(input.gif?{tipo:"Gif",archivoData:input.gif}:{}),...(input.attachment?{adjunto:input.attachment}:{}),respuestaA:original?{id:original.id,autor:original.autor,texto:original.texto}:null});
    } else {
      if(!message) throw new Error("La publicación ya no está disponible.");
      if(input.action==="react") {
        if(!input.emoji) throw new Error("Selecciona una reacción.");
        const users:string[]=message.reacciones?.[input.emoji]??[];
        message.reacciones={...message.reacciones,[input.emoji]:users.includes(userId)?users.filter(id=>id!==userId):[...users,userId]};
      } else if(input.action==="comment") {
        if(!input.texto) throw new Error("Escribe el comentario.");
        message.comentarios=[...(message.comentarios??[]),{id:randomUUID(),...author,texto:input.texto}];
      } else {
        if(input.action==="remove"&&!canDeleteOwned(actor,message.usuarioId,(await tx.usuario.findUnique({where:{id:message.usuarioId}}))?.areaId)) throw new Error("No puedes eliminar mensajes de otra persona.");
        if(input.action!=="remove"&&message.usuarioId!==userId&&!owner) throw new Error("No puedes modificar una publicación ajena.");
        if(input.action==="edit"){if(!input.texto)throw new Error("El mensaje no puede quedar vacío.");message.texto=input.texto;message.editadoAt=now;}
        if(input.action==="remove") mensajes=mensajes.filter(m=>m.id!==message.id);
        if(input.action==="pin"){if(!owner)throw new Error("Solo moderadores pueden fijar publicaciones.");message.fijado=!message.fijado;}
      }
    }
    return tx.registroPortal.update({where:{id},data:{datos:{...data,mensajes}},include});
  });
  res.json(result);
 }catch(error){next(error)}
}

export async function removeSpace(req:Request,res:Response,next:NextFunction){
 try{
  const id=z.string().uuid().parse(req.params.id), type=String(req.params.tipo);
  const row=await prisma.registroPortal.findUniqueOrThrow({where:{id}});
  checkSpace(row,type,req.userId!);
  const user=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}});
  if(!canDeleteOwned(user,row.creadorId,(await prisma.usuario.findUniqueOrThrow({where:{id:row.creadorId}})).areaId)) throw new Error("Solo el creador o administrador global puede eliminar el espacio.");
  await prisma.registroPortal.update({where:{id},data:{tipo:`${type}_eliminado`,datos:{...(row.datos as any),eliminadoAt:new Date().toISOString(),eliminadoPor:user.id}}});
  res.json({ok:true});
 }catch(error){next(error)}
}

// El editor de integrantes nunca reemplaza mensajes, reacciones ni seguidores.
export async function updateSpaceSettings(id:string,type:string,userId:string,input:Record<string,unknown>){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM registros_portal WITH (UPDLOCK, ROWLOCK) WHERE id = ${id}`;
  const row=await tx.registroPortal.findUniqueOrThrow({where:{id}});checkSpace(row,type,userId);
  if(!manages(row,userId))throw new Error("Solo el creador y los moderadores pueden editar el espacio.");
  const data=row.datos as any;
  const settings=z.object({nombre:z.string().trim().min(1).max(80).optional(),descripcion:z.string().max(300).optional(),foto:z.string().max(2_800_000).optional(),miembros:z.array(z.string().uuid()).optional(),moderadores:z.array(z.string().uuid()).optional()}).parse(input);
  if(type==="grupo"&&settings.miembros?.some(id=>!membersOf(row).includes(id)))throw new Error("Los nuevos integrantes deben aceptar una invitación.");
  if(settings.miembros&&!settings.miembros.includes(row.creadorId))throw new Error("No puedes retirar al creador.");
  return tx.registroPortal.update({where:{id},data:{datos:{...data,...settings}},include});
 });
}
