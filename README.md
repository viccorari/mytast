# Rastreo Olva

Entorno web local para consultar dónde está un paquete enviado con **Olva Courier**.

No usa ninguna API privada: levanta un Chromium controlado por Playwright, entra a la
página pública de rastreo de Olva, completa el formulario con tu número de guía y
devuelve el resultado ya normalizado (línea de tiempo, texto crudo y captura de pantalla).

## Requisitos

- Node.js >= 20
- Acceso de red a `www.olvacourier.com`

## Instalación

```bash
npm install
npx playwright install chromium
```

## Uso

### Interfaz web

```bash
npm start           # http://localhost:3000
```

Pega el **N° tracking** tal como aparece en la boleta, con el año incluido
(`12345678-26`), o solo la guía y el año por separado. La página muestra el último
estado, todos los movimientos registrados y la captura de lo que devolvió la web de Olva.

### Terminal

```bash
node track.js 12345678-26            # formato de la boleta
node track.js 12345678 2026          # guía y año por separado
HEADED=1 node track.js 12345678-26   # abre el navegador visible, para depurar
```

### API local

```
GET /api/track?code=<guía[-año]>&year=<año>
GET /api/screenshot?code=<guía>
```

Respuesta:

```json
{
  "ok": true,
  "code": "12345678",
  "found": true,
  "status": "En reparto",
  "events": [{ "date": "09/09/2026", "status": "En reparto", "detail": "..." }],
  "rawText": "...",
  "screenshot": "/api/screenshot?code=12345678"
}
```

## Configuración

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del servidor local |
| `OLVA_TRACKING_URL` | `https://www.olvacourier.com/rastrea-tu-envio/` | URL de la página de rastreo |
| `CHROMIUM_PATH` | (autodetectado) | Chromium propio, si no quieres el de Playwright |
| `HEADED` | `0` | `1` abre el navegador con ventana |

## Estructura

```
server.js              servidor local (sin dependencias) + API
track.js               consulta desde la terminal
src/olva-session.js    automatización del navegador contra la web de Olva
public/index.html      interfaz
```

## Notas

- El N° tracking de la boleta viene como `guía-año` de dos dígitos (`12345678-26`);
  el año se expande a cuatro y, si el formulario de Olva lo lista de otra forma, se
  prueban ambas variantes.
- Los selectores del formulario son heurísticos (busca el campo de guía por nombre,
  id o placeholder y, si no lo encuentra, usa el primer campo de texto visible), así
  que un rediseño de la web de Olva no lo rompe de inmediato. Si aun así falla, la
  captura en `.cache/` muestra qué vio el navegador.
- Solo consulta información pública de rastreo: no inicia sesión ni guarda credenciales.
