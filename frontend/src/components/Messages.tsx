import AnnouncementComposer, { AnnouncementText } from "./AnnouncementComposer";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import EmojiPicker, {
  Categories,
  EmojiStyle,
  SkinTonePickerLocation,
  Theme,
} from "emoji-picker-react";
import {
  ArrowLeft,
  Accessibility,
  Bell,
  BellOff,
  BriefcaseBusiness,
  CalendarDays,
  CircleCheck,
  CircleMinus,
  Clock3,
  Check,
  ChevronDown,
  Download,
  Forward,
  FileText,
  Inbox,
  Hash,
  Home,
  Image,
  Lightbulb,
  Mail,
  Star,
  Settings,
  Shield,
  MessageCircle,
  Reply,
  Megaphone,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Search,
  Send,
  Smile,
  Trash2,
  Type,
  Upload,
  Utensils,
  Plus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  deleteConversation,
  deleteMessageForEveryone,
  deleteChatSpace,
  chatSpaceAction,
  fetchCollaboration,
  fetchConversations,
  fetchMessages,
  fetchIniciativas,
  fetchScheduledMessages,
  deleteScheduledMessage,
  updateScheduledMessage,
  forwardMessage,
  fetchProductRecords,
  inviteGroupMember,
  saveMessageStatus,
  saveNotificationPreferences,
  sendMessage,
  scheduleMessage,
  searchMessageContent,
  toggleMessageReaction,
  saveProductRecord,
  updateCollaboration,
  updateProductRecord,
} from "../api/iniciativas";
import {
  MessageSpaceList,
  MessageSpaces,
  type RecordRow,
} from "./CollaborationModules";
import { chatTones, playChatTone, correctLastWord, readChatAttachment } from "../utils/chat-tools";
import { uiConfirm, uiPrompt, uiAlert } from "../utils/dialog";
import { cargoLabel } from "../utils/access";

type Conversation = {
  id: string;
  nombres: string;
  apellidos: string;
  fotoPerfil?: string | null;
  cargo: string;
  estadoMensaje: string;
  area: { nombre: string; colorHex: string };
  lastMessage?: { contenido: string; createdAt: string } | null;
  unread: number;
  hidden?: boolean;
};
type Message = {
  eliminadoAt?:string|null;
  id: string;
  remitenteId: string;
  destinatarioId: string;
  contenido: string;
  tipo: "Texto" | "Documento" | "Sticker";
  archivoNombre?: string;
  archivoMime?: string;
  archivoData?: string;
  createdAt: string;
  respuestaAId?: string | null;
  respuestaA?: Pick<Message, "id" | "contenido" | "tipo" | "remitenteId" | "createdAt"> | null;
  reenviadoDeId?: string | null;
  reenviadoDe?: Pick<Message, "id" | "contenido" | "tipo" | "remitenteId" | "createdAt"> | null;
  reacciones?: { emoji: string; count: number; mine: boolean }[];
  sourceSpace?: boolean;
};
type ScheduledMessage = Message & { destinatarioId: string; enviarEn: string; enviadoAt?: string | null };
type MessageSearchGroup = { usuario: { id: string; nombres: string; apellidos: string; fotoPerfil?: string | null }; resultados: { mensajeId: string; fragmento: string; createdAt: string }[] };
const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "✅"];
type GifResult = {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
};
type CustomWallpaper = {
  id: string;
  name: string;
  data: string;
  createdAt: string;
};
const wallpaperDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ejb-manager-wallpapers", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("wallpapers"))
        request.result.createObjectStore("wallpapers", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const loadCustomWallpapers = async () => {
  const db = await wallpaperDb();
  return new Promise<CustomWallpaper[]>((resolve, reject) => {
    const request = db
      .transaction("wallpapers", "readonly")
      .objectStore("wallpapers")
      .getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as CustomWallpaper[]).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    request.onerror = () => reject(request.error);
  });
};
const storeCustomWallpaper = async (item: CustomWallpaper) => {
  const db = await wallpaperDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction("wallpapers", "readwrite")
      .objectStore("wallpapers")
      .put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
const initials = (v: string) =>
  v
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2);
const statusOptions = [
  { value: "Disponible", label: "Disponible", Icon: CircleCheck },
  { value: "Break", label: "Break", Icon: Utensils },
  { value: "Ausente", label: "Ausente", Icon: Clock3 },
  { value: "Ocupado", label: "Ocupado", Icon: CircleMinus },
  { value: "No_molestar", label: "No molestar", Icon: BellOff },
];
const statusLabel = (value: string) =>
  statusOptions.find((option) => option.value === value)?.label ?? "Disponible";
function StatusGlyph({ value, compact = false }: { value: string; compact?: boolean }) {
  const option = statusOptions.find((item) => item.value === value) ?? statusOptions[0];
  const Icon = option.Icon;
  return (
    <span
      className={`chat-status-glyph status-${option.value.toLowerCase().replace("_", "-")} ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}
const wallpaperOptions = [
  { id: "ejb-doodle-light", name: "Claro", asset: "/chat-wallpapers/ejb-light.jpeg" },
  { id: "ejb-doodle-blue", name: "Azul EJB", asset: "/chat-wallpapers/ejb-blue.jpeg" },
  { id: "ejb-doodle-green", name: "Verde EJB", asset: "/chat-wallpapers/ejb-green.jpeg" },
  { id: "ejb-doodle-black", name: "Negro", asset: "/chat-wallpapers/ejb-black.jpeg" },
];
function SettingSwitch({label,detail,checked,onChange}:{label:string;detail?:string;checked:boolean;onChange:(value:boolean)=>void}){
  return <label className="setting-switch"><span><b>{label}</b>{detail&&<small>{detail}</small>}</span><input type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)}/><span className="setting-switch-track" aria-hidden="true"><span/></span></label>;
}
export default function Messages({
  currentUserId,
  currentStatus,
  onStatusChange,
  onIncomingMessage,
  canPublishAnnouncements = false,
  notificationCount = 0,
  notifications = [],
  onBackToDashboard,
  onNavigate,
}: {
  currentUserId: string;
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onIncomingMessage: (
    name: string,
    message: string,
    photo?: string | null,
  ) => void;
  canPublishAnnouncements?: boolean;
  notificationCount?: number;
  notifications?: { title?: string; message?: string; severity?: string; type?: string }[];
  onBackToDashboard?: () => void;
  onNavigate?: (page: "calendario" | "iniciativas" | "mi-trabajo" | "equipo" | "notificaciones") => void;
}) {
  const [chatBusy, setChatBusy] = useState(false);
  const spaceVersion = useRef(0);
  const [contacts, setContacts] = useState<Conversation[]>([]),
    [active, setActive] = useState<Conversation | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState(""),
    [activeSpace, setActiveSpace] = useState<RecordRow | null>(null),
    [spaceDraft, setSpaceDraft] = useState(""),
    [spaceReply, setSpaceReply] = useState<any | null>(null),
    [spaceSettings, setSpaceSettings] = useState(false),
    [announcementsOpen, setAnnouncementsOpen] = useState(false),
    [announcementComposerOpen, setAnnouncementComposerOpen] = useState(false),
    [announcements, setAnnouncements] = useState<any[]>([]),
    [inboxView, setInboxView] = useState<"home" | "unread" | "starred" | "scheduled">("home"),
    [homeFilter, setHomeFilter] = useState<"all" | "dms" | "spaces" | "unread" | "pinned">("all"),
    [pinnedContacts, setPinnedContacts] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem(`ejb_pinned_chats_${currentUserId}`) || "[]"); } catch { return []; }
    }),
    [accessOpen, setAccessOpen] = useState(true),
    [directOpen, setDirectOpen] = useState(true),
    [spacesOpen, setSpacesOpen] = useState(true),
    [threadView, setThreadView] = useState(false),
    [dmReply, setDmReply] = useState<Message | null>(null),
    [reactionTarget, setReactionTarget] = useState<string | null>(null),
    [forwardTarget, setForwardTarget] = useState<Message | null>(null),
    [forwardRecipients, setForwardRecipients] = useState<string[]>([]),
    [scheduleOpen, setScheduleOpen] = useState(false),
    [scheduleAt, setScheduleAt] = useState(""),
    [scheduled, setScheduled] = useState<ScheduledMessage[]>([]),
    [contentResults, setContentResults] = useState<MessageSearchGroup[]>([]),
    [pendingMessageId, setPendingMessageId] = useState<string | null>(null),
    [chipPreview, setChipPreview] = useState<{ title: string; detail: string } | null>(null),
    [initiatives, setInitiatives] = useState<any[]>([]),
    [newChatOpen, setNewChatOpen] = useState(false),
    [newChatQuery, setNewChatQuery] = useState(""),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [settingsTab, setSettingsTab] = useState<"notifications"|"messages"|"appearance"|"accessibility">("notifications"),
    [composerMenuOpen, setComposerMenuOpen] = useState(false),
    [formattingOpen, setFormattingOpen] = useState(false),
    [isRecording, setIsRecording] = useState(false),
    [settingsFeedback, setSettingsFeedback] = useState(""),
    [chatPreferences, setChatPreferences] = useState(() => {
      const defaults={desktop:true,reactions:true,sound:"Tonos",email:false,callSound:true,autocorrect:true,markdown:true,color:"Zafiro",mode:"Sistema",density:"Cómoda",animations:"system",timezone:true};
      try{return {...defaults,...JSON.parse(localStorage.getItem(`ejb_chat_preferences_${currentUserId}`)||"{}")}}catch{return defaults}
    }),
    [sidebarHidden, setSidebarHidden] = useState(false),
    [statusOpen, setStatusOpen] = useState<"appbar" | "panel" | null>(null),
    [stickersOpen, setStickersOpen] = useState(false),
    [gifsOpen, setGifsOpen] = useState(false),
    [gifQuery, setGifQuery] = useState(""),
    [gifResults, setGifResults] = useState<GifResult[]>([]),
    [gifsLoading, setGifsLoading] = useState(false),
    [gifsLoadingMore, setGifsLoadingMore] = useState(false),
    [gifPage, setGifPage] = useState(1),
    [gifHasNext, setGifHasNext] = useState(true),
    [recentGifs, setRecentGifs] = useState<GifResult[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem(`ejb_recent_gifs_${currentUserId}`) || "[]",
        ).slice(0, 12);
      } catch {
        return [];
      }
    }),
    [favoriteGifs, setFavoriteGifs] = useState<GifResult[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem(`ejb_favorite_gifs_${currentUserId}`) || "[]",
        );
      } catch {
        return [];
      }
    }),
    [wallpaperOpen, setWallpaperOpen] = useState(false),
    [wallpaperHistory, setWallpaperHistory] = useState<CustomWallpaper[]>([]),
    [chatWallpapers, setChatWallpapers] = useState<Record<string, string>>(
      () => {
        try {
          return JSON.parse(
            localStorage.getItem(`ejb_chat_wallpapers_${currentUserId}`) ||
              "{}",
          );
        } catch {
          return {};
        }
      },
    );
  const messagesBox = useRef<HTMLDivElement | null>(null),
    announcementsFeed = useRef<HTMLDivElement | null>(null),
    messageInput = useRef<HTMLInputElement | null>(null),
    searchInput = useRef<HTMLInputElement | null>(null),
    knownMessages = useRef<Set<string>>(new Set()),
    messageStreamReady = useRef(false),
    stickToBottom = useRef(true),
    recorder = useRef<MediaRecorder | null>(null),
    recordedChunks = useRef<Blob[]>([]);
  const trackChatScroll = () => {
    const box = messagesBox.current;
    if (box)
      stickToBottom.current =
        box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  };
  const loadContacts = () =>
    fetchConversations().then((rows: Conversation[]) => {
      setContacts((previous) => JSON.stringify(previous) === JSON.stringify(rows) ? previous : rows);
      setActive((activeContact) =>
        activeContact
          ? (() => { const next = rows.find((row) => row.id === activeContact.id) ?? null; return JSON.stringify(next) === JSON.stringify(activeContact) ? activeContact : next; })()
          : null,
      );
    });
  const loadAnnouncements = () => fetchProductRecords("comunicado").then(setAnnouncements).catch(() => setAnnouncements([]));
  useEffect(() => { void loadAnnouncements(); }, []);
  useEffect(() => {
    if (!announcementsOpen) return;
    requestAnimationFrame(() => {
      const feed = announcementsFeed.current;
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
  }, [announcementsOpen, announcements]);
  useEffect(()=>{localStorage.setItem(`ejb_chat_preferences_${currentUserId}`,JSON.stringify(chatPreferences))},[chatPreferences,currentUserId]);
  const updatePreference=(key:string,value:unknown)=>{setChatPreferences((current:any)=>({...current,[key]:value}));setSettingsFeedback("Cambios guardados")};
  const testNotificationSound = async (sound: string) => {
    try { await playChatTone(sound); setSettingsFeedback(sound === "Silencio" ? "Sonido desactivado" : `Reproduciendo: ${sound}`); }
    catch (error) { setSettingsFeedback(error instanceof Error ? error.message : "No se pudo reproducir el sonido"); }
  };
  useEffect(()=>{if(!settingsOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSettingsOpen(false)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[settingsOpen]);
  useEffect(() => {
    const closeFloatingPanels = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (reactionTarget && !target.closest(".chat-reaction-picker, [data-reaction-trigger]")) setReactionTarget(null);
      if (composerMenuOpen && !target.closest(".composer-plus-menu, .composer-plus")) setComposerMenuOpen(false);
      if (formattingOpen && !target.closest(".composer-format-menu, [data-format-trigger]")) setFormattingOpen(false);
      if (stickersOpen && !target.closest(".sticker-picker, [data-sticker-trigger]")) setStickersOpen(false);
      if (gifsOpen && !target.closest(".gif-picker, [data-gif-trigger]")) setGifsOpen(false);
      if (scheduleOpen && !target.closest(".schedule-popover, [data-schedule-trigger]")) setScheduleOpen(false);
      if (wallpaperOpen && !target.closest(".wallpaper-gallery, [data-wallpaper-trigger]")) setWallpaperOpen(false);
      if (statusOpen && !target.closest(".chat-app-status, .chat-app-status-menu, .status-trigger, .status-menu")) setStatusOpen(null);
      if (notificationsOpen && !target.closest(".chat-notifications-popover, .chat-notifications-button")) setNotificationsOpen(false);
      if (chipPreview && !target.closest(".chat-chip-popover, .chat-smart-chip")) setChipPreview(null);
    };
    document.addEventListener("pointerdown", closeFloatingPanels);
    return () => document.removeEventListener("pointerdown", closeFloatingPanels);
  }, [reactionTarget, composerMenuOpen, formattingOpen, stickersOpen, gifsOpen, scheduleOpen, wallpaperOpen, statusOpen, notificationsOpen, chipPreview]);
  useEffect(() => { void fetchIniciativas().then(setInitiatives).catch(() => setInitiatives([])); }, []);
  const loadScheduled = () => fetchScheduledMessages().then(setScheduled).catch(() => setScheduled([]));
  useEffect(() => { void loadScheduled(); const timer = setInterval(loadScheduled, 15000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    loadContacts();
    const timer = setInterval(loadContacts, 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    loadCustomWallpapers()
      .then(setWallpaperHistory)
      .catch(() => setWallpaperHistory([]));
  }, []);
  useEffect(() => {
    if (!active) return;
    stickToBottom.current = true;
    knownMessages.current = new Set();
    messageStreamReady.current = false;
    let loading = false, disposed = false;
    const load = () => {
      if (loading || document.hidden) return;
      loading = true;
      return fetchMessages(active.id).then((rows: Message[]) => {
        if (disposed) return;
        if (messageStreamReady.current) {
          const incoming = rows.find(
            (row) =>
              row.remitenteId !== currentUserId &&
              !knownMessages.current.has(row.id),
          );
          if (incoming)
            onIncomingMessage(
              `${active.nombres} ${active.apellidos}`,
              incoming.contenido,
              active.fotoPerfil,
            );
        }
        knownMessages.current = new Set(rows.map((row) => row.id));
        messageStreamReady.current = true;
        setMessages(rows);
      }).catch(() => undefined).finally(() => { loading = false; });
    };
    load();
    const timer = setInterval(load, 4000);
    return () => { disposed = true; clearInterval(timer); };
  }, [active?.id]);
  useEffect(()=>{
    if(!activeSpace)return;
    const id=activeSpace.id,type=activeSpace.datos.esCanal?"canal":"grupo";let disposed=false,loading=false;
    const refresh=async()=>{
      if(loading||document.hidden)return;loading=true;const version=spaceVersion.current;
      try{const rows=await fetchCollaboration(type);if(disposed||version!==spaceVersion.current)return;
        const row=rows.find((item:any)=>item.id===id);
        setActiveSpace(current=>current?.id===id?(row?{...row,datos:{...row.datos,tipo:type,esCanal:type==="canal"}}:null):current);
      }catch{}finally{loading=false}
    };
    const timer=setInterval(refresh,4000);return()=>{disposed=true;clearInterval(timer)};
  },[activeSpace?.id]);
  useEffect(() => {
    if (!pendingMessageId || !messages.length) return;
    requestAnimationFrame(() => {
      document.querySelector(`[data-message-id="${pendingMessageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingMessageId(null);
    });
  }, [messages, pendingMessageId]);
  useEffect(() => {
    stickToBottom.current = true;
  }, [active?.id, activeSpace?.id]);
  useEffect(() => {
    const box = messagesBox.current;
    if (box && stickToBottom.current)
      requestAnimationFrame(() =>
        box.scrollTo({ top: box.scrollHeight, behavior: "smooth" }),
      );
  }, [messages, activeSpace?.datos.mensajes?.length]);
  useEffect(() => {
    if (!gifsOpen) return;
    const controller = new AbortController(),
      timer = setTimeout(
        async () => {
          setGifsLoading(true);
          setGifPage(1);
          try {
            const endpoint = gifQuery.trim()
              ? `https://gifsnap.com/api/v1/gifs/search?q=${encodeURIComponent(gifQuery.trim())}&page=1&limit=36`
              : `https://gifsnap.com/api/v1/gifs/trending?page=1&limit=36`;
            const response = await fetch(endpoint, {
              signal: controller.signal,
            });
            if (!response.ok) throw new Error();
            const body = await response.json();
            setGifResults(body.data ?? []);
            setGifHasNext(Boolean(body.pagination?.has_next));
          } catch (error) {
            if ((error as Error).name !== "AbortError") {
              setGifResults([]);
              setGifHasNext(false);
            }
          } finally {
            setGifsLoading(false);
          }
        },
        gifQuery ? 350 : 0,
      );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [gifsOpen, gifQuery]);
  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        if(c.hidden && !c.lastMessage) return false;
        const matchesQuery = `${c.nombres} ${c.apellidos}`
          .toLowerCase()
          .includes(query.toLowerCase());
        if (threadView && !c.lastMessage) return false;
        if (inboxView === "unread" || homeFilter === "unread") return matchesQuery && c.unread > 0;
        if (homeFilter === "spaces") return false;
        if (homeFilter === "pinned" || inboxView === "starred") return matchesQuery && pinnedContacts.includes(c.id);
        return matchesQuery;
      }),
    [contacts, query, inboxView, homeFilter, pinnedContacts, threadView],
  );
  useEffect(() => {
    if (query.trim().length < 2 || filtered.length) { setContentResults([]); return; }
    const timer = setTimeout(() => void searchMessageContent(query.trim()).then(setContentResults).catch(() => setContentResults([])), 350);
    return () => clearTimeout(timer);
  }, [query, filtered.length]);
  const togglePinnedContact = (id:string) => {
    setPinnedContacts((current) => {
      const next=current.includes(id)?current.filter((value)=>value!==id):[...current,id];
      localStorage.setItem(`ejb_pinned_chats_${currentUserId}`,JSON.stringify(next));
      return next;
    });
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!active) return;
    if (!draft.trim()) return;
    const row = await sendMessage(active.id, { contenido: draft, respuestaAId: dmReply?.id });
    stickToBottom.current = true;
    setMessages((v) => [...v, row]);
    setDraft("");
    setDmReply(null);
  };
  const programCurrentMessage = async () => {
    if (!active || !draft.trim() || !scheduleAt) return;
    await scheduleMessage(active.id, { contenido: draft.trim(), enviarEn: new Date(scheduleAt).toISOString() });
    setDraft(""); setScheduleAt(""); setScheduleOpen(false); await loadScheduled();
  };
  const reactDmMessage = async (messageId: string, emoji: string) => {
    const reacciones = await toggleMessageReaction(messageId, emoji);
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reacciones } : message));
    setReactionTarget(null);
  };
  const forwardSelectedMessage = async () => {
    if (!forwardTarget || !forwardRecipients.length) return;
    if (forwardTarget.sourceSpace) await Promise.all(forwardRecipients.map((id)=>sendMessage(id,{contenido:forwardTarget.contenido,tipo:forwardTarget.tipo,archivoNombre:forwardTarget.archivoNombre,archivoMime:forwardTarget.archivoMime,archivoData:forwardTarget.archivoData})));
    else await forwardMessage(forwardTarget.id, forwardRecipients);
    setForwardTarget(null); setForwardRecipients([]); await loadContacts();
  };
  const formatDraft = (prefix:string,suffix=prefix) => {
    const input=messageInput.current;if(!input)return;
    const start=input.selectionStart??draft.length,end=input.selectionEnd??draft.length;
    setDraft(`${draft.slice(0,start)}${prefix}${draft.slice(start,end)}${suffix}${draft.slice(end)}`);
    requestAnimationFrame(()=>{input.focus();input.setSelectionRange(start+prefix.length,end+prefix.length)});
  };
  const toggleVoiceRecording = async () => {
    if (isRecording) { recorder.current?.stop(); return; }
    if (!active || !navigator.mediaDevices?.getUserMedia) return alert("Este navegador no permite grabar audio.");
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});recordedChunks.current=[];
    const mediaRecorder=new MediaRecorder(stream);recorder.current=mediaRecorder;
    mediaRecorder.ondataavailable=(event)=>{if(event.data.size)recordedChunks.current.push(event.data)};
    mediaRecorder.onstop=()=>{setIsRecording(false);stream.getTracks().forEach((track)=>track.stop());const blob=new Blob(recordedChunks.current,{type:mediaRecorder.mimeType||"audio/webm"});if(blob.size>2000000)return alert("La nota de voz supera los 2 MB.");const reader=new FileReader();reader.onload=async()=>{const row=await sendMessage(active.id,{contenido:"Nota de voz",tipo:"Documento",archivoNombre:`nota-de-voz-${Date.now()}.webm`,archivoMime:blob.type,archivoData:String(reader.result)});setMessages((current)=>[...current,row])};reader.readAsDataURL(blob)};
    mediaRecorder.start();setIsRecording(true);
  };
  const sendSticker = (sticker: string) => {
    setDraft((value) => `${value}${sticker}`);
    setStickersOpen(false);
    requestAnimationFrame(() => messageInput.current?.focus());
  };
  const performSpaceAction = async (data: Record<string,unknown>) => {
    if(!activeSpace || chatBusy) return;
    const id=activeSpace.id, type=activeSpace.datos.esCanal ? "canal" : "grupo";
    setChatBusy(true); spaceVersion.current++;
    try {
      const updated=await chatSpaceAction(type,id,data);
      setActiveSpace(current=>current?.id===id?updated:current);
      return updated;
    }catch(error){await uiAlert("No se pudo completar la acción",error instanceof Error?error.message:"Inténtalo nuevamente.");}
    finally{spaceVersion.current++;setChatBusy(false);}
  };
  const sendSpaceMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(!spaceDraft.trim())return;
    if(await performSpaceAction({action:"post",texto:spaceDraft.trim(),replyId:spaceReply?.id})){
      stickToBottom.current=true;setSpaceDraft("");setSpaceReply(null);
    }
  };
  const reactSpaceMessage = async (message:any,emoji:string) => {
    if(await performSpaceAction({action:"react",messageId:message.id,emoji}))setReactionTarget(null);
  };
  const editSpaceMessage = async (message:any) => {
    const texto=await uiPrompt("Editar mensaje",message.texto,{multiline:true});
    if(texto?.trim())await performSpaceAction({action:"edit",messageId:message.id,texto:texto.trim()});
  };
  const commentOnPost = async (message:any) => {
    const texto=await uiPrompt("Comentar publicación","",{multiline:true,message:message.texto?.slice(0,160)});
    if(texto?.trim())await performSpaceAction({action:"comment",messageId:message.id,texto:texto.trim()});
  };
  const removePost = async (message:any) => {
    if(await uiConfirm("Eliminar publicación","Se retirará esta publicación del espacio."))await performSpaceAction({action:"remove",messageId:message.id});
  };
  const removeDirectChat = async () => {
    if(!active || !(await uiConfirm("Eliminar chat","Se ocultará el historial anterior solo para ti. La otra persona conservará su copia. Los nuevos mensajes volverán a aparecer.")))return;
    try{await deleteConversation(active.id);setActive(null);setMessages([]);setDmReply(null);setDraft("");await loadContacts();}
    catch(error){await uiAlert("No se pudo eliminar",error instanceof Error?error.message:"Inténtalo nuevamente.");}
  };
  const removeSpace = async () => {
    if(!activeSpace || !(await uiConfirm("Eliminar espacio","Se retirará el grupo o canal de la lista para todos sus integrantes. Solo administración podrá recuperar el registro.")))return;
    try{await deleteChatSpace(activeSpace.datos.esCanal?"canal":"grupo",activeSpace.id);setSpaceSettings(false);setActiveSpace(null);window.dispatchEvent(new Event("ejb-spaces-changed"));}
    catch(error){await uiAlert("No se pudo eliminar",error instanceof Error?error.message:"Inténtalo nuevamente.");}
  };
  const removeDmForEveryone=async(message:Message)=>{
    if(!await uiConfirm("Eliminar para todos","El mensaje y sus archivos se retirarán de la conversación para ambas personas."))return;
    try{const updated=await deleteMessageForEveryone(message.id);setMessages(rows=>rows.map(row=>row.id===message.id?updated:row));setReactionTarget(null);setDmReply(null);setForwardTarget(null);}
    catch(error){await uiAlert("No se pudo eliminar",error instanceof Error?error.message:"Intenta nuevamente.");}
  };
  const editAnnouncement=async(row:any)=>{
    const titulo=await uiPrompt("Editar comunicado",row.datos.titulo);if(!titulo)return;
    const mensaje=await uiPrompt("Contenido",row.datos.mensaje,{multiline:true});if(!mensaje)return;
    try{await updateProductRecord("comunicado",row.id,{...row.datos,titulo,mensaje});await loadAnnouncements();}
    catch(error){await uiAlert("No se pudo editar",String(error));}
  };
  const attachmentView = (file:any) => <a className="chat-post-attachment" href={file.data} download={file.nombre}>
    {/^image\/(png|jpeg|webp|gif)$/.test(file.mime)?<img src={file.data} alt={file.nombre}/>:<FileText/>}
    <span>{file.nombre}</span><Download/>
  </a>;
  const markdownText = (value:string,key:number) => value.split(/(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|_[^_]+_)/g).map((part,index)=>part.startsWith("**")?<strong key={`${key}-${index}`}>{part.slice(2,-2)}</strong>:part.startsWith("~~")?<del key={`${key}-${index}`}>{part.slice(2,-2)}</del>:part.startsWith("`")?<code key={`${key}-${index}`}>{part.slice(1,-1)}</code>:part.startsWith("_")?<em key={`${key}-${index}`}>{part.slice(1,-1)}</em>:part);
  const richText = (value: string) => value.split(/(@[\p{L}\d._-]+|\b(?:INV|IN)-\d{3,}\b)/giu).map((part, index) => {
    if (part.startsWith("@")) {
      const needle = part.slice(1).replace(/[._-]/g, "").toLowerCase();
      const person = contacts.find((contact) => `${contact.nombres}${contact.apellidos}`.toLowerCase().replace(/\s+/g, "").includes(needle));
      return <button type="button" className="chat-smart-chip chat-mention" key={index} onClick={() => setChipPreview({ title: person ? `${person.nombres} ${person.apellidos}` : part, detail: person ? `${cargoLabel(person.cargo)} · ${statusLabel(person.estadoMensaje)}` : "Mención" })}>{part}</button>;
    }
    if (/^(?:INV|IN)-\d{3,}$/i.test(part)) {
      const initiative = initiatives.find((item) => String(item.codigo).toLowerCase() === part.toLowerCase());
      return <button type="button" className="chat-smart-chip initiative-chip" key={index} onClick={() => setChipPreview({ title: initiative?.titulo ?? part, detail: initiative ? `${initiative.estado} · ${initiative.porcentajeAvance ?? 0}% de avance` : "Iniciativa no encontrada" })}>{part}</button>;
    }
    return chatPreferences.markdown ? markdownText(part,index) : part;
  });
  const sendSpaceGif = async (gif:GifResult) => {
    if(await performSpaceAction({action:"post",texto:gif.title||"GIF",gif:gif.url}))setGifsOpen(false);
  };
  const saveSpace = async (datos: any) => {
    if (!activeSpace) return;
    const type =
        activeSpace.datos.tipo ??
        (activeSpace.datos.esCanal ? "canal" : "grupo"),
      previousMembers: string[] = activeSpace.datos.miembros ?? [
        activeSpace.creador.id,
      ],
      nextMembers: string[] = datos.miembros ?? previousMembers,
      added = nextMembers.filter((id) => !previousMembers.includes(id));
    if (type === "grupo" && added.length) {
      for (const usuarioId of added)
        await inviteGroupMember(activeSpace.id, usuarioId);
      alert("Invitación enviada. La persona se unirá cuando la acepte.");
      return;
    }
    const updated = await updateCollaboration(type, activeSpace.id, datos);
    setActiveSpace(updated);
  };
  const wallpaperKey = activeSpace
    ? `space-${activeSpace.id}`
    : active
      ? `direct-${active.id}`
      : "general";
  const usesDarkChatTheme =
    chatPreferences.mode === "Oscuro" ||
    (chatPreferences.mode === "Sistema" && document.documentElement.classList.contains("dark"));
  const savedWallpaper = chatWallpapers[wallpaperKey];
  const wallpaper =
    savedWallpaper?.startsWith("custom:") ||
    savedWallpaper?.startsWith("data:image/") ||
    wallpaperOptions.some((option) => option.id === savedWallpaper)
      ? savedWallpaper
      : usesDarkChatTheme
        ? "ejb-doodle-blue"
        : "ejb-doodle-light";
  const historyWallpaper = wallpaper.startsWith("custom:")
    ? wallpaperHistory.find((item) => item.id === wallpaper.slice(7))
    : undefined;
  const customWallpaperData =
    historyWallpaper?.data ||
    (wallpaper.startsWith("data:image/") ? wallpaper : "");
  const customWallpaper = Boolean(customWallpaperData);
  const wallpaperClass = customWallpaper ? "custom" : wallpaper;
  const chooseWallpaper = (value: string) => {
    const next = { ...chatWallpapers, [wallpaperKey]: value };
    try {
      localStorage.setItem(
        `ejb_chat_wallpapers_${currentUserId}`,
        JSON.stringify(next),
      );
      setChatWallpapers(next);
      setWallpaperOpen(false);
    } catch {
      alert(
        "La imagen es demasiado pesada para guardarla. Prueba con una imagen menor.",
      );
    }
  };
  const chooseCustomWallpaper = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return alert("Selecciona una imagen JPG, PNG o WEBP.");
    if (file.size > 8000000)
      return alert("La imagen debe pesar menos de 8 MB.");
    const source = URL.createObjectURL(file),
      image = new window.Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject();
        image.src = source;
      });
      if (image.naturalWidth < 1600 || image.naturalHeight < 900)
        return alert(
          "Para evitar pixelación, usa una imagen de al menos 1600 × 900 px.",
        );
      const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
        item = {
          id: crypto.randomUUID(),
          name: file.name,
          data,
          createdAt: new Date().toISOString(),
        };
      await storeCustomWallpaper(item);
      setWallpaperHistory((current) => [item, ...current]);
      chooseWallpaper(`custom:${item.id}`);
    } catch {
      alert("No se pudo guardar la imagen seleccionada.");
    } finally {
      URL.revokeObjectURL(source);
      input.value = "";
    }
  };
  const saveSpacePhoto = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file || !activeSpace) return;
    if (!file.type.startsWith("image/") || file.size > 2000000)
      return alert("Selecciona una imagen menor a 2 MB");
    const reader = new FileReader();
    reader.onload = () =>
      saveSpace({ ...activeSpace.datos, foto: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const members: string[] = activeSpace
    ? Array.from(
        new Set<string>(
          (activeSpace.datos.miembros ?? [activeSpace.creador.id]) as string[],
        ),
      )
    : [];
  const moderators: string[] = activeSpace
    ? Array.from(
        new Set<string>((activeSpace.datos.moderadores ?? []) as string[]),
      )
    : [];
  const muted = activeSpace
    ? (activeSpace.datos.silenciados ?? []).includes(currentUserId)
    : false;
  const canManage = Boolean(
    activeSpace &&
      (activeSpace.creador.id === currentUserId ||
        moderators.includes(currentUserId)),
  );
  const sendFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file || !active) return;
    if (file.size > 2000000)
      return alert("El documento debe pesar menos de 2 MB");
    const reader = new FileReader();
    reader.onload = async () => {
      const row = await sendMessage(active.id, {
        contenido: file.name,
        tipo: "Documento",
        archivoNombre: file.name,
        archivoMime: file.type || "application/octet-stream",
        archivoData: String(reader.result),
      });
      stickToBottom.current = true;
      setMessages((v) => [...v, row]);
      input.value = "";
    };
    reader.readAsDataURL(file);
  };
  const sendGif = async (gif: GifResult) => {
    if (!active) return;
    const row = await sendMessage(active.id, {
      contenido: gif.title || "GIF",
      tipo: "Documento",
      archivoNombre: gif.title || "GIF",
      archivoMime: "image/gif",
      archivoData: gif.url,
    });
    stickToBottom.current = true;
    setMessages((v) => [...v, row]);
    setGifsOpen(false);
  };
  const chooseGif = (gif: GifResult, onChoose: (gif: GifResult) => void) => {
    const next = [
      gif,
      ...recentGifs.filter((item) => item.id !== gif.id),
    ].slice(0, 12);
    setRecentGifs(next);
    localStorage.setItem(
      `ejb_recent_gifs_${currentUserId}`,
      JSON.stringify(next),
    );
    onChoose(gif);
  };
  const clearRecentGifs = () => {
    setRecentGifs([]);
    localStorage.removeItem(`ejb_recent_gifs_${currentUserId}`);
  };
  const isFavoriteGif = (id: string) =>
    favoriteGifs.some((gif) => gif.id === id);
  const toggleFavoriteGif = (gif: GifResult) => {
    const next = isFavoriteGif(gif.id)
      ? favoriteGifs.filter((item) => item.id !== gif.id)
      : [gif, ...favoriteGifs];
    setFavoriteGifs(next);
    localStorage.setItem(
      `ejb_favorite_gifs_${currentUserId}`,
      JSON.stringify(next),
    );
  };
  const loadMoreGifs = async () => {
    if (gifsLoadingMore || !gifHasNext) return;
    const nextPage = gifPage + 1;
    setGifsLoadingMore(true);
    try {
      const endpoint = gifQuery.trim()
        ? `https://gifsnap.com/api/v1/gifs/search?q=${encodeURIComponent(gifQuery.trim())}&page=${nextPage}&limit=36`
        : `https://gifsnap.com/api/v1/gifs/trending?page=${nextPage}&limit=36`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error();
      const body = await response.json(),
        incoming: GifResult[] = body.data ?? [];
      setGifResults((current) => [
        ...current,
        ...incoming.filter(
          (gif) => !current.some((item) => item.id === gif.id),
        ),
      ]);
      setGifPage(nextPage);
      setGifHasNext(Boolean(body.pagination?.has_next));
    } finally {
      setGifsLoadingMore(false);
    }
  };
  const gifTile = (
    gif: GifResult,
    onChoose: (gif: GifResult) => void,
    keyPrefix: string,
  ) => (
    <div className="gif-tile" key={`${keyPrefix}-${gif.id}`}>
      <button
        type="button"
        className="gif-send"
        onClick={() => chooseGif(gif, onChoose)}
        title={`Enviar ${gif.title || "GIF"}`}
      >
        <img
          src={gif.preview_url || gif.url}
          alt={gif.title || "GIF"}
          loading="lazy"
        />
      </button>
      <button
        type="button"
        className={`gif-favorite ${isFavoriteGif(gif.id) ? "active" : ""}`}
        onClick={() => toggleFavoriteGif(gif)}
        aria-label={
          isFavoriteGif(gif.id) ? "Quitar de favoritos" : "Agregar a favoritos"
        }
        title={
          isFavoriteGif(gif.id) ? "Quitar de favoritos" : "Agregar a favoritos"
        }
      >
        <Star />
      </button>
    </div>
  );
  const sentGif = (url: string, title = "GIF compartido") => {
    const gif: GifResult = {
        id: url,
        title,
        url,
        preview_url: url,
        width: 0,
        height: 0,
      },
      favorite = isFavoriteGif(gif.id);
    return (
      <div className="sent-gif-wrap">
        <img className="gif-message" src={url} alt={title} />
        <button
          type="button"
          className={`sent-gif-favorite ${favorite ? "active" : ""}`}
          onClick={() => toggleFavoriteGif(gif)}
          aria-label={
            favorite ? "Quitar GIF de favoritos" : "Guardar GIF en favoritos"
          }
          title={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <Star />
          <span>{favorite ? "Guardado" : "Favorito"}</span>
        </button>
      </div>
    );
  };
  const gifPicker = (onChoose: (gif: GifResult) => void) => (
    <div className="gif-picker gif-picker-expanded">
      <header>
        <div>
          <b>Animaciones</b>
          <small>Explora, busca y guarda tus GIFs y stickers favoritos</small>
        </div>
        <button type="button" onClick={() => setGifsOpen(false)} aria-label="Cerrar buscador de animaciones">
          <X />
        </button>
      </header>
      <div className="gif-search">
        <Search />
        <input
          autoFocus
          value={gifQuery}
          onChange={(e) => setGifQuery(e.target.value)}
          placeholder="Busca animaciones, stickers o GIFs"
          aria-label="Buscar animaciones, stickers o GIFs"
        />
        {gifQuery && (
          <button type="button" onClick={() => setGifQuery("")} aria-label="Limpiar búsqueda">
            <X />
          </button>
        )}
      </div>
      <div className="gif-categories">
        {[
          "Reacciones",
          "Trabajo",
          "Gracias",
          "Celebración",
          "Humor",
          "Aplausos",
          "Buenos días",
          "Motivación",
        ].map((category) => (
          <button
            type="button"
            key={category}
            className={gifQuery === category ? "active" : ""}
            onClick={() => setGifQuery(category)}
          >
            {category}
          </button>
        ))}
      </div>
      {!gifQuery.trim() && favoriteGifs.length > 0 && (
        <section className="favorite-gifs">
          <div>
            <Star />
            <b>Favoritos</b>
            <span>{favoriteGifs.length}</span>
          </div>
          <div>
            {favoriteGifs.map((gif) => gifTile(gif, onChoose, "favorite"))}
          </div>
        </section>
      )}
      {!gifQuery.trim() && recentGifs.length > 0 && (
        <section className="recent-gifs">
          <div>
            <b>Usados recientemente</b>
            <button type="button" onClick={clearRecentGifs}>
              Limpiar
            </button>
          </div>
          <div>{recentGifs.map((gif) => gifTile(gif, onChoose, "recent"))}</div>
        </section>
      )}
      <div className="gif-section-title">
        <b>
          {gifQuery.trim() ? `Resultados para â€œ${gifQuery}â€` : "Tendencias"}
        </b>
        <span>{gifResults.length} disponibles</span>
      </div>
      <div className="gif-grid">
        {gifsLoading ? (
          <div className="gif-loading">
            <i />
            <span>Buscando GIFs...</span>
          </div>
        ) : (
          gifResults.map((gif) => gifTile(gif, onChoose, "result"))
        )}
        {!gifsLoading && !gifResults.length && (
          <div className="gif-empty">
            <Image />
            <b>No encontramos resultados</b>
            <span>Prueba con otra bÃºsqueda.</span>
          </div>
        )}
        {!gifsLoading && gifHasNext && gifResults.length > 0 && (
          <button
            type="button"
            className="gif-load-more"
            onClick={loadMoreGifs}
            disabled={gifsLoadingMore}
          >
            {gifsLoadingMore ? (
              <>
                <i />
                Cargando...
              </>
            ) : (
              "Ver mÃ¡s GIFs"
            )}
          </button>
        )}
      </div>
      <footer>
        {gifPage > 1 ? `${gifResults.length} GIFs cargados Â· ` : ""}Selecciona
        la estrella para guardar favoritos
      </footer>
    </div>
  );
  return (
    <div
      className={`messages-hub google-chat-layout wallpaper-${wallpaperClass} chat-density-${chatPreferences.density === "Compacta" ? "compact" : "comfortable"} chat-mode-${String(chatPreferences.mode).toLowerCase()} chat-color-${String(chatPreferences.color).toLowerCase()} animations-${chatPreferences.animations} ${sidebarHidden ? "chat-sidebar-hidden" : ""} ${active || activeSpace || announcementsOpen ? "chat-conversation-open" : "chat-home-open"}`}
      style={
        customWallpaper
          ? ({
              "--chat-wallpaper-image": `url("${customWallpaperData}")`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <header className="chat-appbar">
        <button type="button" className="chat-back-dashboard" onClick={onBackToDashboard} aria-label="Volver al resumen" title="Volver al panel principal"><ArrowLeft /></button>
        <button
          type="button"
          className="chat-app-menu"
          onClick={() => setSidebarHidden((value) => !value)}
          aria-label={sidebarHidden ? "Mostrar panel de conversaciones" : "Ocultar panel de conversaciones"}
          title={sidebarHidden ? "Mostrar conversaciones" : "Ocultar conversaciones"}
        >
          {sidebarHidden ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
        <span className="chat-app-logo"><MessageCircle /></span>
        <b>EJB Chat</b>
        <label><Search /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el chat" /></label>
        <button type="button" className="chat-app-status" aria-expanded={statusOpen === "appbar"} onClick={() => setStatusOpen((open) => open === "appbar" ? null : "appbar")}><StatusGlyph value={currentStatus} compact />{statusLabel(currentStatus)}<ChevronDown /></button>
        {statusOpen === "appbar" && <div className="chat-app-status-menu">{statusOptions.map((option) => <button type="button" key={option.value} onClick={async()=>{await saveMessageStatus(option.value);onStatusChange(option.value);setStatusOpen(null)}}><StatusGlyph value={option.value} compact /><span>{option.label}</span>{currentStatus===option.value&&<Check/>}</button>)}</div>}
        <button type="button" className="chat-notifications-button" aria-label="Ver todas las notificaciones" aria-expanded={notificationsOpen} title="Notificaciones" onClick={()=>{setNotificationsOpen((open)=>!open);setSettingsOpen(false)}}><Bell />{notificationCount > 0 && <span>{notificationCount}</span>}</button>
        <button type="button" aria-label="Comunicados" title="Comunicados" onClick={()=>{setAnnouncementsOpen(true);setActive(null);setActiveSpace(null)}}><Megaphone /></button>
        <button type="button" aria-label="Configuración de chat" title="Configuración de chat" onClick={()=>{setSettingsOpen(true);setNotificationsOpen(false)}}><Settings /></button>
        <button type="button" aria-label="Espacios" title="Ver grupos y canales" onClick={()=>{setInboxView("home");setHomeFilter("spaces");setActive(null);setActiveSpace(null);setAnnouncementsOpen(false)}}><Users /></button>
      </header>
      {notificationsOpen&&<aside className={`chat-notifications-popover ${usesDarkChatTheme ? "chat-mode-oscuro" : "chat-mode-claro"}`}><header><div><Bell/><b>Notificaciones</b></div><button type="button" onClick={()=>setNotificationsOpen(false)}><X/></button></header><div>{notifications.map((item,index)=><article className={item.severity??"info"} key={index}><i>{item.type==="completado"?"✓":"!"}</i><p><b>{item.title??"Notificación"}</b><span>{item.message??"Tienes una nueva actividad."}</span></p></article>)}{!notifications.length&&<div className="chat-notifications-empty"><Bell/><b>Todo al día</b><span>No tienes alertas pendientes.</span></div>}</div><button type="button" className="notifications-close-action" onClick={()=>setNotificationsOpen(false)}>Cerrar</button></aside>}
      <aside className="message-space-column">
        <div className="telegram-space-title">
          <span>
            <MessageCircle />
          </span>
          <div>
            <b>EJB Chat</b>
            <small>Mensajería del equipo</small>
          </div>
          <button
            type="button"
            data-wallpaper-trigger
            onClick={() => setWallpaperOpen((value) => !value)}
            title="Personalizar fondo"
          >
            <Image />
          </button>
        </div>
        <button type="button" className="chat-new-button" onClick={()=>{setNewChatQuery("");setNewChatOpen(true)}}><MessageCircle/><span>Nuevo chat</span></button>
        <button type="button" className="chat-section-toggle" aria-expanded={accessOpen} onClick={()=>setAccessOpen((open)=>!open)}><ChevronDown/><span>Accesos directos</span></button>
        {accessOpen&&<nav className="chat-shortcuts" aria-label="Accesos de mensajería">
          <button type="button" className={inboxView === "home" ? "active" : ""} onClick={() => { setInboxView("home"); setHomeFilter("all"); setActive(null); setActiveSpace(null); setAnnouncementsOpen(false); }}>
            <Home /><span>Inicio</span>{contacts.reduce((sum, contact) => sum + contact.unread, 0) > 0 && <b>{contacts.reduce((sum, contact) => sum + contact.unread, 0)}</b>}
          </button>
          <button type="button" className={inboxView === "unread" ? "active" : ""} onClick={() => { setInboxView("unread"); setHomeFilter("unread"); setActive(null); setActiveSpace(null); setAnnouncementsOpen(false); }}>
            <MessageCircle /><span>No leídos</span>{contacts.filter((contact) => contact.unread > 0).length > 0 && <b>{contacts.filter((contact) => contact.unread > 0).length}</b>}
          </button>
          <button type="button" className={inboxView === "starred" ? "active" : ""} onClick={() => { setInboxView("starred"); setHomeFilter("pinned"); setActive(null); setActiveSpace(null); setAnnouncementsOpen(false); }}>
            <Star /><span>Destacados</span>
          </button>
          <button type="button" className={inboxView === "scheduled" ? "active" : ""} onClick={() => { setInboxView("scheduled"); setActive(null); setActiveSpace(null); setAnnouncementsOpen(false); void loadScheduled(); }}>
            <Clock3 /><span>Programados</span>{scheduled.length > 0 && <b>{scheduled.length}</b>}
          </button>
        </nav>}
        <section className="chat-direct-shortlist">
          <button type="button" className="chat-section-toggle" aria-expanded={directOpen} onClick={()=>setDirectOpen((open)=>!open)}><ChevronDown/><span>Mensajes directos</span></button>
          {directOpen&&<div className="chat-direct-items">
          {contacts.slice(0, 5).map((contact) => <button type="button" key={contact.id} title="Abrir chat. Clic derecho para destacar" onContextMenu={(event)=>{event.preventDefault();togglePinnedContact(contact.id)}} onClick={() => { setActive(contact); setActiveSpace(null); setAnnouncementsOpen(false); }}>
            {contact.fotoPerfil ? <img src={contact.fotoPerfil} alt="" /> : <i style={{background:contact.area.colorHex}}>{initials(`${contact.nombres} ${contact.apellidos}`)}</i>}
            <span><b>{contact.nombres} {contact.apellidos}</b><small>{contact.lastMessage?.contenido || statusLabel(contact.estadoMensaje)}</small></span>
            <StatusGlyph value={contact.estadoMensaje} compact />
            {pinnedContacts.includes(contact.id)&&<Star className="pinned-contact"/>}
          </button>)}
          {!contacts.length&&<p>Busca un compañero para empezar.</p>}
          </div>}
        </section>
        <button type="button" className="chat-section-toggle" aria-expanded={spacesOpen} onClick={()=>setSpacesOpen((open)=>!open)}><ChevronDown/><span>Espacios</span></button>
        {spacesOpen&&<MessageSpaces
          currentUserId={currentUserId}
          activeId={activeSpace?.id}
          onSelect={(row) => {
            setAnnouncementsOpen(false);
            setActiveSpace(row);
            setActive(null);
            setStatusOpen(null);
            setWallpaperOpen(false);
          }}
        />}
        {wallpaperOpen && createPortal(
          <div className={`wallpaper-popover wallpaper-gallery ${usesDarkChatTheme ? "chat-mode-oscuro" : "chat-mode-claro"} chat-color-${String(chatPreferences.color).toLowerCase()}`}>
            <div>
              <b>Fondo de esta conversación</b>
              <button type="button" onClick={() => setWallpaperOpen(false)}>
                <X />
              </button>
            </div>
            <p>Cada chat, grupo y canal conserva su propio fondo.</p>
            <label className="wallpaper-upload">
              <Image />
              <span>
                <b>Incluir una imagen</b>
                <small>JPG, PNG o WEBP · mínimo 1600 × 900 px</small>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => chooseCustomWallpaper(event.currentTarget)}
              />
              {customWallpaper && <Check />}
            </label>
            {wallpaperHistory.length > 0 && (
              <section className="wallpaper-history">
                <div>
                  <b>Imágenes recientes</b>
                  <small>{wallpaperHistory.length} guardada(s)</small>
                </div>
                <div>
                  {wallpaperHistory.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        wallpaper === `custom:${item.id}` ? "active" : ""
                      }
                      onClick={() => chooseWallpaper(`custom:${item.id}`)}
                      title={item.name}
                    >
                      <img src={item.data} alt={item.name} />
                      {wallpaper === `custom:${item.id}` && <Check />}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="wallpaper-options">
              {wallpaperOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`wallpaper-swatch wallpaper-${option.id} ${wallpaper === option.id ? "active" : ""}`}
                  style={{ "--wallpaper-preview": `url("${option.asset}")` } as React.CSSProperties}
                  onClick={() => chooseWallpaper(option.id)}
                >
                  <i />
                  {option.name}
                  {wallpaper === option.id && <Check />}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </aside>
      <div className={`messenger ${threadView ? "thread-view" : ""}`}>
        <aside className="conversation-list">
          <div className="conversation-list-title">
            <span>Página principal</span>
            <div className="chat-home-view-tools"><label>No leídos<input type="checkbox" checked={homeFilter==="unread"} onChange={(event)=>{setHomeFilter(event.target.checked?"unread":"all");setInboxView(event.target.checked?"unread":"home")}}/><i/></label><button type="button" aria-pressed={threadView} title="Mostrar solo conversaciones que ya tienen mensajes" className={threadView?"active":""} onClick={()=>setThreadView((enabled)=>!enabled)}><MessageCircle/>Hilo</button></div>
          </div>
          <div className="chat-home-tabs" role="tablist" aria-label="Filtrar conversaciones">
            {[['all','Todo'],['dms','Mensajes'],['spaces','Espacios'],['unread','No leídos'],['pinned','Fijados']].map(([id,label]) => <button type="button" role="tab" aria-selected={homeFilter===id} className={homeFilter===id?'active':''} key={id} onClick={()=>setHomeFilter(id as typeof homeFilter)}>{label}</button>)}
          </div>
          <div className="my-message-status">
            <span>Mi estado</span>
            <button
              type="button"
              className="status-trigger"
              aria-expanded={statusOpen === "panel"}
              onClick={() => setStatusOpen((open) => open === "panel" ? null : "panel")}
            >
              <StatusGlyph value={currentStatus} compact />
              <b>{statusLabel(currentStatus)}</b>
              <ChevronDown />
            </button>
            {statusOpen === "panel" && (
              <div
                className="status-menu"
                role="listbox"
                aria-label="Seleccionar mi estado"
              >
                {statusOptions.map((option) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={currentStatus === option.value}
                    key={option.value}
                    onClick={async () => {
                      await saveMessageStatus(option.value);
                      onStatusChange(option.value);
                      setStatusOpen(null);
                    }}
                  >
                    <StatusGlyph value={option.value} />
                    <span>
                      <b>{option.label}</b>
                      <small>
                        {option.value === "Disponible"
                          ? "Listo para responder"
                          : option.value === "Break"
                            ? "En una pausa breve"
                            : option.value === "Ausente"
                              ? "Fuera por el momento"
                              : option.value === "Ocupado"
                                ? "Atendiendo otra tarea"
                                : "Evitar interrupciones"}
                      </small>
                    </span>
                    {currentStatus === option.value && <Check />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="message-search">
            <Search />
            <input
              placeholder="Buscar compañero"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className={`announcements-entry ${announcementsOpen ? "active" : ""}`} onClick={() => { setAnnouncementsOpen(true); setActive(null); setActiveSpace(null); setStatusOpen(null); }}>
            <div><Megaphone /></div>
            <p><b>Comunicados</b><small>Avisos importantes para todo EJB</small></p>
            {announcements.length > 0 && <span>{announcements.length}</span>}
          </button>
          {filtered.map((c) => (
            <button
              key={c.id}
              className={active?.id === c.id ? "active" : ""}
              title="Clic derecho para destacar o quitar de destacados"
              onContextMenu={(event)=>{event.preventDefault();togglePinnedContact(c.id)}}
              onClick={() => {
                setAnnouncementsOpen(false);
                setActive(c);
                setActiveSpace(null);
                setStatusOpen(null);
                setWallpaperOpen(false);
              }}
            >
              {c.fotoPerfil ? (
                <img src={c.fotoPerfil} />
              ) : (
                <div style={{ background: c.area.colorHex }}>
                  {initials(`${c.nombres} ${c.apellidos}`)}
                </div>
              )}
              <p>
                <b>
                  {c.nombres} {c.apellidos}
                </b>
                <span className="contact-status">
                  <StatusGlyph value={c.estadoMensaje} compact />
                  {statusLabel(c.estadoMensaje)}
                </span>
                <small>
                  {c.lastMessage?.contenido ?? `${cargoLabel(c.cargo)} · ${c.area.nombre}`}
                </small>
              </p>
              {c.unread > 0 && <span>{c.unread}</span>}
              {pinnedContacts.includes(c.id)&&<Star className="pinned-contact"/>}
            </button>
          ))}
          {contentResults.length > 0 && <section className="message-content-results"><h4>Resultados en mensajes</h4>{contentResults.map((group) => <div key={group.usuario.id}><b>{group.usuario.nombres} {group.usuario.apellidos}</b>{group.resultados.map((result) => <button type="button" key={result.mensajeId} onClick={() => { const contact = contacts.find((item) => item.id === group.usuario.id); if (contact) { setPendingMessageId(result.mensajeId); setActive(contact); setActiveSpace(null); } }}><span>{result.fragmento}</span><small>{new Date(result.createdAt).toLocaleString("es-PE")}</small></button>)}</div>)}</section>}
          {inboxView === "scheduled" && <section className="scheduled-message-list"><h4>Mensajes programados</h4>{scheduled.map((item) => <article key={item.id}><p>{item.contenido}</p><small>{new Date(item.enviarEn).toLocaleString("es-PE")}</small><div><button type="button" onClick={async()=>{const contenido=prompt("Editar mensaje programado",item.contenido);if(!contenido?.trim())return;const fecha=prompt("Nueva fecha y hora (AAAA-MM-DDTHH:mm)",new Date(item.enviarEn).toISOString().slice(0,16));if(!fecha)return;await updateScheduledMessage(item.id,{contenido:contenido.trim(),enviarEn:new Date(fecha).toISOString()});await loadScheduled()}}>Editar</button><button type="button" onClick={async()=>{if(confirm("¿Cancelar este mensaje programado?")){await deleteScheduledMessage(item.id);await loadScheduled()}}}>Cancelar</button></div></article>)}{!scheduled.length&&<p>No tienes mensajes pendientes.</p>}</section>}
          {!filtered.length && (
            <div className="chat-home-empty"><span><MessageCircle/></span><b>{inboxView === "unread" ? "No hay mensajes nuevos. Todo despejado." : inboxView === "starred" ? "Aún no tienes conversaciones destacadas." : homeFilter === "spaces" ? "Selecciona un grupo o canal para comenzar." : "Busca un compañero para iniciar un chat."}</b></div>
          )}
          <MessageSpaceList
            activeId={activeSpace?.id}
            onSelect={(row) => {
              setAnnouncementsOpen(false);
              setActiveSpace(row);
              setActive(null);
              setStatusOpen(null);
              setWallpaperOpen(false);
            }}
          />
        </aside>
        <section className={`chat-panel ${announcementsOpen ? `announcements-panel ${announcementComposerOpen ? "compose-open" : ""}` : ""}`}>
          {announcementsOpen ? (
            <>
              <header className="announcements-header"><div><Megaphone /></div><p><b>Comunicados EJB</b><small>Información oficial visible para todos los usuarios</small></p>{canPublishAnnouncements&&<button type="button" className={`announcement-compose-toggle ${announcementComposerOpen ? "active" : ""}`} aria-expanded={announcementComposerOpen} onClick={()=>setAnnouncementComposerOpen(value=>!value)}><Type/><span>{announcementComposerOpen?"Cerrar editor":"Redactar comunicado"}</span><ChevronDown/></button>}</header>
              <div ref={announcementsFeed} className="messages announcements-feed">
                {[...announcements].reverse().map((row) => <article key={row.id}><p><b>{row.datos.titulo}</b><AnnouncementText text={row.datos.mensaje??""} formatted={row.datos.formato==="markdown"}/>{row.datos.prioridad === "Urgente" && <em>URGENTE</em>}</p>{(row.datos.adjuntos??[]).map((file:any,index:number)=><div key={index}>{attachmentView(file)}</div>)}<small>{row.creador ? `${row.creador.nombres} ${row.creador.apellidos} · ` : ""}{new Date(row.createdAt).toLocaleString("es-PE")}</small>{canPublishAnnouncements&&<button type="button" onClick={()=>void editAnnouncement(row)}>Editar comunicado</button>}</article>)}
                {!announcements.length && <div className="start-chat"><Megaphone/><b>Aún no hay comunicados</b><span>Los avisos importantes aparecerán aquí.</span></div>}
              </div>
              {canPublishAnnouncements && announcementComposerOpen ? <AnnouncementComposer onPublished={loadAnnouncements}/> : !canPublishAnnouncements ? <div className="announcement-readonly">Solo gerencia y administración pueden publicar comunicados.</div> : null}
            </>
          ) : activeSpace ? (
            <>
              <header className="space-chat-header">
                <div>{activeSpace.datos.esCanal ? <Hash /> : <Users />}</div>
                <p>
                  <b>{activeSpace.datos.nombre}</b>
                  <small>
                    {activeSpace.datos.descripcion || "Conversación del equipo"}
                  </small>
                </p>
                {muted && (
                  <span className="muted-space">
                    <VolumeX />
                    SILENCIADO
                  </span>
                )}
                <button
                  className="space-settings-button"
                  onClick={() => setSpaceSettings(true)}
                  title="Administrar espacio"
                >
                  <Settings />
                </button>
                {activeSpace.datos.esCanal&&<button type="button" className="channel-follow" disabled={chatBusy} onClick={()=>void performSpaceAction({action:"follow"})}>{(activeSpace.datos.seguidores??[]).includes(currentUserId)?"Siguiendo":"Seguir"} · {(activeSpace.datos.seguidores??[]).length}</button>}
                <span>{activeSpace.datos.esCanal ? "CANAL" : "GRUPO"}</span>
              </header>
              <div
                className={`messages space-messages-inline ${activeSpace.datos.esCanal?"channel-feed":""}`}
                ref={messagesBox}
                onScroll={trackChatScroll}
              >
                {[...(activeSpace.datos.mensajes ?? [])].sort((a:any,b:any)=>activeSpace.datos.esCanal?(Number(Boolean(b.fijado))-Number(Boolean(a.fijado))||new Date(b.fecha).getTime()-new Date(a.fecha).getTime()):0).map((m: any) => (
                  <article
                    className={m.usuarioId === currentUserId ? "mine" : ""}
                    key={m.id}
                    data-message-id={m.id}
                  >
                    {m.fijado&&<small className="channel-pinned">📌 Publicación fijada</small>}
                    <b>{m.usuarioId===currentUserId?"Tú":(m.autor==="Yo" ? (()=>{const p=contacts.find(c=>c.id===m.usuarioId);return p?`${p.nombres} ${p.apellidos}`:activeSpace.creador.id===m.usuarioId?`${activeSpace.creador.nombres} ${activeSpace.creador.apellidos}`:"Integrante";})():m.autor)}</b>
                    {m.adjunto&&attachmentView(m.adjunto)}
                    {m.respuestaA && (
                      <blockquote className="chat-reply-preview">
                        <b>{m.respuestaA.autor}</b>
                        <span>{m.respuestaA.texto}</span>
                      </blockquote>
                    )}
                    {m.tipo === "Gif" ? (
                      sentGif(m.archivoData, m.texto || "GIF compartido")
                    ) : (
                      <p>{richText(m.texto)}</p>
                    )}
                    <small>
                      {new Date(m.fecha).toLocaleString("es-PE")}
                      {m.editadoAt ? " · editado" : ""}
                    </small>
                    <div className="chat-context-actions">
                      <button type="button" onClick={() => activeSpace.datos.esCanal ? void commentOnPost(m) : setSpaceReply(m)}>
                        {activeSpace.datos.esCanal ? "Comentar" : "Responder"}
                      </button>
                      <button type="button" data-reaction-trigger onClick={()=>setReactionTarget((id)=>id===`space:${m.id}`?null:`space:${m.id}`)} title="Reaccionar">😊</button>
                      {reactionTarget===`space:${m.id}`&&<div className="chat-reaction-picker">{reactionEmojis.map((emoji)=><button type="button" key={emoji} onClick={() => void reactSpaceMessage(m,emoji)}>{emoji}</button>)}</div>}
                      <button type="button" onClick={()=>{setForwardTarget({id:m.id,remitenteId:m.usuarioId,destinatarioId:"",contenido:m.texto??"",tipo:m.tipo==="Gif"?"Documento":"Texto",archivoNombre:m.tipo==="Gif"?(m.texto||"GIF"):undefined,archivoMime:m.tipo==="Gif"?"image/gif":undefined,archivoData:m.archivoData,createdAt:m.fecha,sourceSpace:true});setForwardRecipients([])}}>Reenviar</button>
                      {m.usuarioId === currentUserId && m.tipo !== "Gif" && (
                        <button
                          type="button"
                          onClick={() => editSpaceMessage(m)}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                    {activeSpace.datos.esCanal&&<div className="channel-comments">{(m.comentarios??[]).map((comment:any)=><div key={comment.id}><b>{comment.autor}</b><p>{comment.texto}</p><small>{new Date(comment.fecha).toLocaleString("es-PE")}</small></div>)}</div>}
                    {(canManage||m.usuarioId===currentUserId)&&<div className="channel-moderation">{canManage&&activeSpace.datos.esCanal&&<button type="button" onClick={()=>void performSpaceAction({action:"pin",messageId:m.id})}>{m.fijado?"Desfijar":"Fijar"}</button>}{m.usuarioId===currentUserId&&<button type="button" onClick={()=>void removePost(m)}><Trash2/>Eliminar para todos</button>}</div>}
                    {Object.entries(m.reacciones ?? {}).some(([, users]) => Array.isArray(users) && users.length > 0) && <div className="chat-reaction-chips">{Object.entries(m.reacciones ?? {}).map(([emoji,users]) => Array.isArray(users) && users.length > 0 ? <button type="button" className={users.includes(currentUserId)?"mine":""} key={emoji} onClick={()=>void reactSpaceMessage(m,emoji)}>{emoji} {users.length}</button>:null)}</div>}
                  </article>
                ))}
                {!activeSpace.datos.mensajes?.length && (
                  <div className="start-chat">
                    <MessageCircle />
                    <b>Inicia la conversación del equipo</b>
                    <span>El historial quedará guardado en este espacio.</span>
                  </div>
                )}
              </div>
              {activeSpace.datos.esCanal&&!canManage?<div className="announcement-readonly">Sigue el canal y participa con comentarios y reacciones. Las publicaciones las gestionan sus moderadores.</div>:<form
                className="space-composer-inline"
                onSubmit={sendSpaceMessage}
              >
                {spaceReply && (
                  <div className="composer-reply">
                    <span>
                      Respondiendo a <b>{spaceReply.autor}</b>:{" "}
                      {spaceReply.texto}
                    </span>
                    <button type="button" onClick={() => setSpaceReply(null)}>
                      <X />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="chat-tool gif-tool"
                  data-gif-trigger
                  title="Buscar GIF"
                  onClick={() => {
                    setStickersOpen(false);
                    setScheduleOpen(false);
                    setFormattingOpen(false);
                    setComposerMenuOpen(false);
                    setGifsOpen((value) => !value);
                  }}
                >
                  <b>GIF</b>
                </button>
                <label className="chat-attachment-control" title="Adjuntar archivo o foto"><Upload/><input type="file" disabled={chatBusy} onChange={async(event)=>{const input=event.currentTarget,file=input.files?.[0];if(!file)return;try{await performSpaceAction({action:"post",texto:file.name,attachment:await readChatAttachment(file)})}catch(error){await uiAlert("No se pudo adjuntar",String(error))}input.value=""}}/></label>
                {gifsOpen && gifPicker(sendSpaceGif)}
                <input
                  value={spaceDraft}
                  onChange={(e) => setSpaceDraft(e.target.value)}
                  placeholder={activeSpace.datos.esCanal?"Publica una novedad para el canal...":"Escribe al grupo..."}
                  maxLength={2000}
                  disabled={chatBusy}
                  spellCheck={chatPreferences.autocorrect}
                />
                <button>
                  <Send />
                </button>
              </form>}
            </>
          ) : active ? (
            <>
              <header>
                {active.fotoPerfil ? (
                  <img
                    className="chat-header-photo"
                    src={active.fotoPerfil}
                    alt={`Foto de ${active.nombres} ${active.apellidos}`}
                  />
                ) : (
                  <div style={{ background: active.area.colorHex }}>
                    {initials(`${active.nombres} ${active.apellidos}`)}
                  </div>
                )}
                <p>
                  <b>
                    {active.nombres} {active.apellidos}
                  </b>
                  <span className="contact-status">
                    <StatusGlyph value={active.estadoMensaje} compact />
                    {statusLabel(active.estadoMensaje)}
                  </span>
                  <small>
                    {cargoLabel(active.cargo)} · {active.area.nombre}
                  </small>
                </p>
                <button type="button" className="chat-delete-button" title="Eliminar chat para mí" aria-label="Eliminar chat para mí" onClick={()=>void removeDirectChat()}><Trash2/></button>
                <button type="button" className={`chat-favorite-button ${pinnedContacts.includes(active.id)?"active":""}`} onClick={()=>togglePinnedContact(active.id)} title={pinnedContacts.includes(active.id)?"Quitar de destacados":"Agregar a destacados"}><Star /></button>
                <button
                  type="button"
                  className="wallpaper-button"
                  data-wallpaper-trigger
                  onClick={() => setWallpaperOpen((value) => !value)}
                  title="Cambiar fondo del chat"
                >
                  <Image />
                </button>
              </header>
              <div
                className={`messages telegram-wallpaper wallpaper-${wallpaperClass}`}
                ref={messagesBox}
                onScroll={trackChatScroll}
              >
                {customWallpaper && (
                  <img
                    className="custom-chat-wallpaper"
                    src={customWallpaperData}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                {messages.map((m) => (
                  <article
                    key={m.id}
                    className={m.remitenteId === currentUserId ? "mine" : ""}
                    data-message-id={m.id}
                  >
                    {m.reenviadoDeId && <small className="forwarded-label"><Forward /> Reenviado</small>}
                    {m.respuestaA && <blockquote className="chat-reply-preview"><b>{m.respuestaA.remitenteId === currentUserId ? "Tú" : `${active.nombres} ${active.apellidos}`}</b><span>{m.respuestaA.contenido || "Documento"}</span></blockquote>}
                    {m.tipo === "Sticker" ? (
                      <div className="sticker-message">{m.contenido}</div>
                    ) : m.tipo === "Documento" &&
                      m.archivoMime === "image/gif" ? (
                      sentGif(
                        m.archivoData!,
                        m.archivoNombre || "GIF compartido",
                      )
                    ) : m.tipo === "Documento" && m.archivoMime?.startsWith("audio/") ? (
                      <div className="voice-message"><Mic/><audio controls preload="metadata" src={m.archivoData}/></div>
                    ) : m.tipo === "Documento" ? (
                      <a
                        className="document-message"
                        href={m.archivoData}
                        download={m.archivoNombre}
                      >
                        <FileText />
                        <span>
                          <b>{m.archivoNombre}</b>
                          <small>Documento adjunto</small>
                        </span>
                        <Download />
                      </a>
                    ) : (
                      <p>{richText(m.contenido)}</p>
                    )}
                    <small>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                    {!m.eliminadoAt&&<div className="chat-context-actions">
                      <button type="button" onClick={()=>{setDmReply(m);requestAnimationFrame(()=>messageInput.current?.focus())}} title="Responder"><Reply /></button>
                      <button type="button" data-reaction-trigger onClick={()=>setReactionTarget((id)=>id===m.id?null:m.id)} title="Reaccionar">😊</button>
                      <button type="button" onClick={()=>{setForwardTarget(m);setForwardRecipients([])}} title="Reenviar"><Forward /></button>
                      {m.remitenteId===currentUserId&&<button type="button" title="Eliminar para todos" aria-label="Eliminar mensaje para todos" onClick={()=>void removeDmForEveryone(m)}><Trash2/></button>}
                    </div>}
                    {!m.eliminadoAt&&reactionTarget===m.id&&<div className="chat-reaction-picker">{reactionEmojis.map((emoji)=><button type="button" key={emoji} onClick={()=>void reactDmMessage(m.id,emoji)}>{emoji}</button>)}</div>}
                    {Boolean(m.reacciones?.length)&&<div className="chat-reaction-chips">{m.reacciones!.map((reaction)=><button type="button" className={reaction.mine?"mine":""} key={reaction.emoji} onClick={()=>void reactDmMessage(m.id,reaction.emoji)}>{reaction.emoji} {reaction.count}</button>)}</div>}
                  </article>
                ))}
                {!messages.length && (
                  <div className="start-chat">
                    <MessageCircle />
                    <b>Inicia la conversación</b>
                    <span>Los mensajes quedan guardados de forma privada.</span>
                  </div>
                )}
              </div>
              {chatPreferences.markdown && /\*\*|~~|`|_[^_]+_/.test(draft) && <div className="chat-draft-preview" aria-label="Vista previa del formato">{richText(draft)}</div>}
              <form className="direct-message-composer" onSubmit={submit}>
                {dmReply && <div className="composer-reply"><span>Respondiendo a <b>{dmReply.remitenteId===currentUserId?"ti":`${active.nombres} ${active.apellidos}`}</b>: {dmReply.contenido || "Documento"}</span><button type="button" onClick={()=>setDmReply(null)}><X /></button></div>}
                <button type="button" className="chat-tool composer-plus" title="Más opciones" aria-expanded={composerMenuOpen} onClick={()=>{setComposerMenuOpen((open)=>!open);setGifsOpen(false);setStickersOpen(false);setScheduleOpen(false);setFormattingOpen(false)}}><Plus /></button>
                {composerMenuOpen&&<div className="composer-plus-menu" role="menu" aria-label="Opciones para enviar"><label role="menuitem"><Upload/><span>Subir un archivo</span><input type="file" onChange={(e)=>{sendFile(e.currentTarget);setComposerMenuOpen(false)}}/></label><button type="button" role="menuitem" data-gif-trigger onClick={()=>{setGifsOpen(true);setStickersOpen(false);setScheduleOpen(false);setFormattingOpen(false);setComposerMenuOpen(false)}}><Image/><span>Buscar un GIF</span></button><button type="button" role="menuitem" data-schedule-trigger onClick={()=>{setScheduleOpen(true);setGifsOpen(false);setStickersOpen(false);setFormattingOpen(false);setComposerMenuOpen(false);requestAnimationFrame(()=>messageInput.current?.focus())}}><Clock3/><span>Programar envío</span></button></div>}
                <button
                  type="button"
                  className="chat-tool gif-tool"
                  data-gif-trigger
                  title="Buscar GIF"
                  onClick={() => {
                    setStickersOpen(false);
                    setScheduleOpen(false);
                    setFormattingOpen(false);
                    setComposerMenuOpen(false);
                    setGifsOpen((value) => !value);
                  }}
                >
                  <b>GIF</b>
                </button>
                {gifsOpen && gifPicker(sendGif)}
                <button type="button" className={`chat-tool ${formattingOpen?"active":""}`} data-format-trigger onClick={()=>{setFormattingOpen((open)=>!open);setGifsOpen(false);setStickersOpen(false);setScheduleOpen(false);setComposerMenuOpen(false)}} title="Formato de texto"><Type /></button>
                {formattingOpen&&<div className="composer-format-menu"><button type="button" onClick={()=>formatDraft("**")}>B</button><button type="button" onClick={()=>formatDraft("_")}><i>I</i></button><button type="button" onClick={()=>formatDraft("~~")}><s>S</s></button><button type="button" onClick={()=>formatDraft("`")}>{"</>"}</button></div>}
                <button
                  type="button"
                  className="chat-tool"
                  data-sticker-trigger
                  onClick={() => {setStickersOpen((v) => !v);setGifsOpen(false);setScheduleOpen(false);setFormattingOpen(false);setComposerMenuOpen(false)}}
                  title="Stickers"
                >
                  <Smile />
                </button>
                {stickersOpen && (
                  <div className="sticker-picker">
                    <EmojiPicker
                      theme={
                        usesDarkChatTheme ? Theme.DARK : Theme.LIGHT
                      }
                      emojiStyle={EmojiStyle.NATIVE}
                      searchPlaceHolder="Buscar emoji..."
                      previewConfig={{ showPreview: false }}
                      skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                      categories={[
                        { category: Categories.SUGGESTED, name: "Recientes" },
                        {
                          category: Categories.SMILEYS_PEOPLE,
                          name: "Caras y personas",
                        },
                        {
                          category: Categories.ANIMALS_NATURE,
                          name: "Animales y naturaleza",
                        },
                        {
                          category: Categories.FOOD_DRINK,
                          name: "Comida y bebida",
                        },
                        {
                          category: Categories.TRAVEL_PLACES,
                          name: "Viajes y lugares",
                        },
                        {
                          category: Categories.ACTIVITIES,
                          name: "Actividades",
                        },
                        { category: Categories.OBJECTS, name: "Objetos" },
                        { category: Categories.SYMBOLS, name: "Símbolos" },
                        { category: Categories.FLAGS, name: "Banderas" },
                      ]}
                      categoryIcons={{
                        suggested: <span>🕘</span>,
                        smileys_people: <span>😀</span>,
                        animals_nature: <span>🐻</span>,
                        food_drink: <span>🍔</span>,
                        travel_places: <span>✈️</span>,
                        activities: <span>⚽</span>,
                        objects: <span>💡</span>,
                        symbols: <span>❤️</span>,
                        flags: <span>🏳️</span>,
                      }}
                      lazyLoadEmojis
                      width="100%"
                      height={420}
                      onEmojiClick={(emoji) => sendSticker(emoji.emoji)}
                    />
                    {false &&
                      [
                        "👍",
                        "🎉",
                        "🚀",
                        "✅",
                        "👏",
                        "💡",
                        "🔥",
                        "💪",
                        "⭐",
                        "😊",
                        "🤝",
                        "📌",
                      ].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => sendSticker(s)}
                        >
                          {s}
                        </button>
                      ))}
                  </div>
                )}
                <input
                  ref={messageInput}
                  name="message"
                  autoComplete="off"
                  autoCorrect={chatPreferences.autocorrect ? "on" : "off"}
                  spellCheck={chatPreferences.autocorrect}
                  placeholder="Escribe un mensaje..."
                  value={draft}
                  onChange={(e) => setDraft(chatPreferences.autocorrect ? correctLastWord(e.target.value) : e.target.value)}
                />
                <button type="button" className={`chat-tool voice-tool ${isRecording?"recording":""}`} title={isRecording?"Detener y enviar nota de voz":"Grabar nota de voz"} onClick={()=>void toggleVoiceRecording()}><Mic /></button>
                <button type="button" className="chat-tool" data-schedule-trigger title="Programar envío" onClick={()=>{setScheduleOpen((open)=>!open);setGifsOpen(false);setStickersOpen(false);setFormattingOpen(false);setComposerMenuOpen(false)}}><Clock3 /></button>
                {scheduleOpen&&<div className="schedule-popover"><b>Programar mensaje</b><input type="datetime-local" value={scheduleAt} min={new Date(Date.now()+60000).toISOString().slice(0,16)} onChange={(event)=>setScheduleAt(event.target.value)}/><button type="button" disabled={!scheduleAt||!draft.trim()} onClick={()=>void programCurrentMessage()}>Programar</button><button type="button" onClick={()=>setScheduleOpen(false)}>Cancelar</button></div>}
                <button>
                  <Send />
                </button>
              </form>
            </>
          ) : (
            <div className="start-chat">
              <MessageCircle />
              <b>Mensajes EJB</b>
              <span>Selecciona un compañero para conversar.</span>
            </div>
          )}
        </section>
        <aside className="chat-app-rail" aria-label="Accesos a EJB Manager"><button type="button" title="Calendario" onClick={()=>onNavigate?.("calendario")}><CalendarDays/></button><button type="button" title="Proyectos" onClick={()=>onNavigate?.("iniciativas")}><Lightbulb/></button><button type="button" title="Mi trabajo" onClick={()=>onNavigate?.("mi-trabajo")}><BriefcaseBusiness/></button><button type="button" title="Equipo" onClick={()=>onNavigate?.("equipo")}><Users/></button></aside>
        {newChatOpen&&<div className={`overlay new-chat-overlay ${usesDarkChatTheme ? "chat-mode-oscuro" : "chat-mode-claro"}`} onMouseDown={(event)=>{if(event.target===event.currentTarget)setNewChatOpen(false)}}><section className="new-chat-modal"><header><div><MessageCircle/><span><b>Nuevo chat</b><small>Selecciona una persona de EJB</small></span></div><button type="button" onClick={()=>setNewChatOpen(false)}><X/></button></header><label><Search/><input autoFocus value={newChatQuery} onChange={(event)=>setNewChatQuery(event.target.value)} placeholder="Buscar por nombre, cargo o área"/></label><div>{contacts.filter((contact)=>`${contact.nombres} ${contact.apellidos} ${contact.cargo} ${contact.area.nombre}`.toLowerCase().includes(newChatQuery.toLowerCase())).map((contact)=><button type="button" key={contact.id} onClick={()=>{setActive(contact);setActiveSpace(null);setAnnouncementsOpen(false);setNewChatOpen(false);setQuery("")}}>{contact.fotoPerfil?<img src={contact.fotoPerfil} alt=""/>:<i style={{background:contact.area.colorHex}}>{initials(`${contact.nombres} ${contact.apellidos}`)}</i>}<span><b>{contact.nombres} {contact.apellidos}</b><small>{cargoLabel(contact.cargo)} · {contact.area.nombre}</small></span><StatusGlyph value={contact.estadoMensaje} compact /></button>)}</div></section></div>}
        {settingsOpen&&createPortal(<div className={`overlay chat-settings-overlay chat-mode-${String(chatPreferences.mode).toLowerCase()} chat-color-${String(chatPreferences.color).toLowerCase()}`} onMouseDown={(event)=>{if(event.target===event.currentTarget)setSettingsOpen(false)}}><section className={`chat-settings-modal density-${String(chatPreferences.density).toLowerCase()}`}><header><h2>Configuración de chat</h2><span className="settings-save-status" role="status">{settingsFeedback}</span><button type="button" aria-label="Cerrar configuración" onClick={()=>setSettingsOpen(false)}><X/></button></header><div className="chat-settings-body"><nav><button type="button" className={settingsTab==="notifications"?"active":""} onClick={()=>setSettingsTab("notifications")}><Bell/>Notificaciones</button><button type="button" className={settingsTab==="messages"?"active":""} onClick={()=>setSettingsTab("messages")}><Inbox/>Mensajes y contenido multimedia</button><button type="button" className={settingsTab==="appearance"?"active":""} onClick={()=>setSettingsTab("appearance")}><Palette/>Aspecto</button><button type="button" className={settingsTab==="accessibility"?"active":""} onClick={()=>setSettingsTab("accessibility")}><Accessibility/>Accesibilidad</button></nav><main className={`chat-settings-content settings-tab-${settingsTab}`}>
          {settingsTab==="notifications"&&<><section><h3>Notificaciones de escritorio</h3><SettingSwitch label="Permitir notificaciones de chat" detail="Muestra alertas en este dispositivo" checked={chatPreferences.desktop} onChange={async(value)=>{if(!value){updatePreference("desktop",false);return}if(!("Notification" in window)){setSettingsFeedback("Este navegador no admite notificaciones");return}const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();updatePreference("desktop",permission==="granted");setSettingsFeedback(permission==="granted"?"Notificaciones activadas":"El navegador bloqueó las notificaciones")}}/><SettingSwitch label="Notificaciones de reacciones" detail="Avisa cuando reaccionen a tus mensajes" checked={chatPreferences.reactions} onChange={(value)=>updatePreference("reactions",value)}/><label className="settings-select">Sonidos de notificaciones<div><select value={chatPreferences.sound} onChange={(event)=>{updatePreference("sound",event.target.value);testNotificationSound(event.target.value)}}>{Object.keys(chatTones).map(tone=><option key={tone}>{tone}</option>)}</select><button type="button" onClick={()=>testNotificationSound(chatPreferences.sound)}>Probar</button></div></label></section><section><h3>Notificaciones por correo electrónico</h3><SettingSwitch label="Mensajes directos o menciones no leídos" checked={chatPreferences.email} onChange={async(value)=>{try{await saveNotificationPreferences({email:value,tareas:true,reuniones:true,aprobaciones:true,resumenSemanal:true});updatePreference("email",value);setSettingsFeedback("Preferencia de correo sincronizada")}catch{setSettingsFeedback("No se pudo sincronizar la preferencia")}}}/></section><section><h3>Horarios de No interrumpir</h3><p>Configura tus horarios usando el estado “No molestar”.</p><button type="button" onClick={async()=>{try{onStatusChange("No_molestar");await saveMessageStatus("No_molestar");setSettingsFeedback("No molestar activado")}catch{setSettingsFeedback("No se pudo cambiar el estado")}}}>Activar No molestar ahora</button><SettingSwitch label="Ajustar a la zona horaria del dispositivo" detail={chatPreferences.timezone?Intl.DateTimeFormat().resolvedOptions().timeZone:"Hora estándar de Perú"} checked={chatPreferences.timezone} onChange={(value)=>updatePreference("timezone",value)}/></section></>}
          {settingsTab==="messages"&&<section><h3>Funciones de mensajes</h3><SettingSwitch label="Corrección automática" detail="Corregir errores frecuentes al terminar una palabra y activar el corrector del navegador" checked={chatPreferences.autocorrect} onChange={(value)=>updatePreference("autocorrect",value)}/><SettingSwitch label="Markdown dinámico" detail="Aplicar formato mientras escribes" checked={chatPreferences.markdown} onChange={(value)=>updatePreference("markdown",value)}/></section>}
          {settingsTab==="appearance"&&<><section><h3>Color: {chatPreferences.color}</h3><div className="chat-color-options">{["Zafiro","Violeta","Rosa","Coral","Ámbar","Oliva","Tierra","Lima","Verde","Turquesa","Cian","Índigo","Morado","Negro"].map((color)=><button type="button" aria-label={color} title={color} className={`${color.toLowerCase()} ${chatPreferences.color===color?"active":""}`} key={color} onClick={()=>updatePreference("color",color)}/>)}</div></section><section><h3>Modo</h3><div className="segmented-setting">{["Sistema","Claro","Oscuro"].map((mode)=><button type="button" className={chatPreferences.mode===mode?"active":""} key={mode} onClick={()=>updatePreference("mode",mode)}>{chatPreferences.mode===mode&&<Check/>}{mode}</button>)}</div></section><section><h3>Densidad</h3><div className="density-options"><button type="button" className={chatPreferences.density==="Cómoda"?"active":""} onClick={()=>updatePreference("density","Cómoda")}>Vista cómoda</button><button type="button" className={chatPreferences.density==="Compacta"?"active":""} onClick={()=>updatePreference("density","Compacta")}>Vista compacta</button></div></section></>}
          {settingsTab==="accessibility"&&<section><h3>Animaciones</h3>{[["system","Usar la configuración del sistema"],["always","Reproducir siempre las animaciones"],["never","No reproducir las animaciones"]].map(([value,label])=><label className="settings-radio" key={value}><input type="radio" name="animations" checked={chatPreferences.animations===value} onChange={()=>updatePreference("animations",value)}/><span>{label}</span></label>)}</section>}
        </main></div><footer className="chat-settings-footer"><button type="button" onClick={()=>{setChatPreferences({desktop:true,reactions:true,sound:"Tonos",email:false,callSound:true,autocorrect:true,markdown:true,color:"Zafiro",mode:"Sistema",density:"Cómoda",animations:"system",timezone:true});setSettingsFeedback("Configuración predeterminada restaurada")}}>Restaurar valores</button><span>Las preferencias se guardan automáticamente en este dispositivo.</span><button type="button" className="primary" onClick={()=>setSettingsOpen(false)}><Check/>Guardar y cerrar</button></footer></section></div>,document.body)}
        {chipPreview&&<div className="chat-chip-popover"><button type="button" onClick={()=>setChipPreview(null)}><X /></button><b>{chipPreview.title}</b><span>{chipPreview.detail}</span></div>}
        {forwardTarget&&<div className="overlay chat-forward-overlay" onMouseDown={(event)=>{if(event.target===event.currentTarget)setForwardTarget(null)}}><section className="chat-forward-modal"><header><div><Forward/><h3>Reenviar mensaje</h3></div><button type="button" onClick={()=>setForwardTarget(null)}><X/></button></header><blockquote>{forwardTarget.contenido || forwardTarget.archivoNombre || "Documento adjunto"}</blockquote><div className="chat-forward-contacts">{contacts.map((contact)=><label key={contact.id}><input type="checkbox" checked={forwardRecipients.includes(contact.id)} onChange={(event)=>setForwardRecipients((current)=>event.target.checked?[...current,contact.id]:current.filter((id)=>id!==contact.id))}/>{contact.fotoPerfil?<img src={contact.fotoPerfil} alt=""/>:<i style={{background:contact.area.colorHex}}>{initials(`${contact.nombres} ${contact.apellidos}`)}</i>}<span>{contact.nombres} {contact.apellidos}</span></label>)}</div><footer><button type="button" onClick={()=>setForwardTarget(null)}>Cancelar</button><button type="button" className="primary" disabled={!forwardRecipients.length} onClick={()=>void forwardSelectedMessage()}>Enviar a {forwardRecipients.length || ""}</button></footer></section></div>}
        {activeSpace && spaceSettings && (
          <div className="overlay group-settings-overlay" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSpaceSettings(false)}}>
            <section className="group-settings-modal">
              <button className="close" onClick={() => setSpaceSettings(false)}>
                <X />
              </button>
              <div className="group-settings-title">
                <span>{activeSpace.datos.esCanal ? <Hash /> : <Users />}</span>
                <div>
                  <small>GESTIÓN DEL ESPACIO</small>
                  <h2>{activeSpace.datos.nombre}</h2>
                  <p>
                    {members.length} integrante(s) · {moderators.length}{" "}
                    moderador(es)
                  </p>
                </div>
              </div>
              <button
                className={`mute-space ${muted ? "active" : ""}`}
                onClick={() => void performSpaceAction({action:"mute"})}
              >
                {muted ? <Volume2 /> : <VolumeX />}
                <span>
                  <b>
                    {muted ? "Activar notificaciones" : "Silenciar mensajes"}
                  </b>
                  <small>
                    {muted
                      ? "Volverás a recibir avisos de este espacio."
                      : "Seguirás viendo el historial sin recibir avisos."}
                  </small>
                </span>
              </button>
              {canManage && (
                <div className="add-space-member">
                  <UserPlus />
                  <select
                    defaultValue=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      await saveSpace({
                        ...activeSpace.datos,
                        miembros: [...members, e.target.value],
                      });
                      e.target.value = "";
                    }}
                  >
                    <option value="">Agregar una persona…</option>
                    {contacts
                      .filter((contact) => !members.includes(contact.id))
                      .map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.nombres} {contact.apellidos} ·{" "}
                          {contact.area.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="space-member-list">
                {members.map((id: string) => {
                  const person = contacts.find((contact) => contact.id === id),
                    isOwner = id === activeSpace.creador.id,
                    isModerator = moderators.includes(id);
                  return (
                    <article key={id}>
                      <span
                        style={{
                          background: person?.area.colorHex ?? "#2f6fed",
                        }}
                      >
                        {person
                          ? initials(`${person.nombres} ${person.apellidos}`)
                          : id === currentUserId
                            ? "YO"
                            : "EJB"}
                      </span>
                      <div>
                        <b>
                          {person
                            ? `${person.nombres} ${person.apellidos}`
                            : id === currentUserId
                              ? "Tú"
                              : `${activeSpace.creador.nombres} ${activeSpace.creador.apellidos}`}
                        </b>
                        <small>
                          {isOwner
                            ? "Creador"
                            : isModerator
                              ? "Moderador"
                              : "Integrante"}
                        </small>
                      </div>
                      {canManage && !isOwner && (
                        <>
                          <button
                            className={
                              isModerator ? "moderator active" : "moderator"
                            }
                            onClick={() =>
                              saveSpace({
                                ...activeSpace.datos,
                                moderadores: isModerator
                                  ? moderators.filter(
                                      (memberId: string) => memberId !== id,
                                    )
                                  : [...moderators, id],
                              })
                            }
                          >
                            <Shield />
                            {isModerator
                              ? "Quitar moderador"
                              : "Hacer moderador"}
                          </button>
                          <button
                            className="remove-member"
                            onClick={() =>
                              saveSpace({
                                ...activeSpace.datos,
                                miembros: members.filter(
                                  (memberId: string) => memberId !== id,
                                ),
                                moderadores: moderators.filter(
                                  (memberId: string) => memberId !== id,
                                ),
                              })
                            }
                          >
                            <Trash2 />
                            Retirar
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
              {(activeSpace.canDelete||activeSpace.creador.id===currentUserId)&&<button type="button" className="chat-delete-space" onClick={()=>void removeSpace()}><Trash2/>Eliminar {activeSpace.datos.esCanal?"canal":"grupo"}</button>}
              {!canManage && (
                <p className="settings-note">
                  <Shield />
                  Solo el creador y los moderadores pueden administrar
                  integrantes.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
