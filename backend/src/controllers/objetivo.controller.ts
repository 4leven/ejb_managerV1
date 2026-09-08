import { canDeleteOwned } from "../services/permissions.js";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
const schema = z.object({
  nombre: z.string().min(3).max(150),
  descripcion: z.string().max(1000).optional(),
});
export const list = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor=await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}});
    res.json(
      (await prisma.objetivoNegocio.findMany({
        where: { deletedAt: null },
        include: {
          _count: { select: { iniciativas: true } },
          progresos: {
            include: {
              usuario: {
                select: {
                  id: true,
                  nombres: true,
                  apellidos: true,
                  fotoPerfil: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      })).map(row=>({...row,canDelete:canDeleteOwned(actor,row.creadorId,row.areaId)})),
    );
  } catch (e) {
    next(e);
  }
};
export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res
      .status(201)
      .json(
        await prisma.objetivoNegocio.create({ data: {...schema.parse(req.body),creadorId:req.userId!,areaId:(await prisma.usuario.findUniqueOrThrow({where:{id:req.userId!}})).areaId} }),
      );
  } catch (e) {
    next(e);
  }
};
const progressSchema = z.object({
  porcentaje: z.number().int().min(0).max(100),
  comentario: z.string().trim().min(3).max(1000),
});
export const progress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const objetivoId = String(req.params.id);
    await prisma.objetivoNegocio.findUniqueOrThrow({
      where: { id: objetivoId },
    });
    const data = progressSchema.parse(req.body);
    res
      .status(201)
      .json(
        await prisma.objetivoProgreso.create({
          data: { ...data, objetivoId, usuarioId: req.userId! },
          include: {
            usuario: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                fotoPerfil: true,
              },
            },
          },
        }),
      );
  } catch (e) {
    next(e);
  }
};
