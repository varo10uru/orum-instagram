// ===========================================================================
// PÁGINA DE FACEBOOK DE ORUM: publica lo mismo que sale en Instagram
//
// Usa el mismo token que Instagram (IG_TOKEN), que es el de la página de
// Facebook vinculada. Además de los permisos de siempre, necesita
// pages_manage_posts.
// - post: una foto con el texto;
// - carrusel: todas las fotos en una sola publicación;
// - historia: una historia de la página;
// - reel: un Reel de la página.
//
// Se prende con FACEBOOK=si (en GitHub, la variable del repo
// PUBLICAR_EN_FACEBOOK). Con "simular" sube las fotos o el video sin
// publicarlos: nadie ve nada y Facebook los descarta solo.
// ===========================================================================

import { readFile, stat } from 'node:fs/promises';

const VERSION = process.env.IG_API_VERSION || 'v25.0';
const API = `https://graph.facebook.com/${VERSION}`;

export const facebookPrendido = () => process.env.FACEBOOK === 'si';

function token(){
  const t = process.env.IG_TOKEN;
  if (!t) throw new Error('falta IG_TOKEN');
  if (t.startsWith('IG')) throw new Error('el token es de Instagram Login: para Facebook hace falta el de la página');
  return t;
}

// Pedido a la API. Los errores vienen en { error: { message } }
async function pedir(metodo, ruta, parametros = {}){
  const url = new URL(`${API}/${ruta}`);
  const cuerpo = new URLSearchParams({ ...parametros, access_token: token() });
  const opciones = { method: metodo };
  if (metodo === 'GET') url.search = cuerpo.toString();
  else opciones.body = cuerpo;

  const respuesta = await fetch(url, opciones);
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || datos.error){
    const e = datos.error || {};
    throw new Error(`Facebook respondió ${respuesta.status}: ${e.error_user_msg || e.message || 'sin detalle'}`);
  }
  return datos;
}

// El token de una página "es" la página: /me devuelve su id
let idDePagina;
async function pagina(){
  idDePagina ||= (await pedir('GET', 'me', { fields: 'id' })).id;
  return idDePagina;
}

// Sube una foto sin publicarla (para carruseles e historias, o para
// probar). Las temporales Facebook las borra solas si no se usan.
async function subirFoto(url, { temporal = false } = {}){
  const { id } = await pedir('POST', `${await pagina()}/photos`, {
    url, published: 'false', ...(temporal && { temporary: 'true' }),
  });
  return id;
}

// Reel, primera parte: abrir la subida y mandar el archivo
async function subirVideo(archivo){
  const { video_id: video, upload_url: destino } = await pedir('POST', `${await pagina()}/video_reels`, { upload_phase: 'start' });
  const respuesta = await fetch(destino, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token()}`, offset: '0', file_size: String((await stat(archivo)).size) },
    body: await readFile(archivo),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !datos.success){
    throw new Error(`no se pudo subir el video a Facebook: ${datos.debug_info?.message || datos.error?.message || respuesta.status}`);
  }
  return video;
}

// Publica (o simula) y devuelve { id, link }. En simulación devuelve null.
export async function publicarEnFacebook({ tipo, texto, imagenes = [], video, simular = false }){
  const id = await pagina();
  const enlace = (postId) => `https://www.facebook.com/${postId}`;

  if (tipo === 'post'){
    if (simular){ await subirFoto(imagenes[0], { temporal: true }); return null; }
    const r = await pedir('POST', `${id}/photos`, { url: imagenes[0], message: texto });
    return { id: r.post_id || r.id, link: enlace(r.post_id || r.id) };
  }
  if (tipo === 'carrusel'){
    const fotos = [];
    for (const url of imagenes) fotos.push(await subirFoto(url, { temporal: simular }));
    if (simular) return null;
    const r = await pedir('POST', `${id}/feed`, {
      message: texto,
      attached_media: JSON.stringify(fotos.map((media_fbid) => ({ media_fbid }))),
    });
    return { id: r.id, link: enlace(r.id) };
  }
  if (tipo === 'historia'){
    const foto = await subirFoto(imagenes[0], { temporal: simular });
    if (simular) return null;
    const r = await pedir('POST', `${id}/photo_stories`, { photo_id: foto });
    return { id: r.post_id, link: null };
  }
  if (tipo === 'reel'){
    const subido = await subirVideo(video);
    if (simular) return null;
    await pedir('POST', `${id}/video_reels`, { upload_phase: 'finish', video_id: subido, video_state: 'PUBLISHED', description: texto });
    return { id: subido, link: `https://www.facebook.com/reel/${subido}` };
  }
  throw new Error(`tipo desconocido: ${tipo}`);
}
