// ===========================================================================
// VISTA PREVIA de una semana: una página para revisar todo junto
//
// Uso:  node scripts/vista-previa.mjs semanas/2026-10-12
//       → crea semanas/2026-10-12/vista-previa.html (no se sube a git)
//       node scripts/vista-previa.mjs --markdown <url base> semanas/2026-10-12
//       → escribe el comentario del PR (lo usa la Action de vista previa)
//
// Muestra cada día con sus imágenes, el texto del post y los hashtags, tal
// como van a salir. Primero hay que renderizar la semana.
// ===========================================================================

import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HORA_POR_TIPO, RAIZ, archivosDelPost, buscarPosts, existe } from './comun.mjs';

const NOMBRE_DIA = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
const NOMBRE_TIPO = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };

function escapar(texto = ''){
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tarjeta(post, semana){
  const { datos, carpeta } = post;
  const dia = carpeta.split('/').pop().replace(/^\d+-/, '');
  const hora = HORA_POR_TIPO[datos.tipo];
  const medios = archivosDelPost(datos).filter((a) => a !== 'portada.jpg').map((archivo) => {
    const ruta = relative(semana, join(carpeta, archivo));
    if (!existe(join(carpeta, archivo))) return `<div class="falta">Falta ${escapar(archivo)}: renderizá la semana</div>`;
    return archivo.endsWith('.mp4')
      ? `<video src="${ruta}" controls muted playsinline></video>`
      : `<img src="${ruta}" alt="${escapar(datos.piezas?.[parseInt(archivo, 10) - 1]?.alt || '')}" loading="lazy">`;
  }).join('');

  const pieDeTexto = datos.tipo === 'historia'
    ? '<p class="nota">Las historias no llevan texto ni hashtags.</p>'
    : `<p class="texto">${escapar(datos.texto)}</p>
       <p class="hashtags">${escapar((datos.hashtags || []).join(' '))}</p>
       ${datos.fuentes?.length ? `<p class="nota">Fuentes: ${datos.fuentes.map(escapar).join(' · ')}</p>` : ''}`;

  return `
  <article class="tarjeta tipo-${datos.tipo}">
    <header>
      <h2>${NOMBRE_DIA[dia] || dia} <span>${datos.fecha} · ${hora}</span></h2>
      <p class="meta">${NOMBRE_TIPO[datos.tipo]} · ${escapar(datos.pilar)} · ${escapar(datos.tema)}</p>
    </header>
    <div class="medios">${medios}</div>
    ${pieDeTexto}
  </article>`;
}

export async function crearVistaPrevia(semana){
  const posts = await buscarPosts([semana]);
  const html = `<!doctype html>
<html lang="es-UY">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Semana ${escapar(semana.split('/').pop())}</title>
<style>
  :root{ --bg:#0A0A0B; --sup:#141416; --borde:#2A2A2E; --texto:#F5F5F7; --sec:#A1A1A6; --acento:#D4FF3F; }
  *{ box-sizing:border-box; margin:0; }
  body{ background:var(--bg); color:var(--texto); font:16px/1.5 Inter, system-ui, sans-serif; padding:32px 16px 80px; }
  h1{ font-size:28px; max-width:1100px; margin:0 auto 24px; }
  main{ max-width:1100px; margin:0 auto; display:grid; gap:24px; }
  .tarjeta{ background:var(--sup); border:1px solid var(--borde); border-radius:16px; padding:20px; }
  h2{ font-size:20px; } h2 span{ color:var(--sec); font-weight:400; font-size:15px; margin-left:8px; }
  .meta{ color:var(--sec); font-size:14px; margin-top:2px; }
  .medios{ display:flex; gap:12px; overflow-x:auto; margin:16px 0; padding-bottom:6px; }
  .medios img, .medios video{ height:420px; width:auto; border-radius:10px; flex:none; background:#000; }
  .tipo-historia .medios img, .tipo-historia .medios video, .tipo-reel .medios video{ height:520px; }
  .texto{ white-space:pre-wrap; max-width:640px; }
  .hashtags{ color:#8AB4F8; margin-top:8px; }
  .nota{ color:var(--sec); font-size:14px; margin-top:8px; }
  .falta{ padding:40px; border:1px dashed var(--borde); border-radius:10px; color:var(--sec); }
</style>
</head>
<body>
  <h1>Semana ${escapar(semana.split('/').pop())}</h1>
  <main>${posts.map((p) => tarjeta(p, semana)).join('')}</main>
</body>
</html>
`;
  const destino = join(semana, 'vista-previa.html');
  await writeFile(destino, html);
  return destino;
}

// ----- Comentario del PR, en Markdown -----
// "base" es la dirección pública de los archivos en el commit del PR.
// GitHub no muestra videos en los comentarios: del Reel va la tira de
// cuadros y un link para bajarlo.
export async function crearComentario(semanas, base){
  const posts = await buscarPosts(semanas);
  const lineas = [
    '<!-- vista-previa -->',
    '## Vista previa de la semana',
    '',
    '**Para aprobarla, hacé merge.** Para corregir un texto, editá el `post.json` de ese día: las imágenes se regeneran solas. Para sacar un día, borrá su carpeta.',
  ];
  for (const { datos, carpeta } of posts){
    const dia = carpeta.split('/').pop().replace(/^\d+-/, '');
    const [, mes, d] = datos.fecha.split('-');
    const url = (archivo) => base + relative(RAIZ, join(carpeta, archivo));
    lineas.push('', `### ${NOMBRE_DIA[dia] || dia} ${d}/${mes} · ${HORA_POR_TIPO[datos.tipo]} · ${NOMBRE_TIPO[datos.tipo]}`);
    lineas.push(`_${datos.pilar} · ${datos.tema}_`, '');

    if (datos.tipo === 'reel'){
      lineas.push(`<img src="${url('tira.jpg')}" width="100%" alt="Cuadros del Reel">`, '');
      lineas.push(`[Bajar el video](${url('reel.mp4')})`);
    } else {
      const ancho = datos.tipo === 'historia' ? 200 : 250;
      lineas.push(archivosDelPost(datos).map((a, i) =>
        `<img src="${url(a)}" width="${ancho}" alt="${escapar(datos.piezas?.[i]?.alt || '')}">`).join(' '));
    }
    if (datos.tipo !== 'historia'){
      lineas.push('', ...String(datos.texto).split('\n').map((l) => `> ${l}`), '>', `> ${(datos.hashtags || []).join(' ')}`);
      if (datos.fuentes?.length) lineas.push('', `Fuentes: ${datos.fuentes.join(' · ')}`);
    }
  }
  return lineas.join('\n') + '\n';
}

// ----- Desde la terminal -----
if (import.meta.url === pathToFileURL(process.argv[1]).href){
  const args = process.argv.slice(2);
  if (args[0] === '--markdown'){
    const [, base, ...semanas] = args;
    process.stdout.write(await crearComentario(semanas, base.replace(/\/?$/, '/')));
  } else if (args[0]){
    console.log(await crearVistaPrevia(args[0]));
  } else {
    console.error('Uso: node scripts/vista-previa.mjs [--markdown <url base>] <carpeta de la semana>');
    process.exit(2);
  }
}
