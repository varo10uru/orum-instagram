// ===========================================================================
// PUBLICAR: sube a Instagram lo que toca hoy
//
// Uso:
//   node scripts/publicar.mjs --probar
//        Muestra la cuenta conectada y cuántas publicaciones van hoy.
//   node scripts/publicar.mjs --pendientes
//        Publica lo de hoy cuya hora ya llegó: historias desde las 10:07 y
//        posts, carruseles y Reels desde las 12:37. Es lo que corre GitHub
//        Actions cada hora (GitHub atrasa las corridas programadas, a veces
//        horas: revisando cada hora, lo de cada día sale cerca de su hora).
//   node scripts/publicar.mjs --franja historias      (o --franja posts)
//        Publica lo de hoy de esa franja, sin mirar la hora.
//   node scripts/publicar.mjs --franja posts --fecha 2026-10-12
//        Lo mismo, para otra fecha (para relanzar un día que falló).
//   node scripts/publicar.mjs --carpeta semanas/2026-10-12/1-lunes
//        Publica ese post ya, sin mirar la fecha.
//   node scripts/publicar.mjs --carpeta semanas/2026-10-12/1-lunes --reel-extra
//        Publica ya el Reel extra de ese post (ver abajo).
//   Con --simular hace todo menos el último paso: Instagram descarga y
//   revisa las imágenes, pero no se publica nada.
//
// REEL EXTRA: cada post o carrusel tiene también su video (video.mp4, lo
// arma renderizar.mjs). A las 19:07 de ese día sale como Reel que no se
// repite en la grilla (solo en la pestaña de Reels), para llegar a gente que
// no te sigue. Se anota aparte, como "<carpeta>#reel". No va a Facebook.
// Un post con "reel_extra": false no lo lleva.
//
// Con FACEBOOK=si, cada cosa que sale en Instagram sale también en la
// página de Facebook (ver facebook.mjs). Primero va Instagram y se anota;
// si Facebook falla, se reintenta en las corridas siguientes de ese día.
//
// Lo publicado se anota en publicados.json. Lo que ya está anotado no se
// vuelve a publicar.
// ===========================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { HORA_POR_TIPO, RAIZ, VIDEO_DEL_POST, archivosDelPost, buscarPosts, existe, horaUY, hoyUY } from './comun.mjs';
import { cuenta, prepararContenedor, publicarContenedor, ultimasPublicaciones } from './instagram.mjs';
import { cuentasYUbicacion, validarPost } from './validar.mjs';
import { facebookPrendido, publicarEnFacebook } from './facebook.mjs';

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

// ¿Este post lleva Reel extra?
const llevaReelExtra = ({ datos }) => (datos.tipo === 'post' || datos.tipo === 'carrusel') && datos.reel_extra !== false;

// Lo que se sube: el texto, las URLs públicas de las imágenes y el video
async function mediosDelPost({ carpeta, datos }, { extra = false } = {}){
  if (extra){
    // El video del post, como Reel solo en la pestaña de Reels; la tapa es
    // un cuadro del video
    return { tipo: 'reel', texto: textoCompleto(datos), video: join(carpeta, VIDEO_DEL_POST), enGrilla: false };
  }
  const base = baseDeMedios();
  const archivos = archivosDelPost(datos);
  const imagenes = archivos.filter((a) => a.endsWith('.jpg') && a !== 'portada.jpg').map((a) => base + relative(RAIZ, join(carpeta, a)));
  for (const url of imagenes) await comprobarUrl(url);
  const portada = datos.tipo === 'reel' ? base + relative(RAIZ, join(carpeta, 'portada.jpg')) : undefined;
  if (portada) await comprobarUrl(portada);
  return {
    tipo: datos.tipo,
    texto: datos.tipo === 'historia' ? undefined : textoCompleto(datos),
    alts: (datos.piezas || []).map((p) => p.alt),
    imagenes,
    video: datos.tipo === 'reel' ? join(carpeta, 'reel.mp4') : undefined,
    portada,
  };
}

// Lo mismo en la página de Facebook, después de Instagram. Si falla, queda
// sin "facebook" en publicados.json y se reintenta en la próxima corrida.
async function aFacebook(post, anotado, publicados){
  const fb = await publicarEnFacebook(await mediosDelPost(post));
  anotado.facebook = fb.link || fb.id;
  await writeFile(RUTA_PUBLICADOS, JSON.stringify(publicados, null, 2) + '\n');
  console.log(`  ${anotado.carpeta}: en Facebook ${anotado.facebook}`);
}

async function publicarPost(post, { simular, extra = false }){
  const { carpeta, datos } = post;
  const nombre = relative(RAIZ, carpeta) + (extra ? ' (Reel extra)' : '');

  const errores = validarPost(post, { listo: true });
  if (extra && !existe(join(carpeta, VIDEO_DEL_POST))) errores.push(`falta ${VIDEO_DEL_POST}: hay que renderizar`);
  if (errores.length) throw new Error(`${nombre} no pasa la revisión:\n    ${errores.join('\n    ')}`);

  // Por si una corrida anterior publicó pero no llegó a anotarlo. El post y
  // su Reel extra llevan el mismo texto: se distinguen por si es Reel o no.
  if (datos.tipo !== 'historia'){
    const texto = normalizar(textoCompleto(datos));
    const esReel = extra || datos.tipo === 'reel';
    const yaEsta = (await ultimasPublicaciones()).find((m) =>
      normalizar(m.caption) === texto && (m.media_product_type === 'REELS') === esReel);
    if (yaEsta){
      console.log(`  ${nombre}: ya estaba publicado (${yaEsta.permalink}); lo anoto`);
      return { id: yaEsta.id, link: yaEsta.permalink };
    }
  }

  const medios = await mediosDelPost(post, { extra });
  const contenedor = await prepararContenedor({ ...medios, ...cuentasYUbicacion(datos) });

  if (simular){
    console.log(`  ${nombre}: Instagram lo aceptó (contenedor ${contenedor}). No se publicó: es una simulación.`);
    if (facebookPrendido() && !extra){
      await publicarEnFacebook({ ...medios, simular: true });
      console.log(`  ${nombre}: Facebook lo aceptó. No se publicó: es una simulación.`);
    }
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
    pendientes: { type: 'boolean' },
    franja: { type: 'string' },
    fecha: { type: 'string' },
    carpeta: { type: 'string' },
    'reel-extra': { type: 'boolean' },
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

// Cada cosa a publicar: el post y si es su Reel extra
let posts;
if (op.carpeta){
  posts = (await buscarPosts([op.carpeta])).map((post) => ({ post, extra: !!op['reel-extra'] }));
} else if (op.pendientes){
  const [fecha, ahora] = [hoyUY(), horaUY()];
  const deHoy = (await buscarPosts([join(RAIZ, 'semanas')])).filter((p) => p.datos.fecha === fecha);
  posts = [
    ...deHoy.filter((p) => HORA_POR_TIPO[p.datos.tipo] <= ahora).map((post) => ({ post, extra: false })),
    ...deHoy.filter((p) => llevaReelExtra(p) && HORA_POR_TIPO['reel-extra'] <= ahora).map((post) => ({ post, extra: true })),
  ];
  console.log(`${fecha} ${ahora}: ${posts.length ? posts.length + ' con la hora cumplida' : 'nada para esta hora'}`);
} else {
  if (!FRANJAS[op.franja]){
    console.error('Uso: node scripts/publicar.mjs --pendientes | --franja historias|posts [--fecha AAAA-MM-DD] | --carpeta <ruta> [--simular]');
    process.exit(2);
  }
  const fecha = op.fecha || hoyUY();
  posts = (await buscarPosts([join(RAIZ, 'semanas')]))
    .filter((p) => p.datos.fecha === fecha && FRANJAS[op.franja].includes(p.datos.tipo))
    .map((post) => ({ post, extra: false }));
  console.log(`${fecha}, ${op.franja}: ${posts.length ? posts.length + ' para publicar' : 'nada para hoy'}`);
}

const publicados = JSON.parse(await readFile(RUTA_PUBLICADOS, 'utf8'));
let fallas = 0;
for (const { post, extra } of posts){
  const carpeta = relative(RAIZ, post.carpeta) + (extra ? '#reel' : '');
  if (extra && !existe(join(post.carpeta, VIDEO_DEL_POST))){
    console.log(`  ${carpeta}: no tiene ${VIDEO_DEL_POST}, sin Reel extra`);
    continue;
  }
  const anotado = publicados.find((p) => p.carpeta === carpeta);
  if (anotado){
    // Ya salió en Instagram. Si hoy no llegó a salir en Facebook, se reintenta
    if (facebookPrendido() && !extra && !op.simular && !anotado.facebook && anotado.fecha === hoyUY()){
      try { await aFacebook(post, anotado, publicados); } catch (e){ fallas++; console.error(`✗ ${carpeta} en Facebook: ${e.message}`); }
    } else {
      console.log(`  ${carpeta}: ya publicado, lo salteo`);
    }
    continue;
  }
  let nuevo = null;
  try {
    const r = await publicarPost(post, { simular: op.simular, extra });
    if (r){
      // "fecha" es el día en que salió (en Uruguay), aunque el post.json
      // dijera otro (por ejemplo, si se publicó a mano antes)
      const { fecha: planeada, pilar, tema } = post.datos;
      const tipo = extra ? 'reel-extra' : post.datos.tipo;
      const fecha = hoyUY();
      nuevo = { fecha, ...(planeada !== fecha && { planeada }), carpeta, tipo, pilar, tema, id: r.id, link: r.link, publicado: new Date().toISOString() };
      publicados.push(nuevo);
      // Se anota enseguida, para que nunca quede algo publicado sin anotar
      await writeFile(RUTA_PUBLICADOS, JSON.stringify(publicados, null, 2) + '\n');
    }
  } catch (e){
    fallas++;
    console.error(`✗ ${carpeta}: ${e.message}`);
  }
  if (nuevo && facebookPrendido() && !extra){
    try { await aFacebook(post, nuevo, publicados); } catch (e){ fallas++; console.error(`✗ ${carpeta} en Facebook: ${e.message}`); }
  }
}
if (fallas) process.exit(1);
