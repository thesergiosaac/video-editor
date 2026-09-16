/* ============================================================
   dom.js — mini-helper para crear nodos sin innerHTML.
   h(tag, props, ...children) -> HTMLElement
   - style: objeto -> Object.assign(el.style, ...)
   - class: string de clases
   - onX: addEventListener('x', fn)  (onClick, onInput, onChange…)
   - html: innerHTML (úsalo solo con contenido de confianza)
   - resto: setAttribute
   children: nodos, strings, números, arrays (se aplanan), o null/false (se ignoran)
   ============================================================ */
(function () {
  const C = (window.CARRETE = window.CARRETE || {});

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.length > 2 && k.slice(0, 2) === 'on' && typeof v === 'function')
          el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      }
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(el, children) {
    for (const c of children) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) appendChildren(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
  }

  /* Video que sobrevive a los redibujos.
     C.render() reconstruye toda la app en cada cambio de estado; un <video> nuevo
     vuelve a descargar desde cero y reinicia lo que se estaba viendo. Aquí se guarda
     uno por "clave" y se reutiliza mientras la dirección sea la misma. */
  const videos = {};
  C.videoFijo = function (clave, src, props) {
    let v = videos[clave];
    if (!v || v.getAttribute('src') !== src) {
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (_) {} }
      v = videos[clave] = h('video', Object.assign({}, props, { src }));
      return v;
    }
    // Reutilizado: solo se actualiza lo visual; los eventos quedaron puestos al crearlo
    for (const k in props) {
      const val = props[k];
      if (k.length > 2 && k.slice(0, 2) === 'on') continue;
      if (k === 'style' && val && typeof val === 'object') Object.assign(v.style, val);
      else if (k === 'class') v.className = val;
      else if (k === 'controls') v.controls = !!val;
      else if (val == null || val === false) v.removeAttribute(k);
      else v.setAttribute(k, val);
    }
    return v;
  };
  C.videoFijo.get = (clave) => videos[clave] || null;

  C.h = h;
  C.frag = function (...children) {
    const f = document.createDocumentFragment();
    appendChildren(f, children);
    return f;
  };
})();
