// ===========================================================================
// PIEZAS: llenar una plantilla con los datos de una pieza y capturarla
// ===========================================================================

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLANTILLAS, RAIZ } from './comun.mjs';
import { capturarSitio } from './sitios.mjs';

// "fondo": "072" es un cuadro del render del hero. En las historias se usa
// la versión vertical.
function rutaDeFondo(fondo, plantilla){
  if (!fondo || !/^\d{3}$/.test(fondo)) return fondo;
  return plantilla === 'historia' ? `../marca/hero/movil/${fondo}.webp` : `../marca/hero/${fondo}.webp`;
}

// Arma los datos que recibe la plantilla: fondo y captura listos
export async function prepararPieza(navegador, pieza, plantilla){
  const datos = { ...pieza, fondo: rutaDeFondo(pieza.fondo, plantilla) };
  if (pieza.captura){
    datos.captura_src = pathToFileURL(await capturarSitio(navegador, pieza.captura)).href;
  }
  return datos;
}

// Abre la plantilla en Chrome, la llena y guarda la imagen en "destino".
// Devuelve la lista de problemas (textos que no entran, errores).
export async function renderizarPieza(navegador, plantilla, datos, destino){
  const { archivo, ancho, alto } = PLANTILLAS[plantilla];
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

  await pagina.addInitScript((d) => { window.DATOS = d; }, datos);
  await pagina.goto(pathToFileURL(join(RAIZ, 'plantillas', archivo)).href);
  await pagina.waitForSelector('body[data-listo="1"]', { timeout: 30_000 });
  const desbordes = await pagina.evaluate(() => window.DESBORDES);
  await pagina.screenshot({ path: destino, type: 'jpeg', quality: 90 });
  await contexto.close();
  return [...desbordes, ...errores.map((e) => `error en la plantilla: ${e}`)];
}
