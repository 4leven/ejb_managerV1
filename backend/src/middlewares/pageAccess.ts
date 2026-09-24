import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db.js";
import { canSeePage } from "../services/permissions.js";

/**
 * Exige que el usuario pueda ver la página `clave` (catálogo en
 * backend/src/constants/paginas.ts) antes de dejarlo llegar a los datos de
 * esa ruta. Es la protección real — ocultar el link en el sidebar es solo
 * UX, esto es lo que de verdad rechaza la petición en el servidor.
 * Va después de requireAuth en cada ruta que se quiera proteger.
 */
export function requirePageAccess(clave: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await prisma.usuario.findUniqueOrThrow({ where: { id: req.userId! } });
      if (!canSeePage(actor, clave))
        return res.status(403).json({ message: "No tienes acceso a esta sección." });
      next();
    } catch (error) {
      next(error);
    }
  };
}
