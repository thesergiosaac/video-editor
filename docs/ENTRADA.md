# La entrada a Cherry (30-oct-2026)

Dos pantallas con todo a la vista (31-oct): **Entrar** (correo y contraseña) y **Crear cuenta** (nombre, correo y contraseña); al entrar, Cherry revisa el correo y sigue el camino que toque. Colores claros del inicio y de fondo el mármol en partículas (`assets/inicio/entrar-marmol.webp`); guardado sin usar: `entrar-escultura.webp`. (`js/components/login.js`, función `servidor/cuenta-entrada.ts`, tablas en `servidor/sql/30-registro.sql`).

| El correo… | Sigue |
|---|---|
| tiene cuenta | contraseña, con «¿Olvidaste tu contraseña?» (código por correo) |
| no tiene cuenta | nombre y contraseña; un código de 6 números confirma el correo |
| la abrimos por dentro | crear su contraseña (primer ingreso, función `primer-ingreso`) |
| entró con Google | el botón de Google, o crear una contraseña con el código |

- **Cerrado hasta lanzar:** `cherry_ajustes › registro` = `"cerrado"`; la pantalla dice «Cherry abre muy pronto». `registro_prueba` = lista de correos que sí pueden registrarse antes.
- **Google:** lo atiende Supabase. El botón solo sale si está prendido en el servidor (`/auth/v1/settings`). Con «registros nuevos» apagado en Supabase, entra quien ya tiene cuenta y a los demás se les dice que abre pronto.
- **Correos:** Resend, secreto `RESEND_API_KEY`, desde `hola@cherrysweet.app`. Nunca el correo de Cobra. Código: 10 minutos, 5 intentos, uno cada 45 s, 12 correos por hora desde el mismo sitio, 500 al día.

## Para abrir el día del lanzamiento
```sql
update cherry_ajustes set valor = '"abierto"', actualizado = now() where clave = 'registro';
```
y prender «Allow new users to sign up» en Supabase (hace falta para las cuentas nuevas con Google).

## Crear cuenta: las tres imágenes (31-oct)

Cada recarga muestra una distinta de la anterior (`localStorage › cherry-registro-version` guarda la última): `periodico`, `portatil` o `particulas` (`assets/inicio/registro-*.webp`). Abajo va la franja con las herramientas (`HERRAMIENTAS` en `js/components/login.js`). `app?crear` abre directo Crear cuenta.
La tabla `registro_versiones` cuenta `vistas` (una cada vez que se abre la página) y `registros` (correo confirmado, o cuenta nueva con Google). Se decide con esos números qué imagen se queda.
