export type ProjectStatus =
  | "Pendiente"
  | "En_evaluacion"
  | "Priorizado"
  | "En_desarrollo"
  | "Finalizado";

export function progressFromTasks(
  total: number,
  completed: number,
  storedProgress = 0,
) {
  if (total <= 0) return Math.max(0, Math.min(100, storedProgress));
  return Math.round((Math.max(0, completed) / total) * 100);
}

export function automaticProjectStatus(
  progress: number,
  current: ProjectStatus,
  hasActiveTasks = false,
): ProjectStatus {
  if (progress >= 100) return "Finalizado";
  if (progress > 0 || hasActiveTasks) return "En_desarrollo";
  if (current === "Finalizado" || current === "En_desarrollo") return "Pendiente";
  return current;
}
