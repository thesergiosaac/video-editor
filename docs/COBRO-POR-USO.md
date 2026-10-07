# El cobro por uso y los topes (6-oct-2026)

Fases 3 y 4 del plan del martes (aprobado por Sergio el 5-oct, memoria `cherry-optimizar-y-cobrar`). Hasta el 6-oct
nadie descontaba créditos: la página los mostraba y nada más.

## El interruptor
`cherry_ajustes` › `cobro`:
- **'contar'** (hoy, con la venta cerrada): todo se apunta en `usos` con lo que costaría, pero NO se descuenta ni se
  bloquea nada. Así el revisor de Meta y las cuentas de prueba siguen igual, y hay datos reales de uso.
- **'cobrar'** (al abrir la venta): se descuenta y, si no alcanza, el servidor contesta `sin_creditos` (402) y no hace
  nada. Prende también el tope de 3 minutos y el cupo del historial.
```sql
update cherry_ajustes set valor = '"cobrar"', actualizado = now() where clave = 'cobro';
```
El administrador (`administradores`) nunca paga ni tiene topes.

## La escalera (tabla `planes`)
| Plan | Videos al mes | Créditos al mes |
|---|---|---|
| Gratis | 1 de bienvenida (con todo), una vez | 0 |
| Basic (US$19) | 15 | 30 |
| Creator (US$49) | 30 | 120 |
| Studio (US$149) | 100 | 350 |
Paquetes: 60 / 150 / 400 créditos por US$15 / 30 / 75. Voz de estudio incluida siempre.

## Qué cuesta y quién lo cobra
| Uso | Créditos | Dónde | Llave (no cobra dos veces) |
|---|---|---|---|
| Video del mes (dentro del cupo) | 0 | orchestrate v258 › `cobrar_fabricacion` | `video:<proyecto>:<mes>` |
| Video más allá del cupo | 10 | orchestrate | `video:<proyecto>:<mes>` |
| Fabricar por 3.ª vez o más (proyecto, mes) | 1 | orchestrate | `fab:<proyecto>:<firma de la versión>` |
| Gráficos en un video | 10 | orchestrate | `graf:<proyecto>:<mes>` |
| Recorte de tu silueta (te sales / tú delante / look Selectivo) | 3 | orchestrate | `recorte:<proyecto>:<mes>` |
| Guion premium | 10 | guion-calco › escribir | `calco:<uuid>` |
| Storyboard (hoja de 2+ escenas) | 5 | sb-vineta | `sb:<uuid>` |
| Carrusel con IA (dirigir / desde un video) | 2 | carruseles | `carrusel:<uuid>` |
| Un reel del historial desmontado | 0 (gasta del cupo de videos) | historial › avanzar | `hist:<ig_media_id>` |
| Una respuesta automática con IA | 0 (escudo de 3.000 al mes) | ig-aviso | `resp:<uuid>` |
En el video de bienvenida de Gratis, gráficos y recorte van incluidos. Lo que se cobra antes de gastar en un modelo
(guion, storyboard, carrusel) se devuelve si falla (`devolver_uso`, a la bolsa «extra»). Se gasta primero lo del plan.
Volver a dibujar UNA escena suelta del storyboard no cuesta (decisión mía: Sergio puede ponerle precio).

## Los topes
- **3 minutos por video** (con 'cobrar'): orchestrate contesta `tope_3_min` y la página lo explica antes de fabricar.
- **Escudo de IA** (siempre, menos el administrador): pasadas 3.000 respuestas con IA en el mes, la cuenta responde
  con su texto fijo (`escudo_ia`).
- **Historial** (con 'cobrar'): cada reel desmontado cuenta como un video del mes; lleno el cupo, espera al mes siguiente.

## Ver lo que se apunta
```sql
select que, count(*), sum(creditos) as costaria, sum(creditos) filter (where cobrado) as cobrado
from usos where creado > now() - interval '30 days' group by que order by 2 desc;
```
La vista `mis_usos_mes` le dice a cada cuenta cuántos videos lleva este mes.
