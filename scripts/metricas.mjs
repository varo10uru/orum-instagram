// ===========================================================================
// MÉTRICAS: qué está funcionando en el Instagram
//
// Uso:
//   node scripts/metricas.mjs --medir
//        Pide los números a Instagram y los guarda en metricas.json:
//        - los seguidores de hoy;
//        - los totales de la cuenta de las dos últimas semanas cerradas
//          (de lunes a domingo, hora de Uruguay);
//        - los números de cada post, carrusel y Reel publicado en las
//          últimas 4 semanas (los más viejos ya no cambian).
//        Necesita IG_TOKEN e IG_USER_ID, con el permiso
//        instagram_manage_insights. Lo corre GitHub Actions los miércoles.
//   node scripts/metricas.mjs --resumen
//        Lee metricas.json (no necesita token) e imprime en Markdown cómo
//        viene la cuenta y qué pilares y formatos funcionan mejor. Lo usa
//        la rutina de los jueves para el PR.
//   node scripts/metricas.mjs --mes 2026-10
//        Lo mismo para un mes entero, con las publicaciones que mejor
//        anduvieron. Lo usa la rutina para informes/AAAA-MM.md.
//
// Las historias no se miden: Meta guarda sus números solo 24 horas.
// Cuando un dato no existe (por ejemplo, con menos de 100 seguidores),
// queda en null. Las cuentas las hace este script, nunca la rutina.
// ===========================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { RAIZ, existe, hoyUY } from './comun.mjs';
import { datosDeLaCuenta, metricasDeLaCuenta, metricasDePublicacion } from './instagram.mjs';

const RUTA_METRICAS = join(RAIZ, 'metricas.json');
const RUTA_PUBLICADOS = join(RAIZ, 'publicados.json');
const DIAS_QUE_SE_MIDEN = 28;      // después de 4 semanas un post ya no cambia
const SEMANAS_DEL_RESUMEN = 8;     // los promedios miran las últimas 8 semanas
const SEMANAS_PARA_AJUSTAR = 4;    // con menos, la rutina no cambia el reparto
const DIA = 86_400_000;

// ----- Fechas (hora de Uruguay, UTC-3 todo el año) -----
const aFecha = (ms) => new Date(ms).toISOString().slice(0, 10);
const aMs = (fecha) => Date.parse(`${fecha}T00:00:00Z`);
const corta = (fecha) => `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}`;

// Lunes de la semana de una fecha "AAAA-MM-DD"
function lunesDe(fecha){
  const dia = new Date(aMs(fecha)).getUTCDay();
  return aFecha(aMs(fecha) - ((dia + 6) % 7) * DIA);
}
// Comienzo de un día de Uruguay (00:00 UY = 03:00 UTC), como Date
const inicioUY = (fecha) => new Date(aMs(fecha) + 3 * 3_600_000);
const semanaTexto = (lunes) => `${corta(lunes)} al ${corta(aFecha(aMs(lunes) + 6 * DIA))}`;

async function leerJson(ruta, vacio){
  return existe(ruta) ? JSON.parse(await readFile(ruta, 'utf8')) : vacio;
}

// ----- Medir -----
async function medir(){
  const metricas = await leerJson(RUTA_METRICAS, { seguidores: [], semanas: {}, publicaciones: {} });
  const publicados = await leerJson(RUTA_PUBLICADOS, []);
  const hoy = hoyUY();
  const medido = new Date().toISOString();
  const avisos = [];

  // Seguidores de hoy (si ya se midió hoy, se reemplaza)
  const cuenta = await datosDeLaCuenta();
  metricas.seguidores = metricas.seguidores.filter((s) => s.fecha !== hoy);
  metricas.seguidores.push({ fecha: hoy, ...cuenta });
  console.log(`Seguidores: ${cuenta.seguidores} · publicaciones: ${cuenta.publicaciones}`);

  // Las dos últimas semanas cerradas: así, si un miércoles falla, la
  // semana se completa el siguiente
  const esteLunes = lunesDe(hoy);
  for (const atras of [2, 1]){
    const lunes = aFecha(aMs(esteLunes) - atras * 7 * DIA);
    const { metricas: valores, faltan } = await metricasDeLaCuenta(inicioUY(lunes), inicioUY(aFecha(aMs(lunes) + 7 * DIA)));
    metricas.semanas[lunes] = { ...valores, medido };
    avisos.push(...faltan.map((f) => `semana ${lunes}: ${f}`));
    console.log(`Semana del ${semanaTexto(lunes)}: alcance ${valores.alcance ?? '—'}, toques en contacto ${valores.toques_en_contacto ?? '—'}`);
  }

  // Cada post, carrusel y Reel de las últimas 4 semanas
  const desde = aFecha(aMs(hoy) - DIAS_QUE_SE_MIDEN * DIA);
  const aMedir = publicados.filter((p) => p.id && p.tipo !== 'historia' && p.fecha >= desde);
  for (const p of aMedir){
    const { metricas: valores, faltan } = await metricasDePublicacion(p.id, p.tipo);
    const { fecha, tipo, pilar, tema, link } = p;
    metricas.publicaciones[p.id] = { fecha, tipo, pilar, tema, link, ...valores, medido };
    avisos.push(...faltan.map((f) => `${p.carpeta}: ${f}`));
    console.log(`  ${fecha} ${tipo} (${pilar}): alcance ${valores.alcance ?? '—'}, guardados ${valores.guardados ?? '—'}, seguidores ${valores.seguidores ?? '—'}`);
  }

  await writeFile(RUTA_METRICAS, JSON.stringify(metricas, null, 2) + '\n');
  if (avisos.length){
    console.log(`\nDatos que Meta no dio (quedan en null):\n  ${avisos.join('\n  ')}`);
  }
  console.log(`\nListo: ${aMedir.length} publicaciones medidas.`);
}

// ----- Resumen en Markdown -----
const promedio = (valores) => {
  const conDato = valores.filter((v) => typeof v === 'number');
  return conDato.length ? Math.round((conDato.reduce((a, b) => a + b, 0) / conDato.length) * 10) / 10 : null;
};
// Números a la uruguaya: 4,5 y 1.200
const numero = (v) => v.toLocaleString('es-UY', { maximumFractionDigits: 1 });
const mostrar = (v) => (typeof v === 'number' ? numero(v) : '—');
const cambio = (a, b) => (typeof a === 'number' && typeof b === 'number' ? (a > b ? '+' : '') + numero(a - b) : '—');

// Primero lo que trae seguidores, después guardados y compartidos
const ordenar = (a, b) => (b.seguidores ?? -1) - (a.seguidores ?? -1) || (b.guardados ?? -1) - (a.guardados ?? -1) || (b.compartidos ?? -1) - (a.compartidos ?? -1);

function tablaPor(campo, publicaciones){
  const grupos = {};
  for (const p of publicaciones) (grupos[p[campo]] ||= []).push(p);
  const filas = Object.entries(grupos)
    .map(([nombre, ps]) => ({
      nombre, cantidad: ps.length,
      seguidores: promedio(ps.map((p) => p.seguidores)),
      guardados: promedio(ps.map((p) => p.guardados)),
      compartidos: promedio(ps.map((p) => p.compartidos)),
      alcance: promedio(ps.map((p) => p.alcance)),
    }))
    .sort(ordenar);
  const titulo = campo === 'pilar' ? 'Pilar' : 'Formato';
  return [
    `| ${titulo} | Publicaciones | Seguidores que trajo | Guardados | Compartidos | Alcance |`,
    '|---|---|---|---|---|---|',
    ...filas.map((f) => `| ${f.nombre} | ${f.cantidad} | ${mostrar(f.seguidores)} | ${mostrar(f.guardados)} | ${mostrar(f.compartidos)} | ${mostrar(f.alcance)} |`),
  ].join('\n');
}

async function resumen(){
  if (!existe(RUTA_METRICAS)){
    console.log('### Cómo viene\n\nTodavía no hay métricas: la primera medición es un miércoles, después de cargar el permiso.');
    return;
  }
  const metricas = JSON.parse(await readFile(RUTA_METRICAS, 'utf8'));
  const salida = ['### Cómo viene', ''];

  // Seguidores: las dos últimas mediciones
  const [antes, ahora] = metricas.seguidores.slice(-2).length === 2 ? metricas.seguidores.slice(-2) : [null, metricas.seguidores.at(-1)];
  if (ahora){
    salida.push(`**Seguidores:** ${mostrar(ahora.seguidores)} el ${corta(ahora.fecha)}` +
      (antes ? ` (${mostrar(antes.seguidores)} el ${corta(antes.fecha)}, ${cambio(ahora.seguidores, antes.seguidores)})` : '') + '.', '');
  }

  // La última semana cerrada contra la anterior
  const semanas = Object.keys(metricas.semanas).sort();
  const [anterior, ultima] = [semanas.at(-2), semanas.at(-1)];
  if (ultima){
    const a = metricas.semanas[ultima];
    const b = anterior ? metricas.semanas[anterior] : {};
    salida.push(
      `| | Semana del ${semanaTexto(ultima)} | ${anterior ? `Semana del ${semanaTexto(anterior)}` : 'Semana anterior'} | Cambio |`,
      '|---|---|---|---|',
      `| Alcance (cuentas que vieron algo) | ${mostrar(a.alcance)} | ${mostrar(b.alcance)} | ${cambio(a.alcance, b.alcance)} |`,
      `| Cuentas que interactuaron | ${mostrar(a.cuentas_que_interactuaron)} | ${mostrar(b.cuentas_que_interactuaron)} | ${cambio(a.cuentas_que_interactuaron, b.cuentas_que_interactuaron)} |`,
      `| Toques en los botones de contacto | ${mostrar(a.toques_en_contacto)} | ${mostrar(b.toques_en_contacto)} | ${cambio(a.toques_en_contacto, b.toques_en_contacto)} |`,
      '',
    );
  }

  // Qué funciona: posts, carruseles y Reels de las últimas 8 semanas
  const desde = aFecha(aMs(hoyUY()) - SEMANAS_DEL_RESUMEN * 7 * DIA);
  const recientes = Object.values(metricas.publicaciones).filter((p) => p.fecha >= desde);
  // Cuentan las semanas con números desde la primera publicación (antes,
  // la cuenta existía pero no había nada que medir)
  const primera = Object.values(metricas.publicaciones).map((p) => p.fecha).sort()[0];
  const conDatos = semanas.filter((s) => typeof metricas.semanas[s].alcance === 'number' && (!primera || aFecha(aMs(s) + 6 * DIA) >= primera)).length;
  if (recientes.length){
    salida.push(
      `**Qué funciona** (promedio por publicación, últimas ${SEMANAS_DEL_RESUMEN} semanas; "—" es que Meta no da ese dato):`, '',
      tablaPor('pilar', recientes), '',
      tablaPor('tipo', recientes), '',
    );
  }
  salida.push(conDatos >= SEMANAS_PARA_AJUSTAR
    ? `Hay ${conDatos} semanas con datos: alcanza para ajustar el reparto.`
    : `Hay ${conDatos} ${conDatos === 1 ? 'semana' : 'semanas'} con datos. Con menos de ${SEMANAS_PARA_AJUSTAR}, el reparto no se cambia.`);
  console.log(salida.join('\n'));
}

// ----- Resumen de un mes, para informes/AAAA-MM.md -----
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function resumenDelMes(mes){
  const nombre = `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
  const salida = [`### ${nombre[0].toUpperCase()}${nombre.slice(1)}`, ''];
  const metricas = await leerJson(RUTA_METRICAS, { seguidores: [], semanas: {}, publicaciones: {} });

  // Seguidores: la última medición del mes contra la última de antes
  const delMes = metricas.seguidores.filter((s) => s.fecha.startsWith(mes));
  const fin = delMes.at(-1);
  const inicio = metricas.seguidores.filter((s) => s.fecha < `${mes}-01`).at(-1) || delMes[0];
  if (fin){
    salida.push(`**Seguidores:** ${mostrar(fin.seguidores)} el ${corta(fin.fecha)}` +
      (inicio !== fin ? ` (${mostrar(inicio.seguidores)} el ${corta(inicio.fecha)}, ${cambio(fin.seguidores, inicio.seguidores)})` : '') + '.', '');
  }

  // Las semanas que empiezan en el mes
  const semanas = Object.keys(metricas.semanas).sort().filter((lunes) => lunes.startsWith(mes));
  if (semanas.length){
    const de = (campo) => semanas.map((lunes) => metricas.semanas[lunes][campo]);
    salida.push(
      '| Semana | Alcance | Cuentas que interactuaron | Toques en los botones de contacto |',
      '|---|---|---|---|',
      ...semanas.map((lunes) => {
        const s = metricas.semanas[lunes];
        return `| ${semanaTexto(lunes)} | ${mostrar(s.alcance)} | ${mostrar(s.cuentas_que_interactuaron)} | ${mostrar(s.toques_en_contacto)} |`;
      }),
      `| **Promedio por semana** | ${mostrar(promedio(de('alcance')))} | ${mostrar(promedio(de('cuentas_que_interactuaron')))} | ${mostrar(promedio(de('toques_en_contacto')))} |`,
      '',
    );
  }

  // Las publicaciones del mes
  const publicaciones = Object.values(metricas.publicaciones).filter((p) => p.fecha.startsWith(mes));
  if (publicaciones.length){
    salida.push(
      '**Las que mejor anduvieron** (primero seguidores, después guardados y compartidos):', '',
      ...[...publicaciones].sort(ordenar).slice(0, 3).map((p) =>
        `- ${corta(p.fecha)}, ${p.tipo} de ${p.pilar}: "${p.tema}". Seguidores ${mostrar(p.seguidores)}, guardados ${mostrar(p.guardados)}, ` +
        `compartidos ${mostrar(p.compartidos)}, alcance ${mostrar(p.alcance)}.${p.link ? ` ${p.link}` : ''}`),
      '',
      tablaPor('pilar', publicaciones), '',
      tablaPor('tipo', publicaciones),
    );
  } else {
    salida.push('No hay publicaciones medidas de ese mes.');
  }
  console.log(salida.join('\n').trimEnd());
}

// ----- Desde la terminal -----
const { values: op } = parseArgs({ options: { medir: { type: 'boolean' }, resumen: { type: 'boolean' }, mes: { type: 'string' } } });

if (op.medir){
  if (!process.env.IG_TOKEN){
    console.log('Todavía no hay token de Instagram cargado: no hay nada que medir.');
    process.exit(0);
  }
  try {
    await medir();
  } catch (e){
    console.error(`✗ No se pudieron pedir las métricas: ${e.message}`);
    if (/permission|permiso/i.test(e.message)){
      console.error('  Falta el permiso instagram_manage_insights en el token. Los pasos están en el README, "Métricas".');
    }
    process.exit(1);
  }
} else if (op.resumen){
  await resumen();
} else if (/^\d{4}-\d{2}$/.test(op.mes || '')){
  await resumenDelMes(op.mes);
} else {
  console.error('Uso: node scripts/metricas.mjs --medir | --resumen | --mes AAAA-MM');
  process.exit(2);
}
