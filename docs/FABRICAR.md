# Fabricar solo al final (6-oct-2026)

Sergio: «todos hacen el navegador y todos una vista previa falsa que solo se renderiza al final para consumir menos».
Plan aprobado el 3/5-oct (memoria `cherry-optimizar-y-cobrar`), fase 1.

## Antes
- El editor fabricaba un video al tocar «generar video» y luego `js/adelantado.js` fabricaba OTRO en segundo plano cada
  vez que algo cambiaba (6 s quieto): ~18 fabricaciones por video. Descargar pedía además el master (calidad original).

## Ahora
- **Todo se ve en vivo** (`js/components/cortesvivo.js`): la base sin subtítulos (la «base adelantada») y encima el color,
  el movimiento, las escenas, los gráficos, los sonidos y los subtítulos. El editor ya no entra nunca en «video hecho»:
  `phase` se queda en `idle` y el celular siempre muestra la vista previa.
- **Se fabrica una vez** (`js/fabricar.js`, reemplaza a `adelantado.js`): Descargar o Publicar → aviso con el tiempo
  («unos 9 minutos por los 6 gráficos») y que no hace falta quedarse → UN master desde la base:
  `orchestrate { reusar_render: <base>, calidad: 'original', subtitulos/color/…: lo que se ve, firma_version, eta_min }`.
  Las frases salen de `cortesVivo.subsParaFabricar` con la misma regla de plantilla que la vista previa (`estiloDe`).
  Solo si se pasó a «solo impacto» sin titulares, o con otro nivel del que trae la base, la IA los escoge al fabricar
  (`marcar_titulares`); la etiqueta del celular lo dice.
- **La versión**: `firma_version` = huella de los cortes (`C.firmaCortes`) + todo lo que va en el video. Se guarda en el
  master (orchestrate v257). Si el último master tiene la misma, Descargar lo baja ya y Publicar va directo al Calendario.
  Si cambiaste algo después: «Cambiaste cosas después de fabricarlo» + «Bajar el de antes».
- **Publicar no espera**: va al Calendario con `fab=<id>&listo=<ms>`. El Calendario lista el video que se fabrica
  («fabricándose · listo hacia las…», `CherryApp.videosListos` › `fabricando`), no deja una hora antes de `listo`, ofrece
  «Publicar apenas esté listo» y programa con `render_master` (ig-publicar v3: guarda la publicación con
  `master_estado: 'preparando'`, cada vuelta del reloj mira si salió; si falla, queda fallida y no se publica nada).
- **El borrador** (`projects.borrador` + `borrador_en`, `servidor/sql/17-borrador.sql`): lo que dejas puesto (color,
  plantilla, gráficos, escenas, sonidos, voz, ritmo de los cortes) se guarda solo 2,5 s después de cada cambio y vuelve
  al abrir el proyecto, si es más nuevo que su último video. Mientras el proyecto carga no se guarda nada.
- **La vista previa de un proyecto de antes** sale de su base o, si no hay, de su último video hecho con esos mismos
  cortes (`api.getVistaPorFirma`; un master se ve con su `vista_base` liviana): no se vuelve a cortar nada. La base va
  primero para que la firma de lo fabricado no cambie al recargar.
- **Editar resultado** edita sobre la base que se ve (`C.idVista()`, `editorFila`) y ya no exporta: «Listo ✓» vuelve y
  lo editado pasa a la vista previa (`cortesVivo.refrescarEdicion`).
- **Al terminar**: si sigues en Cherry, un aviso abajo («Tu video está listo» + Descargar) y la pestaña lo dice. El
  correo queda para cuando cherrysweet.app tenga su envío propio (Sergio crea la cuenta).
- Efectos de sonido automáticos y el Guion funcionan sobre la vista previa (antes pedían «primero haz el video»).
- La clave de la base ahora incluye «sin cortes» y el revelado apagado (solo cuando están puestos: las bases viejas
  siguen sirviendo). Antes, cambiarlos dejaba la vista con la base vieja.

## Servidor
- `orchestrate` v257: acepta `firma_version` y `eta_min`; el camino rápido ya no copia `base: true` de la base al master
  (quedaba como otra base, sin la pasada final); un master hecho desde otro master conserva la `vista_base` liviana.
- `ig-publicar` v3: `programar`/`ahora` aceptan `render_master` (dueño comprobado, debe ser calidad original).

## Calendario (arreglado de paso)
Borrar, mover o volver a guardar una publicación que Cherry ya había programado en Instagram solo cambiaba el
calendario: la del servidor seguía (se habría publicado lo borrado, a la hora vieja, o dos veces). Ahora se cancela la
vieja (`ig-publicar › quitar`) y, si sigue programada, se apunta otra (`reprogramar`).

## Arreglado de paso: el editor no se pintaba
Desde el 4-oct (commit 9f52680) `js/components/topbar.js` usaba la variable `creditos`, que ese commit había quitado: al
entrar al editor la barra de arriba fallaba y la pantalla del editor no se pintaba. Ahora la pastilla usa `miPlan`.

## Cómo se probó (6-oct, sin tocar producción ni gastar)
Banco local que NUNCA se publica: `_demo-fab.html` (copia de app.html) + `_fab-candado.js` (bloquea toda llamada al
servidor real) + `_fab-falso.js` (servidor de mentira con una base real de «Video de prueba» leída en `_fab_datos.json`,
que se borra después). Con clics reales: Descargar → aviso → Fabricar → «Fabricando…» → «¡tu video está listo!» + aviso
abajo; cambiar la plantilla → «Cambiaste cosas…» y el borrador se guarda; recargar → vuelven el borrador y el master;
dejarlo igual → otra vez listo (la firma no cambia al recargar); Editar resultado → corregir una palabra → «Listo ✓» →
la vista y lo que se fabrica la llevan; Publicar → fabrica y abre el Calendario con `fab` y `listo`. Calendario con
`herramientas/_demo-fab-cal.html` + `_cal-fab-falso.js`: aviso «se está fabricando», «Publicar apenas esté listo», no deja
una hora antes, programa con `render_master`; volver a guardar cancela la vieja y borrar también.

## Estimado de tiempo
`3 + 1,2 × minutos de video + 0,8 por gráfico premium (0,25 clásico) + 1 con voz de estudio`, redondeado hacia arriba,
mínimo 3. Medido el 5-oct: reutilizando partes 1–3 min; desde cero 6–16 min. Ajustarlo con fabricaciones reales.

## 7-oct-2026 — «TODO DEBE VERSE EN LA VISTA PREVIA AL INSTANTE»
- **Titulares por nivel.** La base guarda en `subtitle_phrases.frases_por_nivel` las frases con los titulares de
  «pocas», «medio» y «muchas» (se escogen a la vez que las frases, orchestrate v259). Cambiar el nivel en Texto ›
  ¿Dónde usar la plantilla? escoge entre ellas al instante (`cortesvivo.js › frasesDe`); el video fabricado sale con las
  mismas (`subsParaFabricar`). Una base de antes los pide una vez en segundo plano (`titulares_niveles` +
  `reusar_render`). Lo corregido a mano en Editar resultado manda sobre los niveles.
- **Voz de estudio en la vista previa.** Al prenderla, `preparar_voz` + `reusar_render` manda al ensamblador (modo
  `voz`) a procesar la base liviana y deja `renders/<id>/voz_<huella>.m4a` en `renders.voz_estudio.vista`. El editor
  silencia el video y pone esa voz encima, al mismo segundo (un desfase chico se alcanza acelerando o frenando un 5 %;
  medido en el banco: ~0,01 s). Ojo con el costo: el video fabricado vuelve a procesar la voz desde los originales
  (otra huella), así que con la voz prendida son dos pasadas de Auphonic por video. Apagarla y prenderla reintenta
  una que no salió.
- **Recorte más rápido.** La silueta se saca en tramos de 4 s (antes 12; la primera vez baja de 200–230 s a ~90 s) y el
  master toma la de la vista previa acomodada a sus cortes (`silueta.js › desdeVista`) en vez de recortar otra vez.
  Medido: los gráficos premium tardan 20–45 s y no eran el cuello de botella; el recorte sí.
- **«✓ Listo, fabrícalo».** Botón en «así va tu video»: arranca a fabricar apenas terminas; cuando esté, se descarga o se
  programa (antes había que escoger primero entre Descargar y Publicar).
- **Cuánto falta, en todo** (`js/eta.js`). Cada trabajo guarda en el navegador lo que tardó las últimas 5 veces y con la
  mediana dice «faltan ≈ 1:10»; si ya se pasó, «ya casi: a veces tarda un poco más». Está en: la vista previa (base,
  gráficos y escenas, titulares, voz, recorte de la persona), Cambiar gráficos, el Laboratorio (pensar, ganchos,
  guion premium, guion normal, dibujar el storyboard) y los carruseles (armar, leer un video, láminas con video al
  descargar). Lo que sigue en el servidor dice «sigue aunque cierres»; lo que espera la pestaña dice «no cierres esta».

## Pendiente
- El correo al terminar (cuenta de envío de cherrysweet.app).
