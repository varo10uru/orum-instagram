// ===========================================================================
// SITIOS REALES: abrirlos como un celular y sacarles capturas
//
// El campo "captura" (o "recorrido") del post.json puede ser:
//   { "sitio": "barraca", "seccion": "simulador" }  → sale de sitios.json
//   { "url": "https://...", "selector": "#algo", "tocar": "#boton" }
//   { "archivo": "marca/capturas/algo.png" }       → una captura ya guardada
//
// Al abrir un sitio no se manda nada ni se cuentan visitas: se corta todo
// pedido que no sea GET y los de analítica, así las estadísticas del
// cliente no se ensucian.
// ===========================================================================

import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ, existe } from './comun.mjs';

export const SITIOS = JSON.parse(await readFile(join(RAIZ, 'sitios.json'), 'utf8'));
const TMP = join(RAIZ, '.tmp', 'capturas');

// Completa los datos con lo que dice sitios.json
export function resolverCaptura(captura){
  if (!captura.sitio) return captura;
  const sitio = SITIOS[captura.sitio];
  if (!sitio) throw new Error(`el sitio "${captura.sitio}" no está en sitios.json`);
  const secciones = sitio.secciones || {};
  if (captura.seccion && !(captura.seccion in secciones)){
    throw new Error(`"${captura.sitio}" no tiene la sección "${captura.seccion}" (hay: ${Object.keys(secciones).join(', ')})`);
  }
  return {
    url: sitio.url,
    tocar: sitio.tocar,
    secciones,
    selector: captura.seccion ? secciones[captura.seccion] : undefined,
    ...captura,
  };
}

// Abre el sitio en un celular de 390 px de ancho (o el que se pida)
export async function abrirSitio(navegador, captura, { ancho = 390, alto = 844, escala = 2 } = {}){
  const { url, tocar } = resolverCaptura(captura);
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: escala,
    isMobile: true,
    hasTouch: true,
    locale: 'es-UY',
    reducedMotion: 'reduce',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  });
  await contexto.route('**/*', (pedido) => {
    const p = pedido.request();
    const analitica = /google-analytics|googletagmanager|plausible|clarity\.ms|facebook\.net|\/rest\/v1\/page_visits/.test(p.url());
    if (p.method() !== 'GET' || analitica) return pedido.abort();
    return pedido.continue();
  });

  const pagina = await contexto.newPage();
  await pagina.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  // Botón a tocar antes (ej. "Saltar intro"), si está
  if (tocar){
    const boton = pagina.locator(tocar).first();
    if (await boton.isVisible().catch(() => false)){
      await boton.click();
      await pagina.waitForTimeout(900);
    }
  }
  // Desplazamiento instantáneo: con el suave, los saltos quedan a mitad de camino
  await pagina.addStyleTag({ content: 'html, body { scroll-behavior: auto !important; }' });
  return { contexto, pagina };
}

// Posición vertical de una sección, dejando lugar para el menú fijo del sitio
export async function posicionDe(pagina, selector){
  return pagina.locator(selector).first().evaluate((el) =>
    Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72));
}

// Captura de una pantalla del sitio, como se ve en el celular
export async function capturarSitio(navegador, captura){
  if (captura.archivo) return join(RAIZ, captura.archivo);
  const datos = resolverCaptura(captura);
  const { url, desplazar = 0, selector, esperar = 1500 } = datos;

  const clave = createHash('sha1').update(JSON.stringify({ url, desplazar, selector })).digest('hex').slice(0, 12);
  const destino = join(TMP, `${clave}.png`);
  if (existe(destino)) return destino;
  await mkdir(TMP, { recursive: true });

  const { contexto, pagina } = await abrirSitio(navegador, datos);
  const y = (selector ? await posicionDe(pagina, selector) : 0) + desplazar;
  await pagina.evaluate((y) => window.scrollTo(0, y), y);
  await pagina.waitForTimeout(esperar);
  await pagina.screenshot({ path: destino, type: 'png' });
  await contexto.close();
  return destino;
}
