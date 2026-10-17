// Visor de suscriptores y vistas de un canal de YouTube.
// Hardware: ESP32-CAM (sin camara en uso) + TFT SPI 4.0" 480x320 ST7796S.
#include <Arduino.h>
#include <WiFi.h>
#include <time.h>

#if __has_include("config.h")
#include "config.h"
#else
#error "Copia include/config.example.h como include/config.h y pon tus datos"
#endif

#include "ui.h"
#include "youtube.h"

namespace {

constexpr int FLASH_LED_PIN = 4;
constexpr uint32_t RETRY_MS = 30 * 1000;

bool haveData = false;
uint64_t baseSubs = 0, baseViews = 0;
String avatarUrl;
uint32_t lastFetch = 0, nextFetchIn = 0;
int lastMinute = -1;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uiMessage("Conectando a WiFi", WIFI_SSID);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    if (millis() - start > 20000) {
      uiMessage("No se pudo conectar", String("Reintentando ") + WIFI_SSID + " ...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      start = millis();
    }
  }
  Serial.printf("WiFi OK, IP %s\n", WiFi.localIP().toString().c_str());
}

String timeString(const char* fmt) {
  struct tm t;
  if (!getLocalTime(&t, 0)) return "";
  char buf[16];
  strftime(buf, sizeof buf, fmt, &t);
  return buf;
}

void refresh() {
  if (WiFi.status() != WL_CONNECTED) {
    uiStatus("Sin WiFi, reconectando...", true);
    WiFi.reconnect();
    nextFetchIn = RETRY_MS;
    return;
  }

  if (haveData) uiStatus("Actualizando...", false);
  ChannelStats st = fetchChannelStats(YT_API_KEY, YT_CHANNEL);
  if (!st.ok) {
    Serial.println("Error: " + st.error);
    if (haveData) {
      uiStatus("Error: " + st.error, true);
    } else {
      uiMessage("Error al consultar YouTube", st.error);
    }
    nextFetchIn = RETRY_MS;
    return;
  }

  if (!haveData) {
    baseSubs = st.subscribers;
    baseViews = st.views;
  }
  uiShowStats(st, (int64_t)(st.subscribers - baseSubs), (int64_t)(st.views - baseViews));
  haveData = true;
  lastMinute = -1;  // fuerza a pintar el reloj en el panel recien dibujado

  if (st.thumbUrl.length() && st.thumbUrl != avatarUrl) {
    size_t len = 0;
    uint8_t* jpg = downloadToBuffer(st.thumbUrl, len);
    uiSetAvatar(jpg, len);
    if (jpg) avatarUrl = st.thumbUrl;
  }

  String hhmm = timeString("%H:%M");
  uiStatus(hhmm.length() ? "Actualizado " + hhmm : String("Actualizado"), false);
  Serial.printf("%s: %llu subs, %llu vistas, %llu videos\n", st.title.c_str(),
                (unsigned long long)st.subscribers, (unsigned long long)st.views,
                (unsigned long long)st.videos);
  nextFetchIn = REFRESH_SECONDS * 1000UL;
}

}  // namespace

void setup() {
  // El LED de flash del ESP32-CAM (GPIO4) flota y puede encenderse tenue.
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  Serial.begin(115200);
  uiBegin();
  uiMessage("YouTube Viewer", "Iniciando...");
  connectWiFi();
  configTzTime(TIMEZONE, "pool.ntp.org", "time.google.com");
  uiMessage("Consultando canal", YT_CHANNEL);
  refresh();
  lastFetch = millis();
}

void loop() {
  if (millis() - lastFetch >= nextFetchIn) {
    refresh();
    lastFetch = millis();
  }

  struct tm t;
  if (getLocalTime(&t, 0) && t.tm_min != lastMinute) {
    lastMinute = t.tm_min;
    uiClock(timeString("%H:%M"));
  }
  delay(200);
}
