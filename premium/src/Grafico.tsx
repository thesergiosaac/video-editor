// Un gráfico premium: la composición recibe la pieza que eligió graficos.js (tipo, forma, datos, tiempos) y dibuja SOLO
// el gráfico, con fondo transparente. El cuadro 0 es el instante `inicio` del video (el primer cuadro de la capa).
// Se diseña a 1080 de ancho y se escala al tamaño del video.
import React from 'react';
import {AbsoluteFill} from 'remotion';
// @ts-ignore
import GRAF from './graficos.js';
import {paletaDe} from './tema';
import {G, Pieza, useG, useT} from './lib/anim';
import {FondoHueco} from './lib/Fondo';
import {Numero} from './plantillas/Numero';
import {Porcentaje} from './plantillas/Porcentaje';
import {Lista} from './plantillas/Lista';
import {Comparacion} from './plantillas/Comparacion';
import {Linea} from './plantillas/Linea';
import {Cita} from './plantillas/Cita';
import {Celular} from './plantillas/Celular';
import {Desglose} from './plantillas/Desglose';
import {Pasos} from './plantillas/Pasos';
import {Mito} from './plantillas/Mito';
import {Palabra} from './plantillas/Palabra';
import {Medidor} from './plantillas/Medidor';
import {Podio} from './plantillas/Podio';
// con profundidad: parte de cada uno va DETRÁS de la persona y parte DELANTE
import {Monumento} from './plantillas/Monumento';
import {Clave} from './plantillas/Clave';
import {Panel} from './plantillas/Panel';
import {Galeria} from './plantillas/Galeria';
import {Banda} from './plantillas/Banda';
import {Contraste} from './plantillas/Contraste';
import {Marco} from './plantillas/Marco';
import {Placa} from './plantillas/Placa';
// tanda de números: más opciones del mismo estilo premium
import {Ranking} from './plantillas/Ranking';
import {Meta} from './plantillas/Meta';
import {Reparto} from './plantillas/Reparto';
import {Rango} from './plantillas/Rango';
import {Multiplo} from './plantillas/Multiplo';
import {Evolucion} from './plantillas/Evolucion';
import {Cuota} from './plantillas/Cuota';
// tanda de explicar y comparar
import {Flujo} from './plantillas/Flujo';
import {Balanza} from './plantillas/Balanza';
import {Piramide} from './plantillas/Piramide';
import {Tabla} from './plantillas/Tabla';
import {Cuadrante} from './plantillas/Cuadrante';
import {Agenda} from './plantillas/Agenda';
// tanda de rematar la idea
import {Titular} from './plantillas/Titular';
import {Pregunta} from './plantillas/Pregunta';
import {Alerta} from './plantillas/Alerta';
import {Claves} from './plantillas/Claves';
import {Dato} from './plantillas/Dato';
import {Cierre} from './plantillas/Cierre';

// el grupo de MOSTRAR (20-sep): enseñar una pantalla, no ilustrarla
import {Telefono} from './plantillas/Telefono';
import {Navegador} from './plantillas/Navegador';
import {Marcador} from './plantillas/Marcador';
// (29-sep) la familia «La persiana»: tarjetas de golpe a pantalla completa (forma «tarjeta»)
import {PeTarjeta, PeLista, PeCifra, PeVs, PeClipV, PeClipH, PeFoto} from './plantillas/persiana/piezas';
// (29-sep, tanda 2) la persiana CON TU VIDEO: el ensamblador mueve el video y esto dibuja lo de alrededor
import {PeVentana, PeEmpuja, PeSales, PeTu} from './plantillas/persiana/conVideo';
// (2-oct) la pantalla con sello: el gancho del Día 2 (detrás de ti, con tu recorte delante)
import {PeFalso} from './plantillas/persiana/falso';

// parte: 'todo' (encima) o 'fondo'/'contenido' por separado (pantalla partida y completa: el fondo se dibuja en menos
// resolución porque son solo degradados, y el contenido en el tamaño del video).
// ancho: ancho real de la capa (si es menor que W, todo se dibuja a escala y el ensamblador la amplía).
export type PropsGrafico = {p: Pieza; color: string; W: number; H: number; fps: number; inicio: number; vista?: boolean; parte?: 'todo' | 'fondo' | 'contenido' | 'atras' | 'delante'; ancho?: number};

const PLANTILLAS: Record<string, React.FC> = {numero: Numero, porcentaje: Porcentaje, lista: Lista, comparacion: Comparacion, linea: Linea, cita: Cita, celular: Celular,
  desglose: Desglose, pasos: Pasos, mito: Mito, palabra: Palabra, medidor: Medidor, podio: Podio,
  monumento: Monumento, clave: Clave, panel: Panel, galeria: Galeria, banda: Banda, contraste: Contraste, marco: Marco, placa: Placa,
  ranking: Ranking, meta: Meta, reparto: Reparto, rango: Rango, multiplo: Multiplo, evolucion: Evolucion, cuota: Cuota,
  flujo: Flujo, balanza: Balanza, piramide: Piramide, tabla: Tabla, cuadrante: Cuadrante, agenda: Agenda,
  titular: Titular, pregunta: Pregunta, alerta: Alerta, claves: Claves, dato: Dato, cierre: Cierre,
  telefono: Telefono, navegador: Navegador, marcador: Marcador,
  pe_tarjeta: PeTarjeta, pe_lista: PeLista, pe_cifra: PeCifra, pe_vs: PeVs, pe_clipv: PeClipV, pe_cliph: PeClipH, pe_foto: PeFoto,
  pe_ventana: PeVentana, pe_empuja: PeEmpuja, pe_sales: PeSales, pe_tu: PeTu, pe_falso: PeFalso};

const Dentro: React.FC<{parte: string}> = ({parte}) => {
  const t = useT();
  const {p} = useG();
  const Plantilla = PLANTILLAS[p.tipo];
  if (!Plantilla || t < p.t0 || t >= p.t1) return null;
  return (
    <>
      {/* «abajo» (20-sep) no tiene hueco: el video sigue de fondo, solo se corre */}
      {/* «tarjeta» (29-sep, La persiana) tampoco: la tarjeta tapa el cuadro entero ella sola */}
      {/* la persiana con tu video (ventana, empuja, sales, tu) dibuja su propio hueco */}
      {p.forma !== 'encima' && p.forma !== 'profundo' && p.forma !== 'abajo' && p.forma !== 'tarjeta' && !GRAF.CALLAN[p.forma] ? <FondoHueco parte={parte} /> : null}
      {parte !== 'fondo' ? <Plantilla /> : null}
    </>
  );
};

export const Grafico: React.FC<PropsGrafico> = ({p, color, W, H, fps, inicio, vista = false, parte = 'todo', ancho}) => {
  const real = ancho || W;
  const esc = W / 1080;          // del tamaño del video al dibujo (1080 de ancho)
  const dibujo = real / 1080;    // y del dibujo al tamaño de ESTA capa (el fondo se dibuja más chico)
  const caja = GRAF.cajaPremium(p, W, H);
  const ctx = {p, pal: paletaDe(color), inicio, fps, W, H, esc, Hd: H / esc, vista, parte};
  return (
    <G.Provider value={ctx}>
      <AbsoluteFill style={{backgroundColor: 'transparent'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: caja.h / esc, transform: `scale(${dibujo})`, transformOrigin: '0 0', overflow: 'hidden'}}>
          <Dentro parte={parte} />
        </div>
      </AbsoluteFill>
    </G.Provider>
  );
};

/** Medidas de la composición para una pieza: el ancho del video, el alto de su caja y los cuadros que dura la capa */
export const medidas = (props: PropsGrafico) => {
  const caja = GRAF.cajaPremium(props.p, props.W, props.H);
  const c = GRAF.cuadros(props.p, props.fps);
  const k = (props.ancho || props.W) / props.W;
  return {width: Math.round((props.W * k) / 2) * 2, height: Math.round((caja.h * k) / 2) * 2, durationInFrames: Math.max(1, c.total), fps: props.fps};
};
