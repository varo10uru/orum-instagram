// ===========================================================================
// REEL CON VOZ: una situación contada por Mateo, con el sitio real en pantalla
//
// El post.json lleva "recorrido": { "sitio": "almilu" } y un "guion", con una
// entrada por línea:
//   "dice":       lo que dice la voz.
//   "subtitulos": lo que se lee, repartido en el tiempo de la línea. *Esto*
//                 va en verde y \n corta el renglón.
//   "hora":       una hora grande arriba, durante toda la línea ("23:00").
//   "pasos":      lo que pasa en pantalla, en orden. Después del último, la
//                 imagen se queda quieta hasta que arranca la línea siguiente.
//     { "ir": "#casas", "margen": 80 }     salta ahí, sin que se vea el viaje
//     { "bajar": "#fotos", "margen": 80, "segundos": 1.2, "prender": true }
//                                          baja suave; "prender" aclara la pantalla
//     { "tocar": "selector", "espera": 0.1 }  muestra el dedo y toca de verdad
//     { "senalar": "selector" }            muestra el dedo y no toca
//     { "oscuro": 0.84 }                   apaga la pantalla (0 la prende)
//     { "placa": "mensaje", "hora": "08:00", "etiqueta": "...", "leer": "selector" }
//                                          muestra lo que dice ese lugar de la página
//     { "placa": "cierre" }                logo y número
// "margen" es el lugar que queda arriba del elemento; si es negativo, baja
// más allá de su principio.
//
// Primero se corta la voz (voz.mjs): cuánto dura cada línea marca el video.
// Se graba cuadro por cuadro, así sale parejo aunque la máquina sea lenta.
// Nunca se manda nada: abrirSitio corta todo lo que no sea GET y WhatsApp no
// llega a abrirse. Resultado: reel.mp4 (1080×1920), portada.jpg y tira.jpg.
// Necesita ffmpeg.
// ===========================================================================

import { execFile } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { RAIZ, VOZ_DEL_REEL } from './comun.mjs';
import { FPS, armarTira, suave } from './recorrido.mjs';
import { abrirSitio } from './sitios.mjs';
import { prepararVoz } from './voz.mjs';

const ejecutar = promisify(execFile);
const COLA = 0.8;          // segundos que sigue el cierre después de la voz
const SEGUNDO_DE_PORTADA = 2;
const ESPERA_DEL_TOQUE = 0.3;
const SE_PASA = 0.4;       // segundos que los pasos pueden pasarse de su línea

const ESTILOS = `
  #reel-oscuro{ position:fixed; inset:0; background:#0A0A0B; opacity:0; z-index:2147483000; pointer-events:none; }
  #reel-dedo{ position:fixed; display:none; width:48px; height:48px; margin:-24px 0 0 -24px; border-radius:50%;
    background:rgba(212,255,63,.55); border:3px solid #0A0A0B; z-index:2147483001; pointer-events:none; }`;

// Saca las capas de la plantilla reel-voz.html
async function abrirCapas(navegador){
  const contexto = await navegador.newContext({ viewport: { width: 1080, height: 1920 } });
  const pagina = await contexto.newPage();
  await pagina.goto(pathToFileURL(join(RAIZ, 'plantillas', 'reel-voz.html')).href);
  await pagina.evaluate(() => document.fonts.ready);
  const sacar = async (datos, archivo) => {
    await pagina.evaluate((d) => window.armar(d), datos);
    await pagina.evaluate(() => document.fonts.ready);
    const jpg = archivo.endsWith('.jpg');
    await pagina.screenshot({ path: archivo, type: jpg ? 'jpeg' : 'png', ...(jpg ? { quality: 92 } : { omitBackground: true }) });
    return archivo;
  };
  return { contexto, sacar };
}

// Graba la pantalla en "tmp/cuadros", línea por línea
async function grabarPantalla(navegador, { datos, tiempos, total, tmp, capas, problemas }){
  const { contexto, pagina } = await abrirSitio(navegador, datos.recorrido, { ancho: 360, alto: 640, escala: 3 });
  await contexto.route(/wa\.me|whatsapp\.com/, (pedido) => pedido.abort());
  await pagina.evaluate(() => { window.open = () => null; });
  await pagina.addStyleTag({ content: ESTILOS });
  await pagina.evaluate(() => {
    for (const id of ['reel-oscuro', 'reel-dedo']){
      const capa = document.createElement('div');
      capa.id = id;
      document.body.appendChild(capa);
    }
  });

  // Baja toda la página de a poco para que cargue lo que se carga al llegar
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < alto; y += 450){
    await pagina.evaluate((y) => window.scrollTo(0, y), y);
    await pagina.waitForTimeout(110);
  }

  const carpeta = join(tmp, 'cuadros');
  await mkdir(carpeta, { recursive: true });
  const cuadro = (i) => join(carpeta, `${String(i).padStart(5, '0')}.jpg`);
  let n = 0;
  let ultimo = null;           // la imagen que se repite cuando está quieto
  let cambio = false;          // la pantalla cambió y falta sacarle una foto
  let nivelOscuro = 0;
  let hayDedo = false;

  const foto = async () => {
    await pagina.screenshot({ path: cuadro(n), type: 'jpeg', quality: 90 });
    ultimo = cuadro(n++);
    cambio = false;
  };
  const quieto = async (segundos) => {
    if (cambio) await foto();
    for (let i = 0, k = Math.round(segundos * FPS); i < k; i++) await copyFile(ultimo, cuadro(n++));
  };
  const posicion = (selector, margen = 80) => pagina.locator(selector).first()
    .evaluate((el, m) => el.getBoundingClientRect().top + window.scrollY - m, margen);
  const ponerOscuro = (nivel) => pagina.evaluate((o) => { document.getElementById('reel-oscuro').style.opacity = o; }, nivel);
  const ponerDedo = async (selector) => {
    const caja = await pagina.locator(selector).first().boundingBox();
    await pagina.evaluate(({ x, y }) => {
      const dedo = document.getElementById('reel-dedo');
      Object.assign(dedo.style, { display: 'block', left: `${x}px`, top: `${y}px` });
    }, { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 });
    hayDedo = cambio = true;
  };
  const sacarDedo = async () => {
    if (!hayDedo) return;
    await pagina.evaluate(() => { document.getElementById('reel-dedo').style.display = 'none'; });
    hayDedo = false;
    cambio = true;
  };

  async function darPaso(paso, i){
    if (paso.oscuro !== undefined){
      nivelOscuro = paso.oscuro;
      await ponerOscuro(nivelOscuro);
      cambio = true;
    } else if (paso.ir){
      await pagina.evaluate((y) => window.scrollTo(0, y), await posicion(paso.ir, paso.margen));
      await pagina.waitForTimeout(700);
      cambio = true;
    } else if (paso.bajar){
      const desde = await pagina.evaluate(() => window.scrollY);
      const hasta = await posicion(paso.bajar, paso.margen);
      const cuadros = Math.round((paso.segundos ?? 1.2) * FPS);
      for (let f = 1; f <= cuadros; f++){
        await pagina.evaluate((y) => window.scrollTo(0, y), Math.round(desde + (hasta - desde) * suave(f / cuadros)));
        if (paso.prender) await ponerOscuro(Math.max(0, nivelOscuro * (1 - f / (cuadros * 0.4))));
        await foto();
      }
      if (paso.prender) nivelOscuro = 0;
    } else if (paso.tocar){
      const espera = paso.espera ?? ESPERA_DEL_TOQUE;
      await ponerDedo(paso.tocar);
      await quieto(espera);
      await pagina.locator(paso.tocar).first().click();
      await pagina.waitForTimeout(350);
      await foto();
      await quieto(espera);
      await sacarDedo();
    } else if (paso.senalar){
      await ponerDedo(paso.senalar);
    } else if (paso.placa){
      const texto = paso.leer ? (await pagina.locator(paso.leer).first().textContent()).trim() : undefined;
      ultimo = await capas.sacar({ tipo: paso.placa, hora: paso.hora, etiqueta: paso.etiqueta, texto }, join(tmp, `placa-${i}.jpg`));
      cambio = false;
    }
  }

  for (const [i, linea] of datos.guion.entries()){
    await sacarDedo();
    for (const paso of linea.pasos || []) await darPaso(paso, i);
    const hasta = i === datos.guion.length - 1 ? total : tiempos[i].fin;
    if (n / FPS > hasta + SE_PASA) problemas.push(`línea ${i + 1}: lo que pasa en pantalla dura más que lo que dice la voz`);
    await quieto(Math.max(0, hasta - n / FPS));
  }
  await contexto.close();
}

// Hora y subtítulos: qué imagen va arriba del video y en qué momento. Cada
// subtítulo dura según lo que tiene para leer.
async function armarCapas({ datos, tiempos, tmp, capas }){
  const lista = [];
  for (const [i, linea] of datos.guion.entries()){
    const { inicio, fin } = tiempos[i];
    if (linea.hora) lista.push({ archivo: await capas.sacar({ tipo: 'hora', hora: linea.hora }, join(tmp, `hora-${i}.png`)), inicio, fin });
    const subtitulos = linea.subtitulos || [];
    const letras = (t) => t.replace(/[*\n]/g, '').length;
    const totalDeLetras = subtitulos.reduce((suma, t) => suma + letras(t), 0);
    let t = inicio;
    for (const [j, texto] of subtitulos.entries()){
      const hasta = t + (fin - inicio) * letras(texto) / totalDeLetras;
      lista.push({ archivo: await capas.sacar({ tipo: 'subtitulo', texto }, join(tmp, `subtitulo-${i}-${j}.png`)), inicio: t, fin: hasta });
      t = hasta;
    }
  }
  return lista;
}

export async function grabarReelConVoz(navegador, { carpeta, datos }){
  const problemas = [];
  const tmp = join(RAIZ, '.tmp', `reel-${basename(carpeta)}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  // 1. La voz: de acá salen los tiempos de todo lo demás
  const { archivo: voz, tiempos } = await prepararVoz(join(carpeta, VOZ_DEL_REEL), datos.guion.length, join(tmp, 'voz'));
  const total = tiempos.at(-1).fin + COLA;

  // 2. La pantalla y las capas
  const capas = await abrirCapas(navegador);
  await grabarPantalla(navegador, { datos, tiempos, total, tmp, capas, problemas });
  const encima = await armarCapas({ datos, tiempos, tmp, capas });
  await capas.contexto.close();

  // 3. Todo junto
  const entradas = encima.flatMap((c) => ['-i', c.archivo]);
  const filtros = encima.map((c, i) => {
    const entrada = i ? `v${i}` : '0:v';
    return `[${entrada}][${i + 2}:v]overlay=0:0:enable='between(t,${c.inicio.toFixed(2)},${c.fin.toFixed(2)})'[v${i + 1}]`;
  });
  await ejecutar('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', join(tmp, 'cuadros', '%05d.jpg'),
    '-i', voz,
    ...entradas,
    '-filter_complex', [...filtros, '[1:a]loudnorm=I=-14:TP=-1.5:LRA=7,aresample=44100,apad[audio]'].join(';'),
    '-map', `[v${encima.length}]`, '-map', '[audio]', '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    join(carpeta, 'reel.mp4'),
  ], { maxBuffer: 10 * 1024 * 1024 });

  // 4. La tapa y la tira para revisarlo en el PR
  await ejecutar('ffmpeg', [
    '-y', '-loglevel', 'error', '-ss', String(SEGUNDO_DE_PORTADA), '-i', join(carpeta, 'reel.mp4'),
    '-frames:v', '1', '-q:v', '3', join(carpeta, 'portada.jpg'),
  ]);
  await armarTira(carpeta, total);

  await rm(tmp, { recursive: true, force: true });
  return problemas;
}
