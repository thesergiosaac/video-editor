// Navegador (20-sep) — para ENSEÑAR una pantalla horizontal: tu web, un panel, una herramienta.
// Una ventana de verdad, con su barra y su dirección, flotando sobre tu video. Si le dices dónde
// mirar (zona), se acerca despacio a ese punto mientras hablas.
//
// 23-sep — FORMA «profundo»: la ventana va DETRÁS de la persona, recortada con su silueta, para
// que el pelo y los hombros queden por delante de la explicación. Sergio: «la pantalla no puede
// tapar mi cabeza».
//   ⚠️ La ventana entera va en la capa de ATRÁS: es lo que tiene que quedar tapado.
//   ⚠️ El título va DELANTE. Detrás, su cuerpo se lo comería justo por el centro, que es donde se
//     lee. Misma decisión que tomó `Marco.tsx`.
import React from 'react';
import {Freeze, Img, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {noise2D} from '@remotion/noise';
import {MONO, OUTFIT} from '../tema';
import {EASE, clamp, rampa, sp, useG, useT} from '../lib/anim';
import {Brillo, Etiqueta, zonaMockup} from '../lib/Piezas';
import {usePresenciaGrupo} from '../lib/Fondo';

const esVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export const Navegador: React.FC = () => {
  const t = useT();
  const {p, pal, Hd, parte, fps} = useG();
  const cuadro = useCurrentFrame();
  const d: any = p.datos || {};
  const {op} = usePresenciaGrupo();
  const bruto = String(d.medio || d.imagen || d.video || '');
  // una URL (lo que sube la persona) o un archivo del propio sitio (las muestras)
  const medio = bruto && !/^(https?:|data:|blob:)/.test(bruto) ? staticFile(bruto) : bruto;

  /* (24-sep) en una PANTALLA de la persona la ventana va quieta: ni flota ni crece ni se desliza, solo aparece
     y se va. Sergio: «la pantalla se mueve, debe quedarse quieta». */
  const pant = !!(p as any).pantalla;
  const entra = pant ? 1 : sp(t, p.t0 + 0.2, {damping: 18, stiffness: 100, mass: 1});
  const x = rampa(t, p.t1 - 0.8, p.t1 - 0.3, EASE.sale);
  const fy = pant ? 0 : noise2D('nav-y', 0, t * 0.2) * 6;

  /* Igual que el teléfono: la zona depende de la forma y la ventana se encoge si no cabe. */
  const BARRA = 52, R = 22;
  const Z = zonaMockup(p.forma, Hd);
  // (24-sep) las pantallas no llevan etiqueta: ocupaba la franja entre tu video y la ventana
  const ETQ = pant ? 0 : 76, TIT = d.titulo ? 94 : 12;
  const hueco = Z.y1 - Z.y0 - ETQ - TIT - 46;
  const alto = Number(d.alto) || 1000, ancho = Number(d.ancho) || 1600;
  /* (24-sep) 840 en las pantallas: Instagram en un celular alto recorta ~9 % por lado, y la ventana se salia */
  let AN = pant ? 840 : 944;
  let AL = Math.round((AN * alto) / ancho) + BARRA;
  if (AL > hueco) { const k = hueco / AL; AL = Math.round(hueco); AN = Math.round(AN * k); }
  /* (24-sep) «detras de ti»: el titulo va ARRIBA de la ventana, bajo la etiqueta. Debajo le caia a
     Sergio justo encima de la cara (la ventana baja hasta el 62 % y su cara empieza ahi). */
  const arriba = p.forma === 'profundo';
  /* (24-sep) pantallas: «detras de ti» arriba del todo (Sergio: «deberia estar mas arriba»); «tu arriba» pegada
     justo debajo de tu video. */
  /* (24-sep) «pantalla arriba, tú abajo»: la ventana pegada a tu video (abajo de su zona) y el título ENCIMA */
  const tuAbajo = pant && (p.forma as string) === 'mitadAbajo';
  const cy = pant
    ? (p.forma === 'profundo' ? Hd * 0.045 + AL / 2 : tuAbajo ? Z.y1 - 40 - AL / 2 : Z.y0 + 36 + AL / 2)
    : Z.y0 + ETQ + (arriba ? TIT : 0) + hueco / 2;
  const esc = pant ? 1 : (0.9 + 0.1 * entra) * (1 - 0.05 * x);
  const ty = pant ? 0 : (1 - entra) * 90 + fy - x * 70;

  /* zona: [x, y, ancho] en fracción de la captura. Si viene, se acerca a ese punto a mitad de la pieza. */
  const z = Array.isArray(d.zona) && d.zona.length >= 3 ? d.zona.map(Number) : null;
  const k = z ? rampa(t, p.t0 + 1.2, p.t0 + 2.7, EASE.suave) : 0;
  const zEsc = z ? 1 + (Math.min(2.2, 1 / Math.max(0.2, z[2])) - 1) * k : 1;
  // el punto al que se acerca: el centro de la zona, en coordenadas de la propia captura
  const oX = z ? (z[0] + z[2] / 2) * 100 : 50;
  const oY = z ? ((z[1] || 0) + (z[3] || z[2] * 0.6) / 2) * 100 : 50;

  if (op <= 0.001) return null;

  /* ⚠️ Con profundidad se pide dos veces: una para lo de atrás y otra para lo de delante. El
     título es lo único que va delante — si fuera detrás, el cuerpo se lo comería por el centro. */
  const titulo = d.titulo ? (
    <div style={{position: 'absolute', left: 78, right: 78,
      ...(tuAbajo ? {bottom: Hd - (cy - (AL / 2) * esc - 24)}
        : {top: arriba && !pant ? Z.y0 + ETQ - 4 : Math.min(Z.y1 - TIT + 6, cy + (AL / 2) * esc + 28)}), textAlign: 'center',
      opacity: clamp((t - (p.t0 + 0.7)) / 0.45, 0, 1) * (1 - x)}}>
      <div style={{fontFamily: OUTFIT, fontWeight: 900,
        fontSize: String(d.titulo).length > 28 ? 46 : 55, lineHeight: 1.06,
        letterSpacing: '-0.03em', color: pal.tinta,
        textShadow: parte ? '0 18px 54px rgba(0,0,0,.85)' : undefined}}>
        {String(d.titulo)}
      </div>
    </div>
  ) : null;

  if (parte === 'delante') {
    return (
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op}}>
        {titulo}
      </div>
    );
  }

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: Hd, opacity: op * (1 - x)}}>
      {pant ? null : (
      <div style={{position: 'absolute', left: 68, right: 68, top: Z.y0 + 16, display: 'flex', justifyContent: 'center'}}>
        <Etiqueta texto={String(d.etiqueta || '')} t0={p.t0 + 0.35} />
      </div>
      )}

      <div style={{position: 'absolute', left: 540 - AN / 2, top: cy - AL / 2 + ty, width: AN, height: AL,
        transform: `scale(${esc})`, transformOrigin: '50% 50%'}}>
        <div style={{position: 'absolute', inset: -2, borderRadius: R + 3,
          boxShadow: `0 38px 82px ${pal.a(0.48)}, 0 10px 24px ${pal.a(0.32)}`}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: R, overflow: 'hidden',
          background: '#100B0E', border: `1.5px solid ${pal.a(0.28)}`}}>
          {/* la barra de la ventana */}
          <div style={{height: BARRA, background: `linear-gradient(180deg, ${pal.a(0.16)}, ${pal.a(0.08)})`,
            display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px',
            borderBottom: `1px solid ${pal.a(0.18)}`}}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
              <div key={c} style={{width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.82}} />
            ))}
            {d.url ? (
              <div style={{marginLeft: 14, flex: 1, height: 28, borderRadius: 14, background: pal.a(0.14),
                display: 'flex', alignItems: 'center', padding: '0 14px'}}>
                <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 16, letterSpacing: '0.02em',
                  color: pal.a(0.72), whiteSpace: 'nowrap', overflow: 'hidden'}}>{String(d.url)}</span>
              </div>
            ) : null}
          </div>
          {/* la captura */}
          <div style={{position: 'absolute', left: 0, top: BARRA, right: 0, bottom: 0, overflow: 'hidden', background: '#0B0709'}}>
            <div style={{position: 'absolute', inset: 0,
              transform: `scale(${zEsc})`, transformOrigin: `${oX}% ${oY}%`}}>
              {medio ? (esVideo(medio)
                ? (() => {
                    /* (24-sep) arranca en SU segundo a los cuadros del video (el master va a 60), y si la
                       grabacion se acaba antes que la explicacion, se queda en su ultimo cuadro */
                    const desde = Math.max(0, Number(d.desde || 0));
                    const video = <OffthreadVideo src={medio} muted startFrom={Math.round(desde * fps)}
                      style={{width: '100%', display: 'block'}} />;
                    const dura = Number(d.dur || 0);
                    const ultimo = dura > 0 ? Math.floor((dura - desde - 0.12) * fps) : Infinity;
                    return cuadro > ultimo && ultimo > 0 ? <Freeze frame={ultimo}>{video}</Freeze> : video;
                  })()
                : <Img src={medio} style={{width: '100%', display: 'block'}} />) : null}
            </div>
            {/* el recuadro que señala, solo mientras se acerca */}
            {z && k > 0.02 && k < 0.98 ? (
              <div style={{position: 'absolute', left: `${z[0] * 100}%`, top: `${(z[1] || 0) * 100}%`,
                width: `${z[2] * 100}%`, height: `${(z[3] || z[2] * 0.6) * 100}%`,
                border: `3px solid ${pal.acento}`, borderRadius: 10, opacity: 1 - k,
                boxShadow: `0 0 0 9999px rgba(8,5,7,${0.42 * (1 - k)})`}} />
            ) : null}
          </div>
        </div>
        {pant ? null : <Brillo t0={p.t0 + 0.5} dur={0.8} w={AN} h={AL} />}
      </div>

      {/* Sin profundidad el título va aquí mismo; con profundidad ya salió en la capa de delante.
          (24-sep) solo se quita en 'atras': en pantalla partida la capa es 'contenido' y SÍ lo lleva. */}
      {parte === 'atras' ? null : titulo}
    </div>
  );
};
