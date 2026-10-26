// ===========================================================================
// TIKTOK: el kit de la semana, para subirlo a TikTok a mano
//
// Uso:  node scripts/tiktok.mjs semanas/2026-10-26
//       node scripts/tiktok.mjs --salida kit-tiktok semanas/2026-10-26
//
// Por cada post del muro (post, carrusel o Reel) arma un video vertical de
// 1080×1920 listo para TikTok:
//   - Reel: el mismo video.
//   - Carrusel: las placas una atrás de la otra, con un fundido.
//   - Post: la imagen con un acercamiento lento.
// Las placas van un poco más arriba del centro, para que no las tapen los
// botones ni el texto que TikTok pone abajo y a la derecha.
// Los videos van sin música: el sonido se elige en TikTok al subirlos.
// Además deja LEEME.md con el día, la hora y el texto para pegar.
// Primero hay que renderizar la semana. Necesita ffmpeg.
// ===========================================================================

import { execFile } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { HORA_POR_TIPO, RAIZ, VIDEO_DEL_POST, archivosDelPost, buscarPosts, existe } from './comun.mjs';

const ejecutar = promisify(execFile);
const FPS = 30;
const POR_PLACA = 3.5;   // segundos de cada placa del carrusel
const FUNDIDO = 0.4;
const POST = 7;          // segundos del video de un post de una imagen
const ARRIBA = 170;      // px desde arriba donde empieza la placa
const FONDO = '0x0A0A0B';

const NOMBRE_DIA = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

// Placa de 1080×1350 sobre un lienzo de 1080×1920
const AL_LIENZO = `scale=1080:1350,setsar=1,pad=1080:1920:0:${ARRIBA}:color=${FONDO}`;
const CODIFICAR = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart'];
const silencio = (segundos) => ['-f', 'lavfi', '-t', String(segundos), '-i', 'anullsrc=r=44100:cl=stereo'];

export async function videoDeCarrusel(imagenes, destino){
  const n = imagenes.length;
  const total = n * POR_PLACA - (n - 1) * FUNDIDO;
  const entradas = imagenes.flatMap((img) => ['-loop', '1', '-framerate', String(FPS), '-t', String(POR_PLACA), '-i', img]);
  let filtro = imagenes.map((_, i) => `[${i}]${AL_LIENZO},format=yuv420p,fps=${FPS}[v${i}]`).join(';');
  let anterior = 'v0';
  for (let i = 1; i < n; i++){
    const salida = i === n - 1 ? 'v' : `x${i}`;
    filtro += `;[${anterior}][v${i}]xfade=transition=fade:duration=${FUNDIDO}:offset=${(i * (POR_PLACA - FUNDIDO)).toFixed(3)}[${salida}]`;
    anterior = salida;
  }
  if (n === 1) filtro += ';[v0]copy[v]';
  await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', ...entradas, ...silencio(total),
    '-filter_complex', filtro, '-map', '[v]', '-map', `${n}:a`, ...CODIFICAR, destino], { maxBuffer: 10 * 1024 * 1024 });
}

export async function videoDePost(imagen, destino){
  const cuadros = POST * FPS;
  const filtro = `[0]${AL_LIENZO},zoompan=z='1+0.05*on/${cuadros}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${cuadros}:s=1080x1920:fps=${FPS},format=yuv420p[v]`;
  await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-i', imagen, ...silencio(POST),
    '-filter_complex', filtro, '-map', '[v]', '-map', '1:a', ...CODIFICAR, destino], { maxBuffer: 10 * 1024 * 1024 });
}

// El texto para TikTok: el propio si lo hay, si no el mismo del post. A los
// hashtags se suma uno para que lo encuentren en TikTok Uruguay.
const HASHTAG_DE_TIKTOK = '#emprendedoresuruguay';
function textoParaTikTok(datos){
  const hashtags = [...(datos.hashtags || [])];
  if (!hashtags.some((h) => h.toLowerCase() === HASHTAG_DE_TIKTOK)) hashtags.push(HASHTAG_DE_TIKTOK);
  return `${(datos.tiktok?.texto || datos.texto).trim()}\n\n${hashtags.join(' ')}`;
}

// El video vertical de un post o carrusel (el mismo del Reel extra)
export async function armarVideo({ carpeta, datos }, destino){
  if (datos.tipo === 'carrusel') return videoDeCarrusel(datos.piezas.map((_, i) => join(carpeta, `${i + 1}.jpg`)), destino);
  return videoDePost(join(carpeta, '1.jpg'), destino);
}

export async function armarKit(semanas, salida){
  await rm(salida, { recursive: true, force: true });
  await mkdir(salida, { recursive: true });
  const posts = (await buscarPosts(semanas)).filter((p) => p.datos.tipo !== 'historia');
  const leeme = ['# Kit de TikTok', '',
    'Un video por post del muro. Subilos en TikTok Studio (tiktok.com/tiktokstudio/upload) o desde la app, elegí un sonido, pegá el texto y programalo para el día y la hora que dice cada uno.', ''];
  const problemas = [];

  for (const { carpeta, datos } of posts){
    const dia = basename(carpeta).replace(/^\d+-/, '').split('-')[0];
    const nombre = `${datos.fecha}-${basename(carpeta).replace(/^\d+-/, '')}.mp4`;
    const destino = join(salida, nombre);
    const faltan = archivosDelPost(datos).filter((a) => !existe(join(carpeta, a)));
    if (faltan.length){
      problemas.push(`${basename(carpeta)}: faltan ${faltan.join(', ')} (hay que renderizar)`);
      continue;
    }
    if (datos.tipo === 'reel') await copyFile(join(carpeta, 'reel.mp4'), destino);
    else if (existe(join(carpeta, VIDEO_DEL_POST))) await copyFile(join(carpeta, VIDEO_DEL_POST), destino);
    else await armarVideo({ carpeta, datos }, destino);

    const [, mes, d] = datos.fecha.split('-');
    leeme.push(`## ${NOMBRE_DIA[dia] || dia} ${d}/${mes} · ${HORA_POR_TIPO[datos.tipo]} · \`${nombre}\``, '',
      '```', textoParaTikTok(datos), '```', '');
  }
  await writeFile(join(salida, 'LEEME.md'), leeme.join('\n'));
  return { cantidad: posts.length - problemas.length, problemas };
}

// ----- Desde la terminal -----
if (import.meta.url === `file://${process.argv[1]}`){
  const { values, positionals } = parseArgs({ options: { salida: { type: 'string' } }, allowPositionals: true });
  if (!positionals.length){
    console.error('Uso: node scripts/tiktok.mjs [--salida carpeta] <carpeta de la semana>');
    process.exit(2);
  }
  const salida = values.salida || join(RAIZ, '.tmp', 'tiktok', basename(positionals[0]));
  const { cantidad, problemas } = await armarKit(positionals, salida);
  for (const p of problemas) console.error(`✗ ${p}`);
  console.log(`Kit de TikTok: ${cantidad} video(s) en ${salida}`);
  if (problemas.length) process.exit(1);
}
