// ===========================================================================
// RENDERIZAR: post.json → imágenes JPG (y el video, si es un Reel)
//
// Uso:  node scripts/renderizar.mjs semanas/2026-10-12
//       node scripts/renderizar.mjs semanas/2026-10-12/1-lunes
//
// Por cada pieza del post abre su plantilla en Chrome, la llena con los
// textos y guarda la captura en la misma carpeta del post.json (1.jpg,
// 2.jpg...). Si la pieza muestra un sitio real ("captura"), primero saca esa
// captura como si fuera un celular. Los Reels los arma recorrido.mjs.
//
// Si algún texto no entra en su lugar, igual guarda la imagen (con el texto
// marcado en rojo) y termina con error, para que la revisión lo frene.
// ===========================================================================

import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ, abrirNavegador, buscarPosts } from './comun.mjs';
import { prepararPieza, renderizarPieza } from './piezas.mjs';
import { grabarReel } from './recorrido.mjs';

export async function renderizarPost(navegador, { carpeta, datos }){
  // Borra lo renderizado antes, para que no queden imágenes viejas
  for (const nombre of await readdir(carpeta)){
    if (/\.(jpg|mp4)$/.test(nombre)) await rm(join(carpeta, nombre));
  }

  if (datos.tipo === 'reel') return grabarReel(navegador, { carpeta, datos });

  const problemas = [];
  const total = datos.piezas.length;
  for (const [i, pieza] of datos.piezas.entries()){
    const plantilla = pieza.plantilla || datos.plantilla;
    const datosPieza = await prepararPieza(navegador, pieza, plantilla);
    if (datos.tipo === 'carrusel') datosPieza.pagina = `${i + 1}/${total}`;

    for (const p of await renderizarPieza(navegador, plantilla, datosPieza, join(carpeta, `${i + 1}.jpg`))){
      problemas.push(`pieza ${i + 1}: ${p}`);
    }
  }
  return problemas;
}

// ----- Desde la terminal -----
if (import.meta.url === pathToFileURL(process.argv[1]).href){
  const rutas = process.argv.slice(2);
  if (!rutas.length){
    console.error('Uso: node scripts/renderizar.mjs <carpeta de la semana o del post>');
    process.exit(2);
  }
  const posts = await buscarPosts(rutas);
  const navegador = await abrirNavegador();
  let conProblemas = 0;
  try {
    for (const post of posts){
      const nombre = post.carpeta.replace(RAIZ + '/', '');
      let problemas;
      try {
        problemas = await renderizarPost(navegador, post);
      } catch (e){
        problemas = [`no se pudo renderizar: ${e.message.split('\n')[0]}`];
      }
      if (problemas.length){
        conProblemas++;
        console.error(`✗ ${nombre}`);
        for (const p of problemas) console.error(`    ${p}`);
      } else {
        console.log(`✓ ${nombre}`);
      }
    }
  } finally {
    await navegador.close();
  }
  if (conProblemas){
    console.error(`\n${conProblemas} post(s) con problemas: hay que acortar textos o corregir algo.`);
    process.exit(1);
  }
}
