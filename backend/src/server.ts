import { gmailRoutes } from "./routes/gmail.routes.js";
import "dotenv/config";
import cors from "cors";
import express from "express";
import { iniciativaRoutes } from "./routes/iniciativa.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { usuarioRoutes } from "./routes/usuario.routes.js";
import { notFound } from "./middlewares/notFound.js";
import { authRoutes } from "./routes/auth.routes.js";
import { requireAuth } from "./middlewares/auth.js";
import { objetivoRoutes } from "./routes/objetivo.routes.js";
import { mensajeRoutes } from "./routes/mensaje.routes.js";
import { aprobacionRoutes } from "./routes/aprobacion.routes.js";
import { alertaRoutes } from "./routes/alerta.routes.js";
import { eventoRoutes } from "./routes/evento.routes.js";
import { operacionRoutes } from "./routes/operacion.routes.js";
import { colaboracionRoutes } from "./routes/colaboracion.routes.js";
import { searchRoutes } from "./routes/search.routes.js";
import { requestLog } from "./middlewares/requestLog.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { startMessageScheduler } from "./services/scheduler.js";
import { huddleRoutes } from "./routes/huddle.routes.js";
import { ticketRoutes } from "./routes/ticket.routes.js";
const localOrigin =
  /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|26\.\d+\.\d+\.\d+):5173$/;
const app = express();
app.use(requestLog);
app.use(
  cors({
    origin: (origin, done) =>
      done(
        null,
        !origin ||
          localOrigin.test(origin) ||
          origin === process.env.FRONTEND_URL,
      ),
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use("/api/colaboracion", requireAuth, colaboracionRoutes);
app.get("/api/health", (_, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/admin", requireAuth, adminRoutes);
app.use("/api/producto", requireAuth, productRoutes);
app.use("/api/notificaciones", requireAuth, notificationRoutes);
app.use("/api/busqueda", requireAuth, searchRoutes);
app.use("/api/iniciativas", requireAuth, iniciativaRoutes);
app.use("/api/objetivos", requireAuth, objetivoRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/mensajes", requireAuth, mensajeRoutes);
app.use("/api/huddles", requireAuth, huddleRoutes);
app.use("/api/tickets", requireAuth, ticketRoutes);
app.use("/api/aprobaciones", requireAuth, aprobacionRoutes);
app.use("/api/alertas", requireAuth, alertaRoutes);
app.use("/api/eventos", requireAuth, eventoRoutes);
app.use("/api/operacion", requireAuth, operacionRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use(notFound);
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(
      JSON.stringify({
        level: "error",
        path: req.path,
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      }),
    );
    res.status(Number((err as any).status)||400).json({ message: err.message });
  },
);
app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0", () => {
  startMessageScheduler();
  console.log("API lista en la red local, puerto 4000");
});
