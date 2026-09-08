import { Router } from "express";
import { deleteForEveryone, deleteConversation, conversations, deleteScheduledMessage, forwardMessage, scheduleMessage, scheduledMessages, searchMessages, send, thread, toggleReaction, updateScheduledMessage } from "../controllers/mensaje.controller.js";
export const mensajeRoutes = Router()
  .get("/conversaciones", conversations).get("/buscar", searchMessages).get("/programados", scheduledMessages)
  .delete("/mensajes/:messageId/para-todos",deleteForEveryone)
  .patch("/programados/:id", updateScheduledMessage).delete("/programados/:id", deleteScheduledMessage)
  .post("/:messageId/reacciones", toggleReaction).post("/:messageId/reenviar", forwardMessage)
  .post("/:userId/programar", scheduleMessage).delete("/:userId", deleteConversation).get("/:userId", thread).post("/:userId", send);
