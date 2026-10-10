/* lab-sweet.js — EL SWEET: la métrica de Cherry (9-oct-2026, aprobada por Sergio; primero se iba a llamar «Dulzura» y él la
 * cambió: «digamos porcentaje de sweet: tu video tiene 70 % de sweet, y que la palabra sweet sea clicable y salga un modal
 * explicando qué es sweet»).
 *
 * Un porcentaje de 0 a 100 de qué tan exitoso fue un video DE VERDAD, solo con datos de RESULTADO de Instagram (las métricas
 * internas de Cherry —gancho, idea, formato, estructura— son la causa; esto es el efecto: no se mezclan).
 * 100 % = un video ultraviral (2 millones de vistas o más) que además retiene y la gente comenta, guarda y comparte.
 *
 *   Alcance          40 %  las vistas en escala: 1.000 → 0 · 2.000.000 → 1 (cada ×10 sube igual)
 *   Retención justa  30 %  la retención comparada con lo NORMAL para su duración (normal = 185 × duración^-0,5, sacado de
 *                          263 reels de Sergio: explica el 76 % de la retención). La mitad de lo normal → 0, lo normal → 0,5,
 *                          1,5 veces lo normal → 1. Así un video de 7 s no gana solo por corto.
 *   Interacción      30 %  por cada 100 vistas: me gusta ×1, comentarios ×2, compartidos ×3, guardados ×3; 20 (lo de sus
 *                          virales) → 1, en raíz para que no castigue tanto lo de en medio.
 *
 * Se juntan con una media geométrica con esos pesos: para un sweet alto TODO tiene que estar bien. Si falta la retención o la
 * interacción se usa lo que haya (sin vistas no hay sweet). Detalle y la prueba: docs/LABORATORIO.md «El Sweet».
 *
 * La palabra «sweet» en pantalla: <span data-sweet>sweet</span> (o CherrySweet.palabra()). Al tocarla abre la explicación;
 * se atrapa en la fase de captura para que no abra también la tarjeta que la contiene.
 */
(function () {
  'use strict';
  var TECHO = 2000000, PESOS = { V: 0.40, R: 0.30, I: 0.30 };
  function num(x) { var v = Number(x); return x != null && x !== '' && isFinite(v) ? v : null; }
  function cl(x) { return Math.max(0, Math.min(1, x)); }
  /* la retención normal para un video de esa duración (en %) */
  function normal(dur) { dur = num(dur); return dur && dur > 0 ? 185 * Math.pow(dur, -0.5) : null; }
  function partes(v) {
    if (!v) return null;
    var vis = num(v.visitas != null ? v.visitas : v.vistas);
    if (!vis || vis <= 0) return null;
    var ret = num(v.retencion), nor = normal(v.dur);
    var acc = [v.meGusta, v.comentarios, v.reposts, v.guardados].map(num);
    var hayAcc = acc.some(function (x) { return x != null; });
    var e = hayAcc ? 100 * ((acc[0] || 0) + 2 * (acc[1] || 0) + 3 * (acc[2] || 0) + 3 * (acc[3] || 0)) / vis : null;
    return {
      V: cl((Math.log(vis) / Math.LN10 - 3) / (Math.log(TECHO) / Math.LN10 - 3)),
      R: ret != null && nor ? cl(ret / nor - 0.5) : null,
      I: e != null ? cl(Math.sqrt(e / 20)) : null,
      vistas: vis, retencion: ret, normal: nor, interaccion: e,
    };
  }
  /* el sweet (0 a 100, con un decimal), o null si no hay con qué */
  function de(v) {
    var p = partes(v);
    if (!p || (p.R == null && p.I == null)) return null;
    var t = 0, s = 0;
    Object.keys(PESOS).forEach(function (k) { if (p[k] != null) { t += PESOS[k]; s += PESOS[k] * Math.log(Math.max(p[k], 0.02)); } });
    return Math.round(1000 * Math.exp(s / t)) / 10;
  }
  /* la palabra que se toca */
  function palabra(txt) { return '<span class="sw-q" data-sweet role="button" tabindex="0" title="¿Qué es el sweet?">' + (txt || 'sweet') + '</span>'; }

  /* ── La explicación (una ventana con el diseño de Cherry; nunca un diálogo del navegador) ── */
  var CSS = '.sw-q{color:inherit;text-decoration:underline;text-decoration-color:#FF2D8A;text-decoration-thickness:2px;text-underline-offset:3px;cursor:help;' +
    'font-weight:inherit;border-radius:4px}.sw-q:hover{color:#FF2D8A}.sw-q:focus-visible{outline:2px solid #FF2D8A;outline-offset:2px}' +
    '.sw-velo{position:fixed;inset:0;z-index:2147483000;background:rgba(11,7,9,.62);backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px;animation:sw-in .18s ease-out}' +
    '@keyframes sw-in{from{opacity:0}to{opacity:1}}' +
    '.sw-caja{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#FBF7F4;color:#140C11;border-radius:28px;padding:26px 26px 22px;' +
    'box-shadow:0 30px 80px -20px rgba(0,0,0,.6);font:400 15px/1.55 "Space Grotesk","Segoe UI",system-ui,sans-serif;position:relative}' +
    '.sw-caja .sw-mano{font:700 24px/1 Caveat,"Segoe Script",cursive;color:#C0186A}' +
    '.sw-caja h3{margin:4px 0 6px;font:900 34px/.95 Outfit,"Arial Black",system-ui,sans-serif;letter-spacing:-.045em}.sw-caja h3 span{color:#FF2D8A}' +
    '.sw-caja p{margin:0 0 12px;color:rgba(20,12,17,.72)}.sw-caja p b{color:#140C11}' +
    '.sw-partes{display:grid;gap:8px;margin:14px 0}.sw-p{display:grid;grid-template-columns:62px 1fr;gap:12px;align-items:center;background:#fff;border-radius:16px;' +
    'box-shadow:inset 0 0 0 1px rgba(20,12,17,.08);padding:10px 14px}.sw-p b{font:900 24px/1 Outfit,system-ui,sans-serif;letter-spacing:-.04em;color:#FF2D8A}' +
    '.sw-p strong{display:block;font:800 15px/1.2 Outfit,system-ui,sans-serif}.sw-p small{display:block;font-size:13px;color:rgba(20,12,17,.64)}' +
    '.sw-escala{display:flex;justify-content:space-between;font:500 11px "DM Mono",ui-monospace,monospace;color:rgba(20,12,17,.5);margin:-4px 0 12px}' +
    '.sw-barra{height:12px;border-radius:99px;background:linear-gradient(90deg,#EFE6E1,#FF8FC0 45%,#FF2D8A 75%,#140C11);margin:6px 0}' +
    '.sw-x{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:0;background:#EFE6E1;color:#140C11;font:700 18px/1 system-ui;cursor:pointer}' +
    '.sw-x:focus-visible,.sw-ok:focus-visible{outline:3px solid #FF2D8A;outline-offset:2px}' +
    '.sw-ok{margin-top:4px;border:0;border-radius:999px;padding:12px 20px;background:#140C11;color:#fff;font:800 15px Outfit,system-ui,sans-serif;cursor:pointer}';
  function estilos() {
    if (document.getElementById('sw-css')) return;
    var st = document.createElement('style'); st.id = 'sw-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  }
  function explicar() {
    estilos();
    if (document.querySelector('.sw-velo')) return;
    var antes = document.activeElement;
    var v = document.createElement('div');
    v.className = 'sw-velo'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-labelledby', 'sw-titulo');
    v.innerHTML = '<div class="sw-caja"><button type="button" class="sw-x" aria-label="Cerrar">×</button>' +
      '<span class="sw-mano">la métrica de Cherry</span><h3 id="sw-titulo">¿Qué es el <span>sweet</span>?</h3>' +
      '<p>Es el porcentaje de qué tan exitoso fue tu video <b>de verdad</b>, con lo que te dio Instagram. <b>100 % es un video ultraviral</b>: más de 2 millones de vistas, que además retiene y la gente comenta, guarda y comparte.</p>' +
      '<div class="sw-barra" aria-hidden="true"></div><div class="sw-escala" aria-hidden="true"><span>0 %</span><span>50 %</span><span>100 % · ultraviral</span></div>' +
      '<div class="sw-partes">' +
        '<div class="sw-p"><b>40 %</b><div><strong>Alcance</strong><small>Las vistas: 1.000 vistas suman 0 y 2 millones suman todo.</small></div></div>' +
        '<div class="sw-p"><b>30 %</b><div><strong>Retención justa</strong><small>Cuánto ven, comparado con lo normal para lo que dura el video. Un video corto retiene más solo por corto; aquí no gana por eso.</small></div></div>' +
        '<div class="sw-p"><b>30 %</b><div><strong>Interacción</strong><small>Por cada 100 vistas: me gusta, comentarios ×2, compartidos ×3 y guardados ×3. Lo que más pesa es lo que hace crecer.</small></div></div>' +
      '</div>' +
      '<p>Las tres tienen que estar bien: si una falla, el sweet baja mucho. Un video de 7 segundos que casi nadie vio no sale alto solo por retener, y uno con millones de vistas que nadie guarda tampoco.</p>' +
      '<button type="button" class="sw-ok">Entendido</button></div>';
    document.body.appendChild(v);
    var cerrar = function () { v.remove(); document.removeEventListener('keydown', tecla, true); try { if (antes && antes.focus) antes.focus(); } catch (e) {} };
    var tecla = function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); } };
    document.addEventListener('keydown', tecla, true);
    v.addEventListener('click', function (e) { if (e.target === v || e.target.closest('.sw-x, .sw-ok')) cerrar(); });
    v.querySelector('.sw-ok').focus();
  }
  /* la palabra se atrapa en la fase de captura: así no abre también la tarjeta o la fila que la contiene */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-sweet]');
    if (!t) return;
    e.preventDefault(); e.stopPropagation(); explicar();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target && e.target.closest && e.target.closest('[data-sweet]');
    if (!t) return;
    e.preventDefault(); e.stopPropagation(); explicar();
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', estilos); else estilos();

  window.CherrySweet = { de: de, partes: partes, normal: normal, palabra: palabra, explicar: explicar };
})();
