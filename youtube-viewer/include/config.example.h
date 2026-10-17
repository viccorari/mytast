// Copia este archivo como include/config.h y rellena tus datos.
// include/config.h esta en .gitignore para que tu clave no acabe en GitHub.
#pragma once

// --- WiFi (solo redes de 2.4 GHz) ---
#define WIFI_SSID      "MiWiFi"
#define WIFI_PASSWORD  "MiPassword"

// --- YouTube Data API v3 ---
// Clave de API: https://console.cloud.google.com/apis/credentials
#define YT_API_KEY     "AIza..."
// ID del canal ("UCxxxxxxxxxxxxxxxxxxxxxx") o su handle ("@nombre").
#define YT_CHANNEL     "@YouTube"

// Segundos entre consultas. Cada consulta cuesta 1 unidad de las 10.000 diarias gratis.
#define REFRESH_SECONDS 60

// Zona horaria POSIX para el reloj. Ejemplos:
//   Espana: "CET-1CEST,M3.5.0,M10.5.0/3"   Mexico: "CST6"
//   Colombia/Peru: "<-05>5"                 Argentina: "<-03>3"   Chile: "<-04>4<-03>,M9.1.6/24,M4.1.6/24"
#define TIMEZONE       "CET-1CEST,M3.5.0,M10.5.0/3"

// Separador de miles: '.' -> 1.234.567   ',' -> 1,234,567
#define THOUSANDS_SEP  '.'
