-- (30-sep-2026) Respuestas automáticas: el estado «aclarar» de ejecuciones_flujo.
-- Una respuesta con IA y `d.pregunta` (p. ej. «de qué tema crea contenido») primero mira si el comentario responde lo que
-- se preguntó. Si no («piedra», «tabla», «hola»), le pide en público que aclare y el flujo NO sigue: la ejecución queda en
-- «aclarar» y su próximo comentario arranca el flujo de nuevo (servidor/ig-aviso.ts › yaPidioAclarar). No es «recibió».
create or replace view public.mis_flujos_resumen with (security_invoker = true) as
  select f.id as flujo_id, f.user_id,
         (select count(*) from public.ejecuciones_flujo e where e.flujo_id = f.id and e.estado not in ('fallida', 'aclarar')) as enviados,
         (select count(*) from public.ejecuciones_flujo e where e.flujo_id = f.id and e.estado = 'fallida') as fallidos,
         (select coalesce(sum(l.clics), 0) from public.enlaces_flujo l where l.flujo_id = f.id) as clics,
         (select max(creada) from public.ejecuciones_flujo e where e.flujo_id = f.id) as ultima
    from public.flujos_respuesta f;
grant select on public.mis_flujos_resumen to authenticated;
