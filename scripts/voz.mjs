// ===========================================================================
// VOZ: lo que dice Mateo en los Reels, con Azure Speech
//
// Necesita AZURE_SPEECH_KEY (secreto del repo, ver README). La región sale de
// AZURE_SPEECH_REGION; si no está, se usa eastus.
//
// Se pide una línea del guion por vez y se mide cuánto dura cada una: el
// video se arma con esos tiempos, así la pantalla y los subtítulos siempre
// van con la voz. Resultado: voz.wav y el momento en que arranca cada línea.
// ===========================================================================

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
const VOZ = 'es-UY-MateoNeural';
const VELOCIDAD = '+8%';
const FORMATO = 'riff-48khz-16bit-mono-pcm';
const PAUSA = 0.45;  // segundos de silencio entre líneas
// Azure deja casi un segundo de silencio al final de cada línea: se saca,
// así la pausa la decide PAUSA
const SIN_SILENCIOS = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,'
  + 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse';

const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function direccion(){
  if (process.env.AZURE_SPEECH_URL) return process.env.AZURE_SPEECH_URL;
  return `https://${process.env.AZURE_SPEECH_REGION || 'eastus'}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

// Pide una línea y la guarda en "archivo"
async function decir(texto, archivo){
  const clave = process.env.AZURE_SPEECH_KEY;
  if (!clave) throw new Error('falta AZURE_SPEECH_KEY: sin la clave de Azure no hay voz (ver README)');
  const respuesta = await fetch(direccion(), {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': clave,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': FORMATO,
      'User-Agent': 'orum-instagram',
    },
    body: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-UY"><voice name="${VOZ}"><prosody rate="${VELOCIDAD}">${escapar(texto)}</prosody></voice></speak>`,
  });
  if (!respuesta.ok) throw new Error(`Azure no dio la voz (${respuesta.status}): ${(await respuesta.text()).slice(0, 200)}`);
  await writeFile(archivo, Buffer.from(await respuesta.arrayBuffer()));
}

async function duracion(archivo){
  const { stdout } = await ejecutar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]);
  return Number(stdout);
}

// Graba todas las líneas en "carpeta/voz.wav". Devuelve cuándo arranca y
// cuándo termina cada una, en segundos, con la pausa incluida (el "fin" de
// una línea es el "inicio" de la siguiente)
export async function grabarVoz(lineas, carpeta){
  await mkdir(carpeta, { recursive: true });
  const archivos = [];
  const tiempos = [];
  let t = 0;
  for (const [i, texto] of lineas.entries()){
    const archivo = join(carpeta, `linea-${i}.wav`);
    const crudo = join(carpeta, `cruda-${i}.wav`);
    await decir(texto, crudo);
    await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-i', crudo, '-af', SIN_SILENCIOS, archivo]);
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
