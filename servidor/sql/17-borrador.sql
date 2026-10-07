-- 17 (6-oct-2026) — FABRICAR SOLO AL FINAL. Sergio: «todo en el navegador, una vista previa que solo se renderiza al
-- final para consumir menos». El editor ya no fabrica un video cada vez que algo cambia, así que lo que la persona deja
-- puesto (color, plantilla, gráficos, escenas, sonidos, voz, ritmo de los cortes…) tiene que vivir en algún lado aunque
-- no haya video: el BORRADOR del proyecto. Lo escribe la página (js/fabricar.js › guardarBorrador) unos segundos después
-- de cada cambio y lo lee al abrir el proyecto (manda sobre la configuración del último video fabricado si es más nuevo).
-- Las políticas de projects ya dejan a cada quien cambiar solo sus proyectos (cambiar el nombre usa la misma).
alter table public.projects add column if not exists borrador jsonb;
alter table public.projects add column if not exists borrador_en timestamptz;
