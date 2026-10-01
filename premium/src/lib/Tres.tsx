// Objetos en 3D de verdad: geometría, materiales y luces. La luz principal viene de arriba a la izquierda,
// igual que la que proyecta la sombra de las letras, y cae sobre un plano invisible que solo recoge la sombra.
// Así el objeto y el texto parecen estar en la misma pared.
import React, {useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {estelaObjeto} from './sombras';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
/* El cuarto de luz de three: es lo que hace que el oro parezca oro. Se genera por lienzo porque
   una textura creada en otro contexto de dibujo no sirve (el metal saldría negro). */
function entorno(gl: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(gl);
  const t = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return t;
}

/* Una caja con las esquinas redondeadas y el borde biselado: es lo que hace que la luz «agarre» en los cantos */
function cajaBlanda(an: number, al: number, fondo: number, r: number) {
  const s = new THREE.Shape();
  const x = -an / 2, y = -al / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + an - r, y); s.quadraticCurveTo(x + an, y, x + an, y + r);
  s.lineTo(x + an, y + al - r); s.quadraticCurveTo(x + an, y + al, x + an - r, y + al);
  s.lineTo(x + r, y + al); s.quadraticCurveTo(x, y + al, x, y + al - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, {depth: fondo, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05,
    bevelSegments: 2, curveSegments: 10});
  g.center();
  return g;
}

type P = {ac: string; claro: string; hondo: string};
const M = {
  papel: {color: '#F7F2E9', roughness: 0.68, metalness: 0.02},
  cuero: {roughness: 0.52, metalness: 0.04},
  metal: {color: '#DCD5C7', roughness: 0.25, metalness: 0.88, envMapIntensity: 2.4},
  oro:   {color: '#F0BF55', roughness: 0.2, metalness: 0.92, envMapIntensity: 2.6},
  vidrio:{color: '#FFF6D8', roughness: 0.12, metalness: 0.0},
};

/* ── Bombilla ── */
const Bombilla: React.FC<P> = ({ac}) => (
  <group>
    <mesh castShadow position={[0, 0.5, 0]}>
      <sphereGeometry args={[1.15, 32, 24]} />
      <meshStandardMaterial color={ac} roughness={0.18} metalness={0.05} emissive={ac} emissiveIntensity={0.28} />
    </mesh>
    <mesh castShadow position={[0, -0.62, 0]}>
      <cylinderGeometry args={[0.52, 0.62, 0.5, 24]} />
      <meshStandardMaterial {...M.metal} />
    </mesh>
    {[0, 1, 2].map((i) => (
      <mesh key={i} castShadow position={[0, -0.98 - i * 0.2, 0]}>
        <torusGeometry args={[0.46 - i * 0.03, 0.07, 8, 20]} />
        <meshStandardMaterial color="#BDB6A8" roughness={0.35} metalness={0.7} />
      </mesh>
    ))}
    <mesh castShadow position={[0, -1.62, 0]}>
      <sphereGeometry args={[0.2, 14, 12]} />
      <meshStandardMaterial color="#8E8579" roughness={0.5} metalness={0.4} />
    </mesh>
  </group>
);

/* ── Monedas ── */
const Monedas: React.FC<P> = ({ac}) => (
  <group rotation={[0.22, 0, 0]} position={[0, -0.3, 0]}>
    {[0, 1, 2].map((i) => (
      <mesh key={i} castShadow position={[(i % 2) * 0.1 - 0.05, i * 0.36, (i % 2) * 0.08]} rotation={[0, i * 0.6, i * 0.04]}>
        <cylinderGeometry args={[1.1, 1.1, 0.32, 36]} />
        <meshStandardMaterial color="#F2C453" roughness={0.22} metalness={0.9} envMapIntensity={2.6} />
      </mesh>
    ))}
    <mesh castShadow position={[1.35, 0.15, 0.55]} rotation={[0, 0.35, 1.32]}>
      <cylinderGeometry args={[1.05, 1.05, 0.3, 36]} />
      <meshStandardMaterial color={ac} roughness={0.25} metalness={0.68} envMapIntensity={2.2} />
    </mesh>
  </group>
);

/* ── Billetera ── */
const Billetera: React.FC<P> = ({ac, hondo}) => {
  const cuerpo = useMemo(() => cajaBlanda(2.8, 1.9, 0.55, 0.22), []);
  const tarjeta = useMemo(() => cajaBlanda(1.5, 0.95, 0.06, 0.1), []);
  return (
    <group rotation={[0.2, -0.38, 0.06]}>
      <mesh castShadow geometry={tarjeta} position={[0.15, 1.0, 0.05]} rotation={[0, 0, 0.12]}>
        <meshStandardMaterial color="#F4EEE4" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh castShadow geometry={cuerpo} position={[0, 0, 0]}>
        <meshStandardMaterial color={ac} {...M.cuero} />
      </mesh>
      <mesh castShadow position={[0, -0.05, 0.31]}>
        <boxGeometry args={[2.84, 0.16, 0.02]} />
        <meshStandardMaterial color={hondo} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0.92, 0.32, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.08, 32]} />
        <meshStandardMaterial {...M.oro} />
      </mesh>
    </group>
  );
};

/* ── Cohete ── */
const Cohete: React.FC<P> = ({ac}) => (
  <group rotation={[0.1, 0.5, 0.22]}>
    <mesh castShadow position={[0, 0.9, 0]}>
      <coneGeometry args={[0.62, 1.2, 24]} />
      <meshStandardMaterial color={ac} roughness={0.3} metalness={0.2} />
    </mesh>
    <mesh castShadow position={[0, -0.2, 0]}>
      <cylinderGeometry args={[0.62, 0.62, 1.9, 24]} />
      <meshStandardMaterial color="#F4EEE4" roughness={0.38} metalness={0.15} />
    </mesh>
    <mesh castShadow position={[0, 0.15, 0.58]}>
      <sphereGeometry args={[0.26, 18, 14]} />
      <meshStandardMaterial color="#7CC8E8" roughness={0.1} metalness={0.4} />
    </mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} castShadow position={[s * 0.62, -1.0, 0]} rotation={[0, 0, s * -0.45]}>
        <boxGeometry args={[0.16, 0.9, 0.5]} />
        <meshStandardMaterial color={ac} roughness={0.35} metalness={0.2} />
      </mesh>
    ))}
    <mesh castShadow position={[0, -1.32, 0]}>
      <cylinderGeometry args={[0.45, 0.58, 0.4, 24]} />
      <meshStandardMaterial {...M.metal} />
    </mesh>
  </group>
);

/* ── Reloj ── */
const Reloj: React.FC<P> = ({ac}) => (
  <group rotation={[0.1, -0.22, 0]}>
    <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1.5, 1.5, 0.4, 40]} />
      <meshStandardMaterial color="#E7E0D2" roughness={0.3} metalness={0.68} envMapIntensity={2.2} />
    </mesh>
    <mesh position={[0, 0, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1.25, 1.25, 0.06, 40]} />
      <meshStandardMaterial color="#FCF8F1" roughness={0.55} metalness={0.05} />
    </mesh>
    {Array.from({length: 12}).map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.sin(a) * 1.02, Math.cos(a) * 1.02, 0.26]}>
          <cylinderGeometry args={[i % 3 === 0 ? 0.075 : 0.045, i % 3 === 0 ? 0.075 : 0.045, 0.05, 16]} />
          <meshStandardMaterial color="#3A312A" roughness={0.6} />
        </mesh>
      );
    })}
    <mesh castShadow position={[0.22, 0.38, 0.3]} rotation={[0, 0, -0.52]}>
      <boxGeometry args={[0.09, 0.85, 0.05]} />
      <meshStandardMaterial color="#2A231D" roughness={0.5} />
    </mesh>
    <mesh castShadow position={[-0.3, -0.12, 0.3]} rotation={[0, 0, 1.2]}>
      <boxGeometry args={[0.075, 0.62, 0.05]} />
      <meshStandardMaterial color={ac} roughness={0.4} />
    </mesh>
    <mesh position={[0, 0, 0.34]}>
      <sphereGeometry args={[0.1, 14, 12]} />
      <meshStandardMaterial color="#2A231D" roughness={0.4} />
    </mesh>
  </group>
);

/* ── Llave ── */
const Llave: React.FC<P> = () => {
  const paleta = useMemo(() => cajaBlanda(0.34, 1.9, 0.16, 0.08), []);
  return (
    <group rotation={[0.25, -0.2, -0.6]}>
      <mesh castShadow position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.66, 0.2, 10, 26]} />
        <meshStandardMaterial {...M.oro} />
      </mesh>
      <mesh castShadow geometry={paleta} position={[0, -0.25, 0]}>
        <meshStandardMaterial {...M.oro} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} castShadow position={[0.3, -0.75 - i * 0.42, 0]}>
          <boxGeometry args={[0.44, 0.22, 0.16]} />
          <meshStandardMaterial {...M.oro} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Barras subiendo ── */
const Subida: React.FC<P> = ({ac}) => (
  <group rotation={[0.12, -0.42, 0]}>
    {[[-1.25, 1.0], [0, 1.7], [1.25, 2.5]].map(([x, h], i) => (
      <mesh key={i} castShadow position={[x, h / 2 - 1.1, 0]}>
        <boxGeometry args={[0.85, h, 0.85]} />
        <meshStandardMaterial color={i === 2 ? ac : '#E2DACC'} roughness={0.45} metalness={0.1} />
      </mesh>
    ))}
    <mesh castShadow position={[0.1, 1.5, 0.7]} rotation={[0, 0, 0.62]}>
      <cylinderGeometry args={[0.1, 0.1, 3.4, 20]} />
      <meshStandardMaterial color={ac} roughness={0.3} metalness={0.3} />
    </mesh>
    <mesh castShadow position={[1.42, 2.0, 0.7]} rotation={[0, 0, -0.95]}>
      <coneGeometry args={[0.28, 0.6, 24]} />
      <meshStandardMaterial color={ac} roughness={0.3} metalness={0.3} />
    </mesh>
  </group>
);

/* ── Diana ── */
const Diana: React.FC<P> = ({ac}) => (
  <group rotation={[0.12, -0.3, 0]}>
    {[[1.55, '#F6F1E6', 0], [1.18, ac, 0.07], [0.82, '#F6F1E6', 0.14], [0.46, ac, 0.21]].map(([r, c, z], i) => (
      <mesh key={i} castShadow={i === 0} position={[0, 0, Number(z)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Number(r), Number(r), 0.16, 32]} />
        <meshStandardMaterial color={String(c)} roughness={0.48} metalness={0.06} />
      </mesh>
    ))}
    {/* la flecha, clavada en el centro y saliendo hacia la cámara */}
    <group position={[0.06, 0.1, 0.3]} rotation={[0.55, -0.35, 0]}>
      <mesh castShadow position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 2.2, 20]} />
        <meshStandardMaterial color="#8E8579" roughness={0.35} metalness={0.6} envMapIntensity={2.2} />
      </mesh>
      <mesh castShadow position={[0, 0, 1.95]}>
        <coneGeometry args={[0.26, 0.5, 18]} />
        <meshStandardMaterial color={ac} roughness={0.3} metalness={0.3} />
      </mesh>
    </group>
  </group>
);

/* ── Plato ── */
const Plato: React.FC<P> = ({ac, hondo}) => (
  <group rotation={[0.72, 0, 0]} position={[0, -0.2, 0]}>
    <mesh castShadow>
      <cylinderGeometry args={[1.75, 1.5, 0.22, 40]} />
      <meshStandardMaterial color="#FCF8F1" roughness={0.34} metalness={0.06} envMapIntensity={1.6} />
    </mesh>
    <mesh position={[0, 0.13, 0]}>
      <cylinderGeometry args={[1.3, 1.3, 0.05, 40]} />
      <meshStandardMaterial color="#F3ECE0" roughness={0.5} />
    </mesh>
    <mesh castShadow position={[-0.22, 0.34, 0.1]}>
      <sphereGeometry args={[0.62, 24, 18]} />
      <meshStandardMaterial color={ac} roughness={0.3} metalness={0.08} />
    </mesh>
    <mesh castShadow position={[0.62, 0.26, -0.3]} rotation={[0.2, 0.4, 0.1]}>
      <capsuleGeometry args={[0.2, 0.6, 8, 20]} />
      <meshStandardMaterial color={hondo} roughness={0.35} />
    </mesh>
    <mesh castShadow position={[0.5, 0.24, 0.55]} rotation={[0.1, -0.3, 0.5]}>
      <capsuleGeometry args={[0.16, 0.5, 8, 20]} />
      <meshStandardMaterial color="#C8B79A" roughness={0.45} />
    </mesh>
  </group>
);

const MODELOS: Record<string, React.FC<P>> = {
  bombilla: Bombilla, monedas: Monedas, billetera: Billetera, cohete: Cohete,
  reloj: Reloj, llave: Llave, subida: Subida, diana: Diana, plato: Plato,
};
export const NOMBRES_3D = Object.keys(MODELOS);

export const PX = 100;          // cuántos píxeles del dibujo mide una unidad del mundo 3D
const FOV = 30;

/** Dónde tiene que estar la cámara para que se vea `altoPx` de alto (el ángulo de three es el vertical) */
function distancia(altoPx: number) {
  return (altoPx / PX / 2) / Math.tan((FOV / 2) * Math.PI / 180);
}

export type Puesto = {nombre: string; x: number; y: number; escala: number; giro: number};

/* La cámara del lienzo: hay que moverla desde dentro, porque lo que se le pasa al crear el lienzo
   solo vale para el primer cuadro y después se queda quieta. */
const Camara: React.FC<{x: number; y: number; z: number; giro: number}> = ({x, y, z, giro}) => {
  const {camera} = useThree();
  camera.position.set(x, y, z);
  camera.rotation.set(0, 0, giro);
  camera.updateProjectionMatrix();
  return null;
};

/** UN SOLO lienzo 3D para toda la placa: dentro van todos los objetos, cada uno en su sitio del lienzo,
 *  y la cámara se mueve igual que la del texto. Uno solo en vez de uno por parada: en el servidor,
 *  que dibuja el 3D a pulso sin tarjeta gráfica, esa diferencia es la que lo hace posible. */
export const Escena3D: React.FC<{ancho: number; alto: number; puestos: Puesto[];
  pal: {acento: string; claro: string; hondo: string}; camX: number; camY: number; camZ: number; giro: number;
  sombra: string}> = ({ancho, alto, puestos, pal, camX, camY, camZ, giro, sombra}) => {
  const D = distancia(alto);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: ancho, height: alto,
      filter: sombra === 'no' ? undefined : estelaObjeto(sombra, alto * 0.48), pointerEvents: 'none'}}>
      <ThreeCanvas width={ancho} height={alto} camera={{fov: FOV, position: [0, 0, D], near: 0.5, far: 200}}
        style={{background: 'transparent'}} gl={{antialias: true, alpha: true}}
        onCreated={({gl, scene}) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          scene.environment = entorno(gl);
        }}>
        <Camara x={camX / PX} y={-camY / PX} z={D / camZ} giro={-giro * Math.PI / 180} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#FFF8EC', '#CFC5B4', 0.7]} />
        <directionalLight position={[-5.5, 7, 6]} intensity={2.2} />
        <directionalLight position={[5, -2.5, 3]} intensity={0.55} color="#FFE6C2" />
        {puestos.map((q, i) => {
          const Modelo = MODELOS[q.nombre];
          if (!Modelo || q.escala <= 0.01) return null;
          return (
            <group key={i} position={[q.x / PX, -q.y / PX, 0]} scale={q.escala} rotation={[0, q.giro, 0]}>
              <Modelo ac={pal.acento} claro={pal.claro} hondo={pal.hondo} />
            </group>
          );
        })}
      </ThreeCanvas>
    </div>
  );
};

/** Un objeto suelto (para el banco de pruebas) */
export const Objeto3D: React.FC<{nombre: string; tam: number; pal: {acento: string; claro: string; hondo: string};
  giro?: number; sombra?: string; estilo?: React.CSSProperties}> = ({nombre, tam, pal, giro = 0, sombra = '52,38,30', estilo}) => (
  <Escena3D ancho={tam} alto={tam} puestos={[{nombre, x: 0, y: -10, escala: 1, giro}]} pal={pal}
    camX={0} camY={0} camZ={1} giro={0} sombra={sombra} />
);
