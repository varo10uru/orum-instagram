// ===========================================================================
// VOZ: lo que dice Mateo en los Reels
//
// La voz sale de Clipchamp (app.clipchamp.com), que es gratis y no pide
// tarjeta: Texto a voz, Español (Uruguay), Mateo, con el guion entero y "..."
// entre línea y línea. Se exporta solo el audio y se guarda como voz.m4a al
// lado del post.json. Ese archivo no va al repo, que es público: el audio
// suelto no se reparte, solo el video terminado.
//
// Acá se corta el audio en esas pausas, una parte por línea del guion, y se
// mide cuánto dura cada una: el video se arma con esos tiempos, así la
// pantalla y los subtítulos siempre van con la voz.
// ===========================================================================

import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { existe } from './comun.mjs';

const ejecutar = promisify(execFile);
const VELOCIDAD = 1.08;
const PAUSA = 0.45;             // segundos de silencio entre líneas
const SILENCIO_DE_LINEA = 0.6;  // las comas hacen pausas más cortas que esto

async function duracion(archivo){
  const { stdout } = await ejecutar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]);
  return Number(stdout);
}

// Los tramos con voz: lo que queda entre los silencios largos
async function tramosConVoz(archivo){
  const { stderr } = await ejecutar('ffmpeg', [
    '-hide_banner', '-i', archivo, '-af', `silencedetect=noise=-40dB:d=${SILENCIO_DE_LINEA}`, '-f', 'null', '-',
  ], { maxBuffer: 10 * 1024 * 1024 });
  const momentos = (nombre) => [...stderr.matchAll(new RegExp(`silence_${nombre}: ([\\d.]+)`, 'g'))].map((m) => Number(m[1]));
  const [inicios, finales] = [momentos('start'), momentos('end')];
  const total = await duracion(archivo);
  const tramos = [];
  let desde = 0;
  for (const [i, inicio] of inicios.entries()){
    if (inicio > desde) tramos.push([desde, inicio]);
    desde = finales[i] ?? total;
  }
  if (desde < total) tramos.push([desde, total]);
  return tramos;
}

// Corta "origen" en una parte por línea y las une con la misma pausa en
// "carpeta/voz.wav". Devuelve cuándo arranca y cuándo termina cada línea, en
// segundos, con la pausa incluida (el "fin" de una línea es el "inicio" de la
// siguiente)
export async function prepararVoz(origen, cuantasLineas, carpeta){
  if (!existe(origen)) throw new Error(`falta ${origen}: exportá la voz desde Clipchamp (ver README, "Reels con voz")`);
  const tramos = await tramosConVoz(origen);
  if (tramos.length !== cuantasLineas){
    throw new Error(`el audio tiene ${tramos.length} partes y el guion ${cuantasLineas} líneas: ¿van "..." entre cada línea en Clipchamp?`);
  }
  await mkdir(carpeta, { recursive: true });
  const archivos = [];
  const tiempos = [];
  let t = 0;
  for (const [i, [desde, hasta]] of tramos.entries()){
    const archivo = join(carpeta, `linea-${i}.wav`);
    // El corte va antes de "-i": después, ffmpeg mediría en el audio ya acelerado
    await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(desde), '-to', String(hasta), '-i', origen, '-af', `atempo=${VELOCIDAD}`, '-ac', '1', archivo]);
    const fin = t + await duracion(archivo) + PAUSA;
    archivos.push(archivo);
    tiempos.push({ inicio: t, fin });
    t = fin;
  }
  const entradas = archivos.flatMap((a) => ['-i', a]);
  const pausas = archivos.map((_, i) => `[${i}]apad=pad_dur=${PAUSA}[a${i}]`).join(';');
  const unidas = archivos.map((_, i) => `[a${i}]`).join('') + `concat=n=${archivos.length}:v=0:a=1[voz]`;
  const salida = join(carpeta, 'voz.wav');
  await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', `${pausas};${unidas}`, '-map', '[voz]', salida]);
  return { archivo: salida, tiempos };
}
