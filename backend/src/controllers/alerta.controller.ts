import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db.js";
import { notify } from "../services/notification.js";
import { isTechnical } from "../services/permissions.js";

async function buildAlerts(userId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const completedSince = new Date(now.getTime() - 7 * 86400000);
    const actor = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
    const initiatives = await prisma.iniciativa.findMany({
      where: actor.isSuperAdmin || isTechnical(actor) ? {} : { OR: [{ areaId: actor.areaId }, { responsableId: actor.id }] },
      include: {
        area: true,
        progresos: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { usuario: { select: { nombres: true, apellidos: true } } },
        },
      },
    });

    const initiativeAlerts=initiatives.flatMap((initiative) => {
      const result: any[] = [];
      const latest = initiative.progresos[0];
      if (initiative.porcentajeAvance >= 100) {
        if (latest && latest.createdAt >= completedSince) {
          const author = `${latest.usuario.nombres} ${latest.usuario.apellidos}`.trim();
          result.push({ type: "completado", severity: "success", initiativeId: initiative.id, code: initiative.codigo, title: `${initiative.codigo} · ${initiative.titulo} fue completada`, message: `Completada por ${author} · ${latest.createdAt.toLocaleString("es-PE")}`, alertDate: latest.createdAt.toISOString() });
        }
        return result;
      }
      if (initiative.fechaFin && initiative.fechaFin < today) result.push({ type: "retraso", severity: "high", initiativeId: initiative.id, code: initiative.codigo, title: `${initiative.codigo} · ${initiative.titulo} está retrasada`, message: `Fecha límite: ${initiative.fechaFin.toLocaleDateString("es-PE")}`, alertDate: initiative.fechaFin.toISOString() });
      const lastProgress = latest?.createdAt;
      if (initiative.estado === "En_desarrollo" && (!lastProgress || lastProgress < today)) result.push({ type: "sin_avance", severity: "medium", initiativeId: initiative.id, code: initiative.codigo, title: `${initiative.codigo} · ${initiative.titulo} sin avance diario`, message: "No se registró progreso hoy", alertDate: today.toISOString() });
      return result;
    });
    const [tasks,events,groups]=await Promise.all([
      prisma.tareaIniciativa.findMany({where:{completada:false,fechaFin:{lte:new Date(now.getTime()+3*86400000)},iniciativa:{OR:[{areaId:actor.areaId},{responsableId:actor.id}]}},include:{iniciativa:{select:{id:true,codigo:true,titulo:true}}},take:20}),
      prisma.evento.findMany({where:{inicio:{gte:now,lte:new Date(now.getTime()+24*3600000)},OR:[{asignadoId:actor.id},{areaId:actor.areaId}]},orderBy:{inicio:"asc"},take:20}),
      prisma.registroPortal.findMany({where:{tipo:"grupo"},select:{id:true,datos:true}})
    ]);
    const taskAlerts=tasks.map(task=>({type:"tarea",severity:task.fechaFin&&task.fechaFin<today?"high":"medium",initiativeId:task.iniciativa.id,code:task.iniciativa.codigo,title:`Tarea pendiente: ${task.titulo}`,message:`${task.iniciativa.codigo} · ${task.iniciativa.titulo} · vence ${task.fechaFin?.toLocaleDateString("es-PE")??"pronto"}`,alertDate:task.fechaFin?.toISOString()??now.toISOString()}));
    const eventAlerts=events.map(event=>({type:"reunion",severity:"medium",initiativeId:event.iniciativaId,title:`Próxima reunión: ${event.titulo}`,message:event.inicio.toLocaleString("es-PE"),alertDate:event.inicio.toISOString()}));
    const invitationAlerts=groups.flatMap(group=>{const data=group.datos as any;return (Array.isArray(data.invitaciones)?data.invitaciones:[]).filter((item:any)=>item.usuarioId===userId&&item.estado==="Pendiente").map((item:any)=>({type:"invitacion_grupo",severity:"medium",initiativeId:group.id,title:`Invitación a ${data.nombre}`,message:"Puedes aceptarla o rechazarla desde Mensajes",alertDate:item.fecha??item.createdAt??now.toISOString()}))});
    const derived=[...invitationAlerts,...eventAlerts,...taskAlerts,...initiativeAlerts];
    await Promise.all(derived.map(item=>notify(userId,item.type,item.title,item.message,item.type==="reunion"?"calendario":item.type==="invitacion_grupo"?"mensajes":"cronograma",{initiativeId:item.initiativeId})));
    return derived;
}

export async function alerts(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await buildAlerts(req.userId!));
  } catch (error) {
    next(error);
  }
}

export async function alertStream(req: Request, res: Response, next: NextFunction) {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let previousSignature = "";
    let closed = false;
    const send = async () => {
      if (closed) return;
      try {
        const rows = await buildAlerts(req.userId!);
        const signature = JSON.stringify(rows);
        if (signature !== previousSignature) {
          previousSignature = signature;
          res.write(`event: alertas\ndata: ${signature}\n\n`);
        } else {
          res.write(`: conectado ${Date.now()}\n\n`);
        }
      } catch {
        res.write(`event: error-servidor\ndata: {}\n\n`);
      }
    };

    await send();
    const timer = setInterval(send, 2000);
    req.on("close", () => {
      closed = true;
      clearInterval(timer);
      res.end();
    });
  } catch (error) {
    next(error);
  }
}
