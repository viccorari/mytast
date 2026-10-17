#pragma once
#include <Arduino.h>

#include "youtube.h"

void uiBegin();

// Pantalla completa con un mensaje (arranque, WiFi, errores antes del primer dato).
void uiMessage(const String& title, const String& detail = "");

// Toma posesion del buffer JPEG (lo libera con free()). nullptr -> inicial del canal.
void uiSetAvatar(uint8_t* jpg, size_t len);

// Dibuja el panel (completo la primera vez, solo los valores despues).
void uiShowStats(const ChannelStats& st, int64_t subsDelta, int64_t viewsDelta);

// Linea de estado del pie de pagina (izquierda) y reloj (derecha).
void uiStatus(const String& text, bool isError);
void uiClock(const String& text);
