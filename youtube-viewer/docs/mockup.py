# Genera una vista previa del panel replicando el layout de src/ui.cpp.
# Uso: python3 docs/mockup.py  (requiere Pillow y fonts-freefont-ttf)
from PIL import Image, ImageDraw, ImageFont
import math
F="/usr/share/fonts/truetype/freefont/"
def font(bold, pt): return ImageFont.truetype(F+("FreeSansBold.ttf" if bold else "FreeSans.ttf"), round(pt*141/72))
def q(c):  # RGB565 quantize
    r,g,b=c; return (r&0xF8,g&0xFC,b&0xF8)
BG=q((15,15,15)); CARD=q((33,33,33)); TRACK=q((60,60,60)); TEXT=(255,255,255)
MUTED=q((170,170,170)); RED=q((255,0,0)); UP=q((46,204,113))
W,H,M,P,R=480,320,12,14,10
AV_X,AV_Y,AV_S=M,8,88
LOGO_W,LOGO_H=44,30; LOGO_X=W-M-LOGO_W; LOGO_Y=14
TITLE_X=AV_X+AV_S+14; TITLE_W=LOGO_X-10-TITLE_X
SC=(M,108,W-2*M,100); VC=(M,218,290,76); DC=(M+290+10,218,W-M-(M+300),76)
FOOT_Y=302
img=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(img)
def sep(n): return f"{n:,}".replace(",",".")
def fit(text,maxw,fonts):
    for f in fonts:
        if d.textlength(text,font=f)<=maxw: return f
    return fonts[-1]
# avatar placeholder
cx,cy=AV_X+AV_S/2,AV_Y+AV_S/2
d.ellipse([AV_X+1,AV_Y+1,AV_X+AV_S-2,AV_Y+AV_S-2],fill=RED)
d.text((cx,cy),"E",font=font(1,24),fill=TEXT,anchor="mm")
# logo
d.rounded_rectangle([LOGO_X,LOGO_Y,LOGO_X+LOGO_W-1,LOGO_Y+LOGO_H-1],8,fill=RED)
lx,ly=LOGO_X+LOGO_W//2,LOGO_Y+LOGO_H//2
d.polygon([(lx-6,ly-8),(lx-6,ly+8),(lx+9,ly)],fill=TEXT)
# header
title="Electronica Facil"
f=fit(title,TITLE_W,[font(1,18),font(1,12)])
d.text((TITLE_X,22),title,font=f,fill=TEXT,anchor="la")
d.text((TITLE_X,64),"@electronicafacil",font=font(0,12),fill=MUTED,anchor="la")
def card(c,label):
    x,y,w,h=c; d.rounded_rectangle([x,y,x+w-1,y+h-1],R,fill=CARD)
    d.text((x+P,y+10),label,font=font(0,9),fill=MUTED,anchor="la")
def delta(c,txt,col):
    x,y,w,h=c; d.text((x+w-P,y+10),txt,font=font(0,9),fill=col,anchor="ra")
def value(c,txt,fonts):
    x,y,w,h=c; f=fit(txt,w-2*P,fonts); d.text((x+P,y+36),txt,font=f,fill=TEXT,anchor="la")
card(SC,"SUSCRIPTORES"); card(VC,"VISTAS"); card(DC,"VIDEOS")
subs=12400
value(SC,sep(subs),[font(1,24),font(1,18)]); delta(SC,"+100 desde el inicio",UP)
x,y=SC[0]+P,SC[1]+84; barW=SC[2]-2*P-150; prev,goal=10000,20000
d.rounded_rectangle([x,y,x+barW-1,y+7],4,fill=TRACK)
fill=int((subs-prev)/(goal-prev)*barW); d.rounded_rectangle([x,y,x+max(fill,8)-1,y+7],4,fill=RED)
d.text((SC[0]+SC[2]-P,y+4),"Meta "+sep(goal),font=font(0,9),fill=MUTED,anchor="rm")
value(VC,sep(1234567),[font(1,18),font(1,12),font(1,9)]); delta(VC,"+3.210",UP)
value(DC,"245",[font(1,18),font(1,12),font(1,9)])
d.text((M,FOOT_Y+9),"Actualizado 14:32",font=font(0,9),fill=MUTED,anchor="lm")
d.text((W-M,FOOT_Y+9),"14:33",font=font(0,9),fill=MUTED,anchor="rm")
img.save("preview_480x320.png")  # tamano real de la pantalla
# 2x con marco de la pantalla
S=2; big=img.resize((W*S,H*S),Image.NEAREST)
fr=Image.new("RGB",(W*S+80,H*S+80),(235,235,235)); fd=ImageDraw.Draw(fr)
fd.rounded_rectangle([10,10,W*S+69,H*S+69],24,fill=(20,20,22))
fr.paste(big,(40,40)); fr.save("preview.png")
