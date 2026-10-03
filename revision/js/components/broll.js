/* broll.js — videos de escenas, con el guion del Laboratorio (23-sep-2026)
 *
 * Sergio: «Cherry ya construye guiones donde cada escena tiene lo que dice y lo que pasa. Lo
 * único que habría sería una opción de B-roll: escoger uno de los guiones que ya tenemos, y
 * Cherry nos dice qué video va en cada escena. Y listo, el guion ya sabe que en esa parte va
 * esa voz».
 *
 * Esta pantalla es el paso 2 del plan: escoger el guion y ponerle un video a cada escena. El
 * reparto de la voz vive en el servidor (`servidor/broll.ts`) y ya está medido contra su
 * grabación real: 266 de 279 palabras, las 8 escenas habladas localizadas.
 *
 * ⚠️ Una escena VISUAL no lleva voz, así que no tiene ventana propia: va ENCIMA de la de al
 * lado. Aquí se dice con todas las letras, porque si no parece que se le olvidó a alguien.
 */
(function () {
  'use strict';
  const C = window.CARRETE;
  const h = C.h;

  /* El estado de esta pantalla, todo junto. */
  function B() {
    if (!C.state.broll) {
      C.state.broll = { on: false, guiones: null, fichaId: null, escenas: [],
                        porEscena: {}, vozClip: null, ventanas: null, cargando: '', aviso: '' };
    }
    return C.state.broll;
  }
  C.brollEstado = B;

  function pon(campos) {
    Object.assign(B(), campos);
    C.setState({});
  }

  const reloj = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  /* ── Traer los guiones ──────────────────────────────────────────────────────────────── */
  async function traerGuiones() {
    pon({ cargando: 'Buscando tus guiones…', aviso: '' });
    try {
      const r = await C.api.edgeFetch('broll', { modo: 'guiones' });
      /* Solo los que tienen algo escrito: un guion vacío no se puede montar y verlo en la
         lista solo sirve para tocarlo y llevarse un chasco. */
      const utiles = (r.guiones || []).filter((g) =>
        (g.escenas || []).some((e) => !e.visual));
      pon({ guiones: utiles, cargando: '' });
      if (!utiles.length) {
        pon({ aviso: 'Todavía no tienes ningún guion escrito en el Laboratorio.' });
      }
    } catch (e) {
      pon({ cargando: '', aviso: e.message });
    }
  }

  function escoger(g) {
    pon({ fichaId: g.id, escenas: g.escenas || [], porEscena: {}, ventanas: null, aviso: '' });
  }

  /* ── Subir un archivo y quedarse con su clip ────────────────────────────────────────── */
  function pedirArchivo(soloAudio, alTener) {
    const input = document.createElement('input');
    input.type = 'file';
    /* ⚠️ La voz puede venir en audio suelto o dentro de un video: se aceptan los dos, que
       grabar con el celular y sacar solo la pista es un paso de más. */
    input.accept = soloAudio ? 'audio/*,video/*' : 'video/*';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      pon({ cargando: 'Subiendo ' + f.name + '…' });
      try {
        const r = await C.api.uploadClipViaS3(f, (pct) => {
          pon({ cargando: 'Subiendo ' + f.name + '… ' + pct + '%' });
        });
        if (!r || !r.id) throw new Error('No se pudo subir ese archivo.');
        pon({ cargando: 'Procesando… esto tarda un poco.' });
        await esperarClip(r.id, soloAudio);
        alTener(r.id);
        pon({ cargando: '' });
      } catch (e) {
        pon({ cargando: '', aviso: e.message });
      }
    };
    input.click();
  }

  /* La voz hace falta TRANSCRITA para poder repartirla; un video de escena, solo convertido. */
  async function esperarClip(id, necesitaTranscripcion) {
    const listo = necesitaTranscripcion ? ['transcribed'] : ['processed', 'transcribed'];
    const desde = Date.now();
    while (Date.now() - desde < 600000) {
      const clips = await C.api.getClips();
      const c = (clips || []).filter((x) => x.id === id)[0];
      if (c && c.status === 'error') throw new Error('Ese archivo no se pudo procesar.');
      if (c && listo.indexOf(c.status) >= 0) return c;
      /* Se dice en qué paso va: «procesando» a secas no distingue entre trabajar y colgarse. */
      pon({ cargando: c && c.status === 'processed'
        ? 'Transcribiendo tu voz…' : 'Convirtiendo el video…' });
      await new Promise((r) => setTimeout(r, 4000));
    }
    throw new Error('Está tardando demasiado. Recarga y mira si aparece.');
  }

  /* ── Repartir ───────────────────────────────────────────────────────────────────────── */
  async function repartir() {
    const b = B();
    if (!b.vozClip) { pon({ aviso: 'Sube primero la grabación de tu voz.' }); return; }
    pon({ cargando: 'Buscando dónde empieza cada escena…', aviso: '' });
    try {
      const r = await C.api.edgeFetch('broll', {
        modo: 'repartir', ficha_id: b.fichaId, clip_id: b.vozClip,
      });
      pon({ ventanas: r, cargando: '' });
      if (!r.sirve) {
        pon({ aviso: 'Tu voz no se parece lo bastante al guion' +
          (r.flojas && r.flojas.length ? ' (se pierde en: ' + r.flojas.join(', ') + ')' : '') +
          '. Revisa que sea la grabación de este guion.' });
      }
    } catch (e) {
      pon({ cargando: '', aviso: e.message });
    }
  }

  /* ── Pintar ─────────────────────────────────────────────────────────────────────────── */

  function filaEscena(e, ventana) {
    const b = B();
    const clip = b.porEscena[e.n];
    const dura = ventana && ventana.ini != null
      ? (ventana.fin - ventana.ini).toFixed(1) + 's' : null;

    return h('div', { class: 'br-fila' + (e.visual ? ' br-fila--visual' : '') },
      h('span', { class: 'br-n' }, String(e.n + 1)),
      h('div', { class: 'br-txt' },
        h('span', { class: 'br-esc' }, e.nombre || ('escena ' + (e.n + 1))),
        h('span', { class: 'br-ve' }, e.ve || 'Sin anotar qué se ve.')
      ),
      h('span', { class: 'br-dura' },
        e.visual ? 'encima' : (dura || '—')),
      h('button', {
        class: 'br-b' + (clip ? ' br-b--ok' : ''),
        onClick: () => pedirArchivo(false, (id) => {
          const m = Object.assign({}, B().porEscena);
          m[e.n] = id;
          pon({ porEscena: m });
        }),
      }, clip ? '✓ puesto' : 'subir video')
    );
  }

  function listaGuiones() {
    const b = B();
    if (b.guiones === null) {
      return h('button', { class: 'btn btn--accent', onClick: traerGuiones },
        'Escoger uno de mis guiones');
    }
    return h('div', { class: 'br-guiones' },
      b.guiones.map((g) => h('button', {
        class: 'br-g' + (b.fichaId === g.id ? ' br-g--sel' : ''),
        onClick: () => escoger(g),
      },
        h('span', { class: 'br-g-t' }, g.titulo),
        h('span', { class: 'br-g-n' },
          g.escenas.length + ' escenas · ' +
          g.escenas.filter((e) => !e.visual).length + ' con voz')
      ))
    );
  }

  C.Broll = function () {
    const b = B();
    const v = b.ventanas;
    const porN = {};
    if (v) (v.ventanas || []).forEach((x) => { porN[x.n] = x; });

    const faltan = b.escenas.filter((e) => !b.porEscena[e.n]).length;

    return h('div', { class: 'br' },
      /* 1 · el guion */
      h('div', { class: 'br-paso' },
        h('span', { class: 'br-paso-n' }, '1'),
        h('span', { class: 'br-paso-t' }, 'El guion'),
        b.fichaId && h('button', { class: 'br-cambiar', onClick: () => pon({ fichaId: null }) },
          'cambiar')
      ),
      !b.fichaId ? listaGuiones() : null,

      /* 2 · la voz */
      b.fichaId && h('div', { class: 'br-paso' },
        h('span', { class: 'br-paso-n' }, '2'),
        h('span', { class: 'br-paso-t' }, 'Tu voz, de una sola grabación'),
        v && h('span', { class: 'br-ok' }, reloj(v.total_s) + ' · ' + v.confianza + '% encaja')
      ),
      b.fichaId && !b.vozClip && h('button', {
        class: 'btn btn--accent', onClick: () => pedirArchivo(true, (id) => {
          pon({ vozClip: id });
          repartir();
        }),
      }, 'Subir la grabación'),
      b.fichaId && b.vozClip && !v && h('button', { class: 'btn btn--accent', onClick: repartir },
        'Repartirla entre las escenas'),

      /* 3 · los videos */
      b.fichaId && h('div', { class: 'br-paso' },
        h('span', { class: 'br-paso-n' }, '3'),
        h('span', { class: 'br-paso-t' }, 'Un video por escena'),
        h('span', { class: 'br-ok' }, faltan ? 'faltan ' + faltan : 'todas puestas')
      ),
      b.fichaId && h('div', { class: 'br-lista' },
        b.escenas.map((e) => filaEscena(e, porN[e.n]))),

      b.cargando && h('div', { class: 'br-cargando' }, b.cargando),
      b.aviso && h('div', { class: 'br-aviso' }, b.aviso)
    );
  };
})();
