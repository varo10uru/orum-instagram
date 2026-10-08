// ===========================================================================
// CONECTAR: deja cargados los Secrets IG_TOKEN e IG_USER_ID (una sola vez)
//
// Uso (en la terminal, en la carpeta del repo):  node scripts/conectar.mjs
//
// Pide tres cosas, sin mostrarlas en pantalla cuando son secretas:
//   1. El identificador de la app de Meta (App ID).
//   2. La clave secreta de la app (App Secret).
//   3. Un token de usuario recién generado en el Explorador de la API Graph.
// Con eso consigue el token de la página de Facebook de ORUM, que no vence,
// y el id de la cuenta de Instagram vinculada, y los guarda en los Secrets
// del repo con `gh`. Ningún token se imprime.
// ===========================================================================

import { spawn } from 'node:child_process';
import readline from 'node:readline';

const VERSION = process.env.IG_API_VERSION || 'v25.0';
const API = `https://graph.facebook.com/${VERSION}`;
const REPO = 'varo10uru/orum-instagram';

// ----- Preguntar en la terminal (con la respuesta oculta si es secreta) -----
function preguntar(texto, { oculto = false } = {}){
  return new Promise((listo) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto){
      rl._writeToOutput = (s) => { if (s.includes(texto)) process.stdout.write(s); };
    }
    rl.question(texto, (respuesta) => {
      rl.close();
      if (oculto) process.stdout.write('\n');
      listo(respuesta.trim());
    });
  });
}

async function pedir(ruta, parametros){
  const url = new URL(`${API}/${ruta}`);
  url.search = new URLSearchParams(parametros).toString();
  const r = await fetch(url);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || datos.error) throw new Error(datos.error?.message || `respuesta ${r.status}`);
  return datos;
}

function guardarSecret(nombre, valor){
  return new Promise((listo, fallo) => {
    const gh = spawn('gh', ['secret', 'set', nombre, '--repo', REPO], { stdio: ['pipe', 'ignore', 'inherit'] });
    gh.on('error', fallo);
    gh.on('close', (codigo) => (codigo === 0 ? listo() : fallo(new Error(`no se pudo guardar ${nombre}`))));
    gh.stdin.end(valor);
  });
}

try {
  console.log('Conectar el Instagram de ORUM con el repo (ningún token se muestra).\n');
  const appId = await preguntar('1. App ID de "ORUM Publicaciones": ');
  const secreto = await preguntar('2. Clave secreta de la app (no se ve al escribir): ', { oculto: true });
  const tokenCorto = await preguntar('3. Token del Explorador de la API Graph (no se ve al escribir): ', { oculto: true });

  // Token de usuario corto (1 hora) → largo (60 días)
  const { access_token: tokenLargo } = await pedir('oauth/access_token', {
    grant_type: 'fb_exchange_token', client_id: appId, client_secret: secreto, fb_exchange_token: tokenCorto,
  });

  // Páginas que administrás, con su Instagram vinculado. El token de una
  // página sacado de un token de usuario largo no vence.
  const { data: paginas = [] } = await pedir('me/accounts', {
    fields: 'name,access_token,instagram_business_account{id,username}', access_token: tokenLargo,
  });
  const conInstagram = paginas.filter((p) => p.instagram_business_account);
  if (!conInstagram.length){
    throw new Error('ninguna de tus páginas tiene un Instagram vinculado (o no lo autorizaste al generar el token)');
  }
  let pagina = conInstagram[0];
  if (conInstagram.length > 1){
    conInstagram.forEach((p, i) => console.log(`   ${i + 1}. ${p.name} → @${p.instagram_business_account.username}`));
    pagina = conInstagram[Number(await preguntar('¿Cuál? Número: ')) - 1];
    if (!pagina) throw new Error('número inválido');
  }
  const instagram = pagina.instagram_business_account;

  // Confirmar que el token de la página no vence
  const { data: info } = await pedir('debug_token', { input_token: pagina.access_token, access_token: `${appId}|${secreto}` });
  const vence = info?.expires_at ? new Date(info.expires_at * 1000).toLocaleDateString('es-UY') : 'nunca';

  await guardarSecret('IG_TOKEN', pagina.access_token);
  await guardarSecret('IG_USER_ID', instagram.id);
  console.log(`\n✓ Listo: página "${pagina.name}" → Instagram @${instagram.username}.`);
  console.log(`  El token vence: ${vence}. Quedó guardado en los Secrets IG_TOKEN e IG_USER_ID.`);
} catch (e){
  console.error(`\n✗ No se pudo conectar: ${e.message}`);
  process.exit(1);
}
