#include "youtube.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

namespace {

// La API devuelve los contadores como strings ("12345").
uint64_t parseCount(JsonVariantConst v) {
  const char* s = v.as<const char*>();
  return s ? strtoull(s, nullptr, 10) : 0;
}

}  // namespace

ChannelStats fetchChannelStats(const char* apiKey, const char* channel) {
  ChannelStats st;

  String url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&key=";
  url += apiKey;
  if (channel[0] == '@') {
    url += "&forHandle=%40";
    url += channel + 1;
  } else {
    url += "&id=";
    url += channel;
  }

  // Sin verificacion de certificado: simplifica y evita que caduque el CA embebido.
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.useHTTP10(true);  // evita "chunked" para poder parsear el stream directamente
  http.setTimeout(10000);
  if (!http.begin(client, url)) {
    st.error = "URL invalida";
    return st;
  }

  int code = http.GET();
  if (code <= 0) {
    st.error = "HTTP: " + HTTPClient::errorToString(code);
    http.end();
    return st;
  }

  // Solo guardamos los campos que usamos; la respuesta completa es mucho mayor.
  JsonDocument filter;
  filter["error"]["message"] = true;
  filter["items"][0]["snippet"]["title"] = true;
  filter["items"][0]["snippet"]["customUrl"] = true;
  filter["items"][0]["snippet"]["thumbnails"]["default"]["url"] = true;
  filter["items"][0]["statistics"] = true;

  JsonDocument doc;
  DeserializationError err =
      deserializeJson(doc, http.getStream(), DeserializationOption::Filter(filter));
  http.end();

  if (code != HTTP_CODE_OK) {
    const char* msg = doc["error"]["message"] | "";
    st.error = "API " + String(code) + ": " + msg;
    return st;
  }
  if (err) {
    st.error = String("JSON: ") + err.c_str();
    return st;
  }

  JsonVariantConst ch = doc["items"][0];
  if (ch.isNull()) {
    st.error = "Canal no encontrado";
    return st;
  }

  st.title = ch["snippet"]["title"] | "";
  st.handle = ch["snippet"]["customUrl"] | "";
  st.thumbUrl = ch["snippet"]["thumbnails"]["default"]["url"] | "";
  JsonVariantConst s = ch["statistics"];
  st.subscribers = parseCount(s["subscriberCount"]);
  st.views = parseCount(s["viewCount"]);
  st.videos = parseCount(s["videoCount"]);
  st.subscribersHidden = s["hiddenSubscriberCount"] | false;
  st.ok = true;
  return st;
}

uint8_t* downloadToBuffer(const String& url, size_t& outLen, size_t maxLen) {
  outLen = 0;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.useHTTP10(true);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(10000);
  if (!http.begin(client, url)) return nullptr;
  if (http.GET() != HTTP_CODE_OK) {
    http.end();
    return nullptr;
  }

  int size = http.getSize();  // -1 si el servidor no manda Content-Length
  size_t cap = size > 0 ? (size_t)size : maxLen;
  if (cap > maxLen) {
    http.end();
    return nullptr;
  }
  uint8_t* buf = (uint8_t*)malloc(cap);
  if (!buf) {
    http.end();
    return nullptr;
  }

  WiFiClient* stream = http.getStreamPtr();
  size_t got = 0;
  uint32_t start = millis();
  while (got < cap && (http.connected() || stream->available()) && millis() - start < 10000) {
    size_t avail = stream->available();
    if (avail) {
      got += stream->readBytes(buf + got, min(avail, cap - got));
    } else {
      delay(5);
    }
  }
  http.end();

  if (got == 0 || (size > 0 && got != (size_t)size)) {
    free(buf);
    return nullptr;
  }
  outLen = got;
  return buf;
}
