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

## Lo que viene

2. **Tomas**: recortar con asas, partir, duplicar, quitar, clips nuevos (base nueva con `cutsOverride` y volver a
   colocar lo atado a palabras).
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
