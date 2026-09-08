# Sistema visual "EJB Chat" — inspirado en Google Chat

Este documento resume el rediseño aplicado y sirve como **prompt de referencia**: puedes pegarlo a futuro (a mí o a otra IA) para extender el mismo lenguaje visual a otras pantallas de EJB MANAGER, o para pedir ajustes puntuales sin perder coherencia.

## Qué se hizo

Se creó un archivo nuevo, `frontend/src/google-chat-theme.css`, que se importa **al final** en `main.tsx` (después de `chat-pro.css`). No se tocó la lógica de `Messages.tsx` ni `CollaborationModules.tsx`: todo sigue funcionando igual (contactos, historial, estados, GIFs, documentos, grupos/canales, firma electrónica, encuestas, fondos personalizables). Solo cambió el aspecto visual.

Se eligió este enfoque (una sola hoja de estilos nueva, en vez de seguir parchando `chat-pro.css`, `refinements.css`, `enterprise.css`, etc.) porque el chat ya tenía **tres capas de overrides con `!important` apiladas** de intentos anteriores — eso es justamente lo que suele producir un resultado inconsistente. La nueva hoja es la única fuente de verdad visual para el chat.

## Paleta y tokens (variables CSS en `.chat-workspace`)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--gc-primary` | `#0b57d0` | `#8ab4f8` | acciones, seleccionado, enlaces |
| `--gc-bg` / `--gc-bg-rail` / `--gc-bg-sunken` | blanco / `#f6f9fc` / `#eef2f7` | `#202124` / `#1a1b1e` / `#17181a` | fondos por capa |
| `--gc-selected` | `#d3e3fd` | `#2f3c58` | ítem activo en listas |
| `--gc-bubble-mine-bg` / `--gc-bubble-other-bg` | `#d3e3fd` / blanco | `#2f3c58` / `#2d2e30` | burbujas de mensaje |
| `--gc-text` / `--gc-text-muted` / `--gc-text-faint` | `#1f1f1f` / `#5f6368` / `#80868b` | `#e8eaed` / `#9aa0a6` / `#80868b` | jerarquía tipográfica |
| `--gc-radius-sm/md/lg/pill` | `12px / 18px / 24px / 999px` | igual | esquinas |

Tipografía: **Roboto** (Google Fonts) para todo el chat — es la fuente real que usa Google Chat en la mayoría de su interfaz.

El modo oscuro se resuelve solo (usa la clase `.dark` que ya alterna el resto de la app), así que no rompe el toggle existente.

## Estructura que se respetó (sin tocar JSX)

- **Barra superior** `.chat-appbar`: logo, buscador, selector de estado, accesos a comunicados/fondos/espacios.
- **Riel angosto** `.message-space-column`: accesos rápidos (Inicio/No leídos/Destacados), primeros 5 contactos, panel de grupos/canales.
- **Lista de conversaciones** `.conversation-list`: pestañas, mi estado, buscador, comunicados, contactos, grupos/canales.
- **Panel de conversación** `.chat-panel`: encabezado, burbujas de mensaje (texto/sticker/documento/GIF), compositor con adjuntar/GIF/emoji.
- Selector de **GIFs**, selector de **emoji/stickers**, popover de **fondos**, modal de **gestión de espacio**, **comunicados**, **firma electrónica** y **encuestas**: todos quedaron dentro del mismo lenguaje visual.
- El sistema de **fondos personalizables** (`wallpaper-ejb-*`, imagen propia) se dejó intacto a propósito — las burbujas llevan su propio borde/sombra para seguir siendo legibles sobre cualquier fondo.

## Prompt reutilizable

Si en el futuro quieres pedir "más de lo mismo" para otra pantalla de EJB MANAGER, puedes usar algo así:

> Aplica el mismo sistema visual de `google-chat-theme.css` (paleta `--gc-*`, Roboto, radios 12/18/24px, sombras suaves, selección `#d3e3fd` en claro / `#2f3c58` en oscuro) a [pantalla X], sin modificar la lógica ni los nombres de clase existentes — solo agrega una hoja de estilos nueva importada al final.

## Cómo verlo

1. Levanta el frontend (`pnpm dev` o el script equivalente dentro de `frontend/`) si no está corriendo.
2. Entra a la sección de mensajes con tu sesión.
3. Si algo no calza (un color, un contraste, un detalle puntual), dime exactamente qué pantalla/estado y lo ajusto sobre esta misma hoja — no hace falta tocar nada más.
