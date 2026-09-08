import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { hasPermission, isTechnical } from '../services/permissions.js';
import { automaticProjectStatus, progressFromTasks, type ProjectStatus } from '../services/project-status.js';

export async function summary(_req:Request,res:Response,next:NextFunction){
  try {
    const [total,enDesarrollo,average] = await Promise.all([
      prisma.iniciativa.count({where:{deletedAt:null}}),
      prisma.iniciativa.count({where:{estado:'En_desarrollo',deletedAt:null}}),
      prisma.iniciativa.aggregate({where:{deletedAt:null},_avg:{impacto:true}})
    ]);
    res.json({total,enDesarrollo,impactoPromedio:Number(average._avg.impacto??0)});
  } catch(error){ next(error); }
}

const escapeXml=(value:unknown)=>String(value??'').replace(/[<>&"']/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&apos;"}[char]!));
const stateLabel=(value:string)=>value.replace('En_evaluacion','En evaluación').replace('En_desarrollo','En proceso');
async function reportData(month?:string,area?:string,client?:string,projectId?:string,taskId?:string,workerId?:string){
  const current=new Date(),parts=month?.match(/^(\d{4})-(\d{2})$/),now=parts?new Date(Number(parts[1]),Number(parts[2])-1,15):current,start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,1),where:any={deletedAt:null};if(area)where.areaId=area;if(client)where.cliente=client;if(projectId)where.id=projectId;if(taskId)where.tareas={some:{id:taskId}};if(workerId)where.OR=[{responsableId:workerId},{tareas:{some:{responsableId:workerId}}}];
  const [initiatives,areas,events,completedTasks,progressCount]=await Promise.all([
    prisma.iniciativa.findMany({where,include:{area:true,responsable:true,tareas:{where:{deletedAt:null},include:{responsable:true}},progresos:{orderBy:{createdAt:'desc'},take:1},_count:{select:{eventos:true}}},orderBy:{score:'desc'}}),
    prisma.area.findMany({orderBy:{nombre:'asc'}}),
    prisma.evento.count({where:{inicio:{gte:start,lt:end}}}),
    prisma.tareaIniciativa.count({where:{completadaAt:{gte:start,lt:end}}}),
    prisma.progreso.count({where:{createdAt:{gte:start,lt:end}}})
  ]);
  const rows=initiatives.map(item=>{const avance=progressFromTasks(item.tareas.length,item.tareas.filter(task=>task.completada).length,item.progresos[0]?.porcentaje??item.porcentajeAvance),hasActiveTasks=item.tareas.some(task=>task.estado==='Iniciado'||task.estado==='En_progreso');return{...item,avance,estado:automaticProjectStatus(avance,item.estado as ProjectStatus,hasActiveTasks)}});
  const avg=rows.length?Math.round(rows.reduce((sum,item)=>sum+item.avance,0)/rows.length):0;
  const areaRows=areas.map(area=>{const projects=rows.filter(item=>item.areaId===area.id);return{nombre:area.nombre,proyectos:projects.length,avance:projects.length?Math.round(projects.reduce((sum,item)=>sum+item.avance,0)/projects.length):0,completados:projects.filter(item=>item.avance===100).length,reuniones:projects.reduce((sum,item)=>sum+item._count.eventos,0)}});
  return{now,start,rows,areaRows,kpis:{total:rows.length,activos:rows.filter(item=>item.estado==='En_desarrollo').length,completados:rows.filter(item=>item.avance===100).length,retrasados:rows.filter(item=>item.fechaFin&&item.fechaFin<now&&item.avance<100).length,avance:avg,nuevos:rows.filter(item=>item.fechaCreacion>=start&&item.fechaCreacion<end).length,eventos:events,tareas:completedTasks,actualizaciones:progressCount}};
}
export async function monthlyReport(req:Request,res:Response,next:NextFunction){
  try{
    const actor=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}});
    if(!actor.isSuperAdmin&&!isTechnical(actor)&&actor.rol!=='Admin'&&!['Jefe','Gerente'].includes(actor.cargo)&&!hasPermission(actor,'exportar'))return res.status(403).json({message:'No tienes permisos para descargar reportes gerenciales'});
    const format=String(req.query.format||'pdf').toLowerCase(),month=String(req.query.month||''),area=String(req.query.area||''),client=String(req.query.client||''),projectId=String(req.query.projectId||''),taskId=String(req.query.taskId||''),workerId=String(req.query.workerId||''),data=await reportData(month,area,client,projectId,taskId,workerId),previous=req.query.compare==='1'?await reportData(`${data.start.getMonth()===0?data.start.getFullYear()-1:data.start.getFullYear()}-${String(data.start.getMonth()===0?12:data.start.getMonth()).padStart(2,'0')}`,area,client,projectId,taskId,workerId):null,period=data.now.toLocaleDateString('es-PE',{month:'long',year:'numeric'}),stamp=data.now.toISOString().slice(0,10),comparison=previous?`Comparativa: avance ${data.kpis.avance-previous.kpis.avance>=0?'+':''}${data.kpis.avance-previous.kpis.avance} pp · proyectos ${data.kpis.total-previous.kpis.total>=0?'+':''}${data.kpis.total-previous.kpis.total}`:'',singleTask=taskId?data.rows.flatMap(row=>row.tareas.map(task=>({task,row}))).find(entry=>entry.task.id===taskId):null,reportTitle=singleTask?`Reporte de tarea · ${singleTask.task.titulo}`:projectId&&data.rows[0]?`Reporte de proyecto · ${data.rows[0].codigo}`:'Reporte mensual';
    if(comparison)res.setHeader('X-Report-Comparison',encodeURIComponent(comparison));
    if(format==='xls'){
      const cells=(values:unknown[])=>`<Row>${values.map(value=>`<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join('')}</Row>`;
      const projectRows=data.rows.map(row=>cells([
        row.codigo,row.titulo,row.cliente||'Sin cliente',row.area.nombre,
        stateLabel(row.estado),`${row.avance}%`,row.score,row.tareas.length,
        row._count.eventos,row.fechaInicio?.toLocaleDateString('es-PE')||'',
        row.fechaFin?.toLocaleDateString('es-PE')||'',
      ])).join('');
      const taskRows=data.rows.flatMap(row=>row.tareas
        .filter(task=>(!taskId||task.id===taskId)&&(!workerId||task.responsableId===workerId||row.responsableId===workerId))
        .map(task=>cells([
          row.codigo,row.titulo,task.titulo,task.completada?'Completada':task.estado,
          task.responsable?`${task.responsable.nombres} ${task.responsable.apellidos}`:'Sin asignar',
          task.fechaInicio?.toLocaleDateString('es-PE')||'',task.fechaFin?.toLocaleDateString('es-PE')||'',
          task.completadaAt?.toLocaleDateString('es-PE')||'',
        ]))).join('');
      const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Resumen"><Table>${cells(['REPORTE MENSUAL EJB MANAGER',period])}${cells([])}${cells(['Métrica','Valor'])}${Object.entries(data.kpis).map(([key,value])=>cells([key,value])).join('')}</Table></Worksheet><Worksheet ss:Name="Por área"><Table>${cells(['Área','Proyectos','Avance promedio','Completados','Reuniones'])}${data.areaRows.map(row=>cells([row.nombre,row.proyectos,`${row.avance}%`,row.completados,row.reuniones])).join('')}</Table></Worksheet><Worksheet ss:Name="Proyectos"><Table>${cells(['Código','Título','Cliente','Área','Estado','Avance','Score','Tareas','Reuniones','Inicio','Fin estimado'])}${projectRows}</Table></Worksheet><Worksheet ss:Name="Tareas"><Table>${cells(['Código','Proyecto','Tarea','Estado','Responsable','Inicio','Fin estimado','Finalizada'])}${taskRows}</Table></Worksheet></Workbook>`;
      const reportName=singleTask?`reporte-tarea-${singleTask.task.id}-${stamp}.xls`:projectId&&data.rows[0]?`reporte-proyecto-${data.rows[0].codigo}-${stamp}.xls`:`reporte-operativo-${stamp}.xls`;
      res.setHeader('Content-Type','application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition',`attachment; filename="${reportName}"`);
      return res.send('\ufeff'+xml);
    }
    const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page=pdf.addPage([842,595]),y=548;
    const addPage=()=>{page=pdf.addPage([842,595]);y=552};
    const line=(text:string,size=9,x=42,font=regular,color=rgb(.12,.18,.28))=>{if(y<42)addPage();page.drawText(text,{x,y,size,font,color,maxWidth:755});y-=size+7};
    page.drawRectangle({x:0,y:535,width:842,height:60,color:rgb(.04,.12,.24)});page.drawText('EJB MANAGER',{x:42,y:562,size:17,font:bold,color:rgb(1,1,1)});page.drawText(`${reportTitle} · ${period}`,{x:42,y:542,size:11,font:regular,color:rgb(.55,.75,1)});y=510;
    line('RESUMEN EJECUTIVO',12,42,bold,rgb(.12,.35,.75));line(`Portafolio: ${data.kpis.total} iniciativas  |  Avance promedio: ${data.kpis.avance}%  |  Activas: ${data.kpis.activos}  |  Completadas: ${data.kpis.completados}`,10,42,bold);line(`Actividad del mes: ${data.kpis.nuevos} nuevas  |  ${data.kpis.tareas} tareas finalizadas  |  ${data.kpis.eventos} reuniones  |  ${data.kpis.actualizaciones} actualizaciones`,10);line(`Proyectos con retraso estimado: ${data.kpis.retrasados}`,10);y-=8;
    line('RENDIMIENTO POR ÁREA',12,42,bold,rgb(.12,.35,.75));data.areaRows.forEach(row=>line(`${row.nombre}: ${row.proyectos} proyectos · ${row.avance}% avance · ${row.completados} completados · ${row.reuniones} reuniones`,9));y-=8;
    line(singleTask?'DETALLE DE LA TAREA':'DETALLE DE INICIATIVAS',12,42,bold,rgb(.12,.35,.75));data.rows.forEach(row=>{line(`${row.codigo} · ${row.titulo}`,10,42,bold);line(`${row.area.nombre} | Cliente: ${row.cliente||'Sin cliente'} | Responsable: ${row.responsable?`${row.responsable.nombres} ${row.responsable.apellidos}`:'Sin asignar'} | ${stateLabel(row.estado)} | Avance ${row.avance}%`,8,54);row.tareas.filter(task=>(!taskId||task.id===taskId)&&(!workerId||task.responsableId===workerId||row.responsableId===workerId)).forEach(task=>line(`Tarea: ${task.titulo} | ${task.completada?'Completada':task.estado} | Responsable: ${task.responsable?`${task.responsable.nombres} ${task.responsable.apellidos}`:'Sin asignar'} | Inicio: ${task.fechaInicio?.toLocaleDateString('es-PE')||'Sin fecha'} | Fin: ${task.fechaFin?.toLocaleDateString('es-PE')||'Sin fecha'}`,8,66));y-=3});
    const filename=singleTask?`reporte-tarea-${singleTask.task.id}-${stamp}.pdf`:projectId&&data.rows[0]?`reporte-proyecto-${data.rows[0].codigo}-${stamp}.pdf`:`reporte-mensual-${stamp}.pdf`,bytes=await pdf.save();res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);return res.send(Buffer.from(bytes));
  }catch(error){next(error)}
}
