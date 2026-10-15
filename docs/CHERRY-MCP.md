# Cherry desde el chat (conector MCP)

14-oct-2026. Fase A: solo para Sergio. La fase B (para clientes, con su propio inicio de sesión) viene después de que él lo pruebe.

## Qué es

Una función aparte, `cherry-mcp` (`servidor/cherry-mcp.ts`), que habla el protocolo MCP (Streamable HTTP, sin estado, solo POST).
Claude la usa para hacer en la cuenta de Cherry lo mismo que las pantallas. No cambia ninguna otra función ni pantalla.

- Dirección: `https://xsptcepijtnmowqauyxw.supabase.co/functions/v1/cherry-mcp` (verify_jwt apagado: la llave la revisa ella).
- Entra con `Authorization: Bearer <CHERRY_MCP_LLAVE>` y actúa como `CHERRY_MCP_UID` (la cuenta creatorspremium.co, c40d9dbf…).
  Los dos son secretos de Supabase. La llave está también en `~/.claude.json` de su computador (conector `cherry`, alcance usuario).
- Para cambiar la llave: nuevo secreto `CHERRY_MCP_LLAVE` + `claude mcp remove cherry -s user` y volver a agregarlo.

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
| `mis_proyectos` | `projects` + `renders` (como `videosListos`) | nada |
| `calendario` | `calendario@<marca>` (ver / agregar como borrador / quitar) | el documento entero |

El guion va en TRES pasos (planear → ganchos → escribir) porque Supabase gratis corta cada llamada a los 150 s: planear y los
ganchos juntos tardaron 120 s.

## Trampas

- Los documentos se guardan ENTEROS, igual que la página. Si Cherry está abierta, su próximo guardado pisa lo del chat:
  cada respuesta que escribe lo avisa.
- El SWEET, el diagnóstico y «Lo siguiente» son COPIAS de `herramientas/lab-sweet.js` y `laboratorio.html`. Si cambian allá, cambiar aquí.
- `mis_videos` usa solo los reels del historial del servidor (la página además junta los de ig-metricas y los de Cherry).
- «Antes de subir» NO está todavía: el 14-oct otra sesión estaba cambiando `lab-ver-video` (auditoría «¿va a funcionar?»)
  y la versión viva era más nueva que la del repo. Cuando eso se asiente, se le agrega a `lab-ver-video` un `video_url`
  (solo con la llave interna) y aquí la acción.
- `lab-transcribir` solo acepta WAV: por eso desmontar llama a Whisper directo.

## Probado el 14-oct

Todas las acciones con su cuenta. `escribir_guion` falló porque la cuenta de Anthropic se quedó sin saldo
(«credit balance is too low»): falta probarla cuando se recargue. Para la prueba del calendario se agregó una publicación
y se quitó. Quedó la ficha de prueba «el Problema Primero» (mv8uncbi40y2) con su plan y sus ganchos, sin escribir.
