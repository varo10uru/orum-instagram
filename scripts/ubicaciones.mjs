// ===========================================================================
// UBICACIONES Y CUENTAS: buscar ids de lugares y probar lo cargado
//
// Uso (corre en GitHub Actions, que tiene el token: Actions → Ubicaciones y
// cuentas → Run workflow):
//   node scripts/ubicaciones.mjs --buscar "Solymar"
//        Busca lugares con ese nombre y muestra su id, para copiarlo en
//        ubicaciones.json.
//   node scripts/ubicaciones.mjs --probar
//        Prueba cada id de ubicaciones.json y cada cuenta de Instagram de
//        sitios.json, creando contenedores de prueba. No publica nada:
//        Instagram descarta solo los contenedores sin publicar.
// Necesita IG_TOKEN e IG_USER_ID.
// ===========================================================================

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { RAIZ } from './comun.mjs';
import { buscarLugares, prepararContenedor } from './instagram.mjs';

// Una imagen ya publicada del repo, para los contenedores de prueba
const repo = process.env.GITHUB_REPOSITORY || 'varo10uru/orum-instagram';
const IMAGEN = `https://raw.githubusercontent.com/${repo}/${process.env.GITHUB_SHA || 'main'}/ejemplo/5-viernes/1.jpg`;

async function buscar(texto){
  let lugares;
  try {
    lugares = await buscarLugares(texto);
  } catch (e){
    console.error(`✗ Meta no dejó buscar: ${e.message}`);
    console.error('  El id se puede sacar a mano: README, "Ubicaciones y cuentas".');
    process.exit(1);
  }
  if (!lugares.length) console.log(`No encontré lugares para "${texto}".`);
  for (const l of lugares){
    const { city, state, country } = l.location;
    console.log(`${l.id}  ${l.name}  (${[city, state, country].filter(Boolean).join(', ')})  ${l.link || ''}`);
  }
}

// Crea un contenedor con un solo extra; si Instagram lo rechaza, falla
async function probarUno(nombre, extra){
  try {
    await prepararContenedor({ tipo: 'post', texto: 'Prueba (no se publica)', imagenes: [IMAGEN], ...extra });
    console.log(`✓ ${nombre}`);
    return true;
  } catch (e){
    console.error(`✗ ${nombre}: ${e.message}`);
    return false;
  }
}

async function probar(){
  const ubicaciones = JSON.parse(await readFile(join(RAIZ, 'ubicaciones.json'), 'utf8'));
  const sitios = JSON.parse(await readFile(join(RAIZ, 'sitios.json'), 'utf8'));
  let fallas = 0;
  for (const [clave, lugar] of Object.entries(ubicaciones)){
    if (!lugar.id){ console.log(`- ${clave}: todavía sin id`); continue; }
    if (!await probarUno(`ubicación ${clave} (${lugar.nombre})`, { ubicacion: lugar.id })) fallas++;
  }
  for (const [clave, sitio] of Object.entries(sitios)){
    if (!sitio.instagram){ console.log(`- ${clave}: sin cuenta de Instagram cargada`); continue; }
    if (!await probarUno(`${clave} como etiqueta (@${sitio.instagram})`, { etiquetas: [sitio.instagram] })) fallas++;
    if (!await probarUno(`${clave} como colaborador (@${sitio.instagram})`, { colaboradores: [sitio.instagram] })) fallas++;
  }
  if (fallas) process.exit(1);
}

// ----- Desde la terminal -----
const { values: op } = parseArgs({ options: { buscar: { type: 'string' }, probar: { type: 'boolean' } } });
if (op.buscar) await buscar(op.buscar);
else if (op.probar) await probar();
else {
  console.error('Uso: node scripts/ubicaciones.mjs --buscar "lugar" | --probar');
  process.exit(2);
}
