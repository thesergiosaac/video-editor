/* Mide la ficha nueva: que el guion salga de la estructura y conserve lo escrito, y que auditar
   diga lo que tiene que decir — sobre todo lo de cambiar dos cosas a la vez, que es lo que hace
   que un video sirva o no como experimento. */
const fs = require('fs');
const html = fs.readFileSync('ve/herramientas/laboratorio.html', 'utf8');

function saca(n) {
  const i = html.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('falta ' + n);
  let k = html.indexOf('{', i), d = 0;
  for (; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); }
  }
}
function sacaVar(n, cierre) {
  const abre = cierre === ']' ? '[' : '{';
  const i = html.indexOf('var ' + n + ' = ' + abre);
  let d = 0;
  for (let k = html.indexOf(abre, i); k < html.length; k++) {
    if (html[k] === abre) d++;
    else if (html[k] === cierre) { d--; if (!d) return html.slice(i, k + 1) + ';'; }
  }
}

let VIDEOS = [], AVISOS = [];
const D = { piezas: { idea: [], estructura: [], gancho: [], formato: [] }, videos: [], planes: [] };
const codigo =
  'var CORTE={scroll:55,entrada:50,cuerpo:45,vale:1.0};\n' +
  'function umbral(){return {faltan:3};}\n' +
  'var nn=0; function nid(){return "id"+(++nn);}\n' +
  'function guardar(){} function pintarFicha(){} function pintarFichaTarjeta(){}\n' +
  'function aviso(t){AVISOS.push(t);}\n' +
  /* peldanos simulado: cada video declara en v.tapados qué peldaños quedaron tapados */
  'function peldanos(v){ var t = v.tapados || []; return { pasos: [0,1,2,3].map(function(i){' +
  ' return { tapado: t.indexOf(i) >= 0 }; }) }; }\n' +
  sacaVar('PIEZAS', ']') + '\n' + sacaVar('TIPOS', '}') + '\n' + sacaVar('PLANTILLA', ']') + '\n' +
  sacaVar('PELDANO_DE', '}') + '\n' +
  saca('llave') + '\n' + saca('buscarPieza') + '\n' + saca('crearPieza') + '\n' +
  saca('piezaPorId') + '\n' + saca('usosDe') + '\n' + saca('estadoDe') + '\n' +
  saca('estadoPieza') + '\n' + saca('corteAcierto') + '\n' + saca('unirY') + '\n' +
  saca('guionDeEstructura') + '\n' + saca('alDiaPlan') + '\n' + saca('auditarFicha') + '\n' +
  'return { crearPieza, guionDeEstructura, alDiaPlan, auditarFicha, estadoPieza };';
const F = new Function('D', 'videosDeCuenta', 'AVISOS', codigo)(D, () => VIDEOS, AVISOS);

let fallos = 0;
const ok = (c, m, x) => { if (!c) fallos++; console.log(` ${c ? '✓' : '✗'} ${m}${x ? '  ' + x : ''}`); };

console.log('══ el guion sale de la estructura ══\n');
const est = F.crearPieza('estructura', 'El desmentido', {
  pasos: ['Gancho', 'Creencia', 'Open loop', 'Cuerpo', 'Open loop', 'Giro', 'CTA'].map(t => ({ tipo: t })),
});
const f = { id: 'f1', piezas: { estructura: est.id }, guion: [] };
F.guionDeEstructura(f);
ok(f.guion.length === 7, 'siete pasos, los de la estructura', f.guion.map(x => x.paso).join(' → '));

f.guion[0].dice = 'el gancho escrito';
f.guion[2].dice = 'primer loop';
f.guion[4].dice = 'segundo loop';

const otra = F.crearPieza('estructura', 'Lista con trampa', {
  pasos: ['Gancho', 'Cuerpo', 'Open loop', 'Cuerpo', 'CTA'].map(t => ({ tipo: t })),
});
f.piezas.estructura = otra.id;
F.guionDeEstructura(f);
ok(f.guion.length === 5, 'al cambiar de estructura cambian los pasos');
ok(f.guion[0].dice === 'el gancho escrito', 'lo escrito en «Gancho» se conserva');
ok(f.guion[2].dice === 'primer loop', 'el primer open loop conserva SU texto, no el del segundo',
   `(«${f.guion[2].dice}»)`);

/* el caso que importa: el segundo loop de una estructura con dos no debe heredar el del primero */
f.piezas.estructura = est.id;
F.guionDeEstructura(f);
ok(f.guion[2].dice === 'primer loop' && f.guion[4].dice === '',
   'al volver a dos loops, el segundo NO copia el del primero',
   `(1º «${f.guion[2].dice}», 2º «${f.guion[4].dice}»)`);

console.log('\n══ auditar la ficha ══\n');
const idea = F.crearPieza('idea', 'Cómo ser rentable');
const gancho = F.crearPieza('gancho', 'Pregunta a cámara');
const fmt = F.crearPieza('formato', 'Dinámico');
/* la idea falla dos veces → inerte; el formato acierta dos → magnética */
VIDEOS = [
  { retencion: 30, piezas: { idea: idea.id } },
  { retencion: 28, piezas: { idea: idea.id } },
  { retencion: 52, piezas: { formato: fmt.id } },
  { retencion: 49, piezas: { formato: fmt.id } },
];
ok(F.estadoPieza('idea', idea.id).e === 'inerte', 'la idea queda inerte');
ok(F.estadoPieza('formato', fmt.id).e === 'magnetica', 'el formato queda magnético');

const f2 = { id: 'f2', piezas: { idea: idea.id, gancho: gancho.id, formato: fmt.id, estructura: est.id },
             guion: [] };
F.guionDeEstructura(f2);
F.auditarFicha(f2);
const dice = f2.auditoria.filas.map(x => x.que);
ok(f2.auditoria.filas.some(x => /inerte/.test(x.que) && !x.bien), 'avisa de que la idea es inerte',
   f2.auditoria.filas.filter(x => /inerte/.test(x.que)).map(x => x.arreglo)[0]);
ok(f2.auditoria.filas.some(x => /magnétic/.test(x.que) && x.bien), 'reconoce el formato magnético');
ok(f2.auditoria.filas.some(x => /guion/i.test(x.que) && !x.bien), 'avisa del guion sin escribir');

console.log('\n══ la regla del experimento: una variable ══\n');
const ctrl = { id: 'vc', titulo: 'El control', retencion: 26,
               piezas: { idea: idea.id, gancho: gancho.id, formato: fmt.id, estructura: est.id } };
VIDEOS = VIDEOS.concat([ctrl]);
D.videos = [ctrl];

const g2 = F.crearPieza('gancho', 'Objeto que no pinta nada');
const f3 = { id: 'f3', base: { id: 'vc', titulo: 'El control' },
             piezas: { idea: idea.id, gancho: g2.id, formato: fmt.id, estructura: est.id }, guion: [] };
F.guionDeEstructura(f3);
F.auditarFicha(f3);
ok(f3.auditoria.filas.some(x => /Sirve como experimento/.test(x.que)),
   'cambiar SOLO el gancho → sirve como experimento');

const i2 = F.crearPieza('idea', 'Por qué pierdes los martes');
const f4 = { id: 'f4', base: { id: 'vc', titulo: 'El control' },
             piezas: { idea: i2.id, gancho: g2.id, formato: fmt.id, estructura: est.id }, guion: [] };
F.guionDeEstructura(f4);
F.auditarFicha(f4);
const dos = f4.auditoria.filas.filter(x => /Cambias 2 cosas/.test(x.que))[0];
ok(!!dos, 'cambiar idea Y gancho → avisa de que no descartará nada', dos && dos.nota);

console.log('\n══ una pieza tapada no cuenta como fallo ══\n');
/* el caso real: un video que se saltó el 83%. La idea no falló — nadie la vio. */
const ideaT = F.crearPieza('idea', 'Una idea que nadie llegó a ver');
const ganchoT = F.crearPieza('gancho', 'El gancho de ese video');
VIDEOS = [{ retencion: 26, tapados: [1, 2, 3], piezas: { idea: ideaT.id, gancho: ganchoT.id } }];
const eI = F.estadoPieza('idea', ideaT.id);
ok(eI.e === 'neutra', 'la idea tapada NO queda inerte', '(' + eI.u.n + ' contados, ' + eI.u.tapados + ' tapados)');
const eG = F.estadoPieza('gancho', ganchoT.id);
ok(eG.e === 'inerte', 'el gancho SÍ se juzga: nada lo tapa', '(' + eG.u.aciertos + ' de ' + eG.u.n + ')');

VIDEOS = [{ retencion: 26, tapados: [], piezas: { idea: ideaT.id } }];
ok(F.estadoPieza('idea', ideaT.id).e === 'inerte', 'si llegaron al final y no la movieron, sí es inerte');

console.log(fallos ? `\n✗ ${fallos} fallos` : '\n✓ todo cuadra');

