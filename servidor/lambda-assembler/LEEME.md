# carrete-assembler — el ensamblador (Lambda de Amazon)

Arma el video final: color, movimiento, escenas, gráficos, sonidos, voz de estudio y subtítulos, en pedazos.
Hasta el 6-oct-2026 este código vivía SOLO en Amazon; aquí está la copia del que se desplegó ese día.

- Entrada: `carrete-assembler-v1.handler` (Node 20, 3008 MB, 900 s). Variables: `REMOTION_SITIO`, `SUPABASE_URL`,
  `SUPABASE_KEY` (las llaves viven en Amazon, nunca aquí).
- Librerías que NO están aquí: `node_modules/@remotion/lambda-client` y `@napi-rs/canvas` (+ `canvas-linux-x64-gnu`).
  El SDK de Amazon (`@aws-sdk/*`) lo pone el entorno de Lambda.

## Desplegar
1. Bajar el paquete desplegado (`aws lambda get-function --function-name carrete-assembler` → `Code.Location`) y
   descomprimirlo: trae los `node_modules`. GUARDAR ese zip para poder volver atrás.
2. Cambiar los `.js` y comprobar que cargan (`node -e "require('./premium.js')"` con las librerías simuladas).
3. Comprimir con los archivos en la raíz y `aws lambda update-function-code --zip-file fileb://…`.
4. Probar que arranca sin tocar ningún video: invocar con `{"render_id":"00000000-0000-4000-8000-000000000000"}` →
   debe terminar en «render row not found» (sin «sin cliente de S3» ni errores al cargar).
5. Copiar aquí los `.js` y subirlos.

## 6-oct-2026 — la caché de los gráficos (premium.js)
Cada capa de Remotion tiene una huella de todo lo que la define (datos, color, tamaño, cuadros, sitio, códec). Al
terminar se copia a `cache/premium/<huella>.webm` del depósito `remotionlambda-useast1-editorvideo` y se borra lo que
dejó Remotion en `renders/<id>/`. Si otra fabricación pide una capa con la misma huella, se usa la guardada (en el
registro sale «♻»). Cambiar de sitio (`REMOTION_SITIO`) cambia todas las huellas: nunca sale una capa vieja.
De paso: `orden` de las capas había quedado dentro de un comentario (desde el 30-sep) y el fondo y el contenido de
algunos gráficos se apilaban al azar.

## 6-oct-2026 — la limpieza (limpieza.js) y R2 (r2.js)
- `modo: 'limpieza'`: recorre `renders/`, `uploads/` y `clips/` y decide archivo por archivo con las reglas de
  `servidor/sql/21-limpieza.sql` (R1 intermedios, R2 versiones viejas, R3 originales a los 15 días, R4 abandonados, R5
  tope de GB). Con el interruptor `cherry_ajustes › limpieza` en 'ensayo' NO borra nada: deja el informe en
  `limpieza_informes`. `modo_forzado` sirve para una corrida a mano. Lo dispara la función `limpieza` (pg_cron diario).
- `r2.js`: con `R2_ACTIVO=si` y las llaves de Cloudflare, el video terminado se sube también a R2 con la misma ruta y
  la base guarda esa dirección. Apagado (sin variables) no hace nada.

## 7-oct-2026 — la voz de la vista previa y el recorte más rápido
- `modo: 'voz'` (`vozVista`): baja la base liviana de la fila (`vista_base` si es un master), la pasa por `voz.js ›
  preparar` (Auphonic, con su caché por huella en `voz/estudio/`), la deja en `renders/<id>/voz_<huella8>.m4a` (público)
  y escribe `renders.voz_estudio = { estado, vista, retardo, efectos_db, huella, reutilizada }`. Lo pide orchestrate
  (`preparar_voz`).
- `silueta.js`: tramos de 4 s (`TRAMO`, antes 12) y `desdeVista`: la silueta del master sale de la de su base liviana,
  cada corte estirado a su duración real (`vista_duraciones` → `duraciones_reales`). Si no se puede, recorta como antes.
- La voz del master (`vozDesdeVista` + `voz.js › acomodar`): baja la base liviana, `preparar` la encuentra hecha por
  su huella (o la procesa / espera la que va en camino) y cada corte se toma con `-ss/-t` a la entrada y se deja del
  largo del master (`apad` + `-t`). UNA pasada de Auphonic por video. Prueba local: `scratchpad/asm/prueba_voz`.

## 8-oct-2026 — la voz de las tomas hechas a mano (editor Manual)
- Una base de tomas a mano (`subtitle_config.mano = { de, tramos }`, la crea orchestrate v260 `recortar_base`) tiene
  otro sonido, otra huella: sin esto cada recorte volvía a pasar por Auphonic. `vozVista` primero llama a
  `voz.js › desdeOtra`: si la base de donde salen las tomas (`de`) ya tiene su voz de estudio lista, corta cada tramo
  (segundos de esa base, con su retardo) y lo deja del largo real que tiene en la nueva (`duraciones_reales`), y lo guarda
  con la huella de la base nueva. Después `preparar` la encuentra hecha (la vista previa y el master). Sin Auphonic.
  Prueba local con ffmpeg y S3 de mentira: `scratchpad/asm/probar_voz_mano.js` (tonos por segundo: salen los de cada tramo).

## 8-oct-2026 — gráficos movidos en el editor Manual
`graficos.js › corrimiento(p, W, H)`: un momento con `pos` = {x, y} (partes del ancho y el alto; solo formas `encima` y
`profundo`) corre su capa: `capa.js` (clásico) y `premium.js` (overlay x/y). `elegir` pasa `pos` y `editado` a la pieza.
En `premium.js` el `pos` NO entra en las props de Remotion (la huella de la caché no cambia al moverlo). Respaldo del
paquete anterior: scratchpad › ensamblador › respaldo_20261008_antes_mover.zip.
Mismo día, más tarde: también el TAMAÑO (`pos.s`, `graficos.js › colocar`): la capa se escala a su caja y el vidrio se
recorta del video detrás de la caja nueva (con `pad` si se sale del cuadro). Sin `pos`, los filtros son idénticos a los de
antes. Respaldo: el paquete anterior a este cambio es nuevo_20261008_mover.zip (scratchpad › ensamblador).
