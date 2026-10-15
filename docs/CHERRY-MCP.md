# Cherry desde el chat (conector MCP)

14-oct-2026. Fase A: solo para Sergio. La fase B (para clientes, con su propio inicio de sesión) viene después de que él lo pruebe.

## Qué es

Una función aparte, `cherry-mcp` (`servidor/cherry-mcp.ts`), que habla el protocolo MCP (Streamable HTTP, sin estado, solo POST).
Claude la usa para hacer en la cuenta de Cherry lo mismo que las pantallas. No cambia ninguna otra función ni pantalla.

- Dirección: `https://xsptcepijtnmowqauyxw.supabase.co/functions/v1/cherry-mcp` (verify_jwt apagado: la llave la revisa ella).
- Entra con `Authorization: Bearer <CHERRY_MCP_LLAVE>` y actúa como `CHERRY_MCP_UID` (la cuenta creatorspremium.co, c40d9dbf…).
  Los dos son secretos de Supabase. La llave está también en `~/.claude.json` de su computador (conector `cherry`, alcance usuario).
- Para cambiar la llave: nuevo secreto `CHERRY_MCP_LLAVE` + `claude mcp remove cherry -s user` y volver a agregarlo.

## La marca de cada chat (15-oct)

La cuenta tiene varias marcas (cobrapos = `principal`, sergiosaac.co = `cdc7nt2`, El Parche Food = `84059jh`). Todas las
acciones, menos `mis_marcas` y `subir_video`, aceptan `marca` (el nombre o el id; se perdonan mayúsculas, tildes y espacios,
y vale un pedazo como «cobra»). Sin `marca` usan la activa en Cherry. NO cambia la activa de la página: dos chats pueden ir
cada uno con la suya. Las instrucciones del conector le piden a Claude preguntar la marca al empezar y pasarla siempre.
Las fichas sin `cuenta` cuentan como de la primera marca, igual que en la página. cobrapos no tiene Instagram conectado
en Cherry: sus videos salen en 0 (guiones y calendario sí funcionan).

## Las acciones

| Acción | Usa | Guarda |
|---|---|---|
| `mis_videos` | historial `lista` + el SWEET y el diagnóstico copiados de la página | nada |
| `que_grabar` | lo mismo + «Lo siguiente» (loQueFunciona/combinacionSig) | nada |
| `ganchos` | guion-calco `ganchos` (con `tema` suelto, o con `ficha_id` = ganchos del plan) | con ficha: `mcpPlan.ganchos` |
| `planear_guion` | guion-calco `biblioteca` + `planear` | ficha nueva en `laboratorio.planes` con `mcpPlan` |
| `escribir_guion` | guion-calco `escribir` (Opus 5.5, llave interna: sin créditos) | `guion`, `dur`, `calco` de la ficha; borra `mcpPlan` |
| `mis_guiones` | el documento `laboratorio` | nada |
| `texto_publicacion` | herramientas `publicacion_texto` (manda `detalle`) | nada |
| `armar_carrusel` | herramientas `carrusel_armar` (solo el texto; el diseño sigue en la página) | nada |
| `desmontar_video` | Whisper directo (MP4 ≤ 25 MB) o texto pegado → herramientas `lab_desmontar`; reel propio por lab-video-ig | nada |
| `subir_video` | dirección firmada en el cubo público `publicar` | — |
| `antes_de_subir` | el video (proyecto o enlace) → `lab-ver-video` modo «antes» con `video_url`; duración por Range (caja mvhd) | con ficha: `antes`, `antesAcepta = {}` y, si no estaba, `grabado` |
| `mis_proyectos` | `projects` + `renders` (como `videosListos`) | nada |
| `calendario` | `calendario@<marca>` (ver / agregar como borrador / quitar) | el documento entero |

El guion va en TRES pasos (planear → ganchos → escribir) porque Supabase gratis corta cada llamada a los 150 s: planear y los
ganchos juntos tardaron 120 s.

## Trampas

- Los documentos se guardan ENTEROS, igual que la página. Si Cherry está abierta, su próximo guardado pisa lo del chat:
  cada respuesta que escribe lo avisa.
- El SWEET, el diagnóstico y «Lo siguiente» son COPIAS de `herramientas/lab-sweet.js` y `laboratorio.html`. Si cambian allá, cambiar aquí.
- `mis_videos` usa solo los reels del historial del servidor (la página además junta los de ig-metricas y los de Cherry).
- «Antes de subir»: `lab-ver-video` acepta `video_url` en el modo «antes» SOLO con la llave interna (abierto, bajaría lo
  que le pidieran). Baja el video (tope 120 MB) y lo pasa a la Files API como flujo, sin guardarlo entero en memoria; Gemini
  ve el VIDEO en vez del audio y los fotogramas que manda la página; al terminar se borra de Google. La página no cambia.
  Sin ficha no guarda nada. La ficha se pasa igual que `adsFicha()` (idea y gancho, de sus piezas); no manda `temas`.
- `lab-ver-video` del repo = la versión viva v45 (incluye lo de la auditoría «¿va a funcionar?» del 14-oct). Antes de
  desplegarla, comparar con la viva.
- `lab-transcribir` solo acepta WAV: por eso desmontar llama a Whisper directo.

## Probado el 14-oct

Todas las acciones con su cuenta. `escribir_guion` falló porque la cuenta de Anthropic se quedó sin saldo
(«credit balance is too low»): falta probarla cuando se recargue. Para la prueba del calendario se agregó una publicación
y se quitó. Quedó la ficha de prueba «el Problema Primero» (mv8uncbi40y2) con su plan y sus ganchos, sin escribir.

`antes_de_subir` (14-oct, noche): Proyecto 22 contra «cómo usar ganchos para viralizar» (mv2uzcuovdrr2), el mismo par
que se había revisado desde la página: 47 s, mismo gancho, mismo pedido y mismo open loop; quedó guardado en la ficha. Esa
ficha tiene las escenas sin texto, así que escena por escena no dice nada (la respuesta lo avisa con «ojo»).
