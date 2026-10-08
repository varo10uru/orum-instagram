// ===========================================================================
// VALIDAR: revisa los post.json antes de abrir el PR (y antes de publicar)
//
// Uso:  node scripts/validar.mjs semanas/2026-10-12
//       node scripts/validar.mjs --listo semanas/2026-10-12   (exige que ya
//                                                    estén las imágenes)
//
// Revisa lo que la rutina no puede ver: formato, días, límites de Instagram,
// palabras que no van con el tono, números sin fuente y temas repetidos.
// Termina con error si encuentra algo, explicando qué y dónde.
// ===========================================================================

import { readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLANTILLAS, RAIZ, archivosDelPost, buscarPosts, diaDeLaSemana, existe } from './comun.mjs';

const TIPOS = ['post', 'carrusel', 'reel', 'historia'];
const PILARES = ['trabajos', 'consejos', 'proceso', 'local'];
const MAX_HASHTAGS = 5;          // límite de Instagram desde fines de 2025
const MAX_TEXTO = 2200;          // texto + hashtags
const DIAS_SIN_REPETIR_TEMA = 42;

// Jerga y frases de venta que alejan al cliente (ver CLAUDE.md, "Tono")
const PALABRAS_PROHIBIDAS = [
  'fricción', 'landing', 'checkout', 'mockup', 'responsive', 'seo', 'funnel',
  'leads', 'conversión', 'conversiones', 'mientras dormís', 'lorem', 'todo(',
];

const SITIOS = JSON.parse(await readFile(join(RAIZ, 'sitios.json'), 'utf8'));
const PUBLICADOS = JSON.parse(await readFile(join(RAIZ, 'publicados.json'), 'utf8'));

// Saca lo que no cuenta como "dato": teléfonos y fechas
function sinNumerosPermitidos(texto){
  return texto
    .replace(/\b0\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}\b/g, '')   // teléfonos
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');                 // fechas
}

function normalizar(texto){
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}

function textosDelPost(datos){
  const textos = [datos.texto || ''];
  for (const p of datos.piezas || []) textos.push(p.etiqueta, p.titulo, p.cuerpo, p.pie, p.cliente, p.alt);
  return textos.filter(Boolean).join('\n');
}

export function validarPost({ carpeta, datos }, { listo = false, todos = [] } = {}){
  const errores = [];
  const error = (m) => errores.push(m);

  // ----- Campos básicos -----
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha || '')) error('"fecha" tiene que ser AAAA-MM-DD');
  if (!TIPOS.includes(datos.tipo)) error(`"tipo" tiene que ser uno de: ${TIPOS.join(', ')}`);
  if (!PILARES.includes(datos.pilar)) error(`"pilar" tiene que ser uno de: ${PILARES.join(', ')}`);
  if (!datos.tema?.trim()) error('falta "tema" (una frase corta, sirve para no repetir)');

  // La carpeta se llama "N-dia" y el día tiene que coincidir con la fecha
  const dia = basename(carpeta).replace(/^\d+-/, '');
  if (datos.fecha && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) && diaDeLaSemana(datos.fecha) !== dia){
    error(`la carpeta dice "${dia}" pero ${datos.fecha} es ${diaDeLaSemana(datos.fecha)}`);
  }

  // ----- Piezas -----
  const piezas = datos.piezas || [];
  if (datos.tipo === 'reel'){
    if (piezas.length !== 2) error('un Reel lleva 2 piezas: la placa de entrada y la de cierre');
    const r = datos.recorrido;
    if (!r) error('falta "recorrido" (qué sitio se muestra y dónde para)');
    else if (r.sitio){
      const sitio = SITIOS[r.sitio];
      if (!sitio) error(`el sitio "${r.sitio}" no está en sitios.json`);
      else for (const parada of r.paradas || []){
        if (!(parada in (sitio.secciones || {}))) error(`"${r.sitio}" no tiene la sección "${parada}"`);
      }
    } else if (!/^https:\/\//.test(r.url || '')) error('el recorrido necesita "sitio" o una "url" https');
  } else {
    if (!piezas.length) error('no tiene "piezas"');
    if (datos.tipo === 'carrusel' && (piezas.length < 2 || piezas.length > 10)) error('un carrusel lleva de 2 a 10 piezas');
    if ((datos.tipo === 'post' || datos.tipo === 'historia') && piezas.length !== 1) error(`un ${datos.tipo} lleva una sola pieza`);
  }
  piezas.forEach((p, i) => {
    const n = `pieza ${i + 1}`;
    const plantilla = p.plantilla || datos.plantilla;
    const paraPosts = Object.keys(PLANTILLAS).filter((p) => !['portada-facebook', 'destacada'].includes(p));
    if (!paraPosts.includes(plantilla)) error(`${n}: la plantilla "${plantilla}" no existe (hay: ${paraPosts.join(', ')})`);
    const vertical = datos.tipo === 'historia' || datos.tipo === 'reel';
    if (vertical && plantilla !== 'historia') error(`${n}: las historias y las placas de los Reels usan la plantilla "historia"`);
    if (!vertical && plantilla === 'historia') error(`${n}: la plantilla "historia" es solo para historias y Reels`);
    if (!p.titulo?.trim()) error(`${n}: falta "titulo"`);
    if (!vertical && !p.alt?.trim()) error(`${n}: falta "alt" (la descripción para quien no ve la imagen)`);
    if (p.alt && p.alt.length > 300) error(`${n}: "alt" es muy largo (máximo 300 caracteres)`);

    if (p.fondo){
      const carpetaFondo = plantilla === 'historia' ? 'marca/hero/movil' : 'marca/hero';
      if (!/^\d{3}$/.test(p.fondo) || !existe(join(RAIZ, carpetaFondo, `${p.fondo}.webp`))){
        error(`${n}: el fondo "${p.fondo}" no existe en ${carpetaFondo}/`);
      }
    }
    if (p.captura){
      const c = p.captura;
      if (c.sitio){
        const sitio = SITIOS[c.sitio];
        if (!sitio) error(`${n}: el sitio "${c.sitio}" no está en sitios.json`);
        else if (c.seccion && !(c.seccion in (sitio.secciones || {}))) error(`${n}: "${c.sitio}" no tiene la sección "${c.seccion}"`);
      } else if (c.archivo){
        if (!existe(join(RAIZ, c.archivo))) error(`${n}: no existe ${c.archivo}`);
      } else if (!/^https:\/\//.test(c.url || '')){
        error(`${n}: la captura necesita "sitio", "archivo" o una "url" https`);
      }
    }
  });

  // ----- Texto y hashtags (las historias no llevan) -----
  if (datos.tipo === 'historia'){
    if (datos.texto || datos.hashtags?.length) error('las historias no llevan "texto" ni "hashtags" (Instagram no los muestra)');
  } else {
    const hashtags = datos.hashtags || [];
    if (!datos.texto?.trim()) error('falta "texto" (lo que va debajo de la imagen)');
    if (hashtags.length < 1 || hashtags.length > MAX_HASHTAGS) error(`lleva ${hashtags.length} hashtags: tienen que ser de 1 a ${MAX_HASHTAGS}`);
    for (const h of hashtags) if (!/^#[\p{L}\p{N}_]+$/u.test(h)) error(`hashtag mal escrito: "${h}" (sin espacios ni signos)`);
    if (new Set(hashtags.map((h) => h.toLowerCase())).size !== hashtags.length) error('hay hashtags repetidos');
    if (/#[\p{L}\p{N}_]/u.test(datos.texto || '')) error('el texto tiene hashtags adentro: van solo en "hashtags"');
    const largo = (datos.texto || '').length + 2 + hashtags.join(' ').length;
    if (largo > MAX_TEXTO) error(`el texto con los hashtags ocupa ${largo} caracteres (máximo ${MAX_TEXTO})`);
  }

  // ----- Tono: jerga y frases de venta -----
  const todoElTexto = textosDelPost(datos);
  const enMinusculas = todoElTexto.toLowerCase();
  for (const palabra of PALABRAS_PROHIBIDAS){
    const patron = new RegExp(`(^|[^\\p{L}])${palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u');
    if (patron.test(enMinusculas)) error(`usa "${palabra}": no va con el tono (ver CLAUDE.md)`);
  }

  // ----- Datos con números: necesitan fuente -----
  const conNumeros = sinNumerosPermitidos(todoElTexto);
  if ((/\d\s*%/.test(conNumeros) || /\b\d{2,}\b/.test(conNumeros)) && !datos.fuentes?.length){
    error('menciona un número o un porcentaje: agregá "fuentes" o sacalo (nunca inventar cifras)');
  }

  // ----- Temas repetidos -----
  const tema = normalizar(datos.tema || '');
  const desde = new Date(datos.fecha);
  desde.setUTCDate(desde.getUTCDate() - DIAS_SIN_REPETIR_TEMA);
  const estaCarpeta = relative(RAIZ, carpeta);
  for (const viejo of PUBLICADOS){
    if (viejo.carpeta === estaCarpeta) continue;   // es este mismo post, ya publicado
    if (normalizar(viejo.tema || '') === tema && new Date(viejo.fecha) >= desde){
      error(`el tema "${datos.tema}" ya salió el ${viejo.fecha}`);
    }
  }
  for (const otro of todos){
    if (otro.carpeta !== carpeta && normalizar(otro.datos.tema || '') === tema) error(`el tema se repite en ${basename(otro.carpeta)}`);
    if (otro.carpeta !== carpeta && otro.datos.fecha === datos.fecha) error(`${basename(otro.carpeta)} tiene la misma fecha: un post por día`);
  }

  // ----- Imágenes listas para publicar -----
  if (listo){
    for (const archivo of archivosDelPost(datos)){
      if (!existe(join(carpeta, archivo))) error(`falta ${archivo}: hay que renderizar`);
    }
  }
  return errores;
}

// ----- Desde la terminal -----
if (import.meta.url === pathToFileURL(process.argv[1]).href){
  const args = process.argv.slice(2);
  const listo = args.includes('--listo');
  const rutas = args.filter((a) => !a.startsWith('--'));
  if (!rutas.length){
    console.error('Uso: node scripts/validar.mjs [--listo] <carpeta de la semana o del post>');
    process.exit(2);
  }
  const posts = await buscarPosts(rutas);
  let conErrores = 0;
  for (const post of posts){
    const nombre = post.carpeta.replace(RAIZ + '/', '');
    const errores = validarPost(post, { listo, todos: posts });
    if (errores.length){
      conErrores++;
      console.error(`✗ ${nombre}`);
      for (const e of errores) console.error(`    ${e}`);
    } else {
      console.log(`✓ ${nombre}`);
    }
  }
  if (!posts.length) console.error('No encontré ningún post.json.');
  if (conErrores || !posts.length) process.exit(1);
}
