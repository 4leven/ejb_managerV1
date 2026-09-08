import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bold, Italic, Underline, Smile, Image, Paperclip, Send, X } from "lucide-react";
import { saveProductRecord } from "../api/iniciativas";
import { readChatAttachment } from "../utils/chat-tools";

// Render a deliberately small formatting vocabulary as React nodes, never HTML.
export function AnnouncementText({text,formatted=false}:{text:string;formatted?:boolean}) {
 const render=(value:string,depth=0):any=>depth>8?value:value.split(/(\*\*[\s\S]+?\*\*|__[\s\S]+?__|_[^_]+?_)/g).map((part,index)=>
  part.startsWith("**")&&part.endsWith("**")?<strong key={index}>{render(part.slice(2,-2),depth+1)}</strong>:
  part.startsWith("__")&&part.endsWith("__")?<u key={index}>{render(part.slice(2,-2),depth+1)}</u>:
  part.startsWith("_")&&part.endsWith("_")?<em key={index}>{render(part.slice(1,-1),depth+1)}</em>:part);
 return <span className="announcement-text">{formatted?render(text):text}</span>;
}

export default function AnnouncementComposer({onPublished}:{onPublished:()=>Promise<unknown>}){
 const [text,setText]=useState(""),[title,setTitle]=useState(""),[priority,setPriority]=useState("Informativo"),[attachment,setAttachment]=useState<Awaited<ReturnType<typeof readChatAttachment>>|null>(null),[emojis,setEmojis]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(false);
 const textarea=useRef<HTMLTextAreaElement>(null),emojiBox=useRef<HTMLDivElement>(null),imageInput=useRef<HTMLInputElement>(null),fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!emojis)return;const close=(event:PointerEvent)=>{if(!emojiBox.current?.contains(event.target as Node))setEmojis(false)};const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setEmojis(false)};document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape)}},[emojis]);
 const insert=(start:string,end="")=>{
  const input=textarea.current;if(!input)return;
  const a=input.selectionStart,b=input.selectionEnd,selection=text.slice(a,b);
  const next=text.slice(0,a)+start+selection+end+text.slice(b);if(next.length>4000){setError("El comunicado admite hasta 4000 caracteres.");return;}
  setText(next);setSent(false);requestAnimationFrame(()=>{input.focus();input.setSelectionRange(a+start.length,b+start.length)});
 };
 const attach=async(input:HTMLInputElement)=>{const file=input.files?.[0];input.value="";if(!file)return;setBusy(true);setError("");try{setAttachment(await readChatAttachment(file));setSent(false)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo adjuntar el archivo.")}finally{setBusy(false)}};
 const submit=async(event:FormEvent)=>{event.preventDefault();if(busy||(!text.trim()&&!attachment))return;setBusy(true);setError("");setEmojis(false);
  const cleanTitle=(title.trim()||text.trim().split("\n")[0]||"Imagen o archivo compartido").replace(/\*\*|__/g,"").replace(/_/g,"").trim().slice(0,180)||"Comunicado";
  try{await saveProductRecord("comunicado",{titulo:cleanTitle,mensaje:text.trim(),formato:"markdown",prioridad:priority,adjuntos:attachment?[attachment]:[]});setText("");setTitle("");setAttachment(null);setSent(true);await onPublished()}
  catch(cause){setError(cause instanceof Error?cause.message:"No se pudo publicar el comunicado.")}finally{setBusy(false)}
 };
 return <form className="announcement-composer announcement-editor" onSubmit={submit}>
  <div className="announcement-editor-heading"><div><b>Nuevo comunicado</b><small>Mensaje, imagen o archivo para todo EJB.</small></div><span>Borrador</span></div>
  <label className="announcement-editor-field"><span>Título</span><input aria-label="Título del comunicado" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título del comunicado (opcional)" maxLength={180}/></label>
  <label className="announcement-editor-field"><span>Mensaje</span><textarea ref={textarea} aria-label="Mensaje del comunicado" value={text} onChange={e=>{setText(e.target.value);setSent(false)}} maxLength={4000} placeholder="Escribe el comunicado para todo el equipo…"/><small>{text.length}/4000 caracteres</small></label>
  {text&&<div className="announcement-format-preview"><small>Vista previa</small><AnnouncementText text={text} formatted/></div>}
  {attachment&&<div className="announcement-selected-file">{/^image\/(png|jpeg|webp|gif)$/.test(attachment.mime)&&<img src={attachment.data} alt="Imagen adjunta"/>}<span>{attachment.nombre}</span><button type="button" disabled={busy} aria-label="Quitar adjunto" onClick={()=>setAttachment(null)}><X/></button></div>}
  <div className="announcement-editor-toolbar">
   <div className="announcement-format-buttons" role="toolbar" aria-label="Formato y adjuntos">
    <button type="button" title="Negrita" aria-label="Negrita" onMouseDown={e=>e.preventDefault()} onClick={()=>insert("**","**")}><Bold/><span>Negrita</span></button>
    <button type="button" title="Cursiva" aria-label="Cursiva" onMouseDown={e=>e.preventDefault()} onClick={()=>insert("_","_")}><Italic/><span>Cursiva</span></button>
    <button type="button" title="Subrayado" aria-label="Subrayado" onMouseDown={e=>e.preventDefault()} onClick={()=>insert("__","__")}><Underline/><span>Subrayado</span></button>
    <div ref={emojiBox} className="announcement-emoji-anchor"><button type="button" title="Emojis" aria-label="Emojis" aria-expanded={emojis} onMouseDown={e=>e.preventDefault()} onClick={()=>setEmojis(!emojis)}><Smile/><span>Emoji</span></button>{emojis&&<div className="announcement-emojis">{["😀","😊","🎉","✅","📢","📅","👍","❤️","👏","🚀","⚠️","💡"].map(emoji=><button type="button" key={emoji} onMouseDown={e=>e.preventDefault()} onClick={()=>{insert(emoji);setEmojis(false)}}>{emoji}</button>)}</div>}</div>
    <button type="button" disabled={busy} title="Adjuntar imagen" aria-label="Adjuntar imagen" onClick={()=>imageInput.current?.click()}><Image/><span>Imagen</span></button>
    <button type="button" disabled={busy} title="Adjuntar archivo (máx. 2 MB)" aria-label="Adjuntar archivo" onClick={()=>fileInput.current?.click()}><Paperclip/><span>Archivo</span></button>
   </div>
   <input hidden ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>void attach(e.currentTarget)}/>
   <input hidden ref={fileInput} type="file" onChange={e=>void attach(e.currentTarget)}/>
   <select aria-label="Prioridad del comunicado" value={priority} onChange={e=>setPriority(e.target.value)}><option>Informativo</option><option>Importante</option><option>Urgente</option></select>
   <button type="submit" className="primary" disabled={busy||(!text.trim()&&!attachment)}><Send/>{busy?"Publicando…":"Publicar"}</button>
  </div>
  {error&&<p role="alert">{error}</p>}{sent&&<p role="status">Comunicado publicado.</p>}
 </form>;
}
