#include "ui.h"

#include <TFT_eSPI.h>
#include <TJpg_Decoder.h>

#if __has_include("config.h")
#include "config.h"
#endif
#ifndef THOUSANDS_SEP
#define THOUSANDS_SEP '.'
#endif

namespace {

TFT_eSPI tft;

constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}
constexpr uint16_t C_BG = rgb(15, 15, 15);
constexpr uint16_t C_CARD = rgb(33, 33, 33);
constexpr uint16_t C_TRACK = rgb(60, 60, 60);
constexpr uint16_t C_TEXT = rgb(255, 255, 255);
constexpr uint16_t C_MUTED = rgb(170, 170, 170);
constexpr uint16_t C_RED = rgb(255, 0, 0);
constexpr uint16_t C_UP = rgb(46, 204, 113);
constexpr uint16_t C_DOWN = rgb(255, 82, 82);

// Layout para 480x320 en horizontal.
constexpr int W = 480, H = 320, M = 12, P = 14, R = 10;
constexpr int AV_X = M, AV_Y = 8, AV_S = 88;
constexpr int LOGO_W = 44, LOGO_H = 30, LOGO_X = W - M - LOGO_W, LOGO_Y = 14;
constexpr int TITLE_X = AV_X + AV_S + 14, TITLE_W = LOGO_X - 10 - TITLE_X;
constexpr int SC_X = M, SC_Y = 108, SC_W = W - 2 * M, SC_H = 100;           // suscriptores
constexpr int VC_X = M, VC_Y = 218, VC_W = 290, VC_H = 76;                  // vistas
constexpr int DC_X = VC_X + VC_W + 10, DC_Y = VC_Y, DC_W = W - M - DC_X, DC_H = VC_H;  // videos
constexpr int FOOT_Y = 302, CLOCK_W = 90;

bool layoutDrawn = false;
uint8_t* avatarJpg = nullptr;
size_t avatarLen = 0;
String lastTitle;

// ---------- Texto ----------

// Las fuentes GFX solo tienen ASCII: pasamos acentos comunes a su letra base
// y descartamos el resto (emojis, otros alfabetos).
String toAscii(const String& in) {
  static const char* const kFrom = "\xA0\xA1\xA2\xA3\xA4\xA7\xA8\xA9\xAA\xAB\xAC\xAD\xAE\xAF\xB1\xB2\xB3\xB4\xB5\xB6\xB9\xBA\xBB\xBC";
  static const char* const kTo = "aaaaaceeeeiiiinooooouuuu";
  String out;
  const char* s = in.c_str();
  while (*s) {
    uint8_t c = *s;
    if (c < 0x80) {
      if (c >= 0x20) out += (char)c;
      s++;
      continue;
    }
    int len = (c & 0xE0) == 0xC0 ? 2 : (c & 0xF0) == 0xE0 ? 3 : (c & 0xF8) == 0xF0 ? 4 : 1;
    if (c == 0xC3 && s[1]) {
      uint8_t lo = (uint8_t)s[1];
      bool upper = lo < 0xA0;  // 0x80-0x9F son las mayusculas de 0xA0-0xBF
      const char* hit = strchr(kFrom, upper ? lo + 0x20 : lo);
      if (hit) {
        char base = kTo[hit - kFrom];
        out += upper ? (char)toupper(base) : base;
      }
    }
    for (int i = 0; i < len && *s; i++) s++;
  }
  out.trim();
  return out;
}

String withThousands(uint64_t v) {
  char digits[24];
  snprintf(digits, sizeof digits, "%llu", (unsigned long long)v);
  String out;
  int n = strlen(digits);
  for (int i = 0; i < n; i++) {
    out += digits[i];
    int rest = n - 1 - i;
    if (rest > 0 && rest % 3 == 0) out += THOUSANDS_SEP;
  }
  return out;
}

String signedDelta(int64_t d) {
  if (d == 0) return "=";
  String s = d > 0 ? "+" : "-";
  return s + withThousands(d > 0 ? d : -d);
}

// Elige la fuente mas grande en la que cabe el texto.
void fitFont(const String& text, int maxW, std::initializer_list<const GFXfont*> fonts) {
  for (const GFXfont* f : fonts) {
    tft.setFreeFont(f);
    if (tft.textWidth(text) <= maxW) return;
  }
}

// Recorta con "..." si no cabe con la fuente actual.
String ellipsize(String text, int maxW) {
  if (tft.textWidth(text) <= maxW) return text;
  while (text.length() > 1 && tft.textWidth(text + "...") > maxW) text.remove(text.length() - 1);
  text.trim();
  return text + "...";
}

// ---------- Elementos ----------

void drawLogo(int x, int y) {
  tft.fillRoundRect(x, y, LOGO_W, LOGO_H, 8, C_RED);
  int cx = x + LOGO_W / 2, cy = y + LOGO_H / 2;
  tft.fillTriangle(cx - 6, cy - 8, cx - 6, cy + 8, cx + 9, cy, C_TEXT);
}

bool jpgToTft(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t* bitmap) {
  if (x >= AV_X + AV_S || y >= AV_Y + AV_S) return true;  // fuera del hueco del avatar
  tft.pushImage(x, y, w, h, bitmap);
  return true;
}

// Pinta las esquinas fuera del circulo con el color de fondo.
void maskCircle(int x0, int y0, int s, uint16_t bg) {
  float r = s / 2.0f;
  for (int j = 0; j < s; j++) {
    float dy = j + 0.5f - r;
    int half = (int)sqrtf(max(0.0f, r * r - dy * dy));
    int edge = (int)(r - half);
    if (edge > 0) {
      tft.drawFastHLine(x0, y0 + j, edge, bg);
      tft.drawFastHLine(x0 + s - edge, y0 + j, edge, bg);
    }
  }
}

void drawAvatar() {
  tft.fillRect(AV_X, AV_Y, AV_S, AV_S, C_BG);
  bool drawn = avatarJpg && avatarLen > 2 && avatarJpg[0] == 0xFF && avatarJpg[1] == 0xD8 &&
               TJpgDec.drawJpg(AV_X, AV_Y, avatarJpg, avatarLen) == JDR_OK;
  int cx = AV_X + AV_S / 2, cy = AV_Y + AV_S / 2;
  if (drawn) {
    maskCircle(AV_X, AV_Y, AV_S, C_BG);
  } else {
    tft.fillCircle(cx, cy, AV_S / 2 - 1, C_RED);
    String initial = lastTitle.length() ? String((char)toupper(lastTitle[0])) : String("?");
    tft.setFreeFont(&FreeSansBold24pt7b);
    tft.setTextColor(C_TEXT);
    tft.setTextDatum(MC_DATUM);
    tft.drawString(initial, cx, cy);
  }
}

void drawHeader(const ChannelStats& st) {
  tft.fillRect(TITLE_X, 0, TITLE_W, SC_Y - 4, C_BG);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(C_TEXT);
  fitFont(lastTitle, TITLE_W, {&FreeSansBold18pt7b, &FreeSansBold12pt7b});
  tft.drawString(ellipsize(lastTitle, TITLE_W), TITLE_X, 22);

  tft.setFreeFont(&FreeSans12pt7b);
  tft.setTextColor(C_MUTED);
  tft.drawString(ellipsize(toAscii(st.handle), TITLE_W), TITLE_X, 64);
}

void drawCard(int x, int y, int w, int h, const char* label) {
  tft.fillRoundRect(x, y, w, h, R, C_CARD);
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(C_MUTED);
  tft.setTextDatum(TL_DATUM);
  tft.drawString(label, x + P, y + 10);
}

// Delta en la esquina superior derecha de una tarjeta.
void drawDelta(int x, int y, int w, int64_t d, const char* suffix) {
  tft.fillRect(x + w / 2, y + 6, w / 2 - P, 20, C_CARD);
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(d > 0 ? C_UP : d < 0 ? C_DOWN : C_MUTED);
  tft.setTextDatum(TR_DATUM);
  tft.drawString(signedDelta(d) + suffix, x + w - P, y + 10);
}

void drawValue(int x, int y, int w, int h, const String& text,
               std::initializer_list<const GFXfont*> fonts) {
  int vx = x + P, vy = y + 32, vw = w - 2 * P;
  tft.fillRect(vx, vy, vw, h, C_CARD);
  fitFont(text, vw, fonts);
  tft.setTextColor(C_TEXT);
  tft.setTextDatum(TL_DATUM);
  tft.drawString(text, vx, vy + 4);
}

// Siguiente hito en la serie 1-2-5 (100, 200, 500, 1.000, ...).
uint64_t nextMilestone(uint64_t v, uint64_t& prev) {
  static const uint8_t steps[] = {1, 2, 5};
  prev = 0;
  for (uint64_t mag = 10; mag < 10000000000000ULL; mag *= 10) {
    for (uint8_t s : steps) {
      uint64_t m = s * mag;
      if (m > v) return m;
      prev = m;
    }
  }
  return v + 1;
}

void drawMilestone(uint64_t subs, bool hidden) {
  int y = SC_Y + 80, x = SC_X + P, labelW = 150;
  int barW = SC_W - 2 * P - labelW;
  tft.fillRect(x, y - 4, SC_W - 2 * P, 16, C_CARD);
  if (hidden) return;

  uint64_t prev;
  uint64_t goal = nextMilestone(subs, prev);
  int fill = (int)((double)(subs - prev) / (double)(goal - prev) * barW);
  tft.fillRoundRect(x, y, barW, 8, 4, C_TRACK);
  if (fill > 0) tft.fillRoundRect(x, y, max(fill, 8), 8, 4, C_RED);

  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(C_MUTED);
  tft.setTextDatum(MR_DATUM);
  tft.drawString("Meta " + withThousands(goal), SC_X + SC_W - P, y + 4);
}

void drawLayout(const ChannelStats& st) {
  tft.fillScreen(C_BG);
  drawAvatar();
  drawLogo(LOGO_X, LOGO_Y);
  drawHeader(st);
  drawCard(SC_X, SC_Y, SC_W, SC_H, "SUSCRIPTORES");
  drawCard(VC_X, VC_Y, VC_W, VC_H, "VISTAS");
  drawCard(DC_X, DC_Y, DC_W, DC_H, "VIDEOS");
  layoutDrawn = true;
}

}  // namespace

void uiBegin() {
  tft.init();
  tft.setRotation(1);  // horizontal; usa 3 si queda al reves
  tft.fillScreen(C_BG);
  TJpgDec.setJpgScale(1);
  TJpgDec.setSwapBytes(true);
  TJpgDec.setCallback(jpgToTft);
}

void uiMessage(const String& title, const String& detail) {
  layoutDrawn = false;
  tft.fillScreen(C_BG);
  drawLogo((W - LOGO_W) / 2, 90);
  tft.setTextDatum(MC_DATUM);
  tft.setFreeFont(&FreeSansBold12pt7b);
  tft.setTextColor(C_TEXT);
  tft.drawString(ellipsize(toAscii(title), W - 2 * M), W / 2, 160);
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(C_MUTED);
  tft.drawString(ellipsize(toAscii(detail), W - 2 * M), W / 2, 195);
}

void uiSetAvatar(uint8_t* jpg, size_t len) {
  free(avatarJpg);
  avatarJpg = jpg;
  avatarLen = jpg ? len : 0;
  if (layoutDrawn) drawAvatar();
}

void uiShowStats(const ChannelStats& st, int64_t subsDelta, int64_t viewsDelta) {
  String title = toAscii(st.title);
  bool titleChanged = title != lastTitle;
  lastTitle = title;
  if (!layoutDrawn) {
    drawLayout(st);
  } else if (titleChanged) {
    drawHeader(st);
    drawAvatar();
  }

  if (st.subscribersHidden) {
    drawValue(SC_X, SC_Y, SC_W, 40, "Oculto", {&FreeSansBold24pt7b});
  } else {
    drawValue(SC_X, SC_Y, SC_W, 40, withThousands(st.subscribers),
              {&FreeSansBold24pt7b, &FreeSansBold18pt7b});
    drawDelta(SC_X, SC_Y, SC_W, subsDelta, " desde el inicio");
  }
  drawMilestone(st.subscribers, st.subscribersHidden);

  drawValue(VC_X, VC_Y, VC_W, 36, withThousands(st.views),
            {&FreeSansBold18pt7b, &FreeSansBold12pt7b, &FreeSansBold9pt7b});
  drawDelta(VC_X, VC_Y, VC_W, viewsDelta, "");

  drawValue(DC_X, DC_Y, DC_W, 36, withThousands(st.videos),
            {&FreeSansBold18pt7b, &FreeSansBold12pt7b, &FreeSansBold9pt7b});
}

void uiStatus(const String& text, bool isError) {
  if (!layoutDrawn) return;
  tft.fillRect(0, FOOT_Y, W - CLOCK_W, H - FOOT_Y, C_BG);
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(isError ? C_DOWN : C_MUTED);
  tft.setTextDatum(ML_DATUM);
  tft.drawString(ellipsize(toAscii(text), W - CLOCK_W - 2 * M), M, FOOT_Y + 9);
}

void uiClock(const String& text) {
  if (!layoutDrawn) return;
  tft.fillRect(W - CLOCK_W, FOOT_Y, CLOCK_W, H - FOOT_Y, C_BG);
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(C_MUTED);
  tft.setTextDatum(MR_DATUM);
  tft.drawString(text, W - M, FOOT_Y + 9);
}
