import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, StartAudio, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Minimize2, PhoneOff } from "lucide-react";
import { leaveHuddle } from "../api/iniciativas";

export type HuddleSession = { huddleId: string; salaId: string; token: string; livekitUrl: string };
export default function Huddle({ session, onClose }: { session: HuddleSession; onClose: () => void }) {
  const [minimized, setMinimized] = useState(false);
  const leave = async () => { try { await leaveHuddle(session.huddleId); } finally { onClose(); } };
  useEffect(() => () => { void leaveHuddle(session.huddleId); }, [session.huddleId]);
  return <section className={`ejb-huddle ${minimized ? "minimized" : ""}`} aria-label="Huddle activo">
    <header><div><i/><b>Huddle en curso</b><small>{session.salaId.slice(0,8)}</small></div><button type="button" onClick={()=>setMinimized((value)=>!value)} title={minimized?"Expandir":"Minimizar"}><Minimize2/></button><button type="button" className="hangup" onClick={()=>void leave()} title="Colgar"><PhoneOff/></button></header>
    {!minimized&&<LiveKitRoom token={session.token} serverUrl={session.livekitUrl} connect audio video onDisconnected={onClose}><VideoConference/><RoomAudioRenderer/><StartAudio label="Activar audio"/></LiveKitRoom>}
  </section>;
}
