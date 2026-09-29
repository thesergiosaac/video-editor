# La portada de cherrysweet.app (27-sep-2026)

`index.html` es la puerta del dominio y lo único que se ve sin cuenta. La aplicación sigue en `app.html` (no se tocó:
es pantalla de la revisión de Meta). Todo lo que usa la portada vive en `assets/portada/`.

## Lo que tiene
- **Hero «vitrina»**: 4 teléfonos con las animaciones de Remotion y calcas pegadas a ellos. Al bajar, los teléfonos se
  abren y cada letrero se va con el suyo.
- **Lo que hace**: un teléfono grande y 4 pasos que avanzan solos o se tocan.
- **Mosaico**: tres filas de tarjetas que corren en sentidos contrarios con el scroll.
- **Simulador** (nada se sube, todo es de la página):
  - *Editar*: explorador de mentira (ventana propia), subida, edición paso a paso y el reel con subtítulos en las
    plantillas reales (Dorado, Editorial, Cinemático; mismas letras, colores y alturas que `js/components/subtitulos.js`),
    escena de apoyo, zoom, gráfico de vidrio y cierre.
  - *Guion y storyboard*: guion con 3 ganchos para escoger y 6 viñetas.
  - *Consejos y retención*: curva contra la media (datos de ejemplo) y 3 consejos.
- **Antes y después** de las pausas para arrastrar (onda real de una grabación de dominio público).
- **Hoja de calcas rosada**, **calendario de la semana** que se llena con el scroll (los días vacíos se programan),
  Instagram + cómo empiezas, marcas, precios, preguntas y cierre.
- Pistas a mano («toca aquí», «arrástrame»…) que se van cuando la persona ya lo hizo.

## ⚠️ Los botones de «Empezar» no llevan a ningún lado (a propósito)
Hasta que exista la página de registro. Son `<a class="btn">` **sin `href`**. La barra fija de abajo del celular
(`#fijo`) está con `hidden` porque solo servía para ese botón. El día que abra el registro: ponerles el `href` de la
página nueva (los planes con su plan escogido) y quitarle el `hidden` a `#fijo`.

## Lo que exigen Paddle y Meta (no quitar)
Precios visibles (Gratis 0 · Creador 19 · Estudio 49 USD, **provisionales**: si cambian, cambiar también el catálogo de
Paddle), enlaces a `terminos.html`, `privacidad.html`, `reembolsos.html`, `soporte@cherrysweet.app` y la nota de que
cobra Paddle.com Market Ltd. «Entrar» lleva a `app.html`.

## Material y licencias
- Papel rasgado de los bloques rosados (`rasgado-*.png`): tornpaperpng.com, uso comercial libre, sin crédito.
- Clips del simulador (`sim/s*.mp4`, `sim/raw-*.webp`): Mixkit, licencia gratis con uso comercial; solo manos y objetos.
- Viñetas (`sim/v*.webp`): de storyboards dibujados por Cherry; solo las que no muestran cara.
- Plantillas (`pl-*.webp`): las de `assets/plantillas`. Estatuas y calcas: el arte pop de Cherry (`assets/inicio`).
- Logos de la franja de marcas: Simple Icons (CC0), dentro del HTML.

La fuente de la propuesta y sus versiones están fuera del repositorio; esta página es la versión aprobada.
