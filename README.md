# Carrete — Editor de video IA · versión Vanilla (HTML + CSS + JS)

Implementación **sin frameworks ni build**: HTML + CSS + JavaScript puro, modular por archivos. Abres `index.html` y funciona. Pensada para insertarse en un proyecto web normal.

---

## 1. Cómo usarlo

**Opción rápida:** abre `index.html` directamente en el navegador (doble clic). Funciona porque los scripts son clásicos (sin `import/export`).

**Opción recomendada (servidor local)** — evita cualquier restricción del navegador:
```bash
cd carrete_vanilla
python3 -m http.server 5500
# abre http://localhost:5500
```
(o usa la extensión "Live Server" de VS Code).

No hay `npm install`, ni compilación, ni dependencias. Solo necesita conexión para cargar las fuentes de Google (Syne / Space Grotesk / DM Mono); si quieres que funcione 100% offline, descarga esas fuentes y cámbialas en `index.html` + `css/styles.css`.

---

## 2. Estructura

```
carrete_vanilla/
├── index.html                  # estructura + carga de CSS y scripts (en orden)
├── css/
│   └── styles.css              # TODO el estilo. Tokens en :root, luego componentes
└── js/
    ├── dom.js                  # helper h(tag, props, ...hijos) para crear nodos
    ├── data.js                 # catálogos (presets, fuentes, sfx, tracks…) + utilidades
    ├── state.js                # estado único + acciones (play, generate, saveBrand…)
    ├── components/
    │   ├── topbar.js           # barra superior
    │   ├── tabstrip.js         # 6 pestañas (cambian el sidebar)
    │   ├── sidebar.js          # panel de opciones + C.ui.* (primitivas reutilizables) + 6 paneles
    │   ├── preview.js          # escenario central con el marco en vivo + C.caption()
    │   ├── rail.js             # rail derecho: material, guión, caja Generar (idle/rendering/done)
    │   ├── overlays.js         # drawer de guión + modal SFX + modal de stock visual
    │   └── result.js           # pantalla "Editar resultado" (timeline + propiedades)
    └── main.js                 # render() principal y arranque
```

Todo cuelga de un único objeto global: **`window.CARRETE`** (abreviado `C` dentro de cada archivo). No contamina el resto de variables globales, así que es seguro pegarlo en un sitio existente.

---

## 3. Cómo funciona (el modelo mental)

Es un patrón "estado → render" muy simple, sin framework:

1. **`C.state`** (en `state.js`) es la única fuente de verdad.
2. **`C.setState({clave: valor})`** aplica el cambio y llama a **`C.render()`**, que reconstruye la interfaz desde el estado. (`C.toggle('clave')` invierte un booleano.)
3. Cada componente es una función que **devuelve nodos DOM** a partir de `C.state` (con el helper `C.h`).

### Detalle importante: fluidez de sliders y textarea
Reconstruir todo en cada tecla rompería el foco del textarea y el arrastre de los sliders. Por eso esos casos **no** llaman a `render()`:
- **Sliders** (ritmo, zoom, volumen): actualizan el valor y su etiqueta directamente (closure), sin re-render.
- **Scrubber y reproducción**: actualizan la barra de progreso y el timecode vía `C.live.progress()` (clases `.js-bar` y `.js-tc`), sin re-render.
- **Textarea del guión**: actualiza `state.scriptText` y el contador en vivo; conserva el cursor.

El resto (clics, toggles, selects, cambio de pestaña, abrir modales) sí re-renderiza, que es instantáneo.

### Render del video
`C.actions.generate()` simula el render con progreso **derivado del tiempo transcurrido** (~4s), no de un contador por tick — así termina aunque el navegador estrangule los temporizadores en segundo plano. Al 100% pasa a `phase:'done'` y aparece "✎ Editar resultado".

---

## 4. Personalización

- **Colores y fuentes:** todo está en `:root` dentro de `css/styles.css` (variables `--coral`, `--cream`, etc.). Cambia ahí y se propaga.
- **Opciones (presets, fuentes, transiciones, categorías de SFX/stock, pistas…):** edita `js/data.js`. No toques la UI para añadir/quitar opciones.
- **Añadir un control nuevo:** crea el markup en el panel correspondiente de `sidebar.js` usando las primitivas `C.ui.toggle / segmented / chip / select / swatch / slider`, y añade su campo en `C.state`.

---

## 5. Qué NO incluye (conéctalo a tu backend)

- Subida real de clips / fuentes / sonidos (los botones existen, sin lógica de archivo).
- Transcripción real para subtítulos y catálogos reales de música/SFX/stock (hoy placeholders).
- Render real del video (hoy es una simulación por temporizador → conéctalo a tu API, idealmente asíncrono con polling/websocket).
- Persistencia (identidad de marca, proyectos).
- Íconos: se usan glifos Unicode (▾ ✓ ✦ ♪ ▦ ✎ ← ↺). Cámbialos por tu set si quieres.
- Responsive/móvil: el diseño es para escritorio.

---

## 6. Insertar en un proyecto existente

1. Copia `css/styles.css` y la carpeta `js/` a tu proyecto.
2. En tu página, añade `<div id="app"></div>`, el `<link>` de las fuentes, el `<link>` al CSS y los `<script>` en el **mismo orden** que en `index.html`.
3. Si ya tienes un sistema de build/bundler, puedes convertir cada archivo a módulos ES (`export`/`import`) fácilmente: están separados por responsabilidad justo para eso.

> Verificado en navegador: pestañas, selección de estilo/formato, subtítulos, sliders, modo avanzado, play/scrubber, generar, drawer de guión, librerías y la pantalla "Editar resultado" con sus 6 pistas y panel de propiedades.
