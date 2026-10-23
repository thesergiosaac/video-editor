# Pruebas A/B de ganchos (23-oct-2026)

Sergio: «tener exactamente el mismo vídeo pero cambiarle el gancho… que Cherry te proponga [la] prueba… publicarlas como
reel de prueba… la que le vaya mejor ya se publica en el perfil; si no se puede, que le avise para que el mismo usuario desde
su celular [la] publique». Sus decisiones: **2 o 3 versiones las escoge el usuario**; **todos los tipos de gancho** (hablado,
de texto, visual, de sonido); una **herramienta propia, «Pruebas A/B»**, conectada con Guiones y con el Editor; **resultado a
las 48 horas**. Propuesta: https://claude.ai/artifact/Ar8uqSrH1QmdDSGGFEzkSW · plan: https://claude.ai/artifact/BSXEqB58LoWAGYkM2ssJBr

Partes del plan: **1 la pantalla y los ganchos de TEXTO (hecha)** · 2 visual y sonido · 3 hablado + Guiones · 4 aprender
(qué tipo de gancho le funciona a cada cuenta). Por ahora **solo administradores** (el servidor responde 403 a los demás).

## Lo que no se puede
- **Instagram no deja pasar un reel de prueba al perfil por la API**, ni dice si un reel es de prueba (changelog de Meta del
  3-dic-2025: `trial_params.graduation_strategy` = MANUAL o SS_PERFORMANCE). Las versiones van con **MANUAL** (con
  SS_PERFORMANCE podrían pasar dos solas y quedarían repetidas en el perfil) y Cherry **avisa** cuál ganó, con su enlace:
  la persona la pasa en la app («Compartir con seguidores»). Las demás se quedan como reels de prueba.
- No todas las cuentas profesionales tienen reels de prueba: si Instagram no publica, la prueba queda «No se pudo» con su error.

## Cómo anda
1. **La pantalla** (`herramientas/pruebas.html`; barra de herramientas › Publicar › «Pruebas A/B», solo administradores):
   escoger un video ya fabricado (`CherryApp.videosListos`) → 2 o 3 versiones, «¿Qué cambia?» (Texto en pantalla; los otros
   tres dicen «Pronto»), cómo se ve (caja blanca, caja del color de la marca, sin caja) y dónde va (arriba, en el medio,
   abajo: donde no tape el título ni los subtítulos del video) → el texto de cada una (o «✦ Que Cherry los proponga»).
   Una versión puede ir vacía = el video tal como está (sirve para saber si el texto ayuda) → cuenta de Instagram de la
   marca, el texto de la publicación (el mismo en todas) y cuándo → «Empezar la prueba».
   El texto se **dibuja en la página** con la letra de títulos de la marca (`letraTitulos`; las letras propias con
   `js/letras-propias.js`) en un PNG transparente del tamaño del video, y sube al cubo público `publicar`.
2. **El servidor** (`servidor/pruebas-ab.ts`, tabla `pruebas_ab` de `servidor/sql/26-pruebas-ab.sql`):
   `master` (si el video no está en calidad original, se pide a orchestrate y se espera) → `fabricando` → `publicando` →
   `en_prueba` (48 h; se mide cada 6 h y al abrir la página, máximo cada 30 min) → `lista` · `fallida` · `cancelada` ·
   `ensayo` (prueba interna con `ensayo: true`: se fabrica y NO se publica).
3. **La Lambda `cherry-pruebas-ab`** (`servidor/lambda-pruebas-ab/index.js`; node20, 3008 MB, 900 s, 4 GB de disco, capa
   `carrete-ffmpeg:1`, rol `carrete-media-processor-role`): una llamada asíncrona por versión. Baja el master (o el archivo
   original de un video «tal cual», de `uploads/<uid>/`), pone el PNG encima de los primeros segundos
   (`scale2ref` + `overlay … enable='lt(t,3)'`) con la compresión de la versión para Instagram del ensamblador (crf 18,
   tope según la duración, cuadro clave cada 2 s) y deja `clips/pruebas/<uid>/<prueba>/<letra>.mp4` + `<letra>.json`
   (`clips/` se lee sin credenciales: así lo baja Instagram y lo mira el reloj, sin llaves nuevas). Sin texto, copia el video
   sin volver a comprimir. Un video HDR (iPhone, tal cual) se rechaza por ahora. Al terminar la prueba (o al cancelarla) se
   llama con `modo:'borrar'`: Instagram ya tiene su copia. Medido: un video de 76 s tarda ~40 s; sin texto, 1 s.
   ⚠️ El usuario de AWS del servidor (`carrete-servidor`) solo enciende las Lambdas de su lista
   (`solo-lo-que-usa-el-servidor`): `cherry-pruebas-ab` se agregó el 23-oct.
4. **Publicar** es el reloj de siempre: cada versión es una fila de `publicaciones_programadas` (REELS,
   `opciones: { prueba:'MANUAL', ab, ab_letra }`, `master_estado:'no'`) que publica `ig-publicar`.
5. **La ganadora** es la de **menos omisión** (`reels_skip_rate`: cuántos de cada 100 pasaron de largo, justo lo que mide un
   gancho). A menos de 2 puntos, desempata el tiempo medio visto. Si alguna versión tiene menos de 200 vistas a las 48 h, se
   espera **un día más, una sola vez**; si siguen pocas, se dice igual pero «tómalo como una pista».
6. **El aviso**: la tarjeta de la prueba dice «Ganó la B», por qué, «Abrir la B en Instagram» y «Ya la pasé a mi perfil».
   En el resto de Cherry (`js/cuenta.js` › `mirarPruebas`, solo administradores): un punto amarillo sobre el ícono de la
   barra y, una vez por prueba, «Tu prueba A/B … terminó: ganó la B». No hay correos: Cherry no tiene servicio de correo.
7. **El reloj**: `pruebas-ab-reloj` (pg_cron, cada 5 min, SOLO si hay alguna prueba andando) llama `accion:'reloj'` con la
   llave del reloj de ig-publicar.
8. **Desde el Editor**: con el video listo, «Hacer una prueba A/B con este video ›» (`js/fabricar.js`, solo administradores)
   abre `pruebas.html?nuevo=<proyecto>` con ese video ya escogido.

## «✦ Que Cherry los proponga»
`accion:'proponer'` lee lo que se dice en el video (las palabras de su render) y pide a gpt-5-mini (respaldo gpt-4o-mini)
2 o 3 textos de 3 a 9 palabras, **cada uno de un tipo de gancho distinto** (los nueve de `herramientas.ts › GANCHO_DEF`), sin
nada que el video no diga, sin «frases de valla». Cuesta del orden de US$0,002 por vez.
⏳ **Créditos**: hoy no se cobra nada; Sergio decide cuánto cuesta una prueba.

## Para mirarla sin cuenta
`herramientas/_demo-pruebas.html` con `_stub-pruebas.js` (videos reales públicos, pruebas inventadas, nada gasta). Sin
seguimiento; nunca se publica.
