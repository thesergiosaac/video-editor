/* pagos.js — «Tu plan», los créditos y el cobro con Paddle (3-oct-2026, forma C que escogió Sergio).
 *
 * Una sola puerta para todo lo de pagar: CherryPagos.abrir() abre la pantalla «Tu plan» (los cuatro planes, los créditos
 * que te quedan y los paquetes). Al escoger un plan o un paquete se abre la ventanita de pago de Paddle con
 * `custom_data.user_id`, que es lo que el aviso de vuelta (servidor/paddle-aviso.ts) usa para saber de quién es el pago.
 *
 * ⛔ LA VENTA ESTÁ CERRADA (Sergio, 3-oct: «por ahora no vayas a dejar que puedan registrarse en ninguno de los
 * planes… les aparece un modal que diga que está todavía en construcción, que se unan al canal»). Mientras
 * VENTA_ABIERTA sea false, todo botón de comprar abre el aviso «Cherry abre muy pronto». Para probar el cobro de
 * punta a punta SOLO en el computador de desarrollo (localhost), se puede pasar `?probarpago=1`.
 *
 * De dónde sale cada cosa: los planes y paquetes, de la tabla `planes` (pública; pasar a la cuenta real de Paddle es
 * cambiar sus filas); tu plan, de la vista `mi_plan`; tus créditos, de `mis_creditos`. Las dos vistas solo devuelven lo
 * de la cuenta que pregunta. Aquí no se suma ni se descuenta nada: eso lo hace el servidor.
 */
(function () {
  'use strict';
  var VENTA_ABIERTA = false;
  var ENTORNO = 'sandbox';                               // 'production' cuando se pase a la cuenta real
  var TOKEN = 'test_1079b203f1caadf4117af124ef4';        // client-side token de Paddle: público, hecho para ir aquí
  var SB = 'https://xsptcepijtnmowqauyxw.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcHRjZXBpanRubW93cWF1eXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDEyNzUsImV4cCI6MjA5NzM3NzI3NX0.kmebg2M5GsQUF8Bf64rjVpxI8WxJlUenYjsUthwLhpQ';
  var CANAL = '0029Vb8xw0WCRs1wSMOitV35';

  /* Lo que trae cada plan, en palabras (lo decidido el 3-oct; las cifras de la tabla `planes` mandan en el precio). */
  var QUE_TRAE = {
    gratis:  { nombre: 'Gratis',  precio: 0,   lema: 'Para organizar tu contenido.', items: ['Calendario y publicación en Instagram', 'Respuestas automáticas con palabra clave', 'Carruseles con plantilla y textos con IA cada mes', 'Tu primer video completo, de bienvenida'] },
    basico:  { nombre: 'Basic',   precio: 19,  lema: 'Para publicar seguido.', items: ['10 videos al mes con subtítulos y escenas de apoyo', '20 créditos al mes para gráficos, voz de estudio y más', 'Carruseles con plantilla, calendario y publicación', 'Respuestas automáticas con palabra clave'] },
    creador: { nombre: 'Creator', precio: 49,  lema: 'Para crecer con videos profesionales.', items: ['20 videos al mes, 5 con gráficos animados', 'Voz de estudio en todos tus videos', 'Storyboards, guion premium y carruseles con IA', 'Respuestas automáticas con IA, sin límite'] },
    estudio: { nombre: 'Studio',  precio: 149, lema: 'Para varias marcas o clientes.', items: ['50 videos al mes, 15 con gráficos animados', 'Tres marcas, cada una por separado', 'Guion premium con el modelo más avanzado', 'Todo lo del plan Creator'] },
  };
  var ORDEN = ['gratis', 'basico', 'creador', 'estudio'];

  function local() { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }
  /* La prueba del cobro SOLO en el computador de desarrollo: `?probarpago=1` la enciende para esta pestaña (Cherry limpia
     la dirección al cargar, por eso se recuerda en sessionStorage). En cherrysweet.app esto no hace nada. */
  try { if (local() && /[?&]probarpago=1/.test(location.search)) sessionStorage.setItem('cherry-probarpago', '1'); } catch (e) {}
  function puedeComprar() {
    if (VENTA_ABIERTA) return true;
    if (!local()) return false;
    try { return /[?&]probarpago=1/.test(location.search) || sessionStorage.getItem('cherry-probarpago') === '1'; } catch (e) { return false; }
  }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function sesion() {
    var C = window.CARRETE;
    if (C && C.session && C.session.token) return { token: C.session.token, user: C.session.user };
    try { var s = JSON.parse(localStorage.getItem('carrete-sesion') || 'null'); if (s && s.token) return s; } catch (e) {}
    return null;
  }
  function leer(ruta) {
    var s = sesion();
    return fetch(SB + '/rest/v1/' + ruta, { headers: { apikey: ANON, Authorization: 'Bearer ' + (s ? s.token : ANON) } })
      .then(function (r) { if (!r.ok) throw new Error('No se pudo leer ' + ruta.split('?')[0] + ' (' + r.status + ')'); return r.json(); });
  }
  function fecha(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }); } catch (e) { return ''; }
  }

  /* ── El estado: tu plan, tus créditos y el catálogo ── */
  var datos = null;
  function cargar() {
    return Promise.all([
      leer('planes?entorno=eq.' + (ENTORNO === 'sandbox' ? 'sandbox' : 'live') + '&select=price_id,plan,nombre,tipo,creditos&order=creditos.asc'),
      leer('mi_plan?select=plan,estado,renueva_el,termina_el,nombre,al_dia').catch(function () { return []; }),
      leer('mis_creditos?select=del_plan,extra,total,repuesto_el').catch(function () { return []; }),
    ]).then(function (r) {
      var mio = r[1][0] || null, cr = r[2][0] || { del_plan: 0, extra: 0, total: 0 };
      datos = {
        planes: r[0].filter(function (p) { return p.tipo === 'plan'; }),
        paquetes: r[0].filter(function (p) { return p.tipo === 'paquete'; }),
        plan: mio && mio.al_dia ? mio.plan : 'gratis',
        mio: mio, creditos: cr,
      };
      try { window.dispatchEvent(new CustomEvent('cherry-plan', { detail: resumen() })); } catch (e) {}
      var C = window.CARRETE;
      if (C && C.setState) C.setState({ miPlan: resumen() });
      return datos;
    });
  }
  function resumen() {
    if (!datos) return null;
    var q = QUE_TRAE[datos.plan] || QUE_TRAE.gratis;
    return { plan: datos.plan, nombre: q.nombre, creditos: datos.creditos.total || 0, renueva: datos.mio && datos.mio.renueva_el };
  }

  /* ── Estilos (una vez) ── */
  var CSS = '' +
    '.cpg-velo{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(8,3,7,.72);' +
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);opacity:0;transition:opacity .22s}' +
    '.cpg-velo.ver{opacity:1}' +
    '.cpg-velo,.cpg-velo *{box-sizing:border-box}.cpg-velo{grid-template-columns:minmax(0,1fr)}.cpg-caja{min-width:0;justify-self:center}.cpg-h{overflow-wrap:anywhere}' +
    '.cpg-caja{position:relative;width:min(100%,1040px);max-height:calc(100dvh - 32px);overflow:auto;border-radius:26px;padding:28px 24px 22px;' +
    'background:radial-gradient(120% 70% at 85% 0%,rgba(255,45,138,.16),transparent 55%),linear-gradient(180deg,#1A1116,#0E080C);' +
    'border:1px solid rgba(247,233,224,.10);color:#F7E9E0;font:400 15px/1.5 "Space Grotesk",system-ui,sans-serif;box-shadow:0 40px 90px -30px #000;' +
    'transform:translateY(12px);transition:transform .25s}' +
    '.cpg-velo.ver .cpg-caja{transform:none}' +
    '.cpg-caja.chica{width:min(100%,470px)}' +
    '.cpg-x{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(247,233,224,.14);background:rgba(247,233,224,.05);color:#F7E9E0;font-size:22px;line-height:1;cursor:pointer}' +
    '.cpg-etq{font:500 11px/1 "DM Mono",monospace;letter-spacing:.18em;text-transform:uppercase;color:#FFC93C}' +
    '.cpg-h{margin:8px 0 4px;font:900 clamp(30px,5vw,44px)/1 Outfit,system-ui,sans-serif;letter-spacing:-.03em}' +
    '.cpg-h span{color:#FF2D8A}' +
    '.cpg-sub{color:rgba(247,233,224,.66);margin:0 0 18px;max-width:62ch}' +
    '.cpg-cred{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;align-items:center;padding:16px 18px;border-radius:18px;margin-bottom:20px;' +
    'background:rgba(255,201,60,.08);border:1px solid rgba(255,201,60,.28)}' +
    '.cpg-cred b{font:900 46px/1 Outfit,sans-serif;letter-spacing:-.03em;color:#FFC93C;grid-row:span 2;font-variant-numeric:tabular-nums}' +
    '.cpg-cred strong{font:700 15px/1.3 "Space Grotesk",sans-serif}' +
    '.cpg-cred small{color:rgba(247,233,224,.6);font-size:13px}' +
    '.cpg-planes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}' +
    '.cpg-plan{display:grid;gap:10px;align-content:start;padding:18px 16px;border-radius:18px;background:rgba(247,233,224,.04);border:1px solid rgba(247,233,224,.10)}' +
    '.cpg-plan.tuyo{border-color:rgba(43,217,199,.55);background:rgba(43,217,199,.07)}' +
    '.cpg-plan.top{border-color:rgba(255,45,138,.55);box-shadow:0 0 40px -14px rgba(255,45,138,.6)}' +
    '.cpg-nom{display:flex;align-items:center;gap:8px;font:800 20px/1 Outfit,sans-serif}' +
    '.cpg-marca{font:500 9.5px/1 "DM Mono",monospace;letter-spacing:.12em;text-transform:uppercase;padding:4px 8px;border-radius:999px;color:#2BD9C7;border:1px solid rgba(43,217,199,.5)}' +
    '.cpg-marca.rosa{color:#FF7DB6;border-color:rgba(255,45,138,.5)}' +
    '.cpg-cifra{display:flex;align-items:baseline;gap:5px}.cpg-cifra b{font:900 40px/1 Outfit,sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}.cpg-cifra span{font-size:12.5px;color:rgba(247,233,224,.55)}' +
    '.cpg-lema{font-size:13px;color:rgba(247,233,224,.6);margin:-4px 0 0}' +
    '.cpg-plan ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}' +
    '.cpg-plan li{display:grid;grid-template-columns:14px 1fr;gap:8px;font-size:13px;line-height:1.4;color:rgba(247,233,224,.78)}' +
    '.cpg-plan li::before{content:"";width:6px;height:6px;border-radius:50%;background:#2BD9C7;margin-top:6px}' +
    '.cpg-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 16px;border-radius:999px;border:0;cursor:pointer;' +
    'font:700 14px/1 "Space Grotesk",sans-serif;background:#F7E9E0;color:#0E080C;margin-top:4px;text-decoration:none}' +
    '.cpg-btn svg{width:22px;height:22px;flex:none}' +
    '.cpg-btn.rosa{background:#FF2D8A;color:#0E080C}.cpg-btn.linea{background:transparent;color:#F7E9E0;border:1px solid rgba(247,233,224,.22)}' +
    '.cpg-btn.wa{background:#25D366;color:#0B0709;font-size:16px;padding:16px}' +
    '.cpg-btn[disabled]{opacity:.45;cursor:default}' +
    '.cpg-tit{margin:24px 0 10px;font:800 20px/1.2 Outfit,sans-serif}' +
    '.cpg-paqs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}' +
    '.cpg-paq{display:grid;gap:6px;padding:16px;border-radius:16px;background:rgba(247,233,224,.04);border:1px solid rgba(247,233,224,.10)}' +
    '.cpg-paq b{font:900 30px/1 Outfit,sans-serif;color:#FFC93C}.cpg-paq span{font-size:13px;color:rgba(247,233,224,.6)}' +
    '.cpg-nota{font-size:13px;color:rgba(247,233,224,.55);margin:12px 0 0}' +
    '.cpg-pie{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.cpg-pie span{font-size:12.5px;padding:8px 12px;border-radius:999px;background:rgba(247,233,224,.05);border:1px solid rgba(247,233,224,.10);color:rgba(247,233,224,.75)}' +
    '.cpg-pasos{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:10px;counter-reset:p}' +
    '.cpg-pasos li{display:grid;grid-template-columns:30px 1fr;gap:10px;font-size:14.5px;line-height:1.45;color:rgba(247,233,224,.7)}' +
    '.cpg-pasos li::before{counter-increment:p;content:counter(p);width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:800 13px/1 "Space Grotesk",sans-serif;background:rgba(247,233,224,.06);border:1px solid rgba(247,233,224,.12);color:#FF7DB6}' +
    '.cpg-pasos b{color:#F7E9E0}' +
    '.cpg-pega{display:inline-block;font:800 14px/1 Outfit,sans-serif;padding:8px 12px;border-radius:10px;background:#FF2D8A;color:#0E080C;transform:rotate(-4deg);box-shadow:0 0 0 3px #F7E9E0}' +
    '@media (max-width:900px){.cpg-planes{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '@media (max-width:560px){.cpg-planes,.cpg-paqs{grid-template-columns:1fr}.cpg-caja{padding:24px 16px 18px}}';
  function estilos() {
    if (document.getElementById('cpg-estilos')) return;
    var st = document.createElement('style'); st.id = 'cpg-estilos'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ── Una ventana encima de todo ── */
  function velo(html, chica) {
    estilos();
    var v = document.createElement('div');
    v.className = 'cpg-velo';
    v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
    v.innerHTML = '<div class="cpg-caja' + (chica ? ' chica' : '') + '"><button type="button" class="cpg-x" aria-label="Cerrar">×</button>' + html + '</div>';
    document.body.appendChild(v);
    requestAnimationFrame(function () { v.classList.add('ver'); });
    var cerrar = function () { v.classList.remove('ver'); setTimeout(function () { v.remove(); }, 220); document.removeEventListener('keydown', tecla); };
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    v.addEventListener('click', function (e) { if (e.target === v || e.target.closest('.cpg-x')) cerrar(); });
    return { v: v, cerrar: cerrar };
  }

  /* ── Un mensaje corto (nunca los diálogos del navegador) ── */
  function mensaje(titulo, texto) {
    return velo('<h3 class="cpg-h" style="font-size:28px;margin-top:6px">' + esc(titulo) + '</h3><p class="cpg-sub">' + esc(texto) + '</p>', true);
  }

  /* ── El aviso «Cherry abre muy pronto» (el mismo de la portada) ── */
  function avisoObra() {
    var d = velo(
      '<span class="cpg-pega">En construcción</span>' +
      '<h3 class="cpg-h" style="margin-top:14px">Cherry abre <span>muy pronto</span></h3>' +
      '<p class="cpg-sub">Estamos terminando los últimos detalles para que todo funcione perfecto. Por eso todavía no se pueden pagar planes ni comprar créditos.</p>' +
      '<ul class="cpg-pasos">' +
      '<li><div><b>Únete al canal de WhatsApp de Cherry.</b> Ahí mostramos cómo edita, lo que vamos sumando y el día que abre.</div></li>' +
      '<li><div><b>Toca la campanita.</b> Así te llega el aviso apenas lo publiquemos.</div></li>' +
      '<li><div><b>Te avisamos apenas esté lista.</b> No tienes que estar pendiente.</div></li></ul>' +
      '<a class="cpg-btn wa" data-canal><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0B0709" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z"/></svg>Unirme al canal</a>', true);
    var a = d.v.querySelector('[data-canal]');
    var APP = 'whatsapp://channel/' + CANAL, WEB = 'https://whatsapp.com/channel/' + CANAL;
    if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')) { a.href = WEB; a.target = '_blank'; a.rel = 'noopener'; }
    else {
      a.href = APP;
      a.addEventListener('click', function () {
        var t = setTimeout(function () { if (document.visibilityState === 'visible') location.href = WEB; }, 1800);
        var fuera = function () { if (document.hidden) { clearTimeout(t); document.removeEventListener('visibilitychange', fuera); } };
        document.addEventListener('visibilitychange', fuera);
      });
    }
    return d;
  }

  /* ── Paddle: se carga solo cuando hace falta ── */
  var paddleListo = null, alPagar = null;
  function paddle() {
    if (paddleListo) return paddleListo;
    paddleListo = new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      s.onload = function () {
        try {
          if (ENTORNO === 'sandbox') window.Paddle.Environment.set('sandbox');
          window.Paddle.Initialize({ token: TOKEN, eventCallback: function (ev) {
            if (ev && ev.name === 'checkout.completed' && alPagar) alPagar(ev);
          } });
          ok(window.Paddle);
        } catch (e) { mal(e); }
      };
      s.onerror = function () { paddleListo = null; mal(new Error('No se pudo cargar Paddle')); };
      document.head.appendChild(s);
    });
    return paddleListo;
  }

  function comprar(priceId, cerrarPlanes) {
    if (!puedeComprar()) { avisoObra(); return; }
    var s = sesion();
    if (!s || !s.user) { avisoObra(); return; }
    paddle().then(function (P) {
      alPagar = function () {
        if (cerrarPlanes) cerrarPlanes();
        /* el aviso de Paddle llega al servidor en segundos: se vuelve a leer hasta ver el cambio */
        var n = 0, antes = JSON.stringify(resumen());
        (function mirar() {
          cargar().then(function () { if (JSON.stringify(resumen()) === antes && ++n < 10) setTimeout(mirar, 2000); else abrir(); });
        })();
      };
      P.Checkout.open({
        items: [{ priceId: priceId, quantity: 1 }],
        customer: s.user.email ? { email: s.user.email } : undefined,
        customData: { user_id: s.user.id },
        settings: { displayMode: 'overlay', theme: 'dark', locale: 'es', allowLogout: false },
      });
    }).catch(function (e) { mensaje('No se pudo abrir el pago', String(e.message || e)); });
  }

  /* ── «Tu plan» ── */
  function pintar() {
    var D = datos, mio = D.mio, plan = D.plan, cr = D.creditos;
    var conPlan = plan !== 'gratis';
    var porId = {}; D.planes.forEach(function (p) { porId[p.plan] = p; });
    var estado = conPlan
      ? 'Estás en <b>' + esc(QUE_TRAE[plan].nombre) + '</b>' + (mio && mio.renueva_el ? '. Se renueva el ' + esc(fecha(mio.renueva_el)) + '.' : '.')
      : 'Estás en el plan <b>Gratis</b>, que es gratis para siempre. Cuando quieras que Cherry te edite videos, escoge un plan.';
    var tarjetas = ORDEN.map(function (k) {
      var q = QUE_TRAE[k], tuyo = k === plan, top = k === 'creador' && !tuyo;
      var boton;
      if (tuyo) boton = '<button type="button" class="cpg-btn linea" disabled>Es tu plan</button>';
      else if (k === 'gratis') boton = '';
      else if (conPlan) boton = '<button type="button" class="cpg-btn' + (top ? ' rosa' : '') + '" data-cambiar="' + k + '">Cambiarme a ' + esc(q.nombre) + '</button>';
      else boton = '<button type="button" class="cpg-btn' + (top ? ' rosa' : '') + '" data-precio="' + esc(porId[k] ? porId[k].price_id : '') + '">Empezar con ' + esc(q.nombre) + '</button>';
      return '<div class="cpg-plan' + (tuyo ? ' tuyo' : '') + (top ? ' top' : '') + '">' +
        '<div class="cpg-nom">' + esc(q.nombre) + (tuyo ? '<span class="cpg-marca">Tuyo</span>' : top ? '<span class="cpg-marca rosa">Recomendado</span>' : '') + '</div>' +
        '<div class="cpg-cifra"><b>' + (q.precio ? 'USD ' + q.precio : 'USD 0') + '</b><span>' + (q.precio ? 'al mes' : 'para siempre') + '</span></div>' +
        '<p class="cpg-lema">' + esc(q.lema) + '</p>' +
        '<ul>' + q.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' + boton + '</div>';
    }).join('');
    var paqs = D.paquetes.map(function (p) {
      var usos = Math.round(p.creditos / 10), precio = { 60: 15, 150: 30, 400: 75 }[p.creditos];
      return '<div class="cpg-paq"><b>' + p.creditos + '</b><span>créditos · ' + usos + ' usos · USD ' + precio + '</span>' +
        '<button type="button" class="cpg-btn linea" data-precio="' + esc(p.price_id) + '"' + (conPlan ? '' : ' disabled') + '>Comprar</button></div>';
    }).join('');
    var creditos = '<div class="cpg-cred"><b>' + (cr.total || 0) + '</b><strong>' + (cr.total ? 'créditos para usar' : 'No tienes créditos todavía') + '</strong>' +
      '<small>' + (cr.del_plan ? cr.del_plan + ' del plan' + (cr.repuesto_el ? ' (vuelven cada mes)' : '') + ' · ' : '') + (cr.extra || 0) + ' de paquetes, que no vencen</small></div>';
    return '<span class="cpg-etq">Tu plan</span>' +
      '<h3 class="cpg-h">Lo que tienes y <span>lo que puedes tener</span></h3>' +
      '<p class="cpg-sub">' + estado + '</p>' + creditos +
      '<div class="cpg-planes">' + tarjetas + '</div>' +
      '<div class="cpg-tit">Créditos de más</div>' +
      '<div class="cpg-paqs">' + paqs + '</div>' +
      '<p class="cpg-nota">Cada uso cuesta 10 créditos: gráficos en un video, voz de estudio, un storyboard, un guion premium, un carrusel con IA o un video de más. ' +
      (conPlan ? 'Los créditos de paquetes no vencen.' : 'Los paquetes son para quien tiene un plan.') + '</p>' +
      '<div class="cpg-pie"><span>Cancelas cuando quieras</span><span>14 días de reembolso</span><span>Pago seguro con Paddle</span></div>';
  }

  function abrir() {
    var d = velo('<p class="cpg-sub" style="margin-top:30px">Cargando tu plan…</p>');
    cargar().then(function () {
      d.v.querySelector('.cpg-caja').innerHTML = '<button type="button" class="cpg-x" aria-label="Cerrar">×</button>' + pintar();
      d.v.querySelectorAll('[data-precio]').forEach(function (b) {
        b.addEventListener('click', function () { if (b.getAttribute('data-precio')) comprar(b.getAttribute('data-precio'), d.cerrar); });
      });
      /* cambiar de un plan pagado a otro se hace sobre la misma suscripción (no una segunda): por construir */
      d.v.querySelectorAll('[data-cambiar]').forEach(function (b) {
        b.addEventListener('click', function () { if (!puedeComprar()) avisoObra(); else mensaje('Cambiar de plan llega muy pronto', 'Mientras tanto, escríbenos a soporte@cherrysweet.app y lo hacemos por ti.'); });
      });
    }).catch(function (e) {
      d.v.querySelector('.cpg-caja').innerHTML = '<button type="button" class="cpg-x" aria-label="Cerrar">×</button><p class="cpg-sub" style="margin-top:30px">No se pudo cargar tu plan: ' + esc(e.message || e) + '</p>';
    });
    return d;
  }

  /* Cuando algo se acaba (hoy: las viñetas del mes). Lleva derecho a «Tu plan». */
  function sinCupo(texto) {
    var d = velo('<span class="cpg-etq">Se acabaron</span>' +
      '<h3 class="cpg-h" style="font-size:32px">Se te acabaron <span>las viñetas del mes</span></h3>' +
      '<p class="cpg-sub">' + esc(texto || '') + ' O pásate a un plan con más storyboards.</p>' +
      '<button type="button" class="cpg-btn rosa" data-ver>Ver los planes</button>', true);
    d.v.querySelector('[data-ver]').addEventListener('click', function () { d.cerrar(); abrir(); });
    return d;
  }

  window.CherryPagos = { sinCupo: sinCupo, abrir: abrir, comprar: comprar, avisoObra: avisoObra, cargar: cargar, resumen: resumen, ventaAbierta: puedeComprar };
})();
