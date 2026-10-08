// ===========================================================================
// PERFIL: las imágenes para armar el perfil de Instagram y la página de
// Facebook (se usan una vez, o cuando cambie la marca)
//
// Uso:  node scripts/perfil.mjs
//       → perfil/portada-facebook.jpg (1640×624)
//       → perfil/destacada-<tema>.jpg (1080×1920, una por destacada)
//       → perfil/foto-perfil.png (el logo, 1024×1024)
// Los textos (bio, nombre, descripción) están en perfil/README.md.
// ===========================================================================

import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ, abrirNavegador } from './comun.mjs';
import { renderizarPieza } from './piezas.mjs';

const DESTINO = join(RAIZ, 'perfil');
const DESTACADAS = ['trabajos', 'consejos', 'proceso', 'contacto'];

await mkdir(DESTINO, { recursive: true });
const navegador = await abrirNavegador();
const problemas = [];
try {
  problemas.push(...await renderizarPieza(navegador, 'portada-facebook', {
    titulo: 'Creamos *sitios web* a medida.',
    lema: 'Comercios y pymes · Ciudad de la Costa, Uruguay',
  }, join(DESTINO, 'portada-facebook.jpg')));
  for (const icono of DESTACADAS){
    problemas.push(...await renderizarPieza(navegador, 'destacada', { icono }, join(DESTINO, `destacada-${icono}.jpg`)));
  }
} finally {
  await navegador.close();
}
await copyFile(join(RAIZ, 'marca', 'perfil.png'), join(DESTINO, 'foto-perfil.png'));

if (problemas.length){
  console.error(problemas.join('\n'));
  process.exit(1);
}
console.log('Listo: perfil/portada-facebook.jpg, perfil/destacada-*.jpg y perfil/foto-perfil.png');
