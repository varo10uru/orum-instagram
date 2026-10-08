// ===========================================================================
// API DE INSTAGRAM
//
// Publicar es siempre en dos pasos: primero se crea un "contenedor" con la
// imagen o el video (Instagram lo descarga y lo revisa) y después se publica
// ese contenedor. Crear un contenedor no publica nada, así que sirve para
// probar sin que nadie vea nada.
//
// Necesita las variables IG_TOKEN e IG_USER_ID (en GitHub, Secrets del repo).
// Funciona con los dos tipos de token que da Meta, y se da cuenta solo de
// cuál es:
// - De la página de Facebook vinculada al Instagram (empieza con "EAA"):
//   es el que se usa hoy. Va por graph.facebook.com y no vence.
// - De Instagram Login, sin página (empieza con "IG"): va por
//   graph.instagram.com y vence a los 60 días (renovar-token.mjs lo renueva).
// ===========================================================================

import { readFile, stat } from 'node:fs/promises';

const VERSION = process.env.IG_API_VERSION || 'v25.0';

// ¿El token es de Instagram Login? Esos vencen y van por otro servidor
export const esTokenDeInstagram = () => (process.env.IG_TOKEN || '').startsWith('IG');
const api = () => `https://graph.${esTokenDeInstagram() ? 'instagram' : 'facebook'}.com/${VERSION}`;

function credenciales(){
  const token = process.env.IG_TOKEN;
  const usuario = process.env.IG_USER_ID;
  if (!token || !usuario) throw new Error('faltan IG_TOKEN o IG_USER_ID');
  return { token, usuario };
}

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

// Pedido a la API. Los errores de Instagram vienen en { error: { message } }
async function pedir(metodo, ruta, parametros = {}){
  const { token } = credenciales();
  const url = new URL(`${api()}/${ruta}`);
  const cuerpo = new URLSearchParams({ ...parametros, access_token: token });
  const opciones = { method: metodo };
  if (metodo === 'GET') url.search = cuerpo.toString();
  else opciones.body = cuerpo;

  const respuesta = await fetch(url, opciones);
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || datos.error){
    const e = datos.error || {};
    throw new Error(`Instagram respondió ${respuesta.status}: ${e.error_user_msg || e.message || 'sin detalle'}`);
  }
  return datos;
}

// ----- Cuenta -----
export async function cuenta(){
  const { usuario } = credenciales();
  const yo = await pedir('GET', usuario, { fields: 'id,username' });
  const limite = await pedir('GET', `${usuario}/content_publishing_limit`, { fields: 'quota_usage,config' });
  return { ...yo, limite: limite.data?.[0] };
}

// Últimas publicaciones del muro (para no publicar dos veces lo mismo)
export async function ultimasPublicaciones(){
  const { usuario } = credenciales();
  const r = await pedir('GET', `${usuario}/media`, { fields: 'id,caption,timestamp,permalink', limit: '15' });
  return r.data || [];
}

// ----- Contenedores -----
async function crearContenedor(parametros){
  const { usuario } = credenciales();
  return pedir('POST', `${usuario}/media`, parametros);
}

// Espera a que Instagram termine de procesar el contenedor (los videos tardan)
async function esperarContenedor(id, { minutos = 10 } = {}){
  const hasta = Date.now() + minutos * 60_000;
  while (Date.now() < hasta){
    const { status_code: estado, status } = await pedir('GET', id, { fields: 'status_code,status' });
    if (estado === 'FINISHED') return;
    if (estado === 'ERROR' || estado === 'EXPIRED') throw new Error(`Instagram no aceptó el archivo (${estado}): ${status || ''}`);
    await esperar(5000);
  }
  throw new Error(`Instagram tardó más de ${minutos} minutos en procesar el archivo`);
}

// Sube un video directo desde el disco (GitHub no sirve los MP4 como video)
async function subirVideo(contenedor, archivo){
  const { token } = credenciales();
  const tamano = (await stat(archivo)).size;
  const respuesta = await fetch(`https://rupload.facebook.com/ig-api-upload/${VERSION}/${contenedor}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(tamano) },
    body: await readFile(archivo),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || datos.success === false){
    throw new Error(`no se pudo subir el video: ${datos.debug_info?.message || datos.error?.message || respuesta.status}`);
  }
}

// Arma el contenedor según el tipo de post y espera a que esté listo.
// "medios" trae las URLs públicas de las imágenes y la ruta local del video.
export async function prepararContenedor({ tipo, texto, alts = [], imagenes = [], video, portada }){
  if (tipo === 'post'){
    const { id } = await crearContenedor({ image_url: imagenes[0], caption: texto, ...(alts[0] && { alt_text: alts[0] }) });
    await esperarContenedor(id);
    return id;
  }
  if (tipo === 'historia'){
    const { id } = await crearContenedor({ media_type: 'STORIES', image_url: imagenes[0] });
    await esperarContenedor(id);
    return id;
  }
  if (tipo === 'carrusel'){
    const hijos = [];
    for (const [i, url] of imagenes.entries()){
      const { id } = await crearContenedor({ image_url: url, is_carousel_item: 'true', ...(alts[i] && { alt_text: alts[i] }) });
      hijos.push(id);
    }
    for (const id of hijos) await esperarContenedor(id);
    const { id } = await crearContenedor({ media_type: 'CAROUSEL', children: hijos.join(','), caption: texto });
    await esperarContenedor(id);
    return id;
  }
  if (tipo === 'reel'){
    const { id } = await crearContenedor({
      media_type: 'REELS', upload_type: 'resumable', caption: texto,
      share_to_feed: 'true', ...(portada && { cover_url: portada }),
    });
    await subirVideo(id, video);
    await esperarContenedor(id, { minutos: 15 });
    return id;
  }
  throw new Error(`tipo desconocido: ${tipo}`);
}

// Publica un contenedor listo y devuelve el id y el link de la publicación
export async function publicarContenedor(contenedor){
  const { usuario } = credenciales();
  const { id } = await pedir('POST', `${usuario}/media_publish`, { creation_id: contenedor });
  let link = null;
  try {
    ({ permalink: link } = await pedir('GET', id, { fields: 'permalink' }));
  } catch { /* las historias a veces no tienen link */ }
  return { id, link };
}

// Renueva el token de Instagram Login (dura 60 días; se puede renovar si
// tiene más de 24 h). Los de página de Facebook no vencen y no se renuevan.
export async function renovarToken(){
  const { token } = credenciales();
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token }).toString();
  const respuesta = await fetch(url);
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !datos.access_token){
    throw new Error(`no se pudo renovar el token: ${datos.error?.message || respuesta.status}`);
  }
  return { token: datos.access_token, dias: Math.round((datos.expires_in || 0) / 86400) };
}
