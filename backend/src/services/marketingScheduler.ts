import { ensureMonthMeta } from "./marketing.service.js";

let timer: NodeJS.Timeout | undefined;

async function ensureCurrentMonthMeta() {
  const hoy = new Date();
  try {
    await ensureMonthMeta(hoy.getFullYear(), hoy.getMonth() + 1);
  } catch (error) {
    console.error("No se pudo asegurar la meta de marketing del mes", error);
  }
}

export function startMarketingScheduler() {
  if (timer) return;
  void ensureCurrentMonthMeta();
  timer = setInterval(() => void ensureCurrentMonthMeta(), 60 * 60 * 1000);
  timer.unref();
}
