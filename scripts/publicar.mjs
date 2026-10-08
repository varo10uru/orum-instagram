// ===========================================================================
// PUBLICAR: sube a Instagram lo que toca hoy
//
// Uso:
//   node scripts/publicar.mjs --probar
//        Muestra la cuenta conectada y cuántas publicaciones van hoy.
//   node scripts/publicar.mjs --franja historias      (o --franja posts)
//        Publica lo de hoy de esa franja. Es lo que corre GitHub Actions:
//        historias a las 10:07 y posts, carruseles y Reels a las 12:37.
//   node scripts/publicar.mjs --franja posts --fecha 2026-10-12
//        Lo mismo, para otra fecha (para relanzar un día que falló).
//   node scripts/publicar.mjs --carpeta semanas/2026-10-12/1-lunes
//        Publica ese post ya, sin mirar la fecha.
//   Con --simular hace todo menos el último paso: Instagram descarga y
//   revisa las imágenes, pero no se publica nada.
//
// Lo publicado se anota en publicados.json. Lo que ya está anotado no se
// vuelve a publicar.
// ===========================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { RAIZ, archivosDelPost, buscarPosts, hoyUY } from './comun.mjs';
import { cuenta, prepararContenedor, publicarContenedor, ultimasPublicaciones } from './instagram.mjs';
import { validarPost } from './validar.mjs';

const RUTA_PUBLICADOS = join(RAIZ, 'publicados.json');
const FRANJAS = { historias: ['historia'], posts: ['post', 'carrusel', 'reel'] };

// Dirección pública de los archivos del repo. En GitHub Actions se usa el
// commit exacto, así Instagram nunca recibe una versión vieja.
function baseDeMedios(){
  if (process.env.MEDIOS_URL) return process.env.MEDIOS_URL.replace(/\/?$/, '/');
  const repo = process.env.GITHUB_REPOSITORY || 'varo10uru/orum-instagram';
  const ref = process.env.GITHUB_SHA || 'main';
  return `https://raw.githubusercontent.com/${repo}/${ref}/`;
}

// Revisa que Instagram vaya a poder descargar la imagen
async function comprobarUrl(url){
  const r = await fetch(url, { method: 'HEAD' });
  if (!r.ok) throw new Error(`no se puede descargar ${url} (${r.status}): ¿está subido a GitHub?`);
  if (!/^image\/jpeg/.test(r.headers.get('content-type') || '')) throw new Error(`${url} no llega como JPEG`);
}

// El texto tal como sale en Instagram: texto + hashtags
function textoCompleto(datos){
  return `${datos.texto}\n\n${datos.hashtags.join(' ')}`;
}

const normalizar = (t = '') => t.replace(/\s+/g, ' ').trim().slice(0, 150);

async function publicarPost(post, { simular }){
  const { carpeta, datos } = post;
  const nombre = relative(RAIZ, carpeta);

  const errores = validarPost(post, { listo: true });
  if (errores.length) throw new Error(`${nombre} no pasa la revisión:\n    ${errores.join('\n    ')}`);

  // Por si una corrida anterior publicó pero no llegó a anotarlo
  if (datos.tipo !== 'historia'){
    const texto = normalizar(textoCompleto(datos));
    const yaEsta = (await ultimasPublicaciones()).find((m) => normalizar(m.caption) === texto);
    if (yaEsta){
      console.log(`  ${nombre}: ya estaba publicado (${yaEsta.permalink}); lo anoto`);
      return { id: yaEsta.id, link: yaEsta.permalink };
    }
  }

  const base = baseDeMedios();
  const archivos = archivosDelPost(datos);
  const imagenes = archivos.filter((a) => a.endsWith('.jpg') && a !== 'portada.jpg').map((a) => base + relative(RAIZ, join(carpeta, a)));
  for (const url of imagenes) await comprobarUrl(url);
  const portada = datos.tipo === 'reel' ? base + relative(RAIZ, join(carpeta, 'portada.jpg')) : undefined;
  if (portada) await comprobarUrl(portada);

  const contenedor = await prepararContenedor({
    tipo: datos.tipo,
    texto: datos.tipo === 'historia' ? undefined : textoCompleto(datos),
    alts: (datos.piezas || []).map((p) => p.alt),
    imagenes,
    video: datos.tipo === 'reel' ? join(carpeta, 'reel.mp4') : undefined,
    portada,
  });

  if (simular){
    console.log(`  ${nombre}: Instagram lo aceptó (contenedor ${contenedor}). No se publicó: es una simulación.`);
    return null;
  }
  const publicado = await publicarContenedor(contenedor);
  console.log(`  ${nombre}: publicado ${publicado.link || publicado.id}`);
  return publicado;
}

// ----- Desde la terminal -----
const { values: op } = parseArgs({
  options: {
    probar: { type: 'boolean' },
    franja: { type: 'string' },
    fecha: { type: 'string' },
    carpeta: { type: 'string' },
    simular: { type: 'boolean' },
  },
});

if (op.probar){
  try {
    const c = await cuenta();
    console.log(`Cuenta: @${c.username}, id ${c.id}`);
    console.log(`Publicaciones por API en las últimas 24 h: ${c.limite?.quota_usage ?? '?'} de ${c.limite?.config?.quota_total ?? 100}`);
    process.exit(0);
  } catch (e){
    console.error(`✗ No me pude conectar con Instagram: ${e.message}`);
    process.exit(1);
  }
}

let posts;
if (op.carpeta){
  posts = await buscarPosts([op.carpeta]);
} else {
  if (!FRANJAS[op.franja]){
    console.error('Uso: node scripts/publicar.mjs --franja historias|posts [--fecha AAAA-MM-DD] [--simular]');
    process.exit(2);
  }
  const fecha = op.fecha || hoyUY();
  posts = (await buscarPosts([join(RAIZ, 'semanas')]))
    .filter((p) => p.datos.fecha === fecha && FRANJAS[op.franja].includes(p.datos.tipo));
  console.log(`${fecha}, ${op.franja}: ${posts.length ? posts.length + ' para publicar' : 'nada para hoy'}`);
}

const publicados = JSON.parse(await readFile(RUTA_PUBLICADOS, 'utf8'));
let fallas = 0;
for (const post of posts){
  const carpeta = relative(RAIZ, post.carpeta);
  if (publicados.some((p) => p.carpeta === carpeta)){
    console.log(`  ${carpeta}: ya publicado, lo salteo`);
    continue;
  }
  try {
    const r = await publicarPost(post, { simular: op.simular });
    if (r){
      const { fecha, tipo, pilar, tema } = post.datos;
      publicados.push({ fecha, carpeta, tipo, pilar, tema, id: r.id, link: r.link, publicado: new Date().toISOString() });
      // Se anota enseguida, para que nunca quede algo publicado sin anotar
      await writeFile(RUTA_PUBLICADOS, JSON.stringify(publicados, null, 2) + '\n');
    }
  } catch (e){
    fallas++;
    console.error(`✗ ${carpeta}: ${e.message}`);
  }
}
if (fallas) process.exit(1);
