// Servidor del entorno web: sirve la interfaz local y expone /api/track, que
// levanta el navegador contra la web de Olva y devuelve el resultado en JSON.
// Sin dependencias externas: solo el http de Node.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { track, TRACKING_URL } from './src/olva-session.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const CACHE_DIR = path.join(ROOT, '.cache');
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/api/track') return await handleTrack(url, res);
    if (url.pathname === '/api/screenshot') return await sendFile(res, lastShot(url));
    return await serveStatic(url.pathname, res);
  } catch (err) {
    json(res, 500, { ok: false, error: err.message });
  }
});

async function handleTrack(url, res) {
  const code = (url.searchParams.get('code') || '').trim();
  const year = (url.searchParams.get('year') || '').trim();
  if (!code) return json(res, 400, { ok: false, error: 'Falta el parametro code.' });

  const shot = path.join(CACHE_DIR, `${code.replace(/[^\w-]/g, '')}.png`);
  const started = Date.now();
  try {
    const result = await track({ code, year: year || undefined, screenshotPath: shot });
    json(res, 200, {
      ...result,
      screenshot: `/api/screenshot?code=${encodeURIComponent(code)}`,
      elapsedMs: Date.now() - started,
      source: TRACKING_URL,
    });
  } catch (err) {
    json(res, 502, { ok: false, code, error: err.message, source: TRACKING_URL });
  }
}

function lastShot(url) {
  const code = (url.searchParams.get('code') || '').replace(/[^\w-]/g, '');
  return path.join(CACHE_DIR, `${code}.png`);
}

async function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'forbidden' });
  await sendFile(res, file);
}

async function sendFile(res, file) {
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

server.listen(PORT, () => {
  console.log(`Entorno web de rastreo Olva -> http://localhost:${PORT}`);
  console.log(`Consultando contra: ${TRACKING_URL}`);
});
