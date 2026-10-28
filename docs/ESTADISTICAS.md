# Estadísticas — `herramientas/estadisticas.html` (26-oct-2026)

Sergio: «una pantalla nueva que solamente muestre estadísticas de cada una de nuestras redes sociales. El inicio es un
acercamiento; esta es para analizar. Que la comunicación sea muy clara para cualquier persona, no solo para profesionales de
marketing». Él dice después qué se queda y qué se va (esta es la primera versión, con lo que escogí yo).

Va en la barra de la izquierda debajo de «Mi proceso» (`estadisticas` en `js/lado.js`). Solo LEE: nada de IA, nada se guarda.
Estilo del Calendario en papel (tarjetas `.vol`, fichas blancas), como pidió Sergio para todas las pantallas.

## Lo que muestra (de arriba abajo)
1. **Cabecera**: «Cómo va tu cuenta», la cuenta (@usuario) y el interruptor de red con logos (`CherryCuenta.interruptorRed`).
2. **La frase** (`veredicto`): cómo va, en palabras de todos los días, con su luz (Va creciendo · Va estable · Va bajando ·
   Quieta). Instagram: contra el alcance de los 28 días anteriores; TikTok/YouTube: las vistas de los videos subidos en 28
   días contra los 28 de antes. Y el video que más gente vio.
3. **Cuatro números** con lo que quiere decir cada uno y su comparación («↑ 2,4 veces más que el mes pasado»; con números
   menores de 10 no se compara). Instagram: seguidores nuevos, personas que te vieron, interactuaron, visitas al perfil.
   TikTok: seguidores, vistas, me gusta, compartidos. YouTube: suscriptores nuevos, vistas, me gusta, comentarios.
4. **Día a día / Video a video**: seguidores (o suscriptores) nuevos cada día, vistas cada día (YouTube) o las vistas de
   cada video (todas). Barras en HTML; la más alta o la de hoy en rosado.
5. **A quién le llegas** (Instagram): cuántos de cada 10 no te seguían, con una frase de qué significa.
6. **Qué hace la gente**: Instagram (guardaron, compartieron, tocaron tu enlace, contra el mes pasado); TikTok y YouTube
   (me gusta, comentarios y compartidos de cada 100 vistas).
7. **Cómo le fue a cada video**: los últimos 8, cada uno contra «lo normal» (la mediana de tus últimos 20): más que lo
   normal (≥ 1,2×) · lo normal · menos (≤ 0,8×); la estrella es el que más gente vio. En Instagram, cuántos pasaron el inicio.
8. **Cuánto publicas**: videos por semana en las últimas 4 y lo que dice la estrategia (`estrategias.semana.reels`).
- Sin la red conectada: logo + «Conecta tu …» + botón (`conectarRed`). Facebook: «muy pronto».

## De dónde sale
Instagram: `CherryCuenta.instagram()` (perfil y reels) + `ig-metricas` › `cuenta` (`actual`/`anterior` de 28 días y
`seguidoresDia`). YouTube: perfil y videos + `yt-conectar` › `cuenta` (`seguidoresDia` neto y `vistasDia`; ~2 días
atrasado). TikTok: perfil (seguidores, me gusta) y videos; no da nada por día.
Los reels nuevos de Instagram entran al abrir Cherry (27-oct): ver `docs/INICIO.md` › «Los reels nuevos entran al abrir
Cherry».

Demo sin cuenta: `herramientas/_demo-estadisticas.html` con `_stub-estadisticas.js` (el `cuenta.js` de verdad con un
servidor de mentira; nunca se publica).

## Informes del mes (28-oct-2026) — `herramientas/informe-mes.js` + `informe-mes.css`
Sergio, después de estudiar a Metricool (simulación: https://claude.ai/artifact/DgGnzSyfhn9gzcWNvb8CCd): «copiemos todo lo que
vale la pena, con nuestro estilo» y «parecemos cualquier informe… debemos construir una parte que diga informes al estilo Cherry:
validaste tantas ideas, solo funcionaron tantas, ya son magnéticas… para tomar acción inmediata». Diseño aprobado:
https://claude.ai/artifact/Ufnr4uP2NPfNcVhKjQ4WnE (pestaña «Informes del mes»).
- Arriba de Estadísticas, «Tu cuenta | ✦ Informes del mes» (`VISTA`; `?ver=informes` la abre de una). Solo Instagram por ahora.
- El informe sale del historial de reels (historial › lista: vistas, retención, portada de CloudFront y las piezas de cada reel), de
  los videos de Instagram (los carruseles), de la estrategia y del Laboratorio (piezas del baúl nunca usadas → «Para probar»). No
  guarda ni gasta IA. Meses: el de hoy y los últimos con reels (hasta 6); a los de otro año se les pone el año.
- Orden: portada (el mes, su etiqueta, la frase y 4 números contra el mes anterior: vistas, interacciones, reels, retención) →
  **Lo que validaste** (lo que nos hace distintos) → datos rápidos → el mes reel a reel (con portadas) y mes contra mes (vistas de
  6 meses) → lo que funcionó y lo que no (con «Hacer otro así») → lo que haría el próximo mes (3 consejos con su botón).
- ⚠️ «Lo que validaste» usa la regla de Mi proceso (proceso.html › etapas, paso 4): acierta si la retención pasa
  CherryResumen.corte; magnética = 2+ aciertos y 2 de cada 3; temporal = acertó alguna vez; inerte = nunca; estructuras con pasos
  de más al final cuentan juntas. El estado es el del CIERRE del mes (todos los reels hasta ese día). Si cambia allá, aquí también.
- «Usar / Repetir / Hacer otro así / Hacer un video con esta receta» → sessionStorage › cherry-otro-asi +
  laboratorio.html?modo=guiones&nuevo=1 (lo mismo de «Rompiste tu patrón»).
- Descargar PDF: html-to-image + jsPDF (se cargan al tocar). ⚠️ html2canvas NO sirve (no entiende color-mix: «unsupported color
  function»). Las letras de Google se le pasan ya metidas (`fuentesCss`), si no salían de reemplazo. Corta las hojas entre bloques.
- En «Tu cuenta», bajo «Seguidores nuevos cada día»: la portada del video el día que salió, si publicar sirvió (los días que
  publicaste y el siguiente contra los demás) y los promedios sin decimales.
- Falta (con despliegue): el enlace público para mandar, el correo de cada mes, guardar las historias antes de 24 h, «Quién te
  ve» (países, ciudades, edad), los números que se tocan (alcance por día) y mes contra mes en seguidores.
- Prueba local: `herramientas/_demo-informes.html` con `_stub-informes.js` y `_informe-datos.js` (reels reales de @sergiosaac.co;
  NUNCA se publican).
