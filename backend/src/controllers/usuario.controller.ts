import { NextFunction, Request, Response } from "express";
import { Cargo, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";

const technicalPermissions = {
  verTicketera: true,
  registrarTickets: true,
  tomarTickets: true,
  crearProyectos: true,
  editarProyectos: true,
  eliminarProyectos: false,
  aprobar: false,
  exportar: true,
  gestionarDocumentos: true,
  verAuditoria: true,
};

export async function catalog(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const [areas, objetivos] = await Promise.all([
      prisma.area.findMany({ orderBy: { nombre: "asc" } }),
      prisma.objetivoNegocio.findMany({ orderBy: { nombre: "asc" } }),
    ]);
    res.json({ areas, objetivos, cargos: Object.values(Cargo) });
  } catch (error) {
    next(error);
  }
}
export async function team(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await prisma.usuario.findMany({
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          email: true,
          fotoPerfil: true,
          cargo: true,
          isSuperAdmin: true,
          permisos: true,
          area: true,
        },
        orderBy: { apellidos: "asc" },
      }),
    );
  } catch (e) {
    next(e);
  }
}
export async function teamCargo(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! } });
    if (!actor.isSuperAdmin) throw new Error("Solo el administrador global puede ascender o descender roles");
    const cargo = String(req.body.cargo) as Cargo;
    if (!Object.values(Cargo).includes(cargo)) throw new Error("Rol inválido");
    const target = await prisma.usuario.findUniqueOrThrow({ where: { id: String(req.params.id) } });
    if (target.isSuperAdmin && target.id !== actor.id) throw new Error("No se puede modificar otra cuenta administradora");
    const currentPermissions = target.permisos as Record<string, boolean> | null;
    res.json(await prisma.usuario.update({
      where: { id: target.id },
      data: {
        cargo,
        rol: target.isSuperAdmin ? Rol.Admin : [Cargo.Jefe,Cargo.Gerente].includes(cargo as any) ? Rol.Comite : Rol.Usuario,
        ...(cargo === Cargo.Tecnico
          ? {
              rol: Rol.Usuario,
              permisos: { ...(currentPermissions || {}), ...technicalPermissions },
            }
          : {}),
      },
      select: { id: true, cargo: true, rol: true, isSuperAdmin: true, permisos: true }
    }));
  } catch (e) { next(e); }
}
export async function removeTeamMember(req:Request,res:Response,next:NextFunction){try{const actor=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}});if(!actor.isSuperAdmin)throw new Error("Solo Santiago puede eliminar perfiles");const id=String(req.params.id);if(id===actor.id)throw new Error("No puedes eliminar tu propia cuenta administradora");await prisma.$transaction(async tx=>{await tx.iniciativa.updateMany({where:{responsableId:id},data:{responsableId:null}});await tx.evento.updateMany({where:{asignadoId:id},data:{asignadoId:null}});await tx.evento.deleteMany({where:{creadorId:id}});await tx.progreso.deleteMany({where:{usuarioId:id}});await tx.tareaComentario.deleteMany({where:{usuarioId:id}});await tx.solicitudCambio.updateMany({where:{aprobadorId:id},data:{aprobadorId:null}});await tx.solicitudCambio.deleteMany({where:{solicitanteId:id}});await tx.usuario.delete({where:{id}})});res.json({ok:true})}catch(e){next(e)}}
export async function password(req:Request,res:Response,next:NextFunction){try{const current=String(req.body.currentPassword??""),nextPassword=String(req.body.newPassword??"");if(nextPassword.length<8)throw new Error("La nueva contraseña debe tener al menos 8 caracteres");const user=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}});if(!await bcrypt.compare(current,user.passwordHash))throw new Error("La contraseña actual no es correcta");await prisma.usuario.update({where:{id:user.id},data:{passwordHash:await bcrypt.hash(nextPassword,12)}});res.json({ok:true})}catch(e){next(e)}}
export async function color(req: Request, res: Response, next: NextFunction) {
  try {
    const portalColor = String(req.body.portalColor);
    if (!/^#[0-9A-Fa-f]{6}$/.test(portalColor))
      throw new Error("Color inválido");
    res.json(
      await prisma.usuario.update({
        where: { id: req.userId! },
        data: { portalColor },
        select: { portalColor: true },
      }),
    );
  } catch (e) {
    next(e);
  }
}
export async function preferences(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const darkMode = Boolean(req.body.darkMode);
    res.json(
      await prisma.usuario.update({
        where: { id: req.userId! },
        data: { darkMode },
        select: { darkMode: true },
      }),
    );
  } catch (e) {
    next(e);
  }
}
const estadosMensaje = ["Disponible", "Break", "Ausente", "Ocupado", "No_molestar"] as const;
export async function messageStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const estadoMensaje = String(req.body.estadoMensaje);
    if (!estadosMensaje.includes(estadoMensaje as typeof estadosMensaje[number]))
      throw new Error("Estado de usuario inválido");
    res.json(await prisma.usuario.update({
      where: { id: req.userId! },
      data: { estadoMensaje },
      select: { estadoMensaje: true },
    }));
  } catch (error) {
    next(error);
  }
}
export async function profile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body as {
      nombres?: string;
      apellidos?: string;
      fotoPerfil?: string | null;
      cargo?: Cargo;
      areaId?: string;
    };
    if (
      data.fotoPerfil &&
      (!data.fotoPerfil.startsWith("data:image/") ||
        data.fotoPerfil.length > 1500000)
    )
      throw new Error("La foto debe ser una imagen menor a 1 MB");
    const current = await prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! } });
    if (data.cargo && !current.isSuperAdmin)
      throw new Error("Solo Santiago puede cambiar su rol en el equipo");
    if (data.cargo && !Object.values(Cargo).includes(data.cargo))
      throw new Error("Rol inválido");
    if(data.areaId && data.areaId!==current.areaId && !current.isSuperAdmin)throw new Error("Solo el administrador global puede cambiar el área de un usuario.");
    if (data.areaId)
      await prisma.area.findUniqueOrThrow({ where: { id: data.areaId } });
    res.json(
      await prisma.usuario.update({
        where: { id: req.userId! },
        data: {
          nombres: data.nombres?.trim(),
          apellidos: data.apellidos?.trim(),
          fotoPerfil: data.fotoPerfil,
          cargo: data.cargo,
          areaId: data.areaId,
        },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          email: true,
          cargo: true,
          rol: true,
          portalColor: true,
          darkMode: true,
          fotoPerfil: true,
          estadoMensaje: true,
          isSuperAdmin: true,
          area: true,
        },
      }),
    );
  } catch (e) {
    next(e);
  }
}
