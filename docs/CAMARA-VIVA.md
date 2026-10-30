# Cámara viva en Cherry

Decisión de Sergio (29-oct-2026): **la Cámara viva son los primeros y únicos gráficos con los que se lanza Cherry**.
Vidrio, La persiana y lo demás se quitan; después se enchufa una familia nueva cada semana. La referencia es su reel del
Día 4 («Cherry 9», instagram.com/p/DePMlkhiOFa; archivo `Downloads\Cherry Contenido\Cherry9\Cherry9-final-C1.mp4`).
Guía de diseño y código congelado del reel: `Downloads\Cherry Taller\camara-viva\IMPLEMENTAR-CAMARA-VIVA.md`.

Propuestas aprobadas: estilos https://claude.ai/artifact/TjJ2PCbk791Aj5YxrBKDh9 · imágenes y plan
https://claude.ai/artifact/XKx95szhMhkfm2gFWS7fQW · prueba del director https://claude.ai/artifact/GXDGbgzdc7LnH6qhQWPULb

⭐ **v4 (29-oct, tarde): SIMPLE.** Sergio: «Fondo con sombras + Objeto (imagen, clip o gráfico) + Títulos y subtítulos con
sombras y animaciones de entrada y salida + Movimientos de Cámara. Esa es la esencia, no más… menos es más». Las 12
plantillas de la v3 se cambiaron por UNA lámina: fondo de color (crema `#ECE4D6` o el que escoja la persona) con la sombra de
la persiana + UN objeto (una imagen recortada, tu video en un recuadro de esquinas redondas, o un gráfico: contador, barras,
comentario, seguir) + una línea chica y una gruesa. Referencia de la lámina: instagram.com/p/DZt2BtXPz8Q (kayn.marketing.co).
Respaldo de la v3: `scratchpad/familias/v3_respaldo/`.

## Cómo está armada (el «enchufe»)

| Pieza | Archivo | Qué hace |
|---|---|---|
| Ficha del estilo | `estilos/camara-viva/ficha.json` | v4: el título de cuando hablas, la lámina (su texto y cuánto dura) y sus objetos (imagen, clip, gráficos con sus campos). `imagenes.estilos`: los 5 estilos de imagen aprobados (Editorial de primero), cada uno con el texto que va a Nano Banana y su miniatura en `estilos/camara-viva/muestras/`; más `texto_referencia` y `fondo_verde`. Un estilo nuevo = una ficha nueva (+ sus plantillas). |
| Director | `servidor/director.ts` | Lee las palabras con sus tiempos y arma el PLAN de momentos (tú hablando / láminas) con la ficha. GPT-5 en segundo plano (Responses API `background`): pensando pasa de los 150 s de una función; se pide (`plan` → `pendiente: id`) y se recoge (`resultado`). Valida contra la ficha: textos sin partir palabras, el objeto (si falta algo, va tu video en el recuadro: nunca un hueco ni algo inventado), láminas largas se parten, momentos diminutos se juntan con el anterior. Probar gratis en local: `scratchpad/familias/probar_director.py`. |
| Tú hablando | `js/camara-viva.js` (página y ensamblador) | Del plan + dónde está tu cara: los encuadres de la cámara (`planos` → `tramos`) y los títulos con su lugar (`cajaTitulo`: al lado con ≥ 330 px libres, si no arriba; nunca encima de la cara). Números del Cherry 9. |
| La cámara | `js/movimiento.js › vivo` | Un pedazo `e: 'viva'` con los tramos: `estado` para la vista (CSS) y `ramaVivaFF` para ffmpeg (`perspective`). Tope ×1,7 (el resto de Cherry sigue en ×1,25). Comprobado: ffmpeg y la vista difieren < 1/255 por pixel (14,5–16 s del Cherry 9). |
| El título | `premium/src/cv/Titulo.tsx` | Palabra por palabra con desenfoque, las rojas en caja rubí, remate en Libre Caslon itálica; tamaño que cabe (la palabra más larga entra en la caja). Vista previa: `premium/src/cv/vista-cv.tsx` → `window.CherryCVVista` (Thumbnail de Remotion). |
| El kit | `premium/src/cv/kit.tsx` | Lo común, copiado del reel: `camLamina` (entra cerca y se asienta, nunca quieta), `Capa` (profundidad), ⭐ `SombraPersiana`, `SOL`, `Palabras` (blur-in por palabra) y, de la v4, `FondoPlano` (color + persiana + grano), `Rotulo` (línea chica 46 + gruesa 112, un renglón cada una: `tamLinea` solo baja la letra si no cabe; sale desenfocándose antes del corte), `esOscuro` (con color oscuro las letras van en blanco). |
| La lámina | `premium/src/cv/laminas.tsx` | UNA plantilla (`lamina`): fondo detrás (se mueve menos), el objeto que sube a su sitio con la cámara y zoom inmediato en la palabra que lo nombra, y el rótulo. Objeto: `imagen` (recorte con sombra de sol y sombra en el piso; nunca torcido), `clip` (tu video en el hueco 680 × 900 de esquinas redondas; `clipVideo` calcula el rectángulo con la MISMA cámara), `grafico` (tarjeta blanca: `contador` que sube y termina antes del corte, `barras`, `comentario` que se escribe y se publica, `seguir` con el puntero que toca). Sin imagen o con un gráfico desconocido → va tu video en el recuadro. |
| Las capas | `premium/src/cv/capas.tsx` | En cada instante: `CapaFondo` → tu video (con su cámara o en el hueco) → `CapaFrente` (la lámina o los títulos). `videoEn` dice dónde va tu video. |
| Plan → láminas | `js/camara-viva.js › piezas` | Cuándo entra cada línea (en la palabra en que la dices; la gruesa nunca cuando ya se va la lámina), el zoom inmediato (palabra de `zoom`), el color (`plan.fondo`) y su material (`material(m)`: el recorte de la persona o, si no hay, uno de EJEMPLO; su foto para comentario y seguir). |

⭐ **Regla de Sergio (29-oct): NUNCA nada provisional.** Lo que falte (una imagen) va con material de EJEMPLO en su sitio
y se aclara que se reemplaza; nunca un cartel o un marcador. Ejemplos de la prueba: la biblioteca del Cherry 9
(`_cv/ejemplos`: escriba y trasnocho en capas, agua y bóveda, escultura, cámara, reloj, cofre, maniquí, caballos).

Letras: Urbanist y Libre Caslon no venían en `@remotion/google-fonts` de premium-build (solo 11 letras): se copiaron del
proyecto del taller (4.0.528) a `scratchpad/premium-build/node_modules/@remotion/google-fonts/dist/{esm,cjs}`.

## Pruebas hechas (29-oct)

- **Nano Banana** (función temporal `nano-prueba`, contraseña de un solo uso): 2.1 = US$0,058 por imagen real (con el
  «pensamiento»), Pro = US$0,139; se usa **2.1** (figura sobre verde limpia y alineada). **1 crédito por imagen**.
- **Director** con los clips del Cherry 9: esfuerzo `low` 97 s y US$0,075 (26 momentos, 8 imágenes); `medium` 190 s y
  US$0,165, calidad parecida → `low`. Claude no se usa (Sergio: el director va con GPT; además la cuenta de Anthropic está
  sin saldo y los guiones premium caen solos a GPT-5).
- **Cámara + títulos**: banco local `_demo-camara-viva.html` (video del Cherry 9 en `_cv/`, plan del director, caras de
  YuNet de ese video). Nunca se publica. Fotos y video de 32 s en `scratchpad/familias/cvfotos`, `camara-viva-prueba.mp4`.

## Lo que falta

1. Director v4 corrido con el reel del Día 4 (29-oct, GPT-5 low, 89 s, US$0,075, `scratchpad/familias/director/
   plan_gpt-5_low.json`). Bien: imágenes con sentido (escultura armándose, anzuelo, cereza para «Cherry»), comentario y clip.
   Mal: cifras sin contador, tramos hablando de 7–9 s, se saltó un punto de la enumeración, huecos, «primero el gancho / el
   gancho». Arreglado (v4b): reglas más claras + `repasar` (sin huecos, tramos hablando > 5 s partidos con cortes de cámara),
   momentos pisados se recortan en vez de borrarse, la chica no repite la gruesa. **2.ª prueba (v4b, 29-oct, US$0,105):**
   contador en «200 mil seguidores», «un millón de vistas» y «5 cosas», sin huecos, cada punto de la enumeración en su
   momento, comentario al final; pidió 7 imágenes (se generaron 5 con Nano Banana 2.1 sobre verde + `chroma.py`,
   US$0,29; «ícono de pausa» y «celular con ícono de guardar» eran flojas → van como tu video en el recuadro). v4c/v4d: ningún
   texto termina colgando (`sinColgar`: la chica de la lámina, los 3 renglones del título hablando y lo que se corta por
   largo; «Día 4 probando que» → «Día 4 probando», «por si te» → nada, «copiar como» → «copiar»; las rojas que se caen salen
   de la lista). Video completo: `C:\Prueba Claude Code\Cherry camara viva\`. Grabar
   por pedazos (un Chrome se cae pasados ~350 cuadros): `scratchpad/familias/grabar.py <plan> <desde> <hasta> <mp4>`. Repaso gratis de un plan ya hecho: `scratchpad/familias/revalidar.py`. Plan a mano: `_cv/plan4.json`
   (y `_cv/plan4_graficos.json`, los 4 gráficos).
2. La cara en Cherry: `js/caras.js` (MediaPipe 0.10.14 por jsdelivr, modelo blaze_face_short_range de Google; gratis, en el
   navegador) ya la detecta. Probado con el Cherry 9 (`_demo-caras.html`): cara en 466 de 482 muestras, a 14 px (x) y 27 px
   (y) de YuNet en promedio; 149 s para 2 min en Chrome sin tarjeta gráfica (muestra cada 0,25 s). Falta: correrla en el
   editor mientras se ve la vista previa y GUARDARLA con el proyecto para el video final; sin cara, los títulos van arriba.
3. La lámina v4 ya existe (`laminas.tsx`, probada en `_demo-camara-viva.html?plan=plan4` con el Cherry 9). Falta: el color
   que escoge la persona (y el que propone Cherry), medir que la
   vista previa vaya fluida (si no, pasarlas al lienzo), el material de ejemplo servido desde Amazon para todos y la versión
   para el video final (Remotion en la Lambda, con tu video como OffthreadVideo en los huecos).
4. Conectar (plan en 4 entregas: https://claude.ai/artifact/7RHjAZXJUVdG9Fgay5dRCn).
   **Entregas 1-2 escritas (29-oct), en prueba solo para administradores (`CV_PARA_TODOS = false` en cvvivo.js):**
   - Estado del editor: `grafEstilo: 'camara_viva'` + `grafFondoCV` (fondo de las láminas) + `cvEstiloImg`; `C.grafCfg()` manda
     `{ estilo: 'camara_viva', fondo_cv?, estilo_imagenes? }` y `restaurarDeRender` lo devuelve.
   - orchestrate: `esCamaraViva` / `pedirPlanCV`. Al preparar la BASE de un proyecto Cámara viva le pide el plan al director
     (en vez de `graficosDe`) y deja `renders.graficos = { v: 4, estilo: 'camara_viva', rev: 1, pendiente }`. `graficosAlDia` y
     el camino completo no tocan un proyecto Cámara viva (si alguien sale de ella, se marcan los de su familia).
   - Función NUEVA `servidor/camara-viva.ts` (con sesión y dueño del proyecto): `plan` recoge lo que dejó pedido orchestrate
     (o lo pide si no hay; máx. 3 pedidos por video) y `caras` guarda dónde está la cara. Escribe con `rev` para no pisarse.
   - `director.ts` atiende también llamadas internas (llave de servicio); esfuerzo por defecto `low`. Lee la ficha de
     cherrysweet.app/estilos → la carpeta `estilos/` TIENE que estar subida.
   - Página: `js/components/cvvivo.js` (movvivo le cede el celular cuando `C.cvVivo.activo()`): pide el plan cada 6 s,
     busca la cara con `js/caras.js` y la guarda, y dibuja las 3 capas (fondo → tu video → frente) con `js/vista-cv.js`
     (compilado de premium/src/cv por `compilar_cv.sh`). Tu video en el hueco: `clip-path` + transform sobre el mismo
     elemento (como el marco del banco). Subtítulos callados en las láminas (`gr-callado`). Pestaña Gráficos: estado del
     plan y fondo de las láminas (Crema, Blanco, Piedra, Noche, Otro).
   - Probado local con `_prueba-cvvivo.html` (la caja del editor de 405 × 720 con el plan del director del Día 4): igual que
     el banco. Fotos: `C:\Prueba Claude Code\Cherry camara viva\editor-prueba-local.jpg`.
   - Desplegar: `scratchpad/familias/desplegar_cv.py` (director + camara-viva + orchestrate; no pisa orchestrate si lo de
     arriba es más nuevo que git). Volver atrás: desplegar `git show a6f0559:servidor/orchestrate.ts` (respaldo también en
     `scratchpad/familias/v3_respaldo/orchestrate_antes_cv.ts`); la página vieja vuelve con un `git revert`.
   - **Modo Manual (29-oct):** Sergio trabaja ahí y no veía la Cámara viva: `manual.js › libCamaraViva` (tarjeta principal
     con botón rosado, fondo de las láminas); el estado va en la etiqueta «Vista previa · armando tu Cámara viva · faltan ≈»
     (cortesvivo › etiquetaTexto + js/eta.js; nada de globos aparte). Sin escenas de apoyo ni «Cambiar todos» de vidrio.
   - **Movimientos v5 (29-oct).** Sergio, al verla en su editor: «se ve muy bonito» pero «hace un par de movimientos y
     repite el mismo ciclo» y «el rectángulo ocupó más espacio». Láminas: 5 entradas por turno (`ENTRADAS`: sube · barre ·
     aleja · cae · acerca; `orden` = n.º de lámina, lo pone camara-viva.js › piezas). Con tu video en el recuadro (`m.clip`,
     de `usaClip`: también las láminas que piden una imagen que aún no hay) todo a 0,55 de fuerza y SIN zoom inmediato; la
     tarjeta de un gráfico a 0,5 y zoom 1,1; «acerca» con zoom 1,14. Tú hablando (`planos`): corre = normal · rápida ·
     barrido desde el otro lado; golpe = vuelve · sigue empujando; suave = se acerca · se aleja · paneo. Todo son keyframes
     (z, x, y): el video final con ffmpeg sale igual.
   - **Medido en su editor (30-oct, Proyecto 14):** el «ciclo» que veía no era del navegador ni del celular (la caja `.cv`
     ya mide 9:16; el encaje con franjas del 29-oct no hacía nada y se quitó; `.screen` sí corta ~5 % de cada lado, solo en la
     vista previa). Era el plan: 13 de 16 hablando con «corre», 0 láminas con imagen ni gráfico (Día 4: 9 de 19, 7 imágenes, 4
     gráficos). `planos()`: máx. 2 «corre» seguidos (el siguiente va golpe o suave) y uno de cada dos al otro lado si la cara
     está cerca del centro; vale para cualquier plan, sin regenerar.
   - **Entrega 3, imágenes (30-oct):** `cvvivo.js › panelImagenes` (lo usan Manual y Automático): estilo por video (el último
     usado; Editorial de primero; referencia; sin imágenes), crear, otra versión, subir la tuya, volver a tu video; primero las
     láminas que piden imagen y detrás de un botón las demás (escribes qué debe verse). `camara-viva.ts`: `imagen` (Nano Banana
     2.1 sobre verde, 1 crédito `img:<proyecto>:<uuid>`, se devuelve si falla), `subir_imagen`, `guardar_imagen`,
     `quitar_imagen`. El verde se recorta en la página (`recortarVerde`, misma cuenta de chroma.py: 0,92/255 de diferencia).
     Archivos en `uploads/<proyecto>/imagenes/` (privada, enlace firmado de 7 días; la limpieza no la toca y se borra con el
     proyecto); `renders.graficos.imagenes[n.º de momento]`. ⚠️ `ediciones/` NO sirve: `carrete-servidor` no puede escribir ahí
     (30-oct, 403: la primera prueba de Sergio falló así). Si se creó y no se guardó, el reintento no paga otra vez (`sinSubir`).
     Ctrl + Z (Manual): `C.cvVivo.alCambiar` anota cada cambio en HIST (imagen de una lámina o ajustes) y `deshacer` lo vuelve a
     poner; los archivos no se borran, así que no cuesta. Prueba sin gastar: `_prueba-cvimg.html` + `scratchpad/familias/foto_panel.py`. Falta subir un CLIP propio a una lámina.
   - **Subtítulos y títulos (30-oct):** con la Cámara viva no hay frases de impacto (`C.subs.modoImpacto`) y el subtítulo es el del
     Día 4 (`C.subs.paraCamaraViva`: una línea, blanca, sombra, al 72 %, quieta, Manrope Bold mientras el ensamblador no tenga
     Urbanist); si la cara baja hasta él, baja hasta 110 px (`cvvivo`). Lo escogido por la persona no se toca. `cvTituloEstilo` +
     `C.subs.estiloTitulo(id)`: títulos y láminas toman letra y colores de cualquier plantilla (leídos de ROLES/MARCA; una plantilla
     nueva sale sola), con la misma entrada y lugar. `limpiarGraficos` (orchestrate) ya deja pasar `estilo_titulos` y `acento_cv`.
   - **Línea de tiempo y corrección (30-oct):** todos los momentos van en la pista Gráficos (`cvvivo.enLinea`), SIN letras para que no parezcan subtítulos (`manual.cuerpoCV`): lámina = su imagen o un ícono, título = barra con T, tú hablando = línea tenue; el nombre sale al pasar el mouse. Al tocar uno,
     `manual.js › panelCV`: texto, palabra roja, cámara y quitar (la lámina vuelve a «tú hablando»), con Ctrl+Z. `editar_momento`
     guarda en `plan.momentos[i]` y deja `m.orig`: `planos` cuenta sus turnos con eso, para que editar uno no mueva los demás.
   - **Los 20 gráficos (30-oct, aprobados por Sergio):** `premium/src/cv/graficos.tsx` dice QUÉ se mueve; `tema.ts` pone colores, tarjeta y
     sombras. «Esos gráficos siempre van a ser los mismos, lo único que cambia es el estilo»: un estilo nuevo = otro tema, no otros gráficos.
     Se listan en la ficha (`lamina.objetos[grafico].graficos`, con `campos`, `req` y `ejemplo`); el director los lee de ahí, y uno al que le
     falte un dato `req` sale como tu clip: nunca se inventan cifras. `reloj()` aprieta la animación si la lámina es corta.
   - **Color de acento (30-oct):** `cvAcento` (`acento_cv` en el proyecto). Sin escoger: el de la plantilla de títulos, si no el de los
     subtítulos (`C.subs.acentoDe`), si no rubí. Pinta gráficos y palabras clave; sobre un fondo claro se oscurece lo justo para leerse.
   - **Lámina y lámina (30-oct):** referencia instagram.com/p/DZt2BtXPz8Q, seg. 2,50 (medida cuadro a cuadro). Dos láminas a menos de 0,6 s
     comparten fondo y la cámara viaja de una a la otra en 0,55 s (`camara-viva.js › piezas` → `m.paso`; `laminas.tsx › enPaso`), con texto y
     objeto juntos: hacia la derecha, y una de cada tres hacia abajo. Si las dos llevan tu video no se puede (es uno solo) y la segunda entra como siempre.
   - **Recortes (30-oct):** recortar una toma crea una base nueva (`subtitle_config.mano`) y Sergio perdía todo a la vista («desaparecieron»). Esa base hereda
     el plan más reciente del proyecto (`camara-viva.ts › heredarPlan`), alineando las palabras: lo editado y las imágenes siguen, sin volver a pagar al
     director. El momento que se queda sin palabras se va; las palabras nuevas quedan contigo hablando. Las caras se vuelven a buscar en la página.
   - **Qué lleva cada lámina (30-oct):** en el panel: Tú hablando / Lámina y Imagen / Tu clip / Gráfico, con sus datos (`objetoLimpio` en `camara-viva.ts`).
   Falta (entrega 4): el video final en el ensamblador (formas `encima` y `tarjeta`).
5. Las imágenes: pantalla «Las imágenes de tu video», subir y acomodar, crear con Nano Banana con créditos, biblioteca.
   ⭐ **El estilo de las imágenes se escoge en CADA video** (Sergio, 29-oct: nunca «una vez por marca»): viene marcado el último
   que usó; además «Igual a esta referencia» (1–3 imágenes como guía, solo para ese video) y «Sin imágenes» (gratis: su video en
   el recuadro). El Arcane no le gustó: quiere algo elegante como la referencia de kayn. Muestras (US$0,47): Editorial (foto de
   estudio en blanco y negro), Color suave, Yeso y 3D suave, en https://claude.ai/artifact/5NJb7qFu1FqQBZ9np97kNt; textos de
   cada estilo en `scratchpad/familias/estilos_muestras.py`, fotos en la lámina con `estilos_laminas.py`.
6. Revisión automática y prueba final con los clips del Cherry 9.
