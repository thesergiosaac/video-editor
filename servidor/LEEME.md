# El servidor de Cherry

Aquí vive el código de las funciones del servidor (Edge Functions de Supabase) y las
migraciones de la base. **No se despliega desde aquí**: se despliega por la API de Supabase.
Esto es la copia buena, la que manda.

⚠️ **Esto empezó a estar versionado el 23-sep-2026** y por poco. Hasta ese día el código vivía
solo en una carpeta temporal de sesión: `herramientas.ts` estaba 580 líneas atrasado aquí y once
funciones no estaban en absoluto. Si aquella carpeta se hubiera limpiado, lo único recuperable
habría sido lo que devuelve Supabase — y ese endpoint **trunca la primera línea** de cada
archivo. Las migraciones no se habrían recuperado de ninguna forma.

**Regla: cada vez que se despliegue algo, se copia aquí y se sube.**

## Qué hay

- `*.ts` — una por función. El nombre del archivo es el nombre de la función.
- `base/*.sql` — las migraciones, en el orden en que se aplicaron.

## Lo que NO está aquí, y no debe estar

Las llaves. Viven en los secretos del proyecto de Supabase y se leen con
`Deno.env.get('NOMBRE')`. Ninguna llave se escribe en un archivo.
