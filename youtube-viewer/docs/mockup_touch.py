# Vista previa de la version tactil: 3 pantallas que se cambian deslizando.
# Uso: python3 docs/mockup_touch.py  (requiere Pillow y fonts-freefont-ttf)
import math
from PIL import Image, ImageDraw, ImageFont

FD = "/usr/share/fonts/truetype/freefont/"
def font(bold, pt): return ImageFont.truetype(FD + ("FreeSansBold.ttf" if bold else "FreeSans.ttf"), round(pt * 141 / 72))
def q(c): r, g, b = c; return (r & 0xF8, g & 0xFC, b & 0xF8)  # RGB565
BG, CARD, TRACK = q((15, 15, 15)), q((33, 33, 33)), q((60, 60, 60))
TEXT, MUTED, GRID = (255, 255, 255), q((170, 170, 170)), q((48, 48, 48))
RED, UP = q((255, 0, 0)), q((46, 204, 113))
W, H, M, P, R = 480, 320, 12, 14, 10
FOOT_Y = 302

def sep(n): return f"{n:,}".replace(",", ".")

def base():
    img = Image.new("RGB", (W, H), BG)
    return img, ImageDraw.Draw(img)

def fit(d, text, maxw, fonts):
    for f in fonts:
        if d.textlength(text, font=f) <= maxw: return f
    return fonts[-1]

def avatar(d, x, y, s, letter, color=RED):
    d.ellipse([x, y, x + s - 1, y + s - 1], fill=color)
    d.text((x + s / 2, y + s / 2), letter, font=font(1, 24 if s > 60 else 12), fill=TEXT, anchor="mm")

def logo(d, x, y, w=44, h=30):
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], 8, fill=RED)
    cx, cy = x + w // 2, y + h // 2
    d.polygon([(cx - 6, cy - 8), (cx - 6, cy + 8), (cx + 9, cy)], fill=TEXT)

def refresh_btn(d, x, y, s=30):
    d.rounded_rectangle([x, y, x + s - 1, y + s - 1], 8, fill=CARD)
    cx, cy, r = x + s / 2, y + s / 2, 8
    d.arc([cx - r, cy - r, cx + r, cy + r], 40, 330, fill=TEXT, width=2)
    ax, ay = cx + r * math.cos(math.radians(40)), cy + r * math.sin(math.radians(40))
    d.polygon([(ax + 4, ay - 6), (ax + 5, ay + 2), (ax - 3, ay)], fill=TEXT)

def dots(d, active, n=3):
    cx = W / 2 - (n - 1) * 8
    for i in range(n):
        x = cx + i * 16
        d.ellipse([x - 4, FOOT_Y + 5, x + 4, FOOT_Y + 13], fill=RED if i == active else TRACK)

def footer(d, active, left="Actualizado 14:32"):
    d.text((M, FOOT_Y + 9), left, font=font(0, 9), fill=MUTED, anchor="lm")
    d.text((W - M, FOOT_Y + 9), "14:33", font=font(0, 9), fill=MUTED, anchor="rm")
    dots(d, active)

def card(d, x, y, w, h, label):
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], R, fill=CARD)
    d.text((x + P, y + 10), label, font=font(0, 9), fill=MUTED, anchor="la")

# ---------- Pantalla 1: panel ----------
def screen_panel():
    img, d = base()
    avatar(d, M, 8, 88, "E")
    tx = M + 88 + 14
    d.text((tx, 22), "Electronica Facil", font=font(1, 18), fill=TEXT, anchor="la")
    d.text((tx, 64), "@electronicafacil", font=font(0, 12), fill=MUTED, anchor="la")
    logo(d, W - M - 44, 14)
    refresh_btn(d, W - M - 37, 56, 30)
    x, y, w, h = M, 108, W - 2 * M, 100
    card(d, x, y, w, h, "SUSCRIPTORES")
    d.text((x + w - P, y + 10), "+100 desde el inicio", font=font(0, 9), fill=UP, anchor="ra")
    d.text((x + P, y + 36), "12.400", font=font(1, 24), fill=TEXT, anchor="la")
    by, bw = y + 84, w - 2 * P - 150
    d.rounded_rectangle([x + P, by, x + P + bw - 1, by + 7], 4, fill=TRACK)
    d.rounded_rectangle([x + P, by, x + P + int(0.24 * bw) - 1, by + 7], 4, fill=RED)
    d.text((x + w - P, by + 4), "Meta 20.000", font=font(0, 9), fill=MUTED, anchor="rm")
    card(d, M, 218, 290, 76, "VISTAS")
    d.text((M + 290 - P, 228), "+3.210", font=font(0, 9), fill=UP, anchor="ra")
    d.text((M + P, 254), "1.234.567", font=font(1, 18), fill=TEXT, anchor="la")
    card(d, M + 300, 218, W - 2 * M - 300, 76, "VIDEOS")
    d.text((M + 300 + P, 254), "245", font=font(1, 18), fill=TEXT, anchor="la")
    footer(d, 0)
    return img

# ---------- Pantalla 2: grafica de vistas ----------
def screen_chart():
    img, d = base()
    avatar(d, M, 10, 40, "E")
    d.text((M + 52, 12), "Vistas - ultimas 24 h", font=font(1, 12), fill=TEXT, anchor="la")
    d.text((M + 52, 38), "Electronica Facil", font=font(0, 9), fill=MUTED, anchor="la")
    d.text((W - M, 12), "+18.430", font=font(1, 18), fill=UP, anchor="ra")
    d.text((W - M, 46), "en 24 h", font=font(0, 9), fill=MUTED, anchor="ra")
    # datos: vistas por hora (curva diaria tipica)
    hourly = [420, 310, 220, 160, 130, 150, 260, 430, 620, 760, 820, 880,
              930, 990, 1010, 980, 1040, 1150, 1290, 1380, 1300, 1050, 800, 550]
    cx0, cx1, cy0, cy1 = M + 44, W - M - 6, 76, 268
    d.rounded_rectangle([M, 66, W - M - 1, 294], R, fill=CARD)
    top = 1500
    for v in range(0, top + 1, 500):
        y = cy1 - v / top * (cy1 - cy0)
        d.line([cx0, y, cx1, y], fill=GRID, width=1)
        d.text((cx0 - 8, y), sep(v), font=font(0, 8), fill=MUTED, anchor="rm")
    n = len(hourly)
    def px(i): return cx0 + i * (cx1 - cx0) / (n - 1)
    def py(v): return cy1 - v / top * (cy1 - cy0)
    pts = [(px(i), py(v)) for i, v in enumerate(hourly)]
    # area muy tenue + linea de 2 px
    fill = q((70, 18, 18))
    d.polygon([(cx0, cy1)] + pts + [(cx1, cy1)], fill=fill)
    d.line(pts, fill=RED, width=2, joint="curve")
    for i, lab in [(0, "15:00"), (6, "21:00"), (12, "03:00"), (18, "09:00"), (23, "ahora")]:
        d.text((px(i), cy1 + 8), lab, font=font(0, 8), fill=MUTED, anchor="ma")
    # punto destacado: maximo
    i_max = max(range(n), key=lambda i: hourly[i])
    mx, my = pts[i_max]
    d.ellipse([mx - 5, my - 5, mx + 5, my + 5], fill=RED, outline=CARD, width=2)
    d.text((mx, my - 10), f"max {sep(hourly[i_max])}/h", font=font(0, 8), fill=TEXT, anchor="md")
    footer(d, 1)
    return img

# ---------- Pantalla 3: varios canales ----------
def screen_channels():
    img, d = base()
    d.text((M, 14), "Mis canales", font=font(1, 18), fill=TEXT, anchor="la")
    d.text((W - M, 22), "Toca uno para abrirlo", font=font(0, 9), fill=MUTED, anchor="ra")
    rows = [("Electronica Facil", "@electronicafacil", 12400, "+100", "E", RED, True),
            ("Taller Maker", "@tallermaker", 58300, "+300", "T", q((30, 110, 220)), False),
            ("Cocina Rapida", "@cocinarapida", 1240000, "=", "C", q((240, 140, 0)), False)]
    y = 60
    for name, handle, subs, delta, letter, col, active in rows:
        d.rounded_rectangle([M, y, W - M - 1, y + 70], R, fill=CARD)
        if active:
            d.rounded_rectangle([M, y, M + 5, y + 70], 3, fill=RED)
        avatar(d, M + 16, y + 13, 44, letter, col)
        d.text((M + 72, y + 14), name, font=font(1, 12), fill=TEXT, anchor="la")
        d.text((M + 72, y + 42), handle, font=font(0, 9), fill=MUTED, anchor="la")
        d.text((W - M - P, y + 14), sep(subs), font=font(1, 12), fill=TEXT, anchor="ra")
        d.text((W - M - P, y + 42), delta + " subs", font=font(0, 9),
               fill=UP if delta.startswith("+") else MUTED, anchor="ra")
        y += 78
    footer(d, 2, "3 canales")
    return img

# ---------- Composicion ----------
S = 2
screens = [(screen_panel(), "1. Panel", "Toca el boton de recargar para actualizar ya"),
           (screen_chart(), "2. Grafica de vistas", "Desliza ← → para cambiar de pantalla"),
           (screen_channels(), "3. Canales", "Toca un canal para ver su panel")]
GAP, PAD, BEZ = 60, 50, 24
cw = PAD * 2 + len(screens) * (W * S + 2 * BEZ) + (len(screens) - 1) * GAP
ch = 130 + H * S + 2 * BEZ + 120
out = Image.new("RGB", (cw, ch), (240, 240, 237))
od = ImageDraw.Draw(out)
od.text((PAD, 36), "YouTube Viewer - version tactil", font=ImageFont.truetype(FD + "FreeSansBold.ttf", 48), fill=(25, 25, 25))
x = PAD
for img, title, hint in screens:
    od.rounded_rectangle([x, 130, x + W * S + 2 * BEZ, 130 + H * S + 2 * BEZ], 30, fill=(20, 20, 22))
    out.paste(img.resize((W * S, H * S), Image.NEAREST), (x + BEZ, 130 + BEZ))
    ty = 130 + H * S + 2 * BEZ + 24
    od.text((x, ty), title, font=ImageFont.truetype(FD + "FreeSansBold.ttf", 34), fill=(25, 25, 25))
    od.text((x, ty + 46), hint, font=ImageFont.truetype(FD + "FreeSans.ttf", 30), fill=(90, 90, 90))
    x += W * S + 2 * BEZ + GAP
out.save("preview_touch.png")
