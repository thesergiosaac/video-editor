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

## Los niveles (la palabra «viral» no se usa)
**Aprendiz → Creador → Experto → Maestro → Leyenda**, con una cereza joya cada uno (`assets/marca/niveles/n1..n5.webp`).
Tocar una abre la ventana que explica el nivel.

La regla: de tus tres mejores videos se toma **el del medio**. `x = vistas ÷ máx(seguidores, 500)`. Hay que pasar las dos
escalas y manda la menor:
- relativa `[0,5 · 1 · 3 · 10 · 30]` veces tus seguidores;
- en crudo `[500 · 2.000 · 10.000 · 40.000 · 100.000]` vistas.

Los textos dicen solo lo que el nivel mide. Ningún texto afirma que «tus seguidores ven tus videos». En el nivel más bajo
se le dice claro a la persona que su alcance todavía es poco y qué porcentaje de sus seguidores alcanza.
