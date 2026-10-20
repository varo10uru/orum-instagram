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
    const error = new Error(`Instagram respondió ${respuesta.status}: ${e.error_user_msg || e.message || 'sin detalle'}`);
    error.codigo = e.code;
    throw error;
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

// Busca lugares (páginas de Facebook con dirección) para "ubicacion".
// Meta puede negarlo si la app no tiene el acceso "Page Public Metadata
// Access"; en ese caso, el id se saca a mano (ver README).
export async function buscarLugares(texto){
  const r = await pedir('GET', 'pages/search', { q: texto, fields: 'id,name,location,link' });
  return (r.data || []).filter((p) => p.location);
}

// ----- Métricas -----
// Necesitan el permiso instagram_manage_insights en el token. Meta tarda
// hasta 48 horas en tener los números al día. Cuando un dato no existe
// (por ejemplo, con menos de 100 seguidores) se devuelve null: nunca un 0.

// Seguidores y cantidad de publicaciones, tal como se ven en el perfil
export async function datosDeLaCuenta(){
  const { usuario } = credenciales();
  const r = await pedir('GET', usuario, { fields: 'followers_count,media_count' });
  return { seguidores: r.followers_count ?? null, publicaciones: r.media_count ?? null };
}

// Nombre de cada métrica en la API → nombre en metricas.json
const METRICAS_DE_LA_CUENTA = {
  reach: 'alcance',
  views: 'vistas',
  accounts_engaged: 'cuentas_que_interactuaron',
  total_interactions: 'interacciones',
  profile_links_taps: 'toques_en_contacto',
};
const METRICAS_POR_TIPO = {
  post:     ['reach', 'views', 'saved', 'shares', 'likes', 'comments', 'follows', 'profile_visits'],
  carrusel: ['reach', 'views', 'saved', 'shares', 'likes', 'comments', 'follows', 'profile_visits'],
  reel:     ['reach', 'views', 'saved', 'shares', 'likes', 'comments', 'ig_reels_avg_watch_time'],
};
const NOMBRES_DE_PUBLICACION = {
  reach: 'alcance', views: 'vistas', saved: 'guardados', shares: 'compartidos',
  likes: 'me_gusta', comments: 'comentarios', follows: 'seguidores',
  profile_visits: 'visitas_al_perfil', ig_reels_avg_watch_time: 'segundos_promedio',
};

// El valor viene en "total_value" (cuenta) o en "values" (publicaciones)
const valorDe = (m) => m.total_value?.value ?? m.values?.[0]?.value ?? null;

// Pide varias métricas juntas. Si Meta rechaza el pedido (una métrica que
// no existe para ese caso alcanza para que falle todo), las pide de a una.
// Lo que no se pudo queda en null y se cuenta en "faltan".
async function pedirMetricas(ruta, metricas, parametros){
  const valores = Object.fromEntries(metricas.map((m) => [m, null]));
  const faltan = [];
  try {
    const { data = [] } = await pedir('GET', ruta, { ...parametros, metric: metricas.join(',') });
    for (const m of data) if (m.name in valores) valores[m.name] = valorDe(m);
  } catch (e){
    // Sin permiso no tiene sentido seguir probando de a una
    if (/permission|permiso|#10\b|#200\b/i.test(e.message) && !/Not enough viewers/i.test(e.message)) throw e;
    for (const metrica of metricas){
      try {
        const { data = [] } = await pedir('GET', ruta, { ...parametros, metric: metrica });
        valores[metrica] = data[0] ? valorDe(data[0]) : null;
      } catch (e){
        faltan.push(`${metrica}: ${e.message}`);
      }
    }
  }
  return { valores, faltan };
}

// Totales de la cuenta entre dos momentos (objetos Date)
export async function metricasDeLaCuenta(desde, hasta){
  const { usuario } = credenciales();
  const { valores, faltan } = await pedirMetricas(`${usuario}/insights`, Object.keys(METRICAS_DE_LA_CUENTA), {
    period: 'day', metric_type: 'total_value',
    since: String(Math.floor(desde / 1000)), until: String(Math.floor(hasta / 1000)),
  });
  const metricas = Object.fromEntries(Object.entries(valores).map(([m, v]) => [METRICAS_DE_LA_CUENTA[m], v]));
  return { metricas, faltan };
}

// Métricas de una publicación (post, carrusel o Reel) desde que salió
export async function metricasDePublicacion(id, tipo){
  const pedidas = METRICAS_POR_TIPO[tipo];
  if (!pedidas) throw new Error(`no hay métricas para el tipo "${tipo}"`);
  const { valores, faltan } = await pedirMetricas(`${id}/insights`, pedidas, {});
  const metricas = {};
  for (const [m, v] of Object.entries(valores)){
    // El tiempo promedio de los Reels viene en milisegundos
    metricas[NOMBRES_DE_PUBLICACION[m]] = m === 'ig_reels_avg_watch_time' && v !== null ? Math.round(v / 100) / 10 : v;
  }
  return { metricas, faltan };
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

// Ubicación, colaboradores y cuentas etiquetadas, según lo que acepta
// cada tipo (documentación de Meta, octubre de 2026):
// - ubicación y colaboradores (hasta 3): posts, carruseles y Reels;
// - etiquetas: posts (con posición en la imagen), historias y Reels.
// Los colaboradores reciben una invitación cuando se publica; si la
// aceptan, el post sale también en su perfil.
function extras(tipo, { ubicacion, colaboradores = [], etiquetas = [] }){
  const p = {};
  if (ubicacion && tipo !== 'historia') p.location_id = ubicacion;
  if (colaboradores.length && tipo !== 'historia') p.collaborators = JSON.stringify(colaboradores);
  if (etiquetas.length && tipo !== 'carrusel'){
    // En un post, la etiqueta va abajo al centro; historias y Reels no llevan posición
    p.user_tags = JSON.stringify(etiquetas.map((username) => (tipo === 'post' ? { username, x: 0.5, y: 0.9 } : { username })));
  }
  return p;
}

// Arma el contenedor según el tipo de post y espera a que esté listo.
// "medios" trae las URLs públicas de las imágenes y la ruta local del video.
export async function prepararContenedor({ tipo, texto, alts = [], imagenes = [], video, portada, ...resto }){
  const extra = extras(tipo, resto);
  if (tipo === 'post'){
    const { id } = await crearContenedor({ image_url: imagenes[0], caption: texto, ...(alts[0] && { alt_text: alts[0] }), ...extra });
    await esperarContenedor(id);
    return id;
  }
  if (tipo === 'historia'){
    const { id } = await crearContenedor({ media_type: 'STORIES', image_url: imagenes[0], ...extra });
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
    const { id } = await crearContenedor({ media_type: 'CAROUSEL', children: hijos.join(','), caption: texto, ...extra });
    await esperarContenedor(id);
    return id;
  }
  if (tipo === 'reel'){
    const { id } = await crearContenedor({
      media_type: 'REELS', upload_type: 'resumable', caption: texto,
      share_to_feed: 'true', ...(portada && { cover_url: portada }), ...extra,
    });
    await subirVideo(id, video);
    await esperarContenedor(id, { minutos: 15 });
    return id;
  }
  throw new Error(`tipo desconocido: ${tipo}`);
}

// Publica un contenedor listo y devuelve el id y el link de la publicación
// A veces Meta da el contenedor por listo pero no lo deja publicar enseguida
// ("El archivo multimedia no está listo", código 9007): se espera y se
// reintenta. No hay riesgo de publicar dos veces, porque ese error quiere
// decir que no se publicó.
export async function publicarContenedor(contenedor){
  const { usuario } = credenciales();
  let id;
  for (let intento = 1; !id; intento++){
    try {
      ({ id } = await pedir('POST', `${usuario}/media_publish`, { creation_id: contenedor }));
    } catch (e){
      const noEstaListo = e.codigo === 9007 || /no está listo|not ready/i.test(e.message);
      if (!noEstaListo || intento === 8) throw e;
      await esperar(10_000);
    }
  }
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
