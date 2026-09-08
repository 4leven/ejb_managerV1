import { useEffect, useState, type FormEvent } from "react";
import { Mail, RefreshCcw, Send, Unplug } from "lucide-react";
import { gmailStatus, gmailAuthorize, gmailInbox, gmailSend, gmailDisconnect } from "../api/iniciativas";
import { uiConfirm } from "../utils/dialog";

export default function GmailConnection({email}:{email:string}) {
 const [status,setStatus]=useState<any>(null),[messages,setMessages]=useState<any[]>([]),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState("");
 const refresh=async()=>{try{const value=await gmailStatus();setStatus(value);if(value.connected)setMessages(await gmailInbox());}catch(error){setFeedback(error instanceof Error?error.message:"No se pudo consultar Gmail.");}};
 useEffect(()=>{void refresh()},[]);
 const connect=async()=>{
  const popup=window.open("about:blank","ejb-gmail-connect","width=600,height=720");
  setBusy(true);setFeedback("");
  try{const result=await gmailAuthorize();if(popup)popup.location.href=result.url;else window.location.assign(result.url);}
  catch(error){popup?.close();setFeedback(error instanceof Error?error.message:"No se pudo conectar.");}
  finally{setBusy(false)}
 };
 const send=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),to=String(data.get("to"));
  if(!(await uiConfirm("Enviar correo",`Se enviará este correo desde ${email} a ${to}.`)))return;
  setBusy(true);setFeedback("");
  try{await gmailSend({to,subject:String(data.get("subject")),body:String(data.get("body"))});form.reset();setFeedback("Correo enviado.");}
  catch(error){setFeedback(error instanceof Error?error.message:"No se pudo enviar.");}
  finally{setBusy(false)}
 };
 return <section className="gmail-connection"><header><Mail/><div><h3>Tu correo en EJB</h3><p>{email}</p></div><span>{status?.connected?"Gmail conectado":status?.configured?"Listo para conectar":"Pendiente de configuración"}</span></header>
  <p>Autoriza tu cuenta para consultar los últimos correos recibidos y redactar mensajes desde este perfil.</p>
  {feedback&&<p role="status" className="gmail-feedback">{feedback}</p>}
  {!status?.configured&&<details><summary>Configurar Google por primera vez</summary><ol>
    <li>En <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud</a>, crea un proyecto y habilita Gmail API.</li>
    <li>Configura Google Auth Platform para uso externo en pruebas y añade <b>{email}</b> a los usuarios de prueba.</li>
    <li>Crea un cliente OAuth de tipo Aplicación web y registra esta URI de redirección: <code>{status?.redirectUri}</code>.</li>
    <li>Configura el ID de cliente y su secreto en el servidor EJB. Después pulsa Actualizar y Conectar Gmail.</li>
  </ol></details>}
  <div className="gmail-actions"><button type="button" disabled={busy} onClick={()=>void refresh()}><RefreshCcw/>Actualizar</button>
  {!status?.connected?<button type="button" className="primary" disabled={busy||!status?.configured} onClick={()=>void connect()}><Mail/>Conectar Gmail</button>:<button type="button" disabled={busy} onClick={async()=>{if(!await uiConfirm("Desconectar Gmail","Se revocará el acceso de EJB a tu cuenta."))return;setBusy(true);try{await gmailDisconnect();setMessages([]);await refresh();}catch(error){setFeedback(String(error))}finally{setBusy(false)}}}><Unplug/>Desconectar</button>}</div>
  {status?.connected&&<><h4>Últimos correos recibidos</h4><div className="gmail-inbox">{messages.map(message=><article key={message.id}><b>{message.subject||"(Sin asunto)"}</b><small>{message.from} · {message.date}</small><p>{message.snippet}</p><a href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#inbox/${message.id}`} target="_blank" rel="noreferrer">Abrir en Gmail</a></article>)}{!messages.length&&<p>No hay correos para mostrar.</p>}</div>
   <form onSubmit={send}><h4>Redactar correo</h4><label>Para<input name="to" type="email" required/></label><label>Asunto<input name="subject" maxLength={180} required/></label><label>Mensaje<textarea name="body" maxLength={20000} required/></label><button className="primary" disabled={busy}><Send/>{busy?"Enviando…":"Enviar correo"}</button></form>
  </>}
 </section>;
}
