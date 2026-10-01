# Gráficos premium (Remotion) — el código de la nube

Hasta el 2-oct-2026 este código **no estaba en ningún repositorio**: solo vivía publicado en el sitio de Remotion
(`sites/cherry-graficos-premium-v5`, el que usa el ensamblador por la variable `REMOTION_SITIO`). Se recuperó entero del
mapa de código (`bundle.js.map › sourcesContent`).

- `src/plantillas/*.tsx` — cada gráfico; `src/plantillas/persiana/` — la persiana; `src/Grafico.tsx` — el registro.
- `src/graficos.js` — copia de `js/graficos.js` (la página y el ensamblador): al cambiar uno, copiar el otro.
- Para publicar un cambio: `npm install`, `npm run publicar` (crea `cherry-graficos-premium-v6`) y apuntar
  `REMOTION_SITIO` del ensamblador al sitio nuevo. La vista previa de la página usa `js/premium-vista.js`, que es este
  mismo código empaquetado: hay que regenerarlo también para que lo que se ve sea lo que sale.
- ⚠️ `cherry-graficos-premium` (sin número) es el del 20-sep: no tiene la persiana. No usarlo para probar.
