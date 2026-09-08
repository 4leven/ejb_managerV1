import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let initiativeId = "";
try {
  const area = await prisma.area.findUnique({ where: { nombre: "Sistemas" } });
  if (!area) throw new Error("El área Sistemas no está registrada.");
  const actor =
    (await prisma.usuario.findFirst({ where: { isSuperAdmin: true }, select: { id: true } })) ??
    (await prisma.usuario.findFirst({ where: { rol: "Admin" }, select: { id: true } }));
  if (!actor) throw new Error("No hay un usuario administrativo para la prueba.");
  const token = jwt.sign({}, process.env.JWT_SECRET ?? "dev-only-secret", {
    subject: actor.id,
    expiresIn: "5m",
  });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const createdResponse = await fetch("http://127.0.0.1:4000/api/iniciativas", {
    method: "POST",
    headers,
    body: JSON.stringify({
      titulo: "PRUEBA TEMPORAL KANBAN SISTEMAS",
      descripcion: "Validación automatizada de visibilidad exclusiva para el área Sistemas.",
      areaId: area.id,
      impacto: 5,
      esfuerzo: "Medio",
    }),
  });
  const created = await createdResponse.json();
  if (createdResponse.status !== 201) throw new Error(JSON.stringify(created));
  initiativeId = created.id;
  if (created.area?.nombre !== "Sistemas") throw new Error("La iniciativa no conservó el área Sistemas.");
  const listResponse = await fetch("http://127.0.0.1:4000/api/iniciativas", { headers });
  const initiatives = await listResponse.json();
  const visible = initiatives.find((item) => item.id === initiativeId);
  if (!visible || visible.area?.nombre !== "Sistemas")
    throw new Error("La iniciativa no está disponible para Kanban Sistemas.");
  const movedResponse = await fetch(`http://127.0.0.1:4000/api/iniciativas/${initiativeId}/estado`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ estado: "En_evaluacion" }),
  });
  const moved = await movedResponse.json();
  if (movedResponse.status !== 200 || moved.estado !== "En_evaluacion")
    throw new Error(`La transición del Kanban falló: ${JSON.stringify(moved)}`);
  console.log("Área Sistemas: OK");
  console.log("Alta y disponibilidad inmediata en Kanban Sistemas: OK");
  console.log("Transición operativa del Kanban: OK");
} finally {
  if (initiativeId)
    await prisma.iniciativa.delete({ where: { id: initiativeId } }).catch(() => undefined);
  await prisma.$disconnect();
}
