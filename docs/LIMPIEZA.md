# Borrar lo viejo en Amazon (6-oct-2026)

Fase 5 del plan del martes: el camino A de «guardado» que aprobó Sergio el 5-oct. El 6-oct el depósito
`remotionlambda-useast1-editorvideo` tenía **120 GB** (renders 62, originales subidos 51, copias livianas 7) y crecía
solo: nada se borraba nunca.

## Cómo funciona
- `servidor/sql/21-limpieza.sql`: el interruptor, la marca `projects.originales_borrados`, `limpieza_informes` y
  `limpieza_datos()` (todo lo que hay que conservar, en una consulta).
- `servidor/lambda-assembler/limpieza.js`: el ensamblador en `modo: 'limpieza'` recorre `renders/`, `uploads/` y `clips/`
  y decide archivo por archivo. Deja un informe por corrida.
- `servidor/limpieza.ts` + `sql/22-limpieza-reloj.sql`: pg_cron la dispara todos los días a las 3:30 a. m. (Colombia).

## Las reglas
| | Qué | A quién |
|---|---|---|
| R1 | Intermedios: pedazos de corte (`seg_*`, `master_*`), capas de Remotion ya usadas, recortes ya montados, renders fallidos (7 días), archivos sin dueño y originales de clips que se quitaron | A todos |
| R2 | Versiones viejas: de cada proyecto se queda el último master, el último video, la última base y lo que esté en marcha | A todos |
| R3 | Originales, copias livianas, recortes y bases 15 días después de la última fabricación (Gratis 3); se queda el video terminado | No al administrador |
| R4 | Proyectos que nunca se fabricaron y llevan 7 días sin tocarse | No al administrador |
| R5 | Tope por cuenta: 20 / 50 / 150 GB (Basic / Creator / Studio; Gratis 5) → R3 empezando por lo más viejo | No al administrador |
Nunca se toca: lo programado en Instagram ni lo que esté en el Calendario, las miniaturas, las grabaciones de pantalla,
las láminas de carruseles, las miniaturas del historial ni lo subido desde el Calendario.

## El interruptor (`cherry_ajustes › limpieza`)
- **'ensayo'** (como está): calcula y deja el informe; no borra nada.
- **'intermedios'**: borra R1 y R2; R3–R5 siguen en ensayo.
- **'borrar'**: todo.
```sql
update cherry_ajustes set valor = '"intermedios"', actualizado = now() where clave = 'limpieza';
select creado, modo, resumen->'reglas', detalle->'cuentas' from limpieza_informes order by id desc limit 1;
```

## El primer ensayo (6-oct, en el depósito de verdad, sin borrar nada)
De 120,35 GB, se podrían borrar **94,12 GB**: R1 67,23 GB (originales de clips quitados 37,09 · intermedios 21,10 ·
capas de Remotion 4,74 · renders fallidos 3,44 · renders sin dueño 0,85), R2 versiones viejas 25,65 GB y R3 1,23 GB
(una cuenta Gratis). Quedarían ~26 GB. Tu cuenta: 74 GB hoy → 24 GB.

## ⚠️ Falta un permiso para que corra sola
Las llaves de Amazon que usa el servidor (usuario `carrete-servidor`, política `solo-lo-que-usa-el-servidor`) solo
pueden invocar `carrete-media-processor`, `carrete-layer2` y `carrete-graphics`. Para la limpieza diaria hay que agregar
`carrete-assembler` a esa lista (lo decide Sergio: es un permiso de su cuenta). Mientras tanto el reloj llama y Amazon
contesta 403 (no pasa nada). A mano se corre con:
`aws lambda invoke --function-name carrete-assembler --payload '{"modo":"limpieza","modo_forzado":"ensayo"}' …`

## En la página
Un proyecto con `originales_borrados` abre con el video terminado en el celular y la franja «Queda el video terminado»
(Descargar y Publicar; ya no se puede volver a editar).

## Pendiente
- El correo «tu video se borra en 2 días» para R4 (cuando cherrysweet.app tenga envío de correo).
- La huella anti-duplicados (un clip subido dos veces se guarda una vez): toca la subida; va con prueba propia.
- La alarma de gasto de US$20 en Amazon (pide el correo al que debe llegar).
