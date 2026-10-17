#pragma once
#include <Arduino.h>

struct ChannelStats {
  bool ok = false;
  String error;
  String title;
  String handle;    // customUrl, p. ej. "@midudev"
  String thumbUrl;  // avatar 88x88 (JPEG)
  uint64_t subscribers = 0;
  uint64_t views = 0;
  uint64_t videos = 0;
  bool subscribersHidden = false;
};

// channel: ID "UC..." o handle "@nombre".
ChannelStats fetchChannelStats(const char* apiKey, const char* channel);

// Descarga un archivo pequeno a un buffer de malloc(). El llamador hace free().
// Devuelve nullptr si falla o si ocupa mas de maxLen.
uint8_t* downloadToBuffer(const String& url, size_t& outLen, size_t maxLen = 32 * 1024);
