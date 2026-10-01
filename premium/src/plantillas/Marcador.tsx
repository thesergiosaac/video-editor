// Marcador (20-sep) — la captura manda en la pantalla y Cherry se ACERCA al punto del que hablas,
// con un recuadro que lo señala. Para cuando el detalle es lo importante: «mira este botón», «aquí
// está el número». Tu cara se va a un círculo arriba para no estorbar.
import React from 'react';
import {Img, OffthreadVideo, staticFile} from 'remotion';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Etiqueta} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const esVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export const Marcador: React.FC = () => {
  const t = useT();
  const {p, pal, Hd} = useG();
  const d: any = p.datos || {};
  const {op} = usePresenciaGrupo();
  const bruto = String(d.medio || d.imagen || d.video || '');
  // una URL (lo que sube la persona) o un archivo del propio sitio (las muestras)
  const medio = bruto && !/^(https?:|data:|blob:)/.test(bruto) ? staticFile(bruto) : bruto;

  const entra = sp(t, p.t0 + 0.2, {damping: 19, stiffness: 105, mass: 1});
  const x = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);

  /* La caja donde vive la captura: casi toda la pantalla, dejando el círculo de tu cara arriba
     (la forma «completa» ya lo reserva) y sitio abajo para los subtítulos. */
  const CX = 64, AN = 1080 - CX * 2;
  // la caja toma la forma de la captura (horizontal o vertical) y se centra en el hueco libre
  const anM = Number(d.ancho) || 16, alM = Number(d.alto) || 9;
  const TOPE = Math.min(Hd - 470 - 300, 1180);
  const AL = Math.min(TOPE, Math.round((AN * alM) / anM));
  const CY = 470 + Math.max(0, (TOPE - AL) / 2);

  /* zona: [x, y, ancho, alto] en fracción de la captura. Sin zona, un acercamiento lento y neutro. */
  const z = Array.isArray(d.zona) && d.zona.length >= 3 ? d.zona.map(Number) : null;
  const k = rampa(t, p.t0 + 1.0, p.t0 + 2.6, EASE.suave);
  const zEsc = z ? 1 + (Math.min(2.2, 1 / Math.max(0.22, z[2])) - 1) * k : 1 + 0.14 * k;
  const oX = z ? (z[0] + z[2] / 2) * 100 : 50;
  const oY = z ? ((z[1] || 0) + (z[3] || z[2] * 0.6) / 2) * 100 : 50;

  // el recuadro aparece antes de acercarse y se disuelve al llegar
  const marco = z ? clamp((t - (p.t0 + 0.55)) / 0.4, 0, 1) * (1 - clamp((t - (p.t1 - 1.6)) / 0.7, 0, 1)) : 0;

  if (op <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op * (1 - x)}}>
      <div style={{position: 'absolute', left: CX, right: CX, top: CY - 74, display: 'flex', justifyContent: 'center'}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={p.t0 + 0.3} />
      </div>

      <div style={{position: 'absolute', left: CX, top: CY, width: AN, height: AL,
        transform: `scale(${0.94 + 0.06 * entra})`, transformOrigin: '50% 50%',
        opacity: entra}}>
        <div style={{position: 'absolute', inset: -2, borderRadius: 26,
          boxShadow: `0 40px 84px ${pal.a(0.5)}, 0 10px 26px ${pal.a(0.3)}`}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden',
          background: '#0B0709', border: `1.5px solid ${pal.a(0.3)}`}}>
          <div style={{position: 'absolute', inset: 0, transform: `scale(${zEsc})`,
            transformOrigin: `${oX}% ${oY}%`}}>
            {medio ? (esVideo(medio)
              ? <OffthreadVideo src={medio} muted startFrom={Math.max(0, Math.round(Number(d.desde || 0) * 30))}
                  style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
              : <Img src={medio} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />) : null}
          </div>

          {/* el recuadro que señala dónde mirar */}
          {z && marco > 0.02 ? (
            <div style={{position: 'absolute', left: `${z[0] * 100}%`, top: `${(z[1] || 0) * 100}%`,
              width: `${z[2] * 100}%`, height: `${(z[3] || z[2] * 0.6) * 100}%`,
              border: `4px solid ${pal.acento}`, borderRadius: 12, opacity: marco,
              boxShadow: `0 0 0 9999px rgba(8,5,7,${0.46 * marco}), 0 0 28px ${pal.a(0.6)}`}}>
              {d.nota ? (
                <div style={{position: 'absolute', left: 0, top: -44, display: 'flex'}}>
                  <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: pal.sobre, background: pal.acento,
                    padding: '7px 14px', borderRadius: 9, whiteSpace: 'nowrap'}}>{String(d.nota)}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {d.titulo ? (
        <div style={{position: 'absolute', left: 78, right: 78, top: CY + AL + 40,
          textAlign: 'center', opacity: clamp((t - (p.t0 + 0.7)) / 0.45, 0, 1) * (1 - x)}}>
          <div style={{fontFamily: OUTFIT, fontWeight: 900,
            fontSize: String(d.titulo).length > 28 ? 44 : 52, lineHeight: 1.06, letterSpacing: '-0.03em', color: pal.tinta}}>
            {String(d.titulo)}
          </div>
        </div>
      ) : null}
    </div>
  );
};
