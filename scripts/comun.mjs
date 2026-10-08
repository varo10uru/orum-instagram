// ===========================================================================
// COSAS COMPARTIDAS ENTRE LOS SCRIPTS
// Rutas, días y horarios, lectura de los post.json y el navegador.
// ===========================================================================

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ----- Días y horarios (hora de Uruguay, UTC-3 todo el año) -----
export const ZONA = 'America/Montevideo';
export const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// Hora de publicación por tipo, si el post.json no trae "hora"
export const HORA_POR_TIPO = {
  historia: '10:07',
  post: '12:37',
  carrusel: '12:37',
  reel: '12:37',
};

// Fecha de hoy en Uruguay, como "AAAA-MM-DD"
export function hoyUY(fecha = new Date()){
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

// Hora actual en Uruguay, como "HH:MM"
export function horaUY(fecha = new Date()){
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha);
}

// Nombre del día ("lunes", "miercoles"...) de una fecha "AAAA-MM-DD"
export function diaDeLaSemana(fechaISO){
  const [a, m, d] = fechaISO.split('-').map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

// ----- Plantillas: archivo y tamaño de cada una -----
export const PLANTILLAS = {
  'post-consejo': { archivo: 'post-consejo.html', ancho: 1080, alto: 1350 },
  'post-trabajo': { archivo: 'post-trabajo.html', ancho: 1080, alto: 1350 },
  'carrusel':     { archivo: 'carrusel.html',     ancho: 1080, alto: 1350 },
  'historia':     { archivo: 'historia.html',     ancho: 1080, alto: 1920 },
};

// ----- Encontrar y leer los post.json debajo de una o más carpetas -----
export async function buscarPosts(rutas){
  const encontrados = [];
  async function recorrer(ruta){
    const info = await stat(ruta);
    if (info.isFile() && ruta.endsWith('post.json')){
      encontrados.push(ruta);
    } else if (info.isDirectory()){
      for (const nombre of (await readdir(ruta)).sort()){
        if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
        await recorrer(join(ruta, nombre));
      }
    }
  }
  for (const ruta of rutas) if (existsSync(resolve(ruta))) await recorrer(resolve(ruta));

  return Promise.all(encontrados.map(async (archivo) => ({
    archivo,
    carpeta: dirname(archivo),
    datos: JSON.parse(await readFile(archivo, 'utf8')),
  })));
}

// Archivos de imagen o video que tiene que tener un post ya renderizado
export function archivosDelPost(datos){
  if (datos.tipo === 'reel') return ['reel.mp4', 'portada.jpg'];
  return datos.piezas.map((_, i) => `${i + 1}.jpg`);
}

// ----- Abrir Chrome -----
// En la Mac y en GitHub Actions usa el Chrome instalado. Si no está en el
// lugar de siempre, se puede indicar con la variable CHROME_PATH.
export async function abrirNavegador(){
  const { chromium } = await import('playwright-core');
  const opciones = { headless: true };
  if (process.env.CHROME_PATH){
    opciones.executablePath = process.env.CHROME_PATH;
  } else {
    opciones.channel = 'chrome';
  }
  return chromium.launch(opciones);
}

export function existe(ruta){ return existsSync(ruta); }
