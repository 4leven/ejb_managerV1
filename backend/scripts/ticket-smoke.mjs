import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const actor =
    (await prisma.usuario.findFirst({ where: { isSuperAdmin: true }, select: { id: true } })) ??
    (await prisma.usuario.findFirst({ where: { rol: "Admin" }, select: { id: true } }));
  if (!actor) throw new Error("No hay un usuario administrativo para ejecutar la prueba.");
  const token = jwt.sign({}, process.env.JWT_SECRET ?? "dev-only-secret", {
    subject: actor.id,
    expiresIn: "5m",
  });
  for (const path of [
    "/api/tickets/resumen",
    "/api/tickets/clientes",
    "/api/tickets?limit=5",
  ]) {
    const response = await fetch(`http://127.0.0.1:4000${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${path} devolvió ${response.status}: ${body}`);
    }
    const body = await response.json();
    const result = Array.isArray(body) ? body.length : body.rows?.length ?? body;
    console.log(`${path}: OK`, result);
  }
} finally {
  await prisma.$disconnect();
}
