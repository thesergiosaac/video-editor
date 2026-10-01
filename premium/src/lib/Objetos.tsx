// Objetos para las placas: cosas dibujadas con volumen que acompañan al texto (una billetera cuando hablas de
// plata, una bombilla cuando hablas de una idea…). Todos se dibujan en una caja de 300×300 y llevan la misma
// sombra larga que las letras, para que parezcan del mismo mundo.
import React from 'react';

type Props = {ac: string; claro: string; hondo: string};

const D = ({id, de, a, x2 = 1, y2 = 1}: {id: string; de: string; a: string; x2?: number; y2?: number}) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    <stop offset="0" stopColor={de} /><stop offset="1" stopColor={a} />
  </linearGradient>
);

/* ── Billetera ── */
const Billetera: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-w1" de={claro} a={hondo} /><D id="ob-w2" de="#F7F1E8" a="#D9CFBE" /></defs>
    <rect x="46" y="118" width="208" height="42" rx="10" fill="url(#ob-w2)" />
    <rect x="70" y="96" width="150" height="34" rx="8" fill="#EFE6D6" transform="rotate(-7 145 113)" />
    <rect x="40" y="126" width="220" height="118" rx="26" fill="url(#ob-w1)" />
    <rect x="40" y="126" width="220" height="30" rx="14" fill="#fff" opacity="0.18" />
    <rect x="166" y="160" width="106" height="50" rx="16" fill={hondo} />
    <circle cx="214" cy="185" r="15" fill="#fff" opacity="0.92" />
    <circle cx="214" cy="185" r="7" fill={ac} />
  </g>
);

/* ── Bombilla ── */
const Bombilla: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-b1" de="#FFE9A8" a={ac} /><D id="ob-b2" de="#CFC7BB" a="#8E8579" /></defs>
    <circle cx="150" cy="128" r="86" fill={ac} opacity="0.18" />
    <path d="M150 42c-45 0-80 34-80 78 0 30 16 46 27 60 8 10 11 18 11 26h84c0-8 3-16 11-26 11-14 27-30 27-60 0-44-35-78-80-78z" fill="url(#ob-b1)" />
    <path d="M118 96c4-20 18-32 36-34" stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.65" />
    <rect x="108" y="212" width="84" height="20" rx="8" fill="url(#ob-b2)" />
    <rect x="114" y="236" width="72" height="16" rx="8" fill="#9A9082" />
    <rect x="124" y="256" width="52" height="14" rx="7" fill="#7E7568" />
  </g>
);

/* ── Monedas ── */
const Monedas: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-m1" de={claro} a={hondo} /><D id="ob-m2" de="#FFD98A" a="#D79A2B" /></defs>
    {[0, 1, 2].map((i) => (
      <g key={i} transform={`translate(0 ${-i * 40})`}>
        <ellipse cx="150" cy="222" rx="96" ry="34" fill={i === 2 ? 'url(#ob-m2)' : 'url(#ob-m1)'} />
        <ellipse cx="150" cy="210" rx="96" ry="34" fill={i === 2 ? '#FFE3A6' : claro} />
        <ellipse cx="150" cy="210" rx="62" ry="21" fill="#fff" opacity="0.28" />
      </g>
    ))}
  </g>
);

/* ── Reloj ── */
const Reloj: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-r1" de={claro} a={hondo} /></defs>
    <circle cx="150" cy="152" r="106" fill="url(#ob-r1)" />
    <circle cx="150" cy="152" r="84" fill="#F7F1E8" />
    <circle cx="150" cy="152" r="84" fill="#000" opacity="0.06" />
    <circle cx="150" cy="146" r="80" fill="#FBF6EE" />
    {Array.from({length: 12}).map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <circle key={i} cx={150 + Math.cos(a) * 64} cy={146 + Math.sin(a) * 64} r={i % 3 === 0 ? 5 : 3} fill="#241C16" opacity="0.5" />;
    })}
    <rect x="146" y="92" width="9" height="60" rx="4" fill="#241C16" />
    <rect x="148" y="142" width="54" height="9" rx="4" fill={ac} />
    <circle cx="150" cy="146" r="9" fill="#241C16" />
  </g>
);

/* ── Cohete ── */
const Cohete: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-c1" de="#FFFFFF" a="#D8CFC2" /><D id="ob-c2" de="#FFC46B" a={ac} /></defs>
    <path d="M150 28c34 28 54 74 54 124v40h-108v-40c0-50 20-96 54-124z" fill="url(#ob-c1)" />
    <path d="M96 150c-22 12-34 34-34 62l34-16z" fill={hondo} />
    <path d="M204 150c22 12 34 34 34 62l-34-16z" fill={hondo} />
    <circle cx="150" cy="118" r="26" fill={ac} opacity="0.25" />
    <circle cx="150" cy="118" r="20" fill="#7CC8E8" />
    <circle cx="143" cy="111" r="7" fill="#fff" opacity="0.8" />
    <path d="M124 192h52l-8 28h-36z" fill="#B9AFA1" />
    <path d="M150 220c14 16 22 34 22 52-8-8-14-12-22-12s-14 4-22 12c0-18 8-36 22-52z" fill="url(#ob-c2)" />
  </g>
);

/* ── Llave ── */
const Llave: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-k1" de="#FFE3A6" a="#D79A2B" /></defs>
    <g transform="rotate(-38 150 150)">
      <circle cx="150" cy="86" r="52" fill="url(#ob-k1)" />
      <circle cx="150" cy="86" r="24" fill="#F5EFE6" />
      <rect x="138" y="128" width="24" height="132" rx="8" fill="url(#ob-k1)" />
      <rect x="162" y="196" width="34" height="20" rx="6" fill="url(#ob-k1)" />
      <rect x="162" y="232" width="26" height="18" rx="6" fill="url(#ob-k1)" />
      <path d="M140 132h20v10h-20z" fill="#fff" opacity="0.4" />
    </g>
  </g>
);

/* ── Diana ── */
const Diana: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-d1" de={claro} a={hondo} /></defs>
    <circle cx="150" cy="152" r="106" fill="#F4EEE4" />
    <circle cx="150" cy="152" r="106" fill="url(#ob-d1)" opacity="0.25" />
    <circle cx="150" cy="152" r="78" fill="#EDE4D6" />
    <circle cx="150" cy="152" r="52" fill="url(#ob-d1)" />
    <circle cx="150" cy="152" r="24" fill="#F7F1E8" />
    <circle cx="150" cy="152" r="10" fill={ac} />
    <path d="M232 70 L168 134" stroke="#8E8579" strokeWidth="13" strokeLinecap="round" />
    <path d="M168 134 l-10 -10 l24 -6 l-6 24z" fill="#3A322A" />
    <path d="M232 70 l26 -26 l6 22 l22 6z" fill={ac} />
  </g>
);

/* ── Subida ── */
const Subida: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-s1" de={claro} a={hondo} /></defs>
    <rect x="46" y="176" width="52" height="80" rx="12" fill="#D8CFC2" />
    <rect x="124" y="128" width="52" height="128" rx="12" fill="#BEB3A3" />
    <rect x="202" y="70" width="52" height="186" rx="12" fill="url(#ob-s1)" />
    <path d="M62 148 L150 96 L238 34" stroke={ac} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M238 34 l-40 2 l30 30z" fill={ac} />
    <circle cx="62" cy="148" r="11" fill={ac} />
    <circle cx="150" cy="96" r="11" fill={ac} />
  </g>
);

/* ── Plato ── */
const Plato: React.FC<Props> = ({ac, claro, hondo}) => (
  <g>
    <defs><D id="ob-p1" de="#FFFFFF" a="#D9D0C2" /></defs>
    <ellipse cx="150" cy="176" rx="118" ry="70" fill="url(#ob-p1)" />
    <ellipse cx="150" cy="168" rx="86" ry="50" fill="#F2EAE0" />
    <ellipse cx="150" cy="166" rx="56" ry="32" fill={ac} opacity="0.85" />
    <ellipse cx="132" cy="158" rx="18" ry="10" fill="#fff" opacity="0.35" />
    <rect x="252" y="96" width="11" height="150" rx="5" fill="#B9AFA1" />
    <rect x="42" y="96" width="11" height="150" rx="5" fill="#B9AFA1" />
    <rect x="30" y="96" width="9" height="56" rx="4" fill="#B9AFA1" />
    <rect x="56" y="96" width="9" height="56" rx="4" fill="#B9AFA1" />
  </g>
);

export const OBJETOS: Record<string, React.FC<Props>> = {
  billetera: Billetera, bombilla: Bombilla, monedas: Monedas, reloj: Reloj,
  cohete: Cohete, llave: Llave, diana: Diana, subida: Subida, plato: Plato,
};

/** Un objeto, del tamaño que se le pida y con su sombra larga (la misma dirección que la de las letras) */
export const Objeto: React.FC<{nombre: string; tam: number; pal: {acento: string; claro: string; hondo: string};
  sombra: string; estilo?: React.CSSProperties}> = ({nombre, tam, pal, sombra, estilo}) => {
  const O = OBJETOS[nombre];
  if (!O) return null;
  const s = tam / 300;
  const gotas = [[0.02, 0.03, 0.30], [0.06, 0.08, 0.24], [0.14, 0.18, 0.17], [0.28, 0.38, 0.11], [0.5, 0.7, 0.07]]
    .map(([d, b, o]) => `drop-shadow(${(d * tam).toFixed(0)}px ${(d * tam).toFixed(0)}px ${(b * tam).toFixed(0)}px rgba(${sombra},${o}))`)
    .join(' ');
  return (
    <div style={{width: tam, height: tam, ...estilo}}>
      <svg width={tam} height={tam} viewBox="0 0 300 300" style={{display: 'block', filter: gotas, overflow: 'visible'}}>
        <g transform={`scale(1)`}>
          <O ac={pal.acento} claro={pal.claro} hondo={pal.hondo} />
        </g>
      </svg>
    </div>
  );
};
