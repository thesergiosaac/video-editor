# Gráficos premium — qué está aprobado y qué no

Estado al **19 de septiembre de 2026**. Este archivo manda sobre cualquier otra lista: si una plantilla no
aparece como aprobada aquí, no se conecta ni se le ofrece al usuario.

## La regla nueva

Los gráficos que vengan de ahora en adelante **salen de referencias en video que manda Sergio**, no de
propuestas nuestras. Él manda el video, nosotros miramos el gráfico que aparece ahí y lo recreamos tal cual.
De siete diseños propuestos a ciegas solo pasaron dos: proponer de nuestra cosecha sale caro y no da en el
blanco.

## Los seis de la primera tanda — en producción

| Plantilla | Archivo | Forma | Estado |
|---|---|---|---|
| Número gigante | `premium/src/plantillas/Numero.tsx` | Encima del video | ✅ en uso |
| Porcentaje (anillo) | `premium/src/plantillas/Porcentaje.tsx` | Pantalla partida | ✅ en uso |
| Lista | `premium/src/plantillas/Lista.tsx` | Encima del video | ✅ en uso |
| Antes y después | `premium/src/plantillas/Comparacion.tsx` | Pantalla completa | ✅ en uso |
| Línea de tiempo | `premium/src/plantillas/Linea.tsx` | Encima del video | ✅ en uso |
| Cita | `premium/src/plantillas/Cita.tsx` | Encima del video | ✅ en uso |

## Los siete de la segunda tanda — veredicto de Sergio

| Plantilla | Archivo | Forma | Veredicto |
|---|---|---|---|
| Medidor de aguja | `premium/src/plantillas/Medidor.tsx` | Pantalla partida | ✅ **aprobado** — falta conectarlo |
| Mito / Realidad | `premium/src/plantillas/Mito.tsx` | Encima del video | ✅ **aprobado** — falta conectarlo |
| Celular 3D (mockup) | `premium/src/plantillas/Celular.tsx` | Tu video a un lado | 🟡 **por pulir** — le gusta la idea, no cómo quedó |
| Recibo / desglose | `premium/src/plantillas/Desglose.tsx` | Pantalla completa | ❌ descartado |
| Pasos 1·2·3 | `premium/src/plantillas/Pasos.tsx` | Tu video a un lado | ❌ descartado |
| Palabra gigante | `premium/src/plantillas/Palabra.tsx` | Encima del video | ❌ descartado |
| Podio top 3 | `premium/src/plantillas/Podio.tsx` | Pantalla completa | ❌ descartado |

Las descartadas siguen en el repositorio y registradas en `premium/src/Grafico.tsx`, pero **no** están en el
prompt de la IA (`deploy/biblioteca.ts`), **no** tienen dibujo clásico en `js/graficos.js` y **no** aparecen
en la pestaña Gráficos. Quedan ahí por si algún día una referencia se parece a alguna.

## Para conectar una plantilla de punta a punta

1. `deploy/biblioteca.ts` — enseñarle a la IA el tipo nuevo y qué datos pedir.
2. `js/graficos.js` — el dibujo del estilo Clásico (el de respaldo, sin costo de render) y la forma.
3. `js/components/config.js` — que salga en la pestaña Gráficos.
4. La plantilla de Remotion ya construida, y volver a publicar el sitio:
   `npx remotion lambda sites create src/index.ts --site-name=cherry-graficos-premium`

## Un fallo arreglado el 19-sep

El tambor de dígitos dejaba las decenas a medio girar con cualquier número que no terminara en 0 (17, 25,
43…): el «17 %» se veía como un glifo partido. Afectaba a **Porcentaje**, que ya estaba en producción, y al
Medidor nuevo. Arreglado con `posDigito()` en `premium/src/lib/Piezas.tsx`, que hace rodar las decenas solo
en el último 10 % del dígito de abajo, como un odómetro de verdad, y así siempre aterrizan en un entero.
