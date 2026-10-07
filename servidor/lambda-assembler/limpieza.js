/* limpieza.js — BORRAR LO VIEJO EN AMAZON (6-oct-2026, fase 5 del plan del martes; reglas en servidor/sql/21-limpieza.sql).
 *
 * El ensamblador lo corre en modo 'limpieza' una vez al día (lo dispara la función `limpieza` desde pg_cron). Lee de la
 * base TODO lo que hay que conservar (limpieza_datos), recorre el depósito y decide archivo por archivo:
 *   R1 intermedios (a todos) · R2 versiones viejas (a todos) · R3 originales 15 días después de fabricar (Gratis 3; no
 *   al administrador) · R4 abandonados 7 días sin fabricar (no al administrador) · R5 tope de GB por cuenta.
 * Con el interruptor en 'ensayo' NO borra nada: deja el informe (limpieza_informes) con lo que borraría. En
 * 'intermedios' borra R1 y R2. En 'borrar', todo. Lo programado o puesto en el Calendario nunca se toca.
 * (6-oct) Nada se borra de una: se MUEVE a `papelera/<fecha>/…` y Amazon la vacía a los 7 días (regla del depósito).
 * Se protege todo archivo que nombre una herramienta, una pantalla o un video que se conserva (la base de un video rápido
 * o de un master vive en la carpeta de OTRO render).
 */
var DIA = 86400000;
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/* lo que solo sirve mientras se arma el video (el ensamblador ya lo usó y no lo vuelve a leer) */
var INTERMEDIO = /^(seg_\d+\.mp4|master_\d+\.mp4|layer1_raw\.mp4|graphics\.mp4|scene_clip_\d+\.mp4|preview\.mp4|base\.mp4|persona_\d+\.webm|\d+\.mp4|.*\.part)$/;
var TOPE_GB = { gratis: 5, basico: 20, creador: 50, estudio: 150 };
var DIAS_ORIGINALES = { gratis: 3 };   // los demás, 15

async function listar(ctx, prefijo) {
  var out = [], token;
  do {
    var r = await ctx.s3Client.send(new ctx.S3Mod.ListObjectsV2Command({ Bucket: ctx.BUCKET, Prefix: prefijo, ContinuationToken: token, MaxKeys: 1000 }));
    (r.Contents || []).forEach(function (o) { out.push({ key: o.Key, size: Number(o.Size) || 0, fecha: new Date(o.LastModified).getTime() }); });
    token = r.IsTruncated ? r.NextContinuationToken : null;
  } while (token);
  return out;
}

/* A la papelera: copiar a papelera/<fecha>/<clave> y después borrar el original. Solo se borra lo que se copió bien. */
async function aLaPapelera(ctx, claves) {
  var dia = new Date().toISOString().slice(0, 10), copiadas = [], cola = claves.slice();
  async function trabajador() {
    while (cola.length) {
      var k = cola.shift();
      try {
        await ctx.s3Client.send(new ctx.S3Mod.CopyObjectCommand({ Bucket: ctx.BUCKET, Key: 'papelera/' + dia + '/' + k,
          CopySource: encodeURIComponent(ctx.BUCKET + '/' + k).replace(/%2F/g, '/') }));
        copiadas.push(k);
      } catch (e) { console.log('[Limpieza] no se pudo mover ' + k + ': ' + String(e && e.message || e).slice(0, 120)); }
    }
  }
  var hilos = []; for (var h = 0; h < 24; h++) hilos.push(trabajador());
  await Promise.all(hilos);
  var hechas = 0;
  for (var i = 0; i < copiadas.length; i += 1000) {
    var lote = copiadas.slice(i, i + 1000);
    var r = await ctx.s3Client.send(new ctx.S3Mod.DeleteObjectsCommand({ Bucket: ctx.BUCKET, Delete: { Objects: lote.map(function (k) { return { Key: k }; }), Quiet: true } }));
    hechas += lote.length - ((r && r.Errors) || []).length;
    if (r && r.Errors && r.Errors.length) console.log('[Limpieza] ' + r.Errors.length + ' no se borraron: ' + JSON.stringify(r.Errors.slice(0, 3)));
  }
  return { hechas: hechas, movidas: copiadas };
}

async function correr(ctx, ev) {
  var t0 = Date.now(), ahora = Date.now();
  var d = await ctx.db('POST', '/rest/v1/rpc/limpieza_datos', {});
  if (!d || !d.renders) throw new Error('limpieza_datos no respondió: ' + JSON.stringify(d).slice(0, 200));
  var modo = (ev && ev.modo_forzado) || d.modo || 'ensayo';
  var admins = {}; (d.admins || []).forEach(function (u) { admins[u] = true; });
  var planDe = function (u) { return (d.planes || {})[u] || 'gratis'; };
  var proyectos = {}; (d.proyectos || []).forEach(function (p) { proyectos[p.id] = p; });
  var renders = {}, porProyecto = {};
  (d.renders || []).forEach(function (r) { r.t = Date.parse(r.c); renders[r.id] = r; (porProyecto[r.p] = porProyecto[r.p] || []).push(r); });
  var aClave = function (u) { try { return decodeURIComponent(String(u || '').replace(/^https?:\/\/[^/]+\//, '').split('?')[0]); } catch (e) { return String(u || ''); } };
  var refs = (d.referencias || []).join(' ');
  var referido = function (id) { return refs.indexOf(id) >= 0; };
  var protegidas = {};
  (d.referencias || []).forEach(function (u) { if (u) protegidas[aClave(u)] = true; });

  /* lo que se queda de cada proyecto: el último master hecho, el último video hecho, la última base, lo que está en
     marcha y lo referido (programado / Calendario) */
  var queda = {}, ultimaFab = {};
  Object.keys(porProyecto).forEach(function (pid) {
    var rs = porProyecto[pid].slice().sort(function (a, b) { return b.t - a.t; });
    var m = rs.find(function (r) { return r.st === 'done' && r.master; });
    var v = rs.find(function (r) { return r.st === 'done' && !r.master && !r.base; });
    var b = rs.find(function (r) { return r.st === 'base'; });
    [m, v, b].forEach(function (r) { if (r) queda[r.id] = true; });
    rs.forEach(function (r) { if (['rendering', 'assembling', 'processing', 'queued', 'pending'].indexOf(r.st) >= 0 && ahora - r.t < 3 * DIA) queda[r.id] = true; if (referido(r.id)) queda[r.id] = true; });
    // lo que nombran los que se quedan (su base puede estar en la carpeta de otro render) se queda
    rs.forEach(function (r) { if (queda[r.id]) (r.urls || []).forEach(function (u) { if (u) protegidas[aClave(u)] = true; }); });
    var hecho = rs.find(function (r) { return r.st === 'done' && !r.base; });
    ultimaFab[pid] = m ? m.t : (hecho ? hecho.t : null);
  });

  /* cada archivo de clips/ y uploads/, de qué clip (y de qué proyecto) es: por la CARPETA del clip
     (clips/<8 primeros del id>/… y uploads/<…>/<id del clip>/…), así entran también su miniatura y lo que se
     guarde al lado. Las miniaturas se guardan como dirección completa: se pasan a clave. */
  var porId8 = {}, porId = {}, miniaturas = {};
  (d.clips || []).forEach(function (c) {
    porId[c.id] = c; porId8[String(c.id).slice(0, 8)] = c;
    if (c.mini) miniaturas[aClave(c.mini)] = true;
  });

  var objetos = [].concat(await listar(ctx, 'renders/'), await listar(ctx, 'uploads/'), await listar(ctx, 'clips/'));
  var plan = [];          // { key, size, regla, user, proyecto }
  var bytesUser = {};
  var duenoDe = function (o) {
    var partes = o.key.split('/');
    if (partes[0] === 'renders' && UUID.test(partes[1] || '')) { var r = renders[partes[1]]; var p = r && proyectos[r.p]; return { p: r && r.p, user: p && p.user, r: r, archivo: partes.slice(2).join('/') }; }
    if (partes[0] === 'renders') return { remotion: true, archivo: partes.slice(2).join('/') };
    /* solo las carpetas con forma de CLIP (clips/<8 del id>/… y uploads/<proyecto>/<id del clip>/…). Lo demás —pantallas,
       carruseles, historial, lo subido desde el Calendario— no es de un clip y aquí no se toca. */
    var esCarpetaClip = (partes[0] === 'clips' && /^[0-9a-f]{8}$/.test(partes[1] || '') && partes.length > 2) ||
      (partes[0] === 'uploads' && UUID.test(partes[1] || '') && UUID.test(partes[2] || '') && partes.length > 3);
    if (!esCarpetaClip) {
      var pp = partes[0] === 'uploads' && proyectos[partes[1]];      // uploads/<proyecto>/pantallas/…: de ese proyecto
      return { fuera: true, p: pp ? pp.id : null, user: pp ? pp.user : null };
    }
    var c = partes[0] === 'clips' ? porId8[partes[1]] : porId[partes[2]];
    var pc = c && proyectos[c.p];
    return { p: c && c.p, user: (c && c.user) || (pc && pc.user), clip: c };
  };

  objetos.forEach(function (o) {
    var ed = ahora - o.fecha, x = duenoDe(o);
    o.x = x;
    if (x.user) bytesUser[x.user] = (bytesUser[x.user] || 0) + o.size;
    if (referido(o.key) || protegidas[o.key]) return;
    if (o.key.indexOf('renders/') === 0) {
      if (x.remotion) { if (ed > 2 * DIA) plan.push({ key: o.key, size: o.size, regla: 'R1 capas de Remotion ya usadas' }); return; }
      if (!x.r) { if (ed > 7 * DIA) plan.push({ key: o.key, size: o.size, regla: 'R1 render sin dueño' }); return; }
      var r = x.r;
      if (r.st === 'error' && ed > 7 * DIA) { plan.push({ key: o.key, size: o.size, regla: 'R1 render fallido', user: x.user, p: x.p }); return; }
      if (INTERMEDIO.test(x.archivo) && ['done', 'base', 'error'].indexOf(r.st) >= 0 && ed > 2 * DIA) { plan.push({ key: o.key, size: o.size, regla: 'R1 intermedio', user: x.user, p: x.p }); return; }
      if (!queda[r.id] && (r.st === 'done' || r.st === 'base') && ed > 3 * DIA) { plan.push({ key: o.key, size: o.size, regla: 'R2 versión vieja', user: x.user, p: x.p }); return; }
      return;
    }
    // uploads/ y clips/: el archivo de un clip que ya no existe (se quitó del proyecto o se borró el proyecto)
    if (x.fuera) return;
    if (!x.clip) { if (ed > 7 * DIA && !miniaturas[o.key]) plan.push({ key: o.key, size: o.size, regla: 'R1 archivo de un clip quitado' }); }
  });

  /* R3 / R4 / R5 por proyecto (nunca al administrador ni a un proyecto ya borrado) */
  var porProyectoObj = {};
  objetos.forEach(function (o) { if (o.x && o.x.p) (porProyectoObj[o.x.p] = porProyectoObj[o.x.p] || []).push(o); });
  var yaEnPlan = {}; plan.forEach(function (q) { yaEnPlan[q.key] = true; });
  var originalesDe = function (pid, regla) {
    var lista = [];
    (porProyectoObj[pid] || []).forEach(function (o) {
      if (yaEnPlan[o.key] || referido(o.key) || protegidas[o.key] || o.x.fuera) return;      // las pantallas siguen con el proyecto
      // del video terminado (el último master, o el último video si no hay master) se queda su salida
      if (o.x.r && queda[o.x.r.id] && !o.x.r.base && /^output|^layer2/.test(o.x.archivo || '')) return;
      if (miniaturas[o.key]) return;
      lista.push({ key: o.key, size: o.size, regla: regla, user: o.x.user, p: pid });
    });
    return lista;
  };
  var marcarOriginales = [], marcarAbandonados = [];
  Object.keys(proyectos).forEach(function (pid) {
    var p = proyectos[pid];
    if (!p.user || admins[p.user] || p.borrado || p.originales_borrados) return;
    var dias = DIAS_ORIGINALES[planDe(p.user)] || 15;
    var act = Date.parse(p.actividad || 0) || 0;
    if (ultimaFab[pid] && ahora - ultimaFab[pid] > dias * DIA && ahora - act > dias * DIA) {
      var l = originalesDe(pid, 'R3 originales (' + dias + ' días)');
      if (l.length) { plan = plan.concat(l); marcarOriginales.push(pid); l.forEach(function (q) { yaEnPlan[q.key] = true; }); }
    } else if (!ultimaFab[pid] && ahora - act > 7 * DIA && (porProyectoObj[pid] || []).length) {
      var l2 = originalesDe(pid, 'R4 abandonado (7 días sin fabricar)');
      if (l2.length) { plan = plan.concat(l2); marcarAbandonados.push(pid); l2.forEach(function (q) { yaEnPlan[q.key] = true; }); }
    }
  });
  // R5: el tope de espacio por cuenta (lo que queda después de lo anterior), empezando por lo más viejo ya fabricado
  var quedaUser = {}; Object.keys(bytesUser).forEach(function (u) { quedaUser[u] = bytesUser[u]; });
  plan.forEach(function (q) { if (q.user) quedaUser[q.user] -= q.size; });
  Object.keys(quedaUser).forEach(function (u) {
    if (admins[u]) return;
    var tope = (TOPE_GB[planDe(u)] || 5) * 1e9;
    if (quedaUser[u] <= tope) return;
    var suyos = Object.keys(proyectos).filter(function (pid) { var p = proyectos[pid]; return p.user === u && ultimaFab[pid] && !p.originales_borrados && marcarOriginales.indexOf(pid) < 0; })
      .sort(function (a, b) { return ultimaFab[a] - ultimaFab[b]; });
    for (var i = 0; i < suyos.length && quedaUser[u] > tope; i++) {
      var l3 = originalesDe(suyos[i], 'R5 tope de ' + (tope / 1e9) + ' GB');
      l3.forEach(function (q) { quedaUser[u] -= q.size; yaEnPlan[q.key] = true; });
      plan = plan.concat(l3); marcarOriginales.push(suyos[i]);
    }
  });

  /* el informe */
  var resumen = { modo: modo, objetos: objetos.length, bytes_total: objetos.reduce(function (a, o) { return a + o.size; }, 0), reglas: {} };
  plan.forEach(function (q) { var k = q.regla.split(' ')[0]; var g = resumen.reglas[k] = resumen.reglas[k] || { archivos: 0, bytes: 0, que: {} }; g.archivos++; g.bytes += q.size; g.que[q.regla] = (g.que[q.regla] || 0) + q.size; });
  resumen.bytes_borrables = plan.reduce(function (a, q) { return a + q.size; }, 0);
  var gb = function (b) { return Math.round(b / 1e7) / 100; };
  var detalle = {
    cuentas: Object.keys(bytesUser).map(function (u) { return { user: u, gb: gb(bytesUser[u]), queda_gb: gb(quedaUser[u] || 0), plan: planDe(u), admin: !!admins[u] }; }).sort(function (a, b) { return b.gb - a.gb; }),
    originales: marcarOriginales, abandonados: marcarAbandonados,
    muestra: plan.slice(0, 40).map(function (q) { return q.regla + ' · ' + q.key + ' · ' + gb(q.size) + ' GB'; }),
  };

  var borrables = plan.filter(function (q) { return modo === 'borrar' || (modo === 'intermedios' && /^R[12] /.test(q.regla)); });
  var borradas = 0, movidas = [];
  if (borrables.length) {
    var mv = await aLaPapelera(ctx, borrables.map(function (q) { return q.key; }));
    borradas = mv.hechas; movidas = mv.movidas;
    if (modo === 'borrar') {
      var cuando = new Date().toISOString();
      for (var j = 0; j < marcarOriginales.length; j++) await ctx.db('PATCH', '/rest/v1/projects?id=eq.' + marcarOriginales[j], { originales_borrados: cuando });
      for (var k2 = 0; k2 < marcarAbandonados.length; k2++) await ctx.db('PATCH', '/rest/v1/projects?id=eq.' + marcarAbandonados[k2], { borrado_en: cuando });
    }
  }
  resumen.borrados = borradas;
  var setMov = {}; movidas.forEach(function (k) { setMov[k] = true; });
  resumen.bytes_borrados = borrables.filter(function (q) { return setMov[q.key]; }).reduce(function (a, q) { return a + q.size; }, 0);
  if (movidas.length) resumen.papelera = 'papelera/' + new Date().toISOString().slice(0, 10) + '/ (se vacía sola a los 7 días)';
  resumen.segundos = Math.round((Date.now() - t0) / 1000);
  await ctx.db('POST', '/rest/v1/limpieza_informes', { modo: modo, resumen: resumen, detalle: detalle });
  console.log('[Limpieza] ' + modo + ': ' + objetos.length + ' archivos (' + gb(resumen.bytes_total) + ' GB); borrables ' + plan.length + ' (' + gb(resumen.bytes_borrables) + ' GB); borrados ' + borradas);
  return { ok: true, resumen: resumen };
}

module.exports = { correr: correr };
