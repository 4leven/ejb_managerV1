import { prisma } from "../config/db.js";
let timer: NodeJS.Timeout | undefined;
async function deliverScheduledMessages() {
  const pending = await prisma.mensajeProgramado.findMany({ where: { enviadoAt: null, enviarEn: { lte: new Date() } }, orderBy: { enviarEn: "asc" }, take: 100 });
  for (const message of pending) try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.mensajeProgramado.updateMany({ where: { id: message.id, enviadoAt: null }, data: { enviadoAt: new Date() } });
      if (!claimed.count) return;
      await tx.mensaje.create({ data: { remitenteId: message.remitenteId, destinatarioId: message.destinatarioId, contenido: message.contenido, tipo: message.tipo, archivoNombre: message.archivoNombre, archivoMime: message.archivoMime, archivoData: message.archivoData } });
    });
  } catch (error) { console.error("No se pudo entregar el mensaje programado", message.id, error); }
}
export function startMessageScheduler() {
  if (timer) return;
  void deliverScheduledMessages().catch((error) => console.error("Error del programador de mensajes", error));
  timer = setInterval(() => void deliverScheduledMessages().catch((error) => console.error("Error del programador de mensajes", error)), 30_000);
  timer.unref();
}
