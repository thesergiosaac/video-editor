# -*- coding: utf-8 -*-
u"""Cazar nombres de clase repetidos antes de que se vean en pantalla.

⚠️ POR QUE EXISTE (23-sep-2026, y van SEIS). Le puse `.meta-l` a las filas de opciones de Meta en
el calendario, y `.meta-l` ya era LA LINEA DE META del grafico de estadisticas:

    .meta-l { position: absolute; left: 0; right: 0; height: 0;
              border-top: 1.5px dashed var(--tinta-3); pointer-events: none; }

Mis filas heredaron `position: absolute` y el borde punteado, y salieron a lo ancho del modal,
encima de todo y con una raya en medio. Sergio: «hay una linea en la mitad, unas letras encima de
otras, una cosa toda extraña».

Nada de esto lo cazan el comprobador de sintaxis ni el de anidado: el HTML era correcto y el CSS
tambien. Lo unico que estaba mal era el NOMBRE.

    python _colisiones.py calendario.html igop-
    python _colisiones.py calendario.html            (lista las clases definidas dos veces)

⚠️ Una clase definida en dos sitios no siempre es un fallo: hay estilos que se amplian a
proposito («.btn» y luego «.btn.btn-rosa»). Lo que caza esto es el caso peligroso: dos reglas que
la definen desde CERO, con `position`, `display` o `border` propios.
"""
import io
import re
import sys

ARCHIVO = sys.argv[1] if len(sys.argv) > 1 else 'calendario.html'
PREFIJO = sys.argv[2] if len(sys.argv) > 2 else ''

RUTA = ('C:/Users/USUARIO/AppData/Local/Temp/video-editor/herramientas/' + ARCHIVO
        if '/' not in ARCHIVO else ARCHIVO)
s = io.open(RUTA, encoding='utf-8').read()

# Cada regla: su selector y lo que declara.
reglas = {}
for m in re.finditer(r'(^|\})\s*([^{}@/]+?)\s*\{([^{}]*)\}', s, re.M):
    sel, cuerpo = m.group(2), m.group(3)
    if '\n' in sel and len(sel) > 300:
        continue
    for clase in set(re.findall(r'\.([a-z][\w-]*)', sel)):
        reglas.setdefault(clase, []).append((sel.strip()[:70], cuerpo))

PESADAS = ('position', 'display', 'border', 'grid-template', 'flex-direction', 'inset')

if PREFIJO:
    mias = sorted(c for c in reglas if c.startswith(PREFIJO))
    usadas = set()
    for c in re.findall(r'class="([^"]*)"', s):
        for x in c.split():
            if x.startswith(PREFIJO):
                usadas.add(x)
    print(u'clases «%s» usadas en el markup: %s' % (PREFIJO, ', '.join(sorted(usadas)) or 'ninguna'))
    otras = set(reglas) - set(mias)
    choque = usadas & otras
    print(u'chocan con algo que ya existia: %s' % (', '.join(sorted(choque)) if choque else 'ninguna'))
    sys.exit(1 if choque else 0)

malas = []
for clase, rs in sorted(reglas.items()):
    desde_cero = [r for r in rs if any(p in r[1] for p in PESADAS)]
    if len(desde_cero) > 1:
        malas.append((clase, desde_cero))

if not malas:
    print(u'ninguna clase se define dos veces desde cero')
    sys.exit(0)

print(u'CLASES DEFINIDAS DOS VECES DESDE CERO (mirar una por una):')
for clase, rs in malas:
    print(u'\n  .%s' % clase)
    for sel, cuerpo in rs:
        pesa = [p for p in PESADAS if p in cuerpo]
        print(u'     %-60s  %s' % (sel, ', '.join(pesa)))
sys.exit(1)
