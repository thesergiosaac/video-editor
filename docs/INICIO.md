# El Inicio de Cherry (rediseño del 4-oct-2026)

## (15-oct-2026) Rebrand sobrio — el diseño que manda ahora
Sergio aprobó la propuesta «inicio-v2» del rebrand sobrio («aprobada, déjalas blancas») con su regla: «la pantalla de inicio
actual ya me gusta… sin cambiar el orden actual». Los MISMOS bloques en el MISMO sitio y todo lo que hacen; cambió solo el
estilo y uno que otro detalle. Todo el estilo nuevo está al final de `css/styles.css`, en el bloque «REBRAND SOBRIO DEL
INICIO», bajo `.ci` (no toca el editor ni las herramientas); las reglas viejas siguen arriba y el bloque las pisa.
- Fondo gris claro `#ECECE9` con grano; tarjetas BLANCAS de 26 px, planas. Solo el fucsia `#FF2D8A` y el amarillo `#FFC93C`.
  Letras de Cherry: Outfit (títulos y números), Space Grotesk (texto, botones, y ahora también el perfil de «Tu cuenta»,
  que antes iba con la letra del sistema), DM Mono (etiquetas). `app.html` carga Outfit 500–900; Big Shoulders se quitó
  (nadie la usaba).
- Barra de arriba blanca; el plan y los créditos en UNA pastilla («Gratis · ◆ 0 créditos»), pero cada uno sigue siendo su
  botón. La franja libre no se toca.
- Tu nivel: arriba «15 % hacia Creador»; la cereza dentro de un anillo por segmentos (amarillo → fucsia hasta tu avance).
- Editor Pro amarillo, sin la estrella que giraba, sin trama de puntos y sin la caja inclinada en «Pro»; la etiqueta va
  dentro del panel; botones píldora con su ícono en un círculo.
- Novedades negra (con su botón «Probarlo») y «Tu video» negra: las dos únicas tarjetas negras.
- Las 7 cartas de herramientas BLANCAS con sus mismos personajes; el «+» sale arriba en el centro.
- Tu cuenta: los destacados negros con el aro del nivel (fucsia bajo · amarillo normal · negro alto) y su leyenda debajo;
  pestañas en píldora; gráficas nuevas con los mismos datos: curva suave con globo (seguidores), barras con degradé y la
  raya de tu promedio (vistas, interacción, tiempo visto) y matriz de puntos (inicio).
- Tu video: etiqueta «{ Tu video · hace N días }» (el «hace N días» antes nunca salía: `CherryResumen.hace()` quiere la
  fecha sola), anillo por segmentos de los que pasaron el inicio, el **sweet** del video (`herramientas/lab-sweet.js`,
  cargado en `app.html`; la palabra se toca y explica qué es) y cada número con su pista y una rayita en lo normal.
- Abajo, «Así trabajan juntas» con cada nota en su cajita y «Seguir editando» con el estado en una pastilla.
- En portátil, tableta y celular todo se achica con container queries (cada tarjeta se mide sola); nada se sale.
- Las HISTORIAS de tus números y las ventanas de los niveles no cambiaron (no estaban en la propuesta).

## La estructura
- **Topbar** a todo el ancho, con el saludo («Hola, …») adentro. En el celular se esconden «Mis proyectos» y el plan.
- **Barra lateral** con todas las herramientas (`barraLateral()` en `js/components/inicio.js`). En pantallas de 1101 px
  o más va **siempre contraída** (68 px, solo íconos) y al pasar el ratón o llegar con el teclado se despliega a 240 px
  **encima** del contenido, sin quitarle ancho a las tarjetas. Nunca necesita scroll.
  (6-oct) Es UNA sola para todo Cherry: `js/lado.js` (CherryLado), que pintan el inicio y las 7 herramientas, en el
  mismo punto (ver `docs/CALENDARIO.md`).
- **Bento** de 12 columnas (opción **A**, escogida por Sergio el 5-oct y publicada el 6-oct), en este orden:
  1. `.ci-cobro` — franja roja SOLO si el plan está `en_gracia` o `en_mora` (falló el cobro del mes), con «Actualizar mi
     tarjeta» (`CherryPagos.abrirTarjeta()`, llega con los cobros de Dodo).
  2. `.ci-escenario` (columnas 1–8) — el Editor como escena: estrella, estatua y «Seguir editando · {proyecto}».
  3. `C.tarjetaNivel()` `.ci-nivelt` (9–12) — el nivel con sus cerezas joya.
  4. `.ci-cartas` — las herramientas como cartas de color (Guiones lila, Storyboard ámbar, Carruseles rosa, Calendario
     menta, Identidad tinta, Laboratorio crema, Respuestas fucsia). En tableta se desplazan de lado.
  5. `C.tarjetaCuenta()` `.tk-tarjeta` (1–8) — la gráfica con brillo y las luces en baldosas de color.
  6. `C.tarjetaVideo()` `.ci-videot` (9–12) — tu video con una tira de 6 miniaturas que rota cada 6 s.
  7. Debajo siguen «Así trabajan juntas» y «Seguir editando»: Sergio las quiere quitar o cambiar (propuesta:
     https://claude.ai/artifact/MzQEAYzhX3pNaa1MHj7gdG). **Pendiente de su decisión.**
  Entre 1101 y 1500 px se esconden los chips del escenario y el nombre del proyecto del botón, para que no se corte.

## En UNA pantalla (6-oct, Sergio: «que se vea así incluso en mi pantalla de portátil»)
En computador (≥1101 px de ancho y ≥600 px de alto) todo el inicio cabe sin scroll. Malla de 24 columnas:
- Arriba: **Aprendiz** (1–7) · **Editor Pro** COMPLETO (8–16, un poco más ancho; no se le quita nada: descripción, chips,
  los dos botones y la estatua se escalan con su panel, container queries `cqi`/`cqh`) · **promocionales** (17–24).
- Luego las cartas de herramientas, bajitas (62 px).
- Abajo: «Tu cuenta» (1–16) y «Tu video» (17–24), con el alto que quede de la pantalla.
- **«Tu video» SIEMPRE sale completo** (Sergio: «en todas las versiones»): miniatura, título, aro, las tres barras y la tira
  de los últimos videos. Si el alto no alcanza se achica (`@container (max-height:440px)` y `330px`), nunca se esconde.
- «Tu cuenta» sí se aprieta en pantallas bajitas: primero se esconde la fila de cifras (13 mil · 1 de 5 · 917), luego el
  título de la gráfica y los textos de las luces.
- **Promocionales** (`promo()` en `inicio.js`, lista `PROMOS`): por ahora rota anuncios de Carruseles, Storyboard y Guiones
  cada 6 s (se detiene con el ratón encima). Ahí van las imágenes o videos que escoja Sergio. Solo en pantalla ancha.
- Tableta y celular quedan como antes (una tarjeta debajo de otra, sin promocionales).

## Personajes y cartas con poder (6-oct, Sergio: «todo nuevo» y «las tres juntas»)
- **Arte nuevo** en `assets/inicio/v2/` (grande para el Editor Pro y la vitrina; `-chica` para las cartas): personas
  REALES a color con un objeto moderno de UN solo color (fucsia o ámbar); las estatuas, en mármol gris. Nada alrededor
  de la figura (ni ondas, ni íconos). Editor Pro = hombre con cabeza de tele; Guiones = astronauta con casco cerrado y
  laptop; Storyboard = mujer con cabeza de cámara; Carruseles = Mona Lisa con selfie; Calendario = Einstein con bombón;
  Identidad = Van Gogh con aerosol; Laboratorio = Tesla con lentes y granizado; Respuestas = Sócrates chateando.
  Originales (PNG con fondo transparente) en `Downloads\Cherry Taller\vitrina\set-color\`. Hechos con
  gpt_image_2_5 usando la pantalla de carga (`sonido_boca.webp`) como referencia de estilo.
- **Cada carta** (`carta()` en `inicio.js`): personaje; **dato vivo** debajo del nombre (`datosCartas()` →
  `C.api.datosInicio()` en `api.js`: los documentos de `herramientas_datos` de la marca activa en una llamada + las
  `ejecuciones_flujo` desde el lunes; `armarDatos()` los vuelve una línea, con punto verde si hay algo HOY); al pasar el
  ratón (solo donde hay ratón): ficha arriba con lo que hace, botón «+» que abre `herramientas/<x>.html?nuevo=1`
  (`herramientas/cherry.js` toca el botón de crear de esa herramienta y quita el parámetro), carta inclinada en 3D con
  luz y textura de papel, y la **vitrina pasa a esa herramienta** (`promoVer()`, se queda 8 s).
- En computador los nombres largos se acortan («Identidad», «Respuestas»); en tableta el personaje va arriba del nombre.
- «Así trabajan juntas» y «Seguir editando» siguen debajo (pendiente de la decisión de Sergio).

## La tarjeta «Tu cuenta» (`js/components/inicio-cuenta.js`)
- **Tamaño fijo**: solo cambia lo de adentro. El ancho angosto lo decide una container query (`@container (max-width:680px)`),
  no la pantalla. Las gráficas se dibujan en SVG al tamaño medido de su caja (ResizeObserver): nada se estira.
- **Solo datos de Instagram.** Nada escrito a mano. Sin cuenta conectada: «Conecta tu Instagram».
- Los datos de la cuenta vienen de `ig-metricas` modo `cuenta` (alcance, seguidores / no seguidores, interacciones,
  guardados, compartidos, visitas al perfil, clics al enlace, seguidores nuevos por día), comparando 28 días con los 28
  anteriores. Se guardan 6 horas en la tabla `ig_cuenta_resumen` (`servidor/sql/14-ig-cuenta.sql`); al desconectar o
  borrar la cuenta se borra también.
- Gráfica con botones (la pestaña elegida se recuerda en `localStorage` `cherry-cuenta-grafica`): Seguidores, Vistas,
  Interacción, Inicio, Tiempo visto, y «Qué te funciona» (ganchos, ideas, formatos y estructuras del Laboratorio).
- El recuadro del video **rota cada 6 s** (se detiene con el ratón encima): miniatura 9:16, sello, aro de cuántos pasaron
  el inicio, barras de este video contra lo normal.

## «Tu cuenta» como tu perfil de Instagram (6-oct)
Sergio: «una mini réplica de nuestro perfil de Instagram, que se sienta como si estuviéramos en Instagram». Propuestas:
perfil https://claude.ai/artifact/4eedNcA5zYUegNLTj3YPBL · tonos https://claude.ai/artifact/K43cPrWPB6suqEtPqGWtFX ·
niveles https://claude.ai/artifact/X2MoFGe3nhiyGcWsYYs1SD. Código: `pintaCuenta()` en `inicio-cuenta.js` (clase `.tk.ig`)
y el bloque «TU CUENTA COMO TU PERFIL DE INSTAGRAM» al final de `styles.css`.
⚠️ La clase de la tarjeta es `.tk-perfil`, NUNCA `.ig`: `.ig` ya es la vista «como se publica en Instagram» del editor
(lleva `pointer-events:none`) y el 6-oct la tarjeta salió publicada sin recibir ni un clic por eso.
- **Perfil:** foto con el aro de colores de Instagram (tocarla abre las historias), usuario, publicaciones / seguidores /
  seguidos con el número arriba (como en la app), nombre, biografía con sus emojis (letra `Noto Color Emoji` en
  `app.html`: sin ella Windows muestra «CO» en vez de la bandera) y el enlace si lo hay (la API no da el de Sergio).
  Botones grises: «Planear el próximo» y «Mis videos».
- **Destacados = los seis números.** Sobrios («no me gusta lo arcoíris»): grafito con luz suave arriba, número en plata.
  - **Por niveles** (Crecimiento, Vistas, Interacción): alto = lima `#C8F556`, medio = amarillo `#FFC93C`, bajo =
    fucsia `#FF2D8A`, en el aro, la luz, la etiqueta y el dibujo de la historia.
  - **Siempre grafito:** Alcance, Del perfil, Guardados.
- **El nivel es contra lo normal para una cuenta de TU TAMAÑO** (Sergio: «contra ti mismo no sirve; hay que decir la
  realidad, lo que deberíamos tener según nuestros seguidores»). `NORMAL` en `inicio-cuenta.js`, interpolado en escala
  logarítmica de seguidores. **Bajo** = menos del 70 % de lo normal · **alto** = más de 1,5 veces · medio = en el medio.
  Números APROBADOS por Sergio el 6-oct (si se cambian, los decide él):

  (⚠️ la columna «Vistas por reel» ya NO se usa: desde el 6-oct las vistas salen de `normalVis`, los números de Sergio;
  ver «Los niveles».)

  | Seguidores | Vistas por reel | Seguidores nuevos al mes | Interacción por reel |
  |---|---|---|---|
  | 1k–5k | 20 % | 2,7 % | 4 % |
  | 5k–10k | 10,2 % | 2,5 % | 3 % |
  | 10k–50k | 8 % | 2,5 % | 2 % |
  | 50k–100k | 5 % | 2,2 % | 1,5 % |
  | 100k–1M | 4 % | 2 % | 1,2 % |
  | 1M+ | 3 % | 1,5 % | 1 % |

  Fuentes: Socialinsider, Instagram Benchmarks 2025 (vistas por reel ÷ seguidores y crecimiento anual, pasado a mes;
  cuentas de marca). La fila de 1M+ y la columna de interacción son propias (las fuentes van de 0,5 % en marcas a
  2,5–3,5 % en creadores). Vistas e interacción = promedio de los últimos 10 reels ÷ seguidores; crecimiento = seguidores
  nuevos de los últimos días ÷ seguidores, llevado a 30 días.
- **Historias** (`abrirHistoria()`): pasan solas cada 6 s; derecha = siguiente, izquierda = anterior, Esc / × cierran.
  Cada una: el número grande, qué es, **el mismo dibujo de antes** (curva de seguidores, dona de «no te seguían», cien
  puntos, barras de alcance, embudo del perfil, guardados/compartidos) y, en las de nivel, una línea «Tú: X % · lo normal
  para tu tamaño: Y %» + «Alto desde… · bajo por debajo de…». ⚠️ Sergio: al cambiar cómo se mide algo, el diseño NO se
  toca.
- **«Qué te funciona» lee DOS fuentes** (6-oct; antes salía vacío): los reels que Cherry desmontó de tu historial
  (`historial › lista`, 112 de sergiosaac.co; las ideas van por TEMA porque cada ángulo casi nunca se repite) y lo
  desmontado a mano en el Laboratorio (un reel que esté en los dos cuenta una vez). Si hay al menos dos piezas con 2+
  videos, solo se muestran esas (eso queda para la línea del patrón). Las estructuras se leen cortas («Conector → Cuerpo ×3 → CTA»).
- **«Qué te funciona» muestra TUS VIDEOS, no categorías** (Sergio: «títulos genéricos: no sé el gancho de qué video o la
  idea de qué video me funcionó»). `mejoresVideos()` + `listaVideos()`: miniatura, la frase exacta del gancho
  (`gancho_frase`) / la idea / el formato / la estructura, tipo y fecha, y su número; tocar abre el reel en Instagram.
  Ganchos por cuántos de 100 pasan el inicio; ideas por vistas; formatos y estructuras por % visto (solo videos de 10 s o
  más). Arriba, una línea con el patrón (`resumenDe()`). Toda la historia (desde jul-2024); las filas que no caben
  enteras se quitan.
- **Pestañas de Instagram:** Números (las cinco gráficas), Qué te funciona (Laboratorio) y Reels (los últimos reels con
  sus vistas; tocar uno abre Instagram). La pestaña se recuerda en `localStorage` `cherry-cuenta-pest`.
- En el portátil todo se achica (container queries); en tableta el perfil va arriba de las pestañas; en celular, como
  la app: los destacados se corren de lado y las pestañas son solo íconos.
- **La foto de perfil vence** (la dirección que da Instagram dura unos días). `cuenta.js › refrescarPerfil()` pide el
  perfil (`ig-metricas` modo `perfil`) una vez al día si `perfil_visto` tiene más de 20 h, y también si la foto no carga.
- **Los reels nuevos entran al abrir Cherry (27-oct).** Sergio: *«¿por qué Cherry no muestra el último reel que subí?»*.
  La lista de las pantallas (`ig-metricas` modo `traer` → `mis_publicaciones`) solo se pedía a Instagram si la cuenta
  llevaba 20 h sin medirse: la de Cherry se midió a las 10:01 a. m., el reel salió a la 1:11 p. m. y no entró hasta las
  11:10 a. m. del día siguiente. Ahora `cuenta.js` llama a `traer` al abrir Cherry (máximo cada 10 min por navegador,
  `localStorage` `cherry-ig-nuevos`) y vuelve a pedir `videos` solo si entró algo. En el servidor, con la cuenta al
  día (sus reels de más de 48 h medidos hace < 20 h), se piden solo las 5 últimas publicaciones y se miden las que
  faltan y las de < 48 h que no se miden hace 1 h. La vuelta entera de los 30 sigue una vez al día. «Al día» no cuenta
  el reel nuevo: si lo contara, publicar a diario aplazaría la vuelta entera para siempre.
- **El inicio en el celular (22-oct).** Sergio: *«los avisos, los toast, salen como una bola gigante, y quiero que la
  página sea fija, que no se pueda hacer zoom»*. Los avisos (`.ci-aviso` del inicio y `.ch-tira` de `cuenta.js`) iban
  centrados con `left:50%` y sin ancho: en el celular solo tenían media pantalla y el texto se partía en muchas líneas con
  las puntas redondas. Ahora miden su texto hasta el ancho de la pantalla menos 32 px y en el celular son un rectángulo
  redondeado. `.ci-aviso` va colgado del `body` (`inicio.js › aviso`), con sus colores propios y `z-index:140`: dentro de
  `.ci` quedaba debajo de la tarjeta «Tu nivel». `app.html`: sin zoom (`maximum-scale=1, user-scalable=no`, y en el
  iPhone se frena el pellizco con `gesturestart`), `touch-action: pan-x pan-y` y, en el celular, sin moverse de lado.
- **El Editor Pro y las novedades en el celular (22-oct).** Sergio: *«este hombre con cabeza de televisor se ve excelente
  en el computador, pero en ese lugar se ve cortado»* y *«este banner de avisos ni siquiera se ve en el celular»*. Hasta
  760 px la estatua del Editor Pro iba arriba a la derecha con el torso cortado en seco a mitad de la tarjeta (en el
  computador ese corte lo tapa el borde de abajo): ahora es más grande, con la cabeza por encima de la tarjeta, y el
  torso se funde en el amarillo (`mask-image`). La tarjeta de novedades (`.ci-promo`) solo salía en la pantalla grande:
  hasta 1100 px va debajo del Editor Pro, a lo ancho (210–220 px de alto).
- **La foto, siempre (22-oct).** Sergio: *«a veces en el desplegable y la foto de perfil no se ven… siempre se debe ver»*.
  Con la sesión de Instagram cerrada (`estado = 'vencida'`) la marca salía con su inicial aunque Cherry tuviera la foto, y
  esa dirección vencía sin que nadie la renovara. Ahora:
  - `fotoPropia()` (en `ig-conectar` y en `ig-metricas` modo `perfil`; copiada en los dos) **copia la foto a nuestro
    almacén**, cubo público `assets`, `perfiles/<ig_user_id>.jpg`, y esa dirección (con `?v=`) es la que queda en
    `cuentas_instagram.foto`: no vence. Si algo falla, queda la de Instagram. Las 4 de Sergio se copiaron a mano el 22-oct.
  - En `perfil`, una cuenta que falla ya no tumba a las demás.
  - `cuenta.js › conInstagram()`: sin sesión activa usa la foto de la cuenta «vencida» o la última guardada en el
    navegador (`localStorage` `cherry-foto-<usuario>-<marca>`), así el avatar sale al instante. Una marca sin Instagram
    la olvida.
  - Si una imagen no carga, sale la inicial (avatar, cabecera del menú y lista de marcas), nunca una imagen rota.

## Los niveles (la palabra «viral» no se usa)
**Aprendiz → Creador → Experto → Maestro → Leyenda**, con una cereza joya cada uno (`assets/marca/niveles/n1..n5.webp`).
Tocar una abre la ventana que explica el nivel.

**El panel «Tu nivel» (6-oct, «casi no se ve la cereza»):** la tarjeta se queda CLARA (la oscura NO le gustó a Sergio).
Opción D de https://claude.ai/artifact/Fb4Kg1S27xRW6bJXZ9NKkW: sin plato blanco, la cereza grande (108 px; 70 en
portátil) con una luz suave del color de su nivel detrás y el aro de avance en ese color — vidrio = azul de hielo,
cerámica = rosa, oro = dorado, rubí = rojo, rubí con corona = naranja con aro dorado (`data-joya` 0–4 que pone
`pintaNivel()`; bloque «TU NIVEL: HALO DE COLOR» en `styles.css`). Las cinco cerezas se rehicieron el 6-oct con
gpt_image_2_5 (fondo transparente, sin la sombra de piso color crema que traían); originales en
`Downloads\Cherry Taller\vitrina\niveles-v2\`. En la ventana de cada nivel la cereza sale SIEMPRE a color y con su luz,
también las que faltan, y la siguiente dice «tu próxima meta» (Sergio: «para que sepa hacia qué rango va y se emocione»).

La regla (6-oct, Sergio: «hay que cambiar el cálculo»; la de antes era vistas ÷ seguidores y con 50 mil seguidores casi
nadie salía de Aprendiz): se toma **tu reel típico** (la mediana de tus últimos 10 reels; Sergio aceptó esa recomendación:
el promedio de todos lo inflaban dos virales de 2024 y la suma depende de cuánto publicas) y se compara con **lo normal
para una cuenta de tu tamaño** (`normalVis`, los números de Sergio, abajo). Veces lo normal: Aprendiz menos de 1 ·
Creador 1 a 2 · Experto 2 a 5 · Maestro 5 a 15 · Leyenda 15 o más; y por lo menos 500 · 2.000 · 10.000 · 50.000 vistas
(`VECES` y `PISO` en `inicio-cuenta.js`). La tarjeta dice «tus mejores videos tienen X vistas; lo normal para tu tamaño
es Y» y cuántas vistas pide el siguiente nivel (redondas). Calculadora que se le mostró:
https://claude.ai/artifact/JPji9d3L4REuzyqtKxHq93

**Publicado 6-oct (Sergio: «si hace meses no sube, no hay con qué contabilizar: que diga que la cuenta está en
peligro»):** cuenta cualquier publicación. A los **21 días** la frase de la tarjeta cambia a un aviso en dorado («Hace X días
no publicas. Sube un reel para que tu cuenta no se enfríe.»); a los **60 días** no se cuenta el nivel: dice «Cuenta en
peligro» en rojo, la cereza en gris con luz roja y ninguna joya marcada («Hace X días no subes contenido. Sube un reel y tu
nivel vuelve a aparecer.»). `AVISO_DIAS` / `PELIGRO_DIAS` / `diasSinPublicar()` en `inicio-cuenta.js`; `data-estado` en la
tarjeta. Los destacados «Vistas» e «Interacción» también usan el reel típico (mediana), no el promedio.

**Lo normal en vistas (Sergio, 6-oct, por su experiencia con creadores):** 5.000 seguidores ≈ 3.000 vistas por reel ·
50.000 ≈ 10.000 · 500.000 ≈ 200.000 (60 % · 20 % · 40 % de los seguidores; entre esos puntos se interpola en escala
logarítmica, fuera de ellos se queda el del extremo). La tabla de Socialinsider (cuentas de MARCAS) daba muy poco: para
5.000 seguidores decía 657 vistas y una cuenta normal salía Experto. La misma `normalVis` decide el color del destacado
«Vistas».

**La parte de abajo de la ventana del nivel (22-oct, Sergio: «la parte de arriba está excelente pero la parte de abajo
donde hay puras letras… se ve muy plano»; escogió la opción A de https://claude.ai/artifact/YHwsQUVWvZnPhaoZPWtzTi):**
arriba no cambió nada (cereza, título, frase). Abajo: una franja «X es · veces lo normal · vistas» (`REGLA`), y luego los
DOS requisitos del nivel, cada uno en su fila (`requisitosNivel()`): «Veces lo normal» y «Vistas de tu reel típico», con
tu número grande, lo que pide el nivel, una barra, y un sello ✓ fucsia si ya lo cumples o ! amarillo si te falta; arriba
«1 de 2 listo». Debajo, la meta junta con la cereza del nivel: «Te faltan N vistas en tu reel típico para ser X»
(`metaNivel()`, la meta es lo más alto de los dos requisitos). Pie: qué es el reel típico y lo normal para tu tamaño.
En tu nivel muestra «Para subir a {siguiente}»; en uno de arriba, «Para llegar a X»; en uno que ya pasaste, «Ya pasaste
por aquí»; en Leyenda, «Estás en lo más alto». Se hizo porque a él le pasaba: 20,5 veces lo normal (Experto pide 2) pero
1.793 vistas de 2.000, y no se entendía por qué seguía en Creador. `abajoNivel()` en `inicio-cuenta.js`, clases `.tk-r-*`.

Los textos dicen solo lo que el nivel mide. Ningún texto afirma que «tus seguidores ven tus videos». En el nivel más bajo
se le dice claro a la persona que su alcance todavía es poco y qué porcentaje de sus seguidores alcanza.

## «Tus proyectos» (6-oct, Sergio: «todo está en blanco y negro… y una opción para cambiar el nombre y borrar»)
- **A color siempre:** `.ci-foto` ya no lleva el filtro gris.
- **Al pasar el ratón:** el `<video>` de la tarjeta (la portada en `#t=1.2`) se reproduce sin sonido, la foto se acerca, la
  tarjeta se levanta con brillo rosado y aparece «Abrir ›». Al salir vuelve a 1,2 s. Con `prefers-reduced-motion` no se mueve.
- **Botón «⋯»** arriba a la izquierda (arriba a la derecha sigue «Otra marca»): «Cambiar nombre» y «Borrar proyecto». Las
  ventanas son de Cherry (`ventana()` en `inicio.js`, sobre `.tk-velo`/`.tk-modal`), nunca diálogos del navegador.
- **Cambiar nombre:** `C.api.renombrarProyecto` (PATCH `projects.title`, máximo 60 letras).
- **Borrar (Sergio escogió la recomendada):** `C.api.borrarProyecto` pone `projects.borrado_en = ahora` y el proyecto
  desaparece al instante; **toda** lista de proyectos pide `borrado_en=is.null` (`js/api.js`, `herramientas/cherry.js`,
  `herramientas/carruseles/app.js`). Si era el proyecto abierto, se abre otro o uno nuevo. A los **7 días** el reloj diario
  `cuentas-borrar` (9:00 UTC) llama a `servidor/borrar-cuenta.ts` (`purgar`), que borra sus archivos —carpetas
  `uploads/<proyecto>/` y `renders/<render>/`, las direcciones exactas de sus clips y pantallas, sus miniaturas del
  almacén— y luego la fila (clips, renders, guiones, ediciones… caen en cascada). La voz de estudio NO se borra: se guarda
  por la huella del audio y otro proyecto la puede usar. **En esa semana soporte lo recupera** poniendo `borrado_en` en null.
  Columna: `servidor/sql/16-proyecto-borrado.sql`. Ensayo sin borrar nada: acción `ensayo_proyecto` (llave del servidor o
  del reloj) devuelve qué carpetas y archivos tocaría; con el Proyecto 25 dio 20 carpetas y 76 archivos, todos suyos.
  ⚠️ El reloj solo llama a la función si hay algo vencido: su condición incluye
  `or exists (select 1 from public.projects where borrado_en <= now() - interval '7 days')`.

## La franja libre de la barra de arriba (9-oct-2026): RESERVADA

Sergio: «este espacio libre en el top bar siempre debe estar libre porque más adelante lo aprovecharemos para hacer
promociones: si hay un descuento, o si una persona tiene el plan gratis, ahí le diremos "Te estás perdiendo muchas cosas,
toca aquí para comprar el plan…", y así cada anuncio o algo que necesitemos lo vamos a colocar ahí».

- **No se pone nada** en el hueco entre el logo y lo de la derecha (saludo, «Mis proyectos», buscar, plan, créditos,
  avatar): ni botones, ni migas, ni el nombre de la página. Vale para la barra del inicio (`ci-barra`) y para la de cada
  herramienta.
- **Cuando se haga:** un solo mensaje a la vez, que se toca y lleva a lo que anuncia (`CherryPagos.abrir()` para subir
  de plan); según la persona: con el plan gratis, lo que se está perdiendo; si hay descuento, el descuento; y avisos de
  Cherry.

## Funciones, no herramientas (19/20-oct-2026)

Sergio: «me encanta el diseño que tenemos del inicio, no debe cambiar nada»; solo la fila de 7 cartas: ya no repite las
herramientas de la barra de la izquierda, son FUNCIONES (`CARTAS` en `js/components/inicio.js`, cada una con `q` = su
dirección exacta y `img` = su personaje): **Mi proceso** y **Estrategias de contenido** de primeras («son las más
importantes»), Desmontar un reel (`?ir=v3`), ¿Va a funcionar? (`?ir=v6`), Qué grabar después (`?ir=v1`), Guion con IA y
Contestar comentarios. El banner (`PROMOS`) suma al principio las de esas funciones, sin quitar las que había; `clave` =
la carta que lo pide al pasar el ratón. Las dos herramientas nuevas: `docs/MI-PROCESO-Y-ESTRATEGIAS.md`.

## (26-oct) Sin la fila de cartas
Sergio: «quitar todos esos bloques de herramientas del medio, haciendo que la parte de abajo pueda subir un poco más y
quedando menos saturado». Se quitó la fila «Lo que puedes hacer» (las 7 cartas: Mi proceso, Estrategias, Desmontar,
¿Funcionará?, Qué grabar, Guion con IA, Responder) con todo lo suyo: `CARTAS`, `carta()`, el dato vivo (`datosCartas`,
`armarDatos`, `pintarDato`), el personaje animado y `promoVer` en `inicio.js`, y todas las reglas `.ci-carta*` /
`.ci-cartas*` y `--cartas` de `css/styles.css`. En computador «Tu cuenta» y «Tu video» ahora miden
`100vh − barra − var(--arriba) − 12px` (un solo espacio entre filas). Todo eso sigue en la barra de la izquierda y en la
vitrina de arriba a la derecha. `C.api.datosInicio` (js/api.js) ya no lo llama nadie. Lo de arriba sobre las cartas queda
como historia.

## (26-oct) Las redes sin conectar, Facebook y el interruptor con logos
Sergio: «mejorar la pantalla cuando TikTok y YouTube no están conectados; agrega una para Facebook porque la vamos a meter
próximamente» y «en lugar de decir la palabra Facebook, Instagram, TikTok, mejor que estén sus logos».
- **El interruptor** (`interruptorRed` en `js/cuenta.js`, el mismo del inicio y de «Mis videos» del Laboratorio): cuatro
  botones con el logo de cada red (Instagram · TikTok · YouTube · Facebook); el nombre va en `aria-label` y `title`.
- **Facebook** (`red = 'fb'`): todavía sin datos (`perfilDeRed` → null, `videosDeRed` → []); cada pantalla dice que llega
  pronto. El Laboratorio lo trata como TikTok y YouTube (sin el historial de Instagram).
- **«Tu cuenta» sin la red conectada** (`REDES_V` en `inicio-cuenta.js`): el logo en un círculo negro, «Conecta tu TikTok»,
  una frase y UN botón que conecta ahí mismo (`CherryCuenta.conectarRed('tt' | 'yt')` → `tt-conectar` / `yt-conectar`
  `accion:'enlace'` con `volver` = la página donde se está; al volver, cuenta.js dice cómo salió). Instagram usa el
  `conectar()` de siempre. Facebook: «Facebook, muy pronto» y una pastilla «Próximamente». Se fueron la cereza y el
  párrafo que mandaba al Calendario.
- **«Tu nivel» y «Tu video»** dicen la red escogida («Cuando conectes tu TikTok…», «Cuando llegue Facebook…»); «Tu video»
  pone su aviso en el centro de la tarjeta negra, con un ícono.
- Para mirarlo sin cuenta: `_demo-inicio-redes.html` (usa el `js/cuenta.js` de verdad con un servidor de mentira).

### (26-oct) «Tu cuenta» con TikTok y YouTube conectados
Sergio: «en Instagram todas las pestañas funcionan excelente, pero en TikTok o YouTube las estadísticas se ven raras». Esas
redes no dan los números de la cuenta (alcance, visitas al perfil, guardados) ni cuántos pasaron el inicio o el tiempo visto.
- **Destacados** (`metricasRed`): salen de los videos y del perfil, solo los que tienen dato (Crecimiento si YouTube da los
  suscriptores por día, Vistas del video típico, Interacción, Me gusta de TikTok, Vistas totales de YouTube). Sin nivel
  contra «lo normal para tu tamaño» (esa vara es de Instagram): van en grafito y la clave de colores se esconde. Antes eran
  seis círculos con «…». La historia dice «tus últimos videos» en vez de «últimos 28 días».
- **Interacción** (`interDe`): sin alcance, me gusta + comentarios + compartidos de cada 100 vistas.
- **Gráficas de «Números»** (`hayDato`): en TikTok y YouTube solo las que tienen con qué dibujarse; si la escogida no está,
  la primera que sí (sin guardarla). En YouTube dice «suscriptores» y «videos».
- **Reels**: con pocos videos cada uno queda casi 9:16 a la izquierda (`max-width`), no uno solo estirado a lo ancho.
- Instagram queda igual. Demo: `_demo-inicio-redes.html?con=1` (TikTok y YouTube con datos de mentira).
- **«Tu video»** (26-oct, «esa tarjeta también debe verse igual en las otras redes; se ve como vacía»): en TikTok y YouTube
  el anillo dice cuántos de cada 100 **interactuaron** (y cuánto sueles) y las barras son Vistas, Me gusta y Compartidos
  (YouTube no da compartidos: Comentarios), cada una contra lo normal tuyo (`barrasRed`). Instagram queda igual
  (Pasaron el inicio · Vistas · Tiempo visto · Interacción).

### (26-oct) El nivel vive en `js/resumen-cuenta.js`
`CherryResumen.nivel(seguidores, videos)` (con `normalVis`, `VECES`, `PISO`, `NIVELES`) y `CherryResumen.corte(videos)`:
el inicio (`inicio-cuenta.js › nivelDe`) y Mi proceso usan la misma cuenta. Los números siguen siendo los de Sergio.

## «Rompiste tu patrón» (27-oct-2026) — `js/patron.js`
Sergio: «cada vez que entremos a Cherry y haya un video que haya roto el patrón (si siempre tengo 1.000 vistas y uno llegó a
8.000), que aparezca un modal de felicitación e información: por qué funcionó —el gancho, la idea, el formato, la estructura,
la duración— y que le recomendemos usar eso en sus próximos videos». Diseño aprobado (la A, modesta, cada razón en su
renglón): https://claude.ai/artifact/TVHVSD8jz3aMkWDUkaiRPi. Umbral: **3 veces** sus vistas normales.
- Solo en el inicio (app.html sin `?ir=`). Lee historial › lista (sin IA). Un reel entra si es de la marca activa, salió en
  los últimos 14 días, ya tiene sus piezas (desmontaje) y llegó a 3× la mediana de sus 20 reels anteriores (mínimo 5). El de
  más veces. Una vez por reel (localStorage › cherry-patron-visto). Si hay otra ventana abierta, espera a la próxima entrada.
- El porqué (`analizar`): cada pieza contra los otros reels de la cuenta. ✓ si la comparte con su mejor video («de tu segundo
  mejor video»), con otro de los buenos (≥ 1,5× lo normal) o si es la primera vez que la usa («fue lo distinto»). Si ya la
  usaba sin éxito, va a la línea gris «No fue…». La duración: dentro de ±25 % de la de siempre, «no fue»; si no, razón. La
  estructura con palabras de todos los días (`estructuraEnPalabras`) y «misma estructura» = una es la otra con pasos de más.
- «Hacer otro así»: sessionStorage › cherry-otro-asi + `herramientas/laboratorio.html?modo=guiones&nuevo=1` → lab-guiones
  `tomarOtroAsi` → LabAPI.otroAsi: un guion nuevo «Por grabar» con esas piezas (las del baúl o nuevas) y el guion armado con su
  estructura. No escribe ni cobra: queda listo para «Que Cherry lo escriba».
- De paso (27-oct): `?nuevo=1` no lo leía nadie (la receta de «Tu próximo video» esperaba a que tocaras «Nuevo guion»):
  ahora LabGuiones.alCargar abre el asistente una vez.
- Prueba local: `_demo-patron.html` con `_patron-datos.js` (los reels reales de @cherrystudio.app; nunca se publican).
- Ventana de detalles (`pedirDetalles`, laboratorio.html), 27-oct: Sergio, «mucho texto plano que cansa la vista». Con
  `f.otroAsi` la receta sale en etiquetas con ✓ (gancho, formato, estructura; la idea no, porque ya tiene su caja debajo) y
  «solo falta lo que vas a contar» a mano. La marca es un renglón corto («MARCA · nombre») y cada opción y cada aviso, media
  línea. No volver a poner párrafos explicativos en esa ventana.

## «Tu semana | Tu fórmula» (28-oct-2026) — `js/components/inicio-accion.js` + `css/inicio-accion.css`
Sergio, sobre «Así trabajan juntas» y «Seguir editando»: «esta parte es inútil… algo que motive a la persona a tomar acción en
algo específico». Le gustaron las dos ideas y escogió el diseño B (una franja oscura partida en dos):
https://claude.ai/artifact/LTKJwGQsaP8ho6nGNL2Uc7. Se quitaron las dos tarjetas viejas de inicio.js (`mapa` y `seguir`).
- TU SEMANA: los reels de lunes a domingo contra la meta de la estrategia (`estrategias@marca` › semana.reels): publicados
  (CherryCuenta.instagram, con portada y ✓), programados (`calendario@marca`, tipo video y estado programado, con día y hora) y
  los que faltan punteados. Racha = semanas seguidas (antes de esta, y esta si ya cumplió con lo publicado) con reels ≥ meta;
  las barritas son las últimas 4. Mejor hora: ⚠️ copia de calendario.html › mejorHoraReal (con el alcance de los videos).
  Sin estrategia: «Armar mi estrategia».
- TU FÓRMULA: la mejor pieza de cada tipo con la regla de Mi proceso (CherryInforme.grupos, de herramientas/informe-mes.js, que
  ahora carga app.html): magnética si la hay; si no, la temporal a la que menos le falta. Lo que falta = aciertos seguidos para
  cumplir a+k ≥ 2 y 3(a+k) ≥ 2(n+k). El «foco» es la que menos le falta; la frase dice cuál repetir. La estructura se muestra
  con palabras (CherryInforme.nom ← patron.js › estructuraEnPalabras). Las de menos de 3 pasos no cuentan («Gancho» solo es un
  desmontaje a medias; igual en proceso.html e informe-mes.js).
- Botones → sessionStorage › cherry-otro-asi + Guiones (como «Rompiste tu patrón»). Línea al informe del mes (Estadísticas
  `?ver=informes`). El historial se pide una vez: `C.historialReels()` (inicio-cuenta.js) lo comparten las dos.
- Sin Instagram conectado (o en otra red) la franja no se muestra: «Tu cuenta» ya pide conectar.
- Prueba local: `_demo-inicio-accion.html` (reels reales de @sergiosaac.co en `_informe-datos.js`; NUNCA se publica).
- (28-oct, después de publicarla) Sergio: «se ve horrible, se ve muy diferente a lo que me propusiste». Con datos reales los
  nombres largos partían la fórmula, sin estrategia la mitad izquierda quedaba vacía («11 reels» sin mostrarlos: eran 2
  publicados + 9 programados) y las mitades no terminaban parejas. Arreglo: la tira de portadas SIEMPRE (si son más de 7: 6 y
  «+N»); sin estrategia dice «videos esta semana» (cuenta lo programado para otras redes); la fórmula en 4 columnas iguales con
  el «+» entre ellas y nombres de máximo 2 renglones; «Por descubrir» en vez de «?»; las dos mitades en columna con el pie
  abajo. Prueba: `_demo-inicio-accion.html?sin=1` (Cobra sin estrategia) y `?largo=1` (nombres largos).

## Nada se selecciona, salvo lo que se copia (28-oct-2026) — `js/lado.js`
Sergio: «que no se puedan seleccionar las cosas: el título, el texto de pestañas… solo lo que realmente se deba seleccionar,
como un guion o texto de datos importantes». La regla la mete `js/lado.js` (la cargan el inicio y todas las herramientas; no
las páginas públicas): `html { user-select: none }`; SÍ se seleccionan (con `!important`, porque alguna hoja les pone
`unset`): campos, cajas de texto, lo editable, `pre`, `code`, la clase `copiable` / `data-copiable`, la propuesta de Cherry en
Guiones (`.lg2-prop-dice`) y lo que dice cada escena del desmontaje (`.ec-q`). Para que algo nuevo se pueda copiar: ponerle
`class="copiable"`. ⚠️ En el iPhone, sin el `user-select: text` explícito los campos no dejan escribir.

## El menú de la foto es UNO para todo Cherry, también en el editor (29-oct)

Sergio: «el dropdown es otro diferente al del resto de la página y no muestra la foto y las marcas». El editor tenía su
propio menú (`data.js › userMenu` + `topbar.js`, con «Mi cuenta» y «Ayuda» que no hacían nada). Ahora la foto del editor
lleva `data-avatar` y abre el de `js/cuenta.js` (foto y marcas, perfil, Reportar o sugerir…). Lo que app.html le suma
(Mis créditos, Mi plan, Mis proyectos, Cerrar sesión) vive en UNA función, `inicio.js › C.menuDeLaFoto()`, que llaman el
inicio y la barra del editor; «Mis proyectos» desde el editor vuelve al inicio en esa sección. Cualquier foto nueva con
`data-avatar` abre este mismo menú: no se hace otro.
