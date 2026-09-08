import { Router } from "express";
import { randomBytes, createHash, createCipheriv, createDecipheriv } from "node:crypto";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middlewares/auth.js";

const clientId=()=>process.env.GOOGLE_CLIENT_ID||"";
const clientSecret=()=>process.env.GOOGLE_CLIENT_SECRET||"";
const redirectUri=()=>process.env.GOOGLE_REDIRECT_URI||"http://localhost:4000/api/gmail/callback";
const ready=()=>Boolean(clientId()&&clientSecret()&&process.env.JWT_SECRET);
const key=()=>{if(!process.env.JWT_SECRET)throw new Error("Falta configurar el cifrado del servidor.");return createHash("sha256").update("ejb-gmail:"+process.env.JWT_SECRET).digest()};
const encrypt=(value:any)=>{const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(part=>part.toString("base64")).join(".")};
const decrypt=(value:string)=>{const [iv,tag,data]=value.split(".").map(part=>Buffer.from(part,"base64")),cipher=createDecipheriv("aes-256-gcm",key(),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString("utf8"))};
const connection=(userId:string)=>prisma.registroPortal.findFirst({where:{tipo:"gmail_cuenta",creadorId:userId},orderBy:{updatedAt:"desc"}});
async function googleJson(url:string,options:RequestInit){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(response.status===401||response.status===403?"Google no autorizó esta operación. Vuelve a conectar Gmail y concede los permisos.":"Google no pudo completar la operación. Intenta nuevamente.");
 return response.status===204?{}:response.json();
}
async function accessToken(userId:string){
 const row=await connection(userId);if(!row)throw new Error("Conecta primero tu cuenta de Gmail.");
 const data=row.datos as any,tokens=decrypt(data.tokens);
 if(tokens.expiresAt>Date.now()+60000)return tokens.access_token;
 if(!tokens.refresh_token)throw new Error("Vuelve a conectar Gmail para renovar el acceso.");
 const updated=await googleJson("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId(),client_secret:clientSecret(),grant_type:"refresh_token",refresh_token:tokens.refresh_token})});
 const merged={...tokens,...updated,expiresAt:Date.now()+updated.expires_in*1000};
 await prisma.registroPortal.update({where:{id:row.id},data:{datos:{...data,tokens:encrypt(merged)}}});
 return merged.access_token;
}
const route=(fn:any)=>async(req:any,res:any,next:any)=>{try{await fn(req,res)}catch(error){next(error)}};
export const gmailRoutes=Router();
gmailRoutes.get("/callback",route(async(req:any,res:any)=>{
 const state=z.string().uuid().parse(req.query.state);
 const pending=await prisma.registroPortal.findFirst({where:{id:state,tipo:"gmail_oauth"}});
 if(!pending)throw new Error("La autorización venció o ya fue utilizada.");
 const data=pending.datos as any;
 const cookie=String(req.headers.cookie??"").split(";").map(v=>v.trim()).find(v=>v.startsWith("ejb_google_state="))?.slice("ejb_google_state=".length);
 if(cookie!==state||Date.now()>data.expiresAt)throw new Error("Vuelve a iniciar la conexión desde tu perfil de EJB.");
 const consumed=await prisma.registroPortal.deleteMany({where:{id:state,tipo:"gmail_oauth"}});
 if(consumed.count!==1)throw new Error("Esta autorización ya fue utilizada.");
 res.clearCookie("ejb_google_state",{path:"/api/gmail"});
 if(req.query.error){res.type("text").send("Conexión cancelada. Puedes volver a EJB.");return}
 const code=z.string().min(1).parse(req.query.code);
 const tokens=await googleJson("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId(),client_secret:clientSecret(),code,code_verifier:data.verifier,redirect_uri:redirectUri(),grant_type:"authorization_code"})});
 const profile=await googleJson("https://gmail.googleapis.com/gmail/v1/users/me/profile",{headers:{Authorization:`Bearer ${tokens.access_token}`}});
 const user=await prisma.usuario.findUniqueOrThrow({where:{id:pending.creadorId}});
 if(String(profile.emailAddress).toLowerCase()!==user.email.toLowerCase())throw new Error("Selecciona en Google el mismo correo registrado en tu perfil de EJB.");
 const existing=await connection(user.id);
 const stored={email:profile.emailAddress,connectedAt:new Date().toISOString(),tokens:encrypt({...tokens,expiresAt:Date.now()+tokens.expires_in*1000})};
 if(existing)await prisma.registroPortal.update({where:{id:existing.id},data:{datos:stored}});
 else await prisma.registroPortal.create({data:{tipo:"gmail_cuenta",creadorId:user.id,datos:stored}});
 res.setHeader("Cache-Control","no-store");
 res.setHeader("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'");
 res.type("html").send("<html lang='es'><meta charset='utf-8'><title>Gmail conectado</title><body style='font-family:system-ui;padding:48px'><h1>Gmail conectado</h1><p>Puedes cerrar esta ventana y volver al perfil de EJB. Pulsa Actualizar para consultar tu bandeja.</p></body></html>");
}));
gmailRoutes.use(requireAuth);
gmailRoutes.get("/status",route(async(req:any,res:any)=>{
 const row=await connection(req.userId);
 res.json({configured:ready(),connected:Boolean(row),email:row?(row.datos as any).email:null,redirectUri:redirectUri()});
}));
gmailRoutes.post("/authorize",route(async(req:any,res:any)=>{
 if(!ready())throw new Error("Primero configura el cliente OAuth de Google en el servidor.");
 const user=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId}});
 const verifier=randomBytes(32).toString("base64url"),challenge=createHash("sha256").update(verifier).digest("base64url");
 const row=await prisma.registroPortal.create({data:{tipo:"gmail_oauth",creadorId:user.id,datos:{verifier,expiresAt:Date.now()+600000}}});
 res.cookie("ejb_google_state",row.id,{httpOnly:true,sameSite:"lax",secure:redirectUri().startsWith("https:"),maxAge:600000,path:"/api/gmail"});
 const params=new URLSearchParams({client_id:clientId(),redirect_uri:redirectUri(),response_type:"code",scope:"https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",access_type:"offline",prompt:"consent",state:row.id,login_hint:user.email,code_challenge:challenge,code_challenge_method:"S256"});
 res.json({url:`https://accounts.google.com/o/oauth2/v2/auth?${params}`});
}));
gmailRoutes.get("/inbox",route(async(req:any,res:any)=>{
 const token=await accessToken(req.userId),headers={Authorization:`Bearer ${token}`};
 const list=await googleJson("https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=10",{headers});
 const rows=await Promise.all((list.messages??[]).map(async(item:any)=>{
  const message=await googleJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,{headers});
  const header=(name:string)=>message.payload?.headers?.find((h:any)=>h.name.toLowerCase()===name.toLowerCase())?.value??"";
  return{id:item.id,subject:header("Subject"),from:header("From"),date:header("Date"),snippet:message.snippet};
 }));
 res.json(rows);
}));
gmailRoutes.post("/send",route(async(req:any,res:any)=>{
 const data=z.object({to:z.string().email().refine(v=>!/[\r\n]/.test(v)),subject:z.string().trim().min(1).max(180).refine(v=>!/[\r\n]/.test(v)),body:z.string().trim().min(1).max(20000)}).parse(req.body);
 const token=await accessToken(req.userId);
 const mime=[`To: ${data.to}`,`Subject: =?UTF-8?B?${Buffer.from(data.subject).toString("base64")}?=`,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",Buffer.from(data.body).toString("base64")].join("\r\n");
 const result=await googleJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({raw:Buffer.from(mime).toString("base64url")})});
 res.json({id:result.id});
}));
gmailRoutes.delete("/connection",route(async(req:any,res:any)=>{
 const row=await connection(req.userId);
 if(row){const tokens=decrypt((row.datos as any).tokens);const response=await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:tokens.refresh_token||tokens.access_token}),signal:AbortSignal.timeout(15000)});if(!response.ok&&response.status!==400)throw new Error("Google no pudo revocar el acceso. Intenta nuevamente.");await prisma.registroPortal.delete({where:{id:row.id}});}
 res.json({ok:true});
}));
