# -*- coding: utf-8 -*-
u"""Comprobar el ANIDADO del HTML que arma una funcion, no solo que las etiquetas cuadren.

⚠️ POR QUE EXISTE (23-sep-2026). Al meter una columna nueva en la ficha, el `</div>` que cerraba
la rejilla paso a cerrar la columna: el panel de la derecha se metio dentro de la izquierda y los
botones se volvieron la segunda columna. Sergio lo vio en pantalla: «te quedo todo al reves».

Y mi comprobacion de entonces —contar `<div>` contra `</div>`— dijo que todo estaba bien, PORQUE
ESTABA BIEN: no faltaba ninguna etiqueta, estaban en el sitio equivocado. Contar no comprueba el
anidado.

Esto junta los trozos de texto de una asignacion `X.innerHTML = '...' + loQueSea + '...'`,
descarta lo que sea JavaScript, y recorre las etiquetas con una pila para dibujar el arbol.

    python _anidado.py <archivo> "<ancla>" [desde]

⚠️ El final de la asignacion es el primer `;` A PROFUNDIDAD CERO: dentro del HTML hay funciones
(`g.map(function (y, i) { … ; … })`) llenas de `;`, y parando en el primero solo se leen las dos
primeras etiquetas.
"""
import io
import re
import sys

ARCHIVO = sys.argv[1] if len(sys.argv) > 1 else 'laboratorio.html'
ANCLA = sys.argv[2] if len(sys.argv) > 2 else 'caja.innerHTML ='
DESDE = int(sys.argv[3]) if len(sys.argv) > 3 else 0

RUTA = ('C:/Users/USUARIO/AppData/Local/Temp/video-editor/herramientas/' + ARCHIVO
        if '/' not in ARCHIVO else ARCHIVO)
s = io.open(RUTA, encoding='utf-8').read()

i = s.index(ANCLA, DESDE)
j, dentro, comilla, hondo = i, False, '', 0
while j < len(s):
    c = s[j]
    if dentro:
        if c == '\\':
            j += 2
            continue
        if c == comilla:
            dentro = False
    elif c in '\'"`':
        dentro, comilla = True, c
    elif c in '([{':
        hondo += 1
    elif c in ')]}':
        hondo -= 1
    elif c == ';' and hondo <= 0:
        break
    j += 1
trozo = s[i:j]

# Solo las cadenas con comilla simple, que es como se escribe el HTML en este archivo.
partes = re.findall(r"'((?:[^'\\]|\\.)*)'", trozo)
html = ''.join(p.replace("\\'", "'").replace('\\"', '"') for p in partes)

VACIAS = {'br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'path', 'circle', 'line',
          'rect', 'use', 'stop', 'polygon', 'polyline', 'ellipse', 'area', 'col', 'embed'}

pila = []
problemas = []
for m in re.finditer(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(/?)>', html):
    cierra, tag, resto, solo = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
    if tag in VACIAS or solo == '/':
        continue
    if not cierra:
        clase = re.search(r'class="([^"]*)"', resto)
        pila.append((tag, (clase.group(1).split(' ')[0] if clase else '')))
        print('  ' * (len(pila) - 1) + '<%s%s>' % (tag, '.' + pila[-1][1] if pila[-1][1] else ''))
    else:
        if not pila:
            problemas.append('sobra </%s>' % tag)
            continue
        if pila[-1][0] != tag:
            problemas.append('se cierra </%s> pero lo abierto es <%s%s>' % (
                tag, pila[-1][0], '.' + pila[-1][1] if pila[-1][1] else ''))
        pila.pop()

print('')
if pila:
    problemas.append('quedan sin cerrar: ' + ', '.join(
        '<%s%s>' % (t, '.' + c if c else '') for t, c in pila))
if problemas:
    print('PROBLEMAS:')
    for x in problemas:
        print('  x  ' + x)
    sys.exit(1)
print('anidado correcto')
