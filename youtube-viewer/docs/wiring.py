# Genera el esquema de conexiones ESP32-CAM <-> TFT 4.0" (con tactil, opcion eFuse).
# Uso: python3 docs/wiring.py  (requiere Pillow y fonts-freefont-ttf)
from PIL import Image, ImageDraw, ImageFont

S = 2  # escala
F = "/usr/share/fonts/truetype/freefont/"
def font(bold, px): return ImageFont.truetype(F + ("FreeSansBold.ttf" if bold else "FreeSans.ttf"), px * S)

W, H = 1000, 700
img = Image.new("RGB", (W * S, H * S), (250, 250, 248))
d = ImageDraw.Draw(img)
def sc(*v): return [x * S for x in v]

BG_ESP, BG_TFT = (106, 76, 147), (25, 25, 28)
RED, BLACK, ORANGE = (220, 40, 40), (30, 30, 30), (240, 140, 0)
SPI, CTRL, TOUCH, GREY = (30, 110, 220), (20, 160, 90), (190, 60, 190), (160, 160, 160)

# Pines de la pantalla en su orden fisico (de arriba a abajo en la placa)
tft = ["SD_CS", "CTP_INT", "CTP_SDA", "CTP_RST", "CTP_SCL", "SDO(MISO)", "LED",
       "SCK", "SDI(MOSI)", "LCD_RS", "LCD_RST", "LCD_CS", "GND", "VCC"]
# pin pantalla -> (pin ESP32-CAM, color, discontinua)
wires = {
    "CTP_SDA": ("IO12", TOUCH, True), "CTP_SCL": ("IO0", TOUCH, True),
    "LED": ("3V3", ORANGE, False), "SCK": ("IO14", SPI, False),
    "SDI(MOSI)": ("IO13", SPI, False), "LCD_RS": ("IO2", CTRL, False),
    "LCD_RST": ("3V3", ORANGE, False), "LCD_CS": ("IO15", CTRL, False),
    "GND": ("GND", BLACK, False), "VCC": ("5V", RED, False),
}
esp = ["IO12", "IO0", "3V3", "IO14", "IO13", "IO2", "IO15", "GND", "5V"]

TOP, STEP = 110, 34
tft_y = {p: TOP + i * STEP for i, p in enumerate(tft)}
esp_y = {p: TOP + STEP // 2 + (i + 1) * STEP for i, p in enumerate(esp)}  # entre pines de la pantalla: sin cables solapados

# Placas
EX0, EX1, TX0, TX1 = 40, 250, 720, 960
d.rounded_rectangle(sc(EX0, TOP - 40, EX1, esp_y["5V"] + 40), 14 * S, fill=BG_ESP)
d.text(sc((EX0 + EX1) / 2 - 20, TOP - 26), "ESP32-CAM", font=font(1, 20), fill="white", anchor="ma")
d.rounded_rectangle(sc(TX0, TOP - 40, TX1, tft_y["VCC"] + 40), 14 * S, fill=BG_TFT)
d.text(sc((TX0 + TX1) / 2 + 20, TOP - 26), 'TFT 4.0" SPI', font=font(1, 20), fill="white", anchor="ma")

def pin(x, y, color):
    d.rectangle(sc(x - 7, y - 7, x + 7, y + 7), fill=(200, 170, 60), outline=color, width=2 * S)

for p, y in esp_y.items():
    pin(EX1, y, "white")
    d.text(sc(EX1 - 16, y), p, font=font(1, 17), fill="white", anchor="rm")
for p, y in tft_y.items():
    used = p in wires
    pin(TX0, y, "white" if used else (90, 90, 90))
    d.text(sc(TX0 + 16, y), p + ("" if used else "   (sin conectar)"), font=font(used, 15),
           fill="white" if used else (130, 130, 130), anchor="lm")

# Cables: ESP -> carril vertical -> pantalla
lanes = {}
for i, p in enumerate(tft):
    if p in wires:
        lanes[p] = 300 + len(lanes) * 38
for p, (e, color, dashed) in wires.items():
    x, y0, y1 = lanes[p], esp_y[e], tft_y[p]
    pts = [(EX1 + 7, y0), (x, y0), (x, y1), (TX0 - 7, y1)]
    for a, b in zip(pts, pts[1:]):
        if dashed:
            (ax, ay), (bx, by) = a, b
            n = int(max(abs(bx - ax), abs(by - ay)) / 10) or 1
            for k in range(0, n, 2):
                t0, t1 = k / n, min((k + 1) / n, 1)
                d.line(sc(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1), fill=color, width=4 * S)
        else:
            d.line(sc(*a, *b), fill=color, width=4 * S)
    for (px, py) in pts[1:3]:
        d.ellipse(sc(px - 3, py - 3, px + 3, py + 3), fill=color)

# Titulo y leyenda
d.text(sc(40, 22), "Conexiones: YouTube Viewer con tactil", font=font(1, 26), fill=BLACK)
d.text(sc(40, 56), "Requiere antes: espefuse.py set_flash_voltage 3.3V  (permanente)  y desenchufar la camara",
       font=font(0, 16), fill=(200, 40, 40))
ly = 640
for i, (c, t, dash) in enumerate([(RED, "5 V", 0), (BLACK, "GND", 0), (ORANGE, "3,3 V", 0),
                                  (SPI, "SPI", 0), (CTRL, "Control LCD", 0), (TOUCH, "Tactil I2C", 1)]):
    x = 40 + i * 155
    if dash:
        for k in range(0, 40, 14): d.line(sc(x + k, ly, x + k + 7, ly), fill=c, width=4 * S)
    else:
        d.line(sc(x, ly, x + 40, ly), fill=c, width=4 * S)
    d.text(sc(x + 50, ly), t, font=font(0, 16), fill=BLACK, anchor="lm")
d.text(sc(40, 672), "Pines ESP32-CAM: 5V, GND, IO12, IO13, IO15, IO14, IO2 en un lateral;  3V3, IO0 en el otro.",
       font=font(0, 14), fill=(90, 90, 90))
img.save("wiring.png")
