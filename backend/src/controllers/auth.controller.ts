import { Cargo } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service.js";

const registerSchema = z.object({
  nombres: z.string().min(2).max(100),
  apellidos: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  areaId: z.string().uuid(),
  approvalCode: z.string().max(100).optional(),
  cargo: z.nativeEnum(Cargo).refine((cargo) => cargo !== Cargo.Tecnico && cargo !== Cargo.Administracion, {
    message: "Los roles Técnico y Administración solo pueden ser asignados por el administrador global",
  }),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res
      .status(201)
      .json(await authService.register(registerSchema.parse(req.body)));
  } catch (e) {
    next(e);
  }
};
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = loginSchema.parse(req.body);
    res.json(await authService.login(data.email, data.password));
  } catch (e) {
    next(e);
  }
};
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await authService.me(req.userId!));
  } catch (e) {
    next(e);
  }
};
export const forgot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(
      await authService.forgot(z.string().email().parse(req.body.email)),
    );
  } catch (e) {
    next(e);
  }
};
export const reset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        token: z.string().min(20),
        password: z.string().min(8).max(72),
      })
      .parse(req.body);
    res.json(await authService.reset(data.token, data.password));
  } catch (e) {
    next(e);
  }
};
export const verify = async (req:Request,res:Response,next:NextFunction)=>{try{res.json(await authService.verifyEmail(z.string().min(20).parse(req.body.token)))}catch(e){next(e)}};
