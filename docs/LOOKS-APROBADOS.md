# Looks aprobados por Sergio (30-sep-2026)

Salieron de su tablero de Pinterest **«Colorización»** (co.pinterest.com/photografyandy/colorización, 7 pines) y se
probaron sobre un cuadro del Proyecto 25 (segundo 29,5) con `motor-color.js`, el mismo del ensamblador y de la vista en
vivo. Descartados por él: «Film cálido desvaído» y «Mate». De la primera tanda (sin arreglo de piel) también estaban
Film verdoso, Neutro cine, Nocturno de colores y Natural limpio: no los escogió ni los descartó.

**Para llevarlos a Cherry:** cada uno es un look «Tu referencia» (`color.look = 'referencia'`, `color.referencia.receta`)
más `color.correccion` y `color.zonas`. Lo natural es sumarlos al `CATALOGO` de `motor-color.js` (con `base` = la receta)
y dejar la piel como zona `piel` (va dentro de la silueta; la madera tiene el mismo tono que la piel y un look parejo
no las separa). Herramientas: `Downloads\Cherry Contenido\P25-editado\color_refs\` (`gradear2.js`, `opciones2.json`,
`out\*.png`).

⚠️ Las recetas automáticas de «Tu referencia» sobre este tablero salieron casi iguales (sus topes son prudentes y las
referencias tienen luz parecida a la de Sergio): estas se armaron A MANO a partir de cada referencia.

## Cálido oscuro (piel arreglada)
**Escogido para el Proyecto 25.** Sombras profundas, luz naranja, sombras con un toque azul verdoso, viñeta; la piel se aclara y se suaviza SOLO dentro de la silueta (zona «piel»). Referencias: ref1 (estudio con lámparas), ref7 (estudio con micrófono).

```json
{"look": "referencia", "referencia": {"receta": {"curva": [[0, 0], [8, 4], [25, 17], [45, 34], [65, 54], [85, 74], [100, 86]], "sat_general": 0.95, "piel_tono": 50, "piel_giro": 5, "piel_sat": 0.85, "calido_giro": -8, "calido_sat": 1.45, "verde_giro": -20, "verde_sat": 0.5, "sombra_sat": 0.7, "sombra_tinte": [-2.5, -4], "luz_tinte": [2, 4.5], "vineta": 1.3, "densidad": 0.3}}, "correccion": {"contraste": 12}, "zonas": {"piel": {"exposicion": 15, "sombras": 16, "saturacion": -9, "temperatura": -2}}}
```

## Cálido oscuro suave
La misma A, todo un poco menos oscuro. Referencias: ref1, ref7.

```json
{"look": "referencia", "referencia": {"receta": {"curva": [[0, 2], [10, 7], [30, 23], [50, 41], [70, 61], [88, 80], [100, 90]], "sat_general": 0.95, "piel_tono": 50, "piel_giro": 5, "piel_sat": 0.85, "calido_giro": -8, "calido_sat": 1.4, "verde_giro": -20, "verde_sat": 0.5, "sombra_sat": 0.7, "sombra_tinte": [-2.5, -4], "luz_tinte": [2, 4.5], "vineta": 1.1, "densidad": 0.25}}, "correccion": {"contraste": 8}, "zonas": {"piel": {"exposicion": 12, "sombras": 14, "saturacion": -8, "temperatura": -2}}}
```

## Naranja y azul verdoso
El clásico de cine: luz naranja, sombras azul verdoso, verdes apagados. Referencias: ref1, ref2.

```json
{"look": "referencia", "referencia": {"receta": {"curva": [[0, 1], [12, 8], [30, 24], [50, 44], [70, 64], [88, 82], [100, 92]], "sat_general": 1.0, "piel_tono": 50, "piel_giro": 5, "piel_sat": 0.88, "calido_giro": -5, "calido_sat": 1.35, "verde_giro": -30, "verde_sat": 0.6, "sombra_sat": 0.9, "sombra_tinte": [-5, -6], "luz_tinte": [3, 5], "vineta": 1, "densidad": 0.2}}, "correccion": {"contraste": 10}, "zonas": {"piel": {"exposicion": 10, "saturacion": -10, "temperatura": -3}}}
```

## Chocolate
Cafés profundos, sombras cálidas, color denso (densidad 0,6). Referencias: ref7.

```json
{"look": "referencia", "referencia": {"receta": {"curva": [[0, 0], [10, 5], [30, 19], [50, 36], [70, 55], [90, 77], [100, 87]], "sat_general": 0.9, "piel_tono": 50, "piel_giro": 5, "piel_sat": 0.85, "calido_giro": 6, "calido_sat": 1.1, "verde_giro": -25, "verde_sat": 0.45, "sombra_sat": 0.8, "sombra_tinte": [2, 1.5], "luz_tinte": [2, 3], "vineta": 1.2, "densidad": 0.6}}, "correccion": {"contraste": 10}, "zonas": {"piel": {"exposicion": 14, "sombras": 14, "saturacion": -14, "temperatura": -5}}}
```

## Noche ámbar
Oscuro, luz ámbar viva, sombras azules, viñeta fuerte. Referencias: ref6, ref1.

```json
{"look": "referencia", "referencia": {"receta": {"curva": [[0, 0], [12, 5], [35, 25], [55, 46], [75, 68], [92, 86], [100, 94]], "sat_general": 1.05, "piel_tono": 50, "piel_giro": 5, "piel_sat": 0.88, "calido_giro": -4, "calido_sat": 1.4, "verde_giro": 0, "verde_sat": 0.9, "sombra_sat": 1, "sombra_tinte": [-1, -6], "luz_tinte": [1, 3], "vineta": 1.4, "densidad": 0.3}}, "correccion": {"exposicion": -6}, "zonas": {"piel": {"exposicion": 12, "sombras": 12, "saturacion": -10, "temperatura": -4}}}
```

## (2-oct-2026) Ya están en Cherry
Los 5 looks están en `js/motor-color.js › CATALOGO` (`calido_oscuro`, `calido_suave`, `teal_naranja`, `chocolate`, `noche_ambar`),
con su receta en `base` y su arreglo de piel y corrección en `porDefecto`. La lista de la página está en `js/data.js › looks`.
Al escogerlos, `C.patchDeLook` (js/state.js) pone `porDefecto` en los controles (`cg_*` y `zp_*`), visibles para moverlos; al pasar
a un look sin `porDefecto`, los limpia. El ensamblador lleva la misma copia de motor-color.js.
