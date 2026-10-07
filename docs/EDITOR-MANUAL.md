# El editor Manual

*8-oct-2026*

Sergio: **«quiero que haya un switch entre el editor que ya tenemos y cuando se toque ese switch se convierta en editor
manual, con el resultado que ya tenemos pero una línea de tiempo con cada elemento… que como un editor tradicional
podamos tocar algo y borrarlo, o tocar un gráfico y darle en generar uno diferente»**.

El diseño se aprobó en la propuesta v5.1 (artefacto «Editor manual de Cherry»).

---

## Cómo se ve

- Arriba, junto a «‹ Inicio», el interruptor **✦ Automático / ✎ Manual** (`C.ModoEditor`). Cada quien se queda en el
  modo en que lo dejó (`localStorage › cherry-editor-modo`).
- El **celular no se mueve** y es grande en los dos modos: la primera columna sale del alto de la ventana
  (`--col-cel` en `css/manual.css`), ya no de un tope de 290 px.
- En Manual, multimedia y configuración dejan su sitio a dos piezas:
  - **arriba, el panel** con «Lo escogido · Tus clips · ＋ Agregar», y a la derecha Fabricar / Descargar / Publicar
    (la misma franja de `fabricar.js`, en una fila);
  - **abajo, la línea de tiempo**: reproducir, reloj, quitar, deshacer, rehacer, ＋ Agregar, acercar; la fila de
    **interruptores** (uno por pista: Subtítulos, Gráficos, Escenas, Tomas, Voz, Efectos) y las pistas.
- La línea de tiempo **no cambia de alto**: su espacio se reparte entre las pistas que se ven; entre menos se vean, más
  alta queda cada una, **hasta 130 px** (lo que sobra queda vacío). Si no caben, hace scroll por dentro; la página
  nunca.
- **Líneas infinitas**: lo que se tapa en una pista pasa a la línea de abajo (hoy se ve sobre todo en Efectos).
- Lo que se toca a mano lleva **✎** en su bloque y «✎ a mano» en el panel.

## Parte 1 (8-oct): solo lo que ya llega al video final

La regla de siempre: la vista previa = el video final. Por eso todo se guarda en lo que **ya existía** y el ensamblador ya
sabe poner; nada nuevo viaja al servidor.

| pista | qué se puede | dónde se guarda |
|---|---|---|
| Subtítulos | corregir una palabra, la palabra clave, cómo sale la frase (estilo, impacto/normal, sin subtítulo), «este estilo a todas» | la edición de subtítulos (`editarSubs` → `renders.subtitle_edits`), igual que «Editar resultado»; la vista previa la toma al instante (`refrescarEdicion`) |
| Efectos | moverlos (arrastrar), cambiarlos, volumen, ±0,1 s, quitarlos; agregar de la biblioteca (100 sonidos, arrastrando o con «＋ Agregar») | `C.state.sonidos`: el golpe cae en una palabra ± 2 s (`palabra` + `mover`), como en el Guion |
| Escenas | moverlas, su duración (o estirar el borde), otra toma, otra categoría, quitarlas, «que decida Cherry»; agregar por categoría o «que Cherry recomiende» | `guionFijos.escenas` (zonas `si`/`no` por número de palabra). Mover una de Cherry la deja fija con la MISMA toma y pone «aquí no» donde estaba |
| Gráficos | quitar uno, «Generar otro» (la IA vuelve a marcar solo ese), «Cambiar todos» | quitar = `guionFijos.graficos.no`; otro = `biblioteca › regenerar-graficos` con los demás en `quedan` |
| Tomas / Voz | ver de qué clip sale, lo que dice; la voz de estudio (`C.controlVoz`) | — |

Atajos: Espacio (reproducir), Supr (quitar lo escogido), Ctrl+Z / Ctrl+Y, Esc (soltar).

### Lo que se arregló de paso

- `cortesvivo › estiloDe`: «Sin subtítulo» puesto a mano ya no sale con la plantilla de impacto en «solo impacto».
- `movvivo`: con las escenas apagadas, las fijadas a mano salen en la vista previa (en el video ya salían: `soloFijas`).
- `fabricar › firmaDe`: «Generar otro» cambia la fila de la base; su huella entra en la firma (ver `FABRICAR.md`).

## Parte 2 (8-oct): las tomas

- **Recortar** (estirar el borde izquierdo o derecho del bloque en la pista Tomas), **partir** en la línea blanca
  (botón o tecla **S**), **duplicar** y **quitar** (botón o **Supr**). «↺ Volver a los cortes de Cherry» lo deshace todo.
  Se recorta hasta lo que hay de ese corte en la base de donde sale (para volver a alargar: deshacer).
- **Se ve al instante**: la lista nueva (`s.tomasMano = { de, cortes: [{ k, a, b }], auto }`) se muestra en la base `de`
  SALTANDO lo recortado (`cortesvivo › saltar`, con los subtítulos de la lista nueva). El celular dice «aplicando tus
  cortes» y Fabricar espera.
- **En segundo plano, sin IA**: a los 4 s quieta, la página arma con `js/recorte.js` la base nueva —cada palabra
  reconocida por su clip y el segundo del clip— con sus frases, titulares de cada nivel, gráficos y escenas, y la manda
  a orchestrate v260 `recortar_base`. F1 corta de las copias livianas sin volver a quitar silencios (~40 s).
- **Cuando llega**, se pasa a ella en el mismo segundo y lo hecho a mano (efectos, escenas y gráficos fijados, títulos,
  la edición de subtítulos) pasa palabra por palabra (`s.indicesDe` = de qué base son los números). Lo que quedó en un
  pedazo quitado se guarda aparte y vuelve si el pedazo vuelve (deshacer).
- **La voz de estudio no vuelve a Auphonic**: el ensamblador corta la de la base anterior (`voz.js › desdeOtra`).
- En Automático, un aviso dice que las tomas van a mano (los ajustes de corte y los clips nuevos no las cambian) con
  «↺ Volver a las de Cherry».

Probado en el banco (`_demo-fab.html`, con `_fab-falso.js › recortarBase`): quitar, partir, recortar, deshacer, el paso
de efectos y escenas fijadas a la misma palabra y la corrección de una palabra que sobrevive al recorte.
`js/recorte.js` tiene sus pruebas en node (`scratchpad/manual2/probar_recorte.js`: identidad, quitar, partir, duplicar,
recortar, el puente de ida y vuelta).

## 8-oct (tarde): lo que reclamó Sergio al usarlo en «Día 1 Reto»

- **«Todo en la línea de tiempo debe coincidir con la vista previa».** Su proyecto tiene una **edición hecha a mano**
  (tabla `ediciones`, docs/EDICION.md): con ella el celular y el video final NO llevan los gráficos ni las escenas de
  Cherry, llevan sus capas. La línea de tiempo mostraba los de Cherry. Ahora `cortesvivo › colocados` aplica la misma
  regla (`edicionVivo.activa`): la pista Gráficos muestra las capas (moradas, «✎ Edición a mano»), Escenas queda vacía y
  los subtítulos que la edición esconde salen tachados. Se puede quitar una capa o la edición entera (vuelven los de
  Cherry); se deshace con Ctrl+Z. Las **pantallas** del Guion también salen en Gráficos (azules).
- **«Cuando los borro no concuerdan».** Al quitar un gráfico o una escena, Cherry llenaba su cupo con otro en otra parte.
  Ahora se prueba la cuenta y lo que aparecería de nuevo se veta (`manual.js › sinRelleno`): solo se va lo que quitaste.
- **Alargar una toma**: hasta 3 s (`ALARGAR`) más allá de donde la dejó el corte, sin salirse del clip. Lo que la base no
  tiene se dice con la **transcripción del clip** (tabla `transcriptions`). Como el video que se ve no trae ese pedazo,
  el celular pasa al instante a la **vista rápida** (tus clips de corte en corte, con los subtítulos de la lista nueva) y
  la línea de tiempo muestra lo mismo (sin gráficos, escenas ni efectos, como el celular) hasta que llega la base (~40 s).
- **Meter un clip** desde «Tus clips» (＋ Agregar): entra lo que se dice en él donde está la línea blanca.
- **Zoom de la línea de tiempo**: Ctrl + rueda del mouse (donde está el mouse) o las teclas + y −.

## 8-oct (noche): lo segundo que reclamó

- **Los efectos no sonaban con la voz de estudio.** Con la voz de estudio sonando en la vista previa, el video de fondo se
  silencia (para no oír dos voces) y `sonidos-vivo.js` tomaba ese silencio como «en silencio»: no sonaba NINGÚN efecto en
  ningún proyecto con voz de estudio (desde el 7-oct). Ahora pregunta `cortesVivo.vozSilencia(v)`.
- **Un subtítulo quitado desaparece** de la línea de tiempo (no queda tachado); vuelve con Ctrl+Z. Lo mismo los que
  esconde la edición a mano.
- **Líneas**: arrastrar un subtítulo, gráfico, escena o efecto hacia arriba o hacia abajo lo pasa a otra línea o crea una
  nueva («＋ línea nueva»). Los subtítulos guardan su línea en la frase (`fila`); lo demás en `s.lineas` (en el borrador).
  Hoy dentro de una pista nada se superpone en el video, así que la línea es el orden en que se ven.
- La edición a mano: una lectura que salió antes de quitar una capa ya no la devuelve (`edicionvivo › E.ver`).

## 8-oct (noche): tomas ENCIMA, con su sonido

Sergio: «si un pedazo de un clip lo subo debe crearse otra línea con el mismo estilo de línea de tiempo de clips». Escogió
**«encima, con su sonido»** (como en CapCut): la toma sale encima del video en su momento, con su voz, y deja la línea
principal, que se cierra; lo de abajo sigue sin verse ni oírse mientras dura. La línea más alta tapa a las de abajo.

- **Cómo se guarda**: `s.tomasMano.encima = [{ k, a, b, clipId, en, fila }]` (`en` = segundo de la línea principal;
  `fila` = 1, 2… hacia arriba). Cada toma lleva su `clipId` (así se dice sola aunque la base que se ve sea otra).
- **Para el video es una lista de cortes más**: `recorte.js › aplanar(L, fuente)` pinta la principal y encima las de
  encima (de la línea más baja a la más alta) y apunta cada pedazo al corte de la fuente que lo trae entero
  (`apuntar`). Así la vista previa la muestra al instante (saltando por la fuente, sin IA ni Auphonic), los subtítulos,
  efectos y la voz se pasan palabra por palabra como con cualquier recorte, y el servidor recibe una lista normal en
  `recortar_base` (nada nuevo en el servidor).
- **La clave de la base** sale de la lista aplanada SIN apuntar (no depende de qué base se esté viendo). En la huella,
  una toma de un clip nuevo (`k = -1`) ahora también cuenta su clip.
- **Con la base nueva a la vista** la lista sigue siendo la tuya (principal + encima) apuntada a esa base: lo partido por
  una toma de encima queda en dos cortes de la base y cada pedazo vuelve a verse al instante.
- **En la línea de tiempo**: las líneas «encima» van arriba de «Tomas»; lo tapado de la principal, rayado oscuro. La Voz
  dibuja lo que se oye.
  - Arrastrar una toma **hacia arriba** (cualquier punto por encima de la pista) = encima, en una línea nueva; sobre una
    línea «encima» que ya existe = a esa línea. Hacia abajo, por debajo de Tomas: aviso («súbela»).
  - Una toma de encima **de lado** cambia su momento (imán de 8 px a los bordes de las tomas y a la línea blanca);
    soltarla sobre «Tomas» la devuelve a la principal (entra antes de la primera toma cuyo centro queda después).
  - Una toma de la principal **de lado** cambia de puesto (marca «aquí»).
  - Sus bordes se estiran igual que los de la principal (± 3 s de lo que traía el corte; al estirar la izquierda, su
    momento se corre con ella). Partir (S), quitar (Supr), deshacer y rehacer, igual.
  - En el panel: «⤒ Ponerla encima» (en la primera línea libre) y, en una de encima, «⤓ A la línea principal».
- Los límites para alargar cuentan todos los cortes del mismo clip que toca la toma (una partida por una de encima
  trae su clip en dos cortes).
- De paso: recortar o partir una toma de un clip nuevo ya no le borra el clip (`k = -1` sin `clipId`).

## Lo que viene

3. **Textos propios** (tipografía, color, cursiva, tamaño, sombra, brillo; se mueven en el celular) y el orden entre
   líneas en el ensamblador.
4. **Gráficos desde tu descripción**; escenas de la biblioteca y de tu computador.
5. **Música** (hoy el selector no llega al video).

Detalles pedidos para después: muchas más tipografías y subir una propia, rueda de color.

## Archivos

- `js/components/manual.js` — todo el modo (se arma una vez y vive aparte de `C.render`, para no perder el scroll, lo
  que se arrastra ni lo que se escribe).
- `css/manual.css` — prefijo `mn-` (la propuesta chocó con `.manual`).
- `main.js` (las zonas), `topbar.js` (el interruptor), `config.js` (`C.controlVoz`), `cortesvivo.js` (`subsVisibles`).
- Parte 2: `js/recorte.js` (puro), `cortesvivo.js` (las tomas a mano: tramos, base nueva, paso de números),
  `orchestrate.ts` v260 (`recortar_base`), `lambda-assembler/voz.js › desdeOtra`, `state.js` (`tomasMano`, `indicesDe`,
  en la firma de cortes), `fabricar.js` (en el borrador), `media.js` (el aviso en Automático).
