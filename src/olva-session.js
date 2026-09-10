// Entorno web: abre la pagina publica de rastreo de Olva Courier en un navegador
// Chromium controlado por Playwright, completa el formulario y devuelve el
// resultado ya normalizado (estados + texto crudo + captura de pantalla).
//
// Se usa el navegador real en vez de una API interna porque Olva no publica un
// endpoint documentado: lo que ve el script es exactamente lo que veria una
// persona entrando a la web.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

export const TRACKING_URL =
  process.env.OLVA_TRACKING_URL || 'https://www.olvacourier.com/rastrea-tu-envio/';

// Textos que delatan el boton de consulta y el banner de cookies.
const SUBMIT_TEXT = /rastrea|rastrear|buscar|consultar|seguimiento|track/i;
const COOKIE_TEXT = /acept|entendido|de acuerdo|cerrar|ok/i;

// Palabras que aparecen en los estados de un envio de Olva.
const STATE_HINTS =
  /(recepcion|recibido|en transito|transito|reparto|ruta|distribuci|entregado|agencia|almac|pendiente|devoluci|observad|destino|origen)/i;

/**
 * Consulta una guia en la web de Olva.
 *
 * @param {object} opts
 * @param {string} opts.code   Numero de guia / orden (obligatorio).
 * @param {string} [opts.year] Anio de emision, si el formulario lo pide.
 * @param {boolean} [opts.headless=true]
 * @param {number} [opts.timeout=45000]
 * @param {string} [opts.screenshotPath] Si se indica, guarda una captura ahi.
 */
export async function track({
  code,
  year,
  headless = true,
  timeout = 45000,
  screenshotPath,
} = {}) {
  if (!code || !String(code).trim()) {
    throw new Error('Falta el numero de guia (code).');
  }
  code = String(code).trim();

  const browser = await chromium.launch({
    headless,
    executablePath: resolveChromium(),
  });
  const context = await browser.newContext({
    locale: 'es-PE',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(TRACKING_URL, { waitUntil: 'domcontentloaded', timeout });
    await dismissCookieBanner(page);

    const beforeText = await bodyText(page);

    const input = await findTrackingInput(page);
    if (!input) {
      throw new Error(
        `No se encontro el campo de guia en ${TRACKING_URL}. ` +
          'Revisa la captura: es probable que la web haya cambiado de formulario.',
      );
    }
    await input.fill(code);

    if (year) await fillYear(page, String(year));

    await submit(page, input);
    await waitForResult(page, beforeText, timeout);

    const rawText = await bodyText(page);
    const events = await extractEvents(page);

    let screenshot = null;
    if (screenshotPath) {
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshot = screenshotPath;
    }

    return {
      ok: true,
      code,
      year: year || null,
      url: page.url(),
      found: events.length > 0 || looksLikeAResult(rawText, beforeText),
      status: events.length ? events[events.length - 1].status : null,
      events,
      rawText,
      screenshot,
      consultedAt: new Date().toISOString(),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

// Playwright normalmente trae su propio Chromium (npx playwright install).
// Si el entorno ya tiene uno instalado aparte, lo reutilizamos en vez de fallar.
function resolveChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH
      ? listChromiumBuilds(process.env.PLAYWRIGHT_BROWSERS_PATH)
      : []),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);

  for (const c of candidates) {
    if (fsSync.existsSync(c)) return c;
  }
  return undefined; // que Playwright use el navegador que descargo el mismo
}

function listChromiumBuilds(root) {
  try {
    return fsSync
      .readdirSync(root)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse()
      .map((d) => path.join(root, d, 'chrome-linux', 'chrome'));
  } catch {
    return [];
  }
}

async function dismissCookieBanner(page) {
  const buttons = await page.locator('button, a[role="button"], .cookie a').all();
  for (const b of buttons.slice(0, 25)) {
    const label = ((await b.textContent()) || '').trim();
    if (label && COOKIE_TEXT.test(label) && label.length < 30) {
      await b.click({ timeout: 2000 }).catch(() => {});
      return;
    }
  }
}

// Busca el input de la guia: primero por atributos evidentes, luego el primer
// campo de texto visible de la pagina.
async function findTrackingInput(page) {
  const bySelector = [
    'input[name*="guia" i]',
    'input[name*="track" i]',
    'input[id*="guia" i]',
    'input[id*="track" i]',
    'input[placeholder*="guia" i]',
    'input[placeholder*="guía" i]',
    'input[placeholder*="orden" i]',
    'input[placeholder*="track" i]',
    'input[type="search"]',
  ];
  for (const sel of bySelector) {
    const el = page.locator(sel).first();
    if (await el.count().then((n) => n > 0).catch(() => false)) {
      if (await el.isVisible().catch(() => false)) return el;
    }
  }
  const generic = page.locator('input[type="text"], input[type="number"], input:not([type])');
  const n = await generic.count();
  for (let i = 0; i < n; i++) {
    const el = generic.nth(i);
    if (await el.isVisible().catch(() => false)) return el;
  }
  return null;
}

// El formulario de Olva suele pedir tambien el anio de emision.
async function fillYear(page, year) {
  const select = page.locator('select').first();
  if (await select.count().then((c) => c > 0).catch(() => false)) {
    const ok = await select.selectOption(year).then(() => true).catch(() => false);
    if (ok) return;
  }
  const candidates = page.locator(
    'input[name*="anio" i], input[name*="año" i], input[name*="year" i], ' +
      'input[placeholder*="año" i], input[placeholder*="year" i]',
  );
  if (await candidates.count().then((c) => c > 0).catch(() => false)) {
    await candidates.first().fill(year).catch(() => {});
  }
}

async function submit(page, input) {
  const buttons = await page.locator('button, input[type="submit"], a.btn').all();
  for (const b of buttons.slice(0, 40)) {
    const label = (
      ((await b.textContent()) || '') + ' ' + ((await b.getAttribute('value')) || '')
    ).trim();
    if (label && SUBMIT_TEXT.test(label) && (await b.isVisible().catch(() => false))) {
      await b.click({ timeout: 5000 }).catch(() => {});
      return;
    }
  }
  await input.press('Enter').catch(() => {});
}

// La web puede responder sin recargar (AJAX), asi que esperamos a que el texto
// de la pagina cambie o a que se quede la red en silencio.
async function waitForResult(page, beforeText, timeout) {
  await page
    .waitForFunction(
      (prev) => document.body.innerText.trim() !== prev,
      beforeText,
      { timeout: Math.min(timeout, 20000) },
    )
    .catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body.innerText).catch(() => '')).trim();
}

function looksLikeAResult(rawText, beforeText) {
  return rawText !== beforeText && STATE_HINTS.test(rawText);
}

// Saca la linea de tiempo del envio. Primero intenta leer una tabla; si no hay,
// recoge las lineas de texto que parecen estados.
async function extractEvents(page) {
  const rows = await page
    .evaluate(() => {
      const out = [];
      for (const table of document.querySelectorAll('table')) {
        const trs = [...table.querySelectorAll('tr')];
        if (trs.length < 2) continue;
        const head = trs[0].innerText.toLowerCase();
        if (!/estado|fecha|situac|detalle|movimiento/.test(head)) continue;
        for (const tr of trs.slice(1)) {
          const cells = [...tr.querySelectorAll('td')].map((td) => td.innerText.trim());
          if (cells.some(Boolean)) out.push(cells);
        }
      }
      return out;
    })
    .catch(() => []);

  if (rows.length) {
    return rows.map((cells) => ({
      date: cells.find((c) => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(c)) || null,
      status: cells.find((c) => /[a-z]{4,}/i.test(c)) || cells.join(' '),
      detail: cells.join(' | '),
    }));
  }

  const lines = (await bodyText(page))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && l.length < 200 && STATE_HINTS.test(l));

  return [...new Set(lines)].map((l) => ({
    date: (l.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[^|]*/) || [null])[0],
    status: l,
    detail: l,
  }));
}
