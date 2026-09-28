# Prototipo: HLG (BT.2100, BT.2020) -> SDR BT.709 con ITU-R BT.2446 método A.
# Entrada: señal R'G'B' HLG 0..1 (BT.2020). Salida: R'G'B' BT.709 (gamma 2.4) 0..1.
import numpy as np

A_, B_, C_ = 0.17883277, 0.28466892, 0.55991073
LW = 1000.0          # pantalla HDR de referencia del HLG
GAMMA_HLG = 1.2      # gamma del sistema a 1000 nits

def hlg_a_lineal_pantalla(e):
    """R'G'B' HLG -> luz de pantalla en nits (OETF^-1 + OOTF, sin nivel de negro)."""
    e = np.clip(e, 0, 1)
    esc = np.where(e <= 0.5, (e ** 2) / 3.0, (np.exp((e - C_) / A_) + B_) / 12.0)
    ys = 0.2627 * esc[..., 0] + 0.6780 * esc[..., 1] + 0.0593 * esc[..., 2]
    f = LW * np.power(np.maximum(ys, 1e-9), GAMMA_HLG - 1)
    return esc * f[..., None]

def bt2446a(e, exp_sat=1.0):
    luz = hlg_a_lineal_pantalla(e) / LW                   # 0..1 (1 = 1000 nits)
    rp = np.power(np.clip(luz, 0, 1), 1 / 2.4)            # R'G'B' gamma 2.4, BT.2020
    y = 0.2627 * rp[..., 0] + 0.6780 * rp[..., 1] + 0.0593 * rp[..., 2]
    cb = (rp[..., 2] - y) / 1.8814
    cr = (rp[..., 0] - y) / 1.4746
    rho_h = 1 + 32 * (LW / 10000) ** (1 / 2.4)
    yp = np.log(1 + (rho_h - 1) * y) / np.log(rho_h)
    yc = np.where(yp <= 0.7399, 1.0770 * yp,
         np.where(yp < 0.9909, -1.1510 * yp ** 2 + 2.7811 * yp - 0.6302, 0.5 * yp + 0.5))
    rho_s = 1 + 32 * (100 / 10000) ** (1 / 2.4)
    ys = (np.power(rho_s, yc) - 1) / (rho_s - 1)
    f = np.where(y > 0, ys / np.maximum(1.1 * y, 1e-9), 0)
    cb2, cr2 = f * cb * exp_sat, f * cr * exp_sat
    y2 = ys - np.maximum(0.1 * cr2, 0)
    # de vuelta a R'G'B' BT.2020 (gamma 2.4), a lineal, a BT.709, y a gamma 2.4
    r = y2 + 1.4746 * cr2
    b = y2 + 1.8814 * cb2
    g = (y2 - 0.2627 * r - 0.0593 * b) / 0.6780
    lin = np.power(np.clip(np.stack([r, g, b], -1), 0, 1), 2.4)
    M = np.array([[1.6605, -0.5876, -0.0728], [-0.1246, 1.1329, -0.0083], [-0.0182, -0.1006, 1.1187]])
    lin709 = np.clip(lin @ M.T, 0, 1)
    return np.power(lin709, 1 / 2.4)

if __name__ == '__main__':
    import sys
    from PIL import Image
    for nombre in sys.argv[1:]:
        raw = np.fromfile(nombre + '.rgb48', dtype='<u2').reshape(1280, 720, 3) / 65535.0
        out = bt2446a(raw)
        Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save('bt2446_' + nombre + '.png')
        print('ok', nombre)

# Para armar la tabla que usa carrete-media-processor (hlg_sdr.cube, junto a su index.js):
#   python -c "import numpy as np; from bt2446 import bt2446a; ..."  → ver docs/PLAN-CALIDAD-Y-VELOCIDAD.md («HDR»).
# 64 puntos: el ffmpeg de 2018 de la Lambda no acepta tablas de más de 64 («Too large or invalid 3D LUT size»).
