// ===========================================================================
// RECORRIDO: Reel que muestra un sitio real como se ve en el celular
//
// El post.json de un Reel lleva:
//   "recorrido": { "sitio": "barraca", "paradas": ["simulador", "ofertas"] }
//   "piezas": [ placa de entrada, placa de cierre ]   (plantilla "historia")
//
// El video queda así: placa de entrada (2,5 s) → el sitio bajando de a poco
// y parando en cada sección → placa de cierre (3 s). Se graba cuadro por
// cuadro (30 por segundo), así sale parejo aunque la máquina sea lenta.
// Resultado: reel.mp4 (1080×1920) y portada.jpg (la placa de entrada).
// Necesita ffmpeg instalado.
// ===========================================================================

import { execFile } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { RAIZ } from './comun.mjs';
import { prepararPieza, renderizarPieza } from './piezas.mjs';
import { abrirSitio, posicionDe, resolverCaptura } from './sitios.mjs';

const ejecutar = promisify(execFile);
const FPS = 30;
const ENTRADA = 2.5;     // segundos de la placa de entrada
const CIERRE = 3;        // segundos de la placa de cierre
const FUNDIDO = 0.4;     // segundos de cada fundido entre partes
const QUIETO_INICIO = 1.2;
const MOVIMIENTO = 1.6;  // segundos que tarda en llegar a cada parada
const QUIETO = 1.4;      // segundos que se queda en cada parada

const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Cronograma: la posición de la página en cada cuadro
function cronograma(posiciones){
  const cuadros = [];
  const quieto = (y, segundos) => { for (let i = 0; i < Math.round(segundos * FPS); i++) cuadros.push(y); };
  quieto(posiciones[0], QUIETO_INICIO);
  for (let i = 1; i < posiciones.length; i++){
    const [desde, hasta] = [posiciones[i - 1], posiciones[i]];
    const n = Math.round(MOVIMIENTO * FPS);
    for (let f = 1; f <= n; f++) cuadros.push(Math.round(desde + (hasta - desde) * suave(f / n)));
    quieto(hasta, QUIETO);
  }
  return cuadros;
}

// Graba los cuadros del sitio en la carpeta "destino"
async function grabarCuadros(navegador, recorrido, destino){
  const datos = resolverCaptura(recorrido);
  const { contexto, pagina } = await abrirSitio(navegador, datos, { ancho: 360, alto: 640, escala: 3 });

  // Baja toda la página de a poco para que carguen las imágenes diferidas
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(alto, 20000); y += 500){
    await pagina.evaluate((y) => window.scrollTo(0, y), y);
    await pagina.waitForTimeout(120);
  }
  await pagina.evaluate(() => window.scrollTo(0, 0));
  await pagina.waitForTimeout(1500);

  // Paradas: secciones de sitios.json (o selectores, si no hay "sitio")
  const maximo = await pagina.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const posiciones = [0];
  for (const parada of recorrido.paradas || []){
    const selector = datos.secciones?.[parada] ?? parada;
    if (!selector) continue;   // la sección "inicio" es el principio
    posiciones.push(Math.min(maximo, await posicionDe(pagina, selector)));
  }

  // Un cuadro por posición; si la posición no cambió, se copia el anterior
  await mkdir(destino, { recursive: true });
  const cuadros = cronograma(posiciones);
  let anterior = null;
  for (const [i, y] of cuadros.entries()){
    const archivo = join(destino, `${String(i).padStart(5, '0')}.jpg`);
    if (anterior && anterior.y === y){
      await copyFile(anterior.archivo, archivo);
    } else {
      await pagina.evaluate((y) => window.scrollTo(0, y), y);
      await pagina.screenshot({ path: archivo, type: 'jpeg', quality: 88 });
    }
    anterior = { y, archivo };
  }
  await contexto.close();
  return cuadros.length / FPS;
}

export async function grabarReel(navegador, { carpeta, datos }){
  const problemas = [];
  const tmp = join(RAIZ, '.tmp', `reel-${basename(carpeta)}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  // 1. Placas de entrada y de cierre
  const [entrada, cierre] = datos.piezas;
  for (const [nombre, pieza] of [['entrada', entrada], ['cierre', cierre]]){
    const datosPieza = await prepararPieza(navegador, pieza, 'historia');
    for (const p of await renderizarPieza(navegador, 'historia', datosPieza, join(tmp, `${nombre}.jpg`))){
      problemas.push(`placa de ${nombre}: ${p}`);
    }
  }
  await copyFile(join(tmp, 'entrada.jpg'), join(carpeta, 'portada.jpg'));

  // 2. El recorrido por el sitio
  const segundos = await grabarCuadros(navegador, datos.recorrido, join(tmp, 'cuadros'));

  // 3. Todo junto, con fundidos y una pista de audio en silencio
  //    (algunos reproductores no muestran videos sin pista de audio)
  const parte2 = ENTRADA + segundos - FUNDIDO;
  const total = parte2 + CIERRE - FUNDIDO;
  const normalizar = 'scale=1080:1920,setsar=1,fps=30,format=yuv420p';
  await ejecutar('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-framerate', String(FPS), '-t', String(ENTRADA), '-i', join(tmp, 'entrada.jpg'),
    '-framerate', String(FPS), '-i', join(tmp, 'cuadros', '%05d.jpg'),
    '-loop', '1', '-framerate', String(FPS), '-t', String(CIERRE), '-i', join(tmp, 'cierre.jpg'),
    '-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo',
    '-filter_complex',
    `[0]${normalizar}[a];[1]${normalizar}[b];[2]${normalizar}[c];` +
    `[a][b]xfade=transition=fade:duration=${FUNDIDO}:offset=${ENTRADA - FUNDIDO}[ab];` +
    `[ab][c]xfade=transition=fade:duration=${FUNDIDO}:offset=${(parte2 - FUNDIDO).toFixed(3)}[v]`,
    '-map', '[v]', '-map', '3:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart',
    join(carpeta, 'reel.mp4'),
  ], { maxBuffer: 10 * 1024 * 1024 });

  await rm(tmp, { recursive: true, force: true });
  return problemas;
}
