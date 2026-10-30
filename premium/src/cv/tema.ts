// (30-oct-2026) Cámara viva — EL TEMA de los gráficos. Sergio: «esos gráficos siempre van a ser los mismos, lo único que cambia
// es el estilo» y «el color de acento debe ser configurable: no siempre los gráficos pueden ir rojos». Los gráficos (graficos.tsx)
// solo saben QUÉ se mueve; los colores, la tarjeta y sus sombras salen de aquí. Un estilo nuevo = otro tema.
export const RUBI = '#9B111E';

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(String(hex || RUBI).replace('#', ''), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const aHex = (c: number[]) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mezcla = (hex: string, con: string, k: number) => { const a = rgb(hex), b = rgb(con); return aHex(a.map((x, i) => x + (b[i] - x) * k)); };
const luz = (hex: string) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contraste = (a: string, b: string) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const acentoValido = (c?: string | null) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : RUBI);
/* el acento como LETRA sobre un fondo claro: si no se lee (un amarillo sobre blanco), se oscurece lo justo */
export const legibleSobre = (hex: string, fondo = '#ffffff') => {
  let c = hex;
  for (let i = 1; i <= 8 && contraste(c, fondo) < 3.2; i++) c = mezcla(hex, '#000000', i * 0.1);
  return c;
};
/* la letra que va encima del acento (blanca o casi negra, la que se lea) */
export const sobreDe = (hex: string) => (contraste(hex, '#ffffff') >= 2.6 ? '#ffffff' : '#16120F');
export const degradadoDe = (hex: string, grados = 180) => `linear-gradient(${grados}deg,${mezcla(hex, '#ffffff', 0.16)},${hex} 58%,${mezcla(hex, '#000000', 0.2)})`;

export type TemaG = {
  sup: string; tinta: string; gris: string; riel: string; suave: string; azul: string;
  acento: string;      // el color tal cual, para rellenos
  letra: string;       // el acento cuando es letra o línea sobre la tarjeta
  sobre: string;       // la letra encima de un relleno de acento
  degradado: string; barra: string;
  sombra: string; radio: number; borde?: string; desenfoque?: string;
};
/* El tema de la Cámara viva: tarjeta blanca con sombra de sol. El fondo (claro u oscuro) solo cambia la sombra */
export const temaCamaraViva = (acento?: string | null, oscuro = false): TemaG => {
  const a = acentoValido(acento);
  return {
    sup: '#fff', tinta: '#16120F', gris: '#8a8079', riel: 'rgba(22,18,15,.08)', suave: '#efefef', azul: '#0095F6',
    acento: a, letra: legibleSobre(a), sobre: sobreDe(a), degradado: degradadoDe(a), barra: `linear-gradient(90deg,${a},${mezcla(a, '#ffffff', 0.28)})`,
    sombra: oscuro ? '0 40px 70px rgba(0,0,0,.6), 0 10px 18px rgba(0,0,0,.4)' : '34px 46px 60px rgba(70,40,20,.32), 8px 12px 16px rgba(70,40,20,.2)',
    radio: 48,
  };
};
