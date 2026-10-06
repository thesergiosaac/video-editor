# El Inicio de Cherry (rediseño del 4-oct-2026)

## La estructura
- **Topbar** a todo el ancho, con el saludo («Hola, …») adentro. En el celular se esconden «Mis proyectos» y el plan.
- **Barra lateral** con todas las herramientas (`barraLateral()` en `js/components/inicio.js`). En pantallas de 1101 px
  o más va **siempre contraída** (68 px, solo íconos) y al pasar el ratón o llegar con el teclado se despliega a 240 px
  **encima** del contenido, sin quitarle ancho a las tarjetas. Nunca necesita scroll.
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

## Los niveles (la palabra «viral» no se usa)
**Aprendiz → Creador → Experto → Maestro → Leyenda**, con una cereza joya cada uno (`assets/marca/niveles/n1..n5.webp`).
Tocar una abre la ventana que explica el nivel.

La regla: de tus tres mejores videos se toma **el del medio**. `x = vistas ÷ máx(seguidores, 500)`. Hay que pasar las dos
escalas y manda la menor:
- relativa `[0,5 · 1 · 3 · 10 · 30]` veces tus seguidores;
- en crudo `[500 · 2.000 · 10.000 · 40.000 · 100.000]` vistas.

Los textos dicen solo lo que el nivel mide. Ningún texto afirma que «tus seguidores ven tus videos». En el nivel más bajo
se le dice claro a la persona que su alcance todavía es poco y qué porcentaje de sus seguidores alcanza.
