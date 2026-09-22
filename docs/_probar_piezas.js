/* Mide el modelo de piezas. Lo que importa: que dos videos con la misma idea apunten a la MISMA
   pieza (si no, el historial se parte en dos y no se puede juzgar nada) y que el estado salga de
   los videos, no de una etiqueta. */
const fs = require('fs');
const html = fs.readFileSync('ve/herramientas/laboratorio.html', 'utf8');

function saca(nombre) {
  const i = html.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('falta ' + nombre);
  let n = 0;
  for (let k = html.indexOf('{', i); k < html.length; k++) {
    if (html[k] === '{') n++;
    else if (html[k] === '}') { n--; if (!n) return html.slice(i, k + 1); }
  }
}
function sacaVar(nombre, cierre) {
  const i = html.indexOf('var ' + nombre + ' = ' + (cierre === ']' ? '[' : '{'));
  let n = 0;
  const abre = cierre === ']' ? '[' : '{';
  for (let k = html.indexOf(abre, i); k < html.length; k++) {
    if (html[k] === abre) n++;
    else if (html[k] === cierre) { n--; if (!n) return html.slice(i, k + 1) + ';'; }
  }
}

let VIDEOS = [];
const codigo =
  'var CORTE = { scroll: 55, entrada: 50, cuerpo: 45, vale: 1.0 };\n' +
  'function umbral() { return { faltan: 3 }; }\n' +
  'var nn = 0; function nid() { return "id" + (++nn); }\n' +
  'function guardar() {}\n' +
  sacaVar('PIEZAS', ']') + '\n' +
  saca('normalizaPiezas') + '\n' + saca('llave') + '\n' + saca('buscarPieza') + '\n' +
  saca('crearPieza') + '\n' + saca('piezaPorId') + '\n' + saca('usosDe') + '\n' +
  saca('estadoDe') + '\n' + saca('estadoPieza') + '\n' + saca('corteAcierto') + '\n' +
  saca('vincularPiezas') + '\n' + saca('nombreEstructura') + '\n' +
  'return { crearPieza, buscarPieza, usosDe, estadoPieza, vincularPiezas, nombreEstructura, llave };';

const D = { piezas: null, videos: [] };
const F = new Function('D', 'videosDeCuenta', codigo)(D, () => VIDEOS);
D.piezas = new Function('x', sacaVar('PIEZAS', ']') + '\n' + saca('normalizaPiezas') + '\nreturn normalizaPiezas(x);')(null);

let fallos = 0;
const ok = (c, msg, extra) => { if (!c) fallos++; console.log(` ${c ? '✓' : '✗'} ${msg}${extra ? '  ' + extra : ''}`); };

console.log('══ la misma idea escrita distinto es la MISMA pieza ══\n');
const a = F.crearPieza('idea', 'Cómo ser rentable en tu restaurante');
const b = F.crearPieza('idea', '  cómo ser RENTABLE en tu restaurante!  ');
ok(a.id === b.id, 'mayúsculas, espacios y signos no crean una pieza nueva', `(${D.piezas.idea.length} pieza)`);
const c = F.crearPieza('idea', 'Cómo ser rentable en tu bar');
ok(c.id !== a.id, 'una idea de verdad distinta sí crea otra', `(${D.piezas.idea.length} piezas)`);
ok(F.llave('Un vídeo, ¿sí?') === 'un video si', 'las tildes y los signos se normalizan');

console.log('\n══ el estado sale de los videos, no de una etiqueta ══\n');
const vid = (ret, piezas) => ({ retencion: ret, fecha: '2026-09-01', piezas });
VIDEOS = [];
ok(F.estadoPieza('idea', a.id).e === 'neutra', 'sin usar → neutra');

VIDEOS = [vid(52, { idea: a.id })];
ok(F.estadoPieza('idea', a.id).e === 'media', 'usada una vez y acierta → temporal');

VIDEOS = [vid(52, { idea: a.id }), vid(48, { idea: a.id })];
ok(F.estadoPieza('idea', a.id).e === 'magnetica', 'dos veces y las dos aciertan → magnética');

VIDEOS = [vid(52, { idea: a.id }), vid(48, { idea: a.id }), vid(29, { idea: a.id })];
ok(F.estadoPieza('idea', a.id).e === 'media', 'falla una → baja sola, sin tocar nada',
   `(acertó ${F.usosDe('idea', a.id).aciertos} de ${F.usosDe('idea', a.id).n})`);

VIDEOS = [vid(31, { idea: a.id }), vid(28, { idea: a.id })];
ok(F.estadoPieza('idea', a.id).e === 'inerte', 'nunca acierta → inerte');

console.log('\n══ vincular un video con sus cuatro piezas ══\n');
D.piezas = { idea: [], estructura: [], gancho: [], formato: [] };
const desm = {
  idea: { tema: 'por qué pierdes dinero los martes', creencia: 'x', realidad: 'y' },
  gancho: { tipo: 'Contradicción', emocion: 'Controversia' },
  alcance: { zona: 'segura' },
  mapa: { pasos: [{ tipo: 'Gancho' }, { tipo: 'Creencia' }, { tipo: 'Open loop' },
                  { tipo: 'Cuerpo' }, { tipo: 'Open loop' }, { tipo: 'Giro' }, { tipo: 'CTA' }] },
  vista: { produccion: { formato: 'Dinámico' } },
};
const v1 = { id: 'v1', desmontaje: desm };
F.vincularPiezas(v1);
ok(!!(v1.piezas.idea && v1.piezas.gancho && v1.piezas.formato && v1.piezas.estructura),
   'se crean las cuatro', JSON.stringify(Object.keys(v1.piezas)));
ok(D.piezas.estructura[0].texto === 'El desmentido',
   'la estructura se bautiza sola', `«${D.piezas.estructura[0].texto}»`);

/* el segundo video con el mismo desmontaje no debe duplicar nada */
const antes = Object.keys(D.piezas).map(k => D.piezas[k].length).join(',');
const v2 = { id: 'v2', desmontaje: desm };
F.vincularPiezas(v2);
const despues = Object.keys(D.piezas).map(k => D.piezas[k].length).join(',');
ok(antes === despues, 'otro video con lo mismo NO duplica piezas', `(${antes} → ${despues})`);
ok(v1.piezas.idea === v2.piezas.idea && v1.piezas.estructura === v2.piezas.estructura,
   'los dos apuntan a las mismas piezas');

VIDEOS = [{ retencion: 52, piezas: v1.piezas }, { retencion: 49, piezas: v2.piezas }];
ok(F.estadoPieza('estructura', v1.piezas.estructura).e === 'magnetica',
   'y por eso la estructura puede llegar a magnética con dos videos');

console.log('\n══ los nombres de estructura ══\n');
const casos = [
  [['Gancho', 'Creencia', 'Open loop', 'Cuerpo', 'Open loop', 'Giro', 'CTA'], 'El desmentido'],
  [['Gancho', 'Cuerpo', 'Cuerpo', 'Cuerpo', 'Open loop', 'CTA'], 'Lista con trampa'],
  [['Gancho', 'Open loop', 'Open loop', 'Open loop', 'CTA'], 'La cadena'],
  [['Pregunta', 'Cuerpo', 'CTA'], 'Pregunta larga'],
];
casos.forEach(function (x) {
  const r = F.nombreEstructura(x[0]);
  ok(r === x[1], `${x[0].length} pasos → «${r}»`);
});

console.log(fallos ? `\n✗ ${fallos} fallos` : '\n✓ todo cuadra');
