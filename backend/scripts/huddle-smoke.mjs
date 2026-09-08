import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient(),base="http://127.0.0.1:4000/api",token=id=>jwt.sign({sub:id},process.env.JWT_SECRET||"dev-only-secret");
async function call(path,userId,options={}){const response=await fetch(base+path,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token(userId)}`},body:options.body?JSON.stringify(options.body):undefined});const text=await response.text(),body=text?JSON.parse(text):null;if(!response.ok)throw new Error(`${path}: ${response.status} ${body?.message||text}`);return body}
let huddleId="";
try{
 const [first,second]=await prisma.usuario.findMany({take:2,orderBy:{createdAt:"asc"}});if(!second)throw new Error("Se necesitan dos usuarios");
 const started=await call("/huddles",first.id,{method:"POST",body:{contexto:"dm",contextoId:second.id}});huddleId=started.huddleId;if(!started.token||!started.livekitUrl)throw new Error("No se generó token");
 const active=await call(`/huddles/activas?contexto=dm&contextoId=${first.id}`,second.id);if(active?.id!==huddleId)throw new Error("El segundo usuario no detectó la llamada");
 const joined=await call(`/huddles/${huddleId}/unirse`,second.id,{method:"POST"});if(!joined.token)throw new Error("No se generó token al unirse");
 const left=await call(`/huddles/${huddleId}/salir`,second.id,{method:"POST"});if(left.estado!=="finalizada")throw new Error("La llamada no se finalizó");
 console.log("HUDDLE_SMOKE_OK: crear/reusar, detectar, unirse, token y finalizar verificados");
}finally{if(huddleId)await prisma.huddle.deleteMany({where:{id:huddleId}});await prisma.$disconnect()}
