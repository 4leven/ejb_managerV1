import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';

declare global { namespace Express { interface Request { userId?:string } } }
export function requireAuth(req:Request,res:Response,next:NextFunction){
 const value=req.headers.authorization;
 if(!value?.startsWith('Bearer ')) return res.status(401).json({message:'Inicia sesión para continuar'});
 try{const payload=jwt.verify(value.slice(7),process.env.JWT_SECRET??'dev-only-secret') as jwt.JwtPayload;req.userId=String(payload.sub);next();}
 catch{return res.status(401).json({message:'La sesión venció. Inicia sesión nuevamente'});}
}
