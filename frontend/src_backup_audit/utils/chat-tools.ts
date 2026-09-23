export const chatTones: Record<string, number[]> = {
  Tonos: [740, 980], Suave: [520], Campana: [1047, 1319, 1568],
  Cristal: [1568, 2093], Gotas: [880, 660, 990], Piano: [523, 659, 784],
  Aurora: [440, 554, 659, 880], Digital: [1200, 900, 1200], Silencio: [],
};

export async function playChatTone(name: string, existing?: AudioContext) {
  const notes = chatTones[name] ?? chatTones.Tonos;
  if (!notes.length) return;
  const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioClass) throw new Error("Este navegador no admite audio.");
  const context: AudioContext = existing ?? new AudioClass();
  await context.resume();
  const now = context.currentTime;
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = now + index * .14;
    oscillator.type = name === "Digital" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(name === "Suave" ? .035 : .075, start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .28);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + .3);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); if (!existing && index === notes.length - 1) void context.close(); };
  });
}

const phrases = ["Buenos días, ¿en qué puedo ayudarte?", "Buenas tardes, te comparto la información.", "Muchas gracias por la información.", "Por favor, revisa el documento adjunto.", "Te confirmo que la consulta quedó resuelta.", "Estoy revisando tu consulta.", "Te envío el documento solicitado.", "Quedo atento a tus comentarios."];
export function composeSuggestion(text: string) {
  const query = text.trimStart().toLocaleLowerCase("es");
  return query.length < 3 ? "" : phrases.find(phrase => phrase.toLocaleLowerCase("es").startsWith(query) && phrase.length > text.length) ?? "";
}
export function suggestedReplies(text: string) {
  if (/gracias/i.test(text)) return ["¡De nada!", "Con gusto", "Estamos para ayudarte"];
  if (/archivo|documento|adjunto/i.test(text)) return ["Recibido, gracias", "Lo revisaré", "Te envío el documento"];
  if (/[?¿]/.test(text)) return ["Sí, de acuerdo", "Lo confirmo en un momento", "¿Puedes darme más detalles?"];
  return ["Entendido, gracias", "De acuerdo", "Lo revisaré"];
}
export function correctLastWord(text: string) {
  const fixes: Record<string,string> = { grasias:"gracias", grcias:"gracias", porfavor:"por favor", tambien:"también", informacion:"información", reunion:"reunión", adjutno:"adjunto", documetno:"documento", configuracion:"configuración" };
  return text.replace(/([\p{L}]+)(\s+)$/u, (all, word: string, space: string) => {
    const replacement = fixes[word.toLowerCase()];
    if (!replacement) return all;
    return (word[0] === word[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement) + space;
  });
}

export async function readChatAttachment(file: File) {
  if (file.size > 2_000_000) throw new Error("El archivo debe pesar menos de 2 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo.")); reader.readAsDataURL(file);
  });
  return { nombre: file.name, mime: file.type || "application/octet-stream", data };
}
