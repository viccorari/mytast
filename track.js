// Consulta rapida desde la terminal:  node track.js <numero-de-guia> [anio]
import { track, TRACKING_URL } from './src/olva-session.js';

const [code, year] = process.argv.slice(2);

if (!code) {
  console.error('Uso: node track.js <numero-de-guia> [anio]');
  process.exit(1);
}

try {
  const r = await track({
    code,
    year,
    headless: process.env.HEADED !== '1',
    screenshotPath: `.cache/${code.replace(/[^\w-]/g, '')}.png`,
  });

  console.log(`\nGuia ${r.code} — ${TRACKING_URL}`);
  if (!r.found) {
    console.log('Sin resultados: la web no devolvio informacion para esa guia.');
  }
  for (const e of r.events) {
    console.log(`  ${e.date ? e.date + '  ' : ''}${e.status}`);
  }
  if (r.status) console.log(`\nUltimo estado: ${r.status}`);
  if (r.screenshot) console.log(`Captura: ${r.screenshot}`);
} catch (err) {
  console.error(`Error consultando Olva: ${err.message}`);
  process.exit(2);
}
