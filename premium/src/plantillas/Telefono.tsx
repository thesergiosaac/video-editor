// Teléfono de frente (20-sep) — para ENSEÑAR una pantalla vertical: tu app, tu perfil, una grabación.
// A diferencia del Celular 3D, este va de frente y quieto: la pantalla se lee, que es de lo que se trata.
// Si la captura es más larga que la pantalla, baja sola despacio mientras hablas.
import React from 'react';
import {Img, OffthreadVideo, staticFile} from 'remotion';
import {noise2D} from '@remotion/noise';
import {OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Etiqueta, zonaMockup} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const esVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export const Telefono: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d: any = p.datos || {};
  const {op, sale} = usePresenciaGrupo();
  const bruto = String(d.medio || d.imagen || d.video || '');
  // una URL (lo que sube la persona) o un archivo del propio sitio (las muestras)
  const medio = bruto && !/^(https?:|data:|blob:)/.test(bruto) ? staticFile(bruto) : bruto;

  const entra = sp(t, p.t0 + 0.2, {damping: 17, stiffness: 95, mass: 1.05});
  const x = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);
  const fy = noise2D('tel-y', 0, t * 0.22) * 7;           // respira, no está muerto

  /* El sitio donde se puede dibujar depende de la forma (20-sep): «encima» y «abajo» usan la mitad
     de arriba —la capa solo mide el 56% del alto y lo demás se recorta—; «partida» usa el hueco de
     debajo, donde ya no está tu video. Dentro de esa zona: etiqueta, teléfono y título. */
  const Z = zonaMockup(p.forma, Hd);
  const ETQ = 78, TIT = d.titulo ? 94 : 12;
  const hueco = Z.y1 - Z.y0 - ETQ - TIT - 46;
  const AL = Math.max(400, Math.min(940, hueco));
  const AN = Math.round(AL * 0.492);                     // la proporción de un teléfono
  const R = Math.round(AL * 0.06), BORDE = Math.max(9, Math.round(AL * 0.0124));
  const cx = 540, cy = Z.y0 + ETQ + hueco / 2;
  const esc = (0.86 + 0.14 * entra) * (1 - 0.06 * x);
  const ty = (1 - entra) * 120 + fy - x * 90;

  // si la captura es larga, se desplaza sola: se ve que hay más abajo
  const alto = Number(d.alto) || 0, ancho = Number(d.ancho) || 0;
  const altoEnPantalla = ancho ? (AN - BORDE * 2) * (alto / ancho) : AL - BORDE * 2;
  const sobra = Math.max(0, altoEnPantalla - (AL - BORDE * 2));
  const avance = rampa(t, p.t0 + 1.1, p.t1 - 1.1, EASE.suave);
  const desliza = -sobra * avance;

  if (op <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op * (1 - x)}}>
      <div style={{position: 'absolute', left: cx - 260, top: Z.y0 + 16, width: 520,
        display: 'flex', justifyContent: 'center'}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={p.t0 + 0.35} />
      </div>

      <div style={{position: 'absolute', left: cx - AN / 2, top: cy - AL / 2 + ty, width: AN, height: AL,
        transform: `scale(${esc})`, transformOrigin: '50% 50%'}}>
        {/* la sombra del aparato */}
        <div style={{position: 'absolute', inset: -2, borderRadius: R + 4,
          boxShadow: `0 44px 90px ${pal.a(0.5)}, 0 12px 28px ${pal.a(0.34)}`}} />
        {/* el marco */}
        <div style={{position: 'absolute', inset: 0, borderRadius: R, background: `linear-gradient(155deg, ${pal.a(0.5)}, #0A0709 42%, #161014)`,
          border: `1.5px solid ${pal.a(0.3)}`}} />
        {/* la pantalla */}
        <div style={{position: 'absolute', left: BORDE, top: BORDE, width: AN - BORDE * 2, height: AL - BORDE * 2,
          borderRadius: R - BORDE + 2, overflow: 'hidden', background: '#0B0709'}}>
          {medio ? (
            <div style={{position: 'absolute', left: 0, top: desliza, width: '100%'}}>
              {esVideo(medio)
                ? <OffthreadVideo src={medio} muted startFrom={Math.max(0, Math.round(Number(d.desde || 0) * 30))}
                    style={{width: '100%', display: 'block'}} />
                : <Img src={medio} style={{width: '100%', display: 'block'}} />}
            </div>
          ) : null}
          {/* el reflejo del vidrio, que se va cuando entra */}
          <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `linear-gradient(118deg, rgba(255,255,255,${0.16 * (1 - entra) + 0.05}) 0%, transparent 38%, transparent 72%, rgba(255,255,255,0.04) 100%)`}} />
        </div>
        {/* la islita de arriba */}
        <div style={{position: 'absolute', left: AN / 2 - AN * 0.11, top: BORDE + 10, width: AN * 0.22, height: Math.round(AN * 0.057),
          borderRadius: 16, background: '#080507'}} />
        <Brillo t0={p.t0 + 0.55} dur={0.85} w={AN} h={AL} />
      </div>

      {d.titulo ? (
        <div style={{position: 'absolute', left: 78, right: 78, top: Math.min(Z.y1 - TIT + 6, cy + (AL / 2) * esc + 26),
          textAlign: 'center', opacity: clamp((t - (p.t0 + 0.7)) / 0.45, 0, 1) * (1 - x)}}>
          <div style={{fontFamily: OUTFIT, fontWeight: 900,
            fontSize: String(d.titulo).length > 28 ? 46 : 55, lineHeight: 1.06, letterSpacing: '-0.03em', color: pal.tinta}}>
            {String(d.titulo)}
          </div>
        </div>
      ) : null}
    </div>
  );
};
