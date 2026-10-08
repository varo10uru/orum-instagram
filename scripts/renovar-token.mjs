// ===========================================================================
// RENOVAR (O REVISAR) EL TOKEN DE INSTAGRAM
//
// Corre cada lunes en GitHub Actions.
// - Token de la página de Facebook (el que se usa hoy): no vence. Solo se
//   revisa que siga andando; si alguien cambia la contraseña de Facebook o
//   le saca permisos a la app, esto falla y GitHub manda un mail.
// - Token de Instagram Login: dura 60 días. Se renueva y se guarda el nuevo
//   en el Secret IG_TOKEN con `gh`, usando un token de GitHub que puede
//   escribir Secrets (GH_TOKEN = Secret GH_PAT_SECRETOS).
//
// Uso:  node scripts/renovar-token.mjs
// El token nunca se muestra en pantalla.
// ===========================================================================

import { spawn } from 'node:child_process';
import { cuenta, esTokenDeInstagram, renovarToken } from './instagram.mjs';

// Antes de la puesta en marcha no hay token: no es un error
if (!process.env.IG_TOKEN){
  console.log('Todavía no hay token de Instagram cargado: no hay nada que revisar.');
  process.exit(0);
}

if (!esTokenDeInstagram()){
  const c = await cuenta();
  console.log(`El token de la página anda (cuenta @${c.username}) y no vence: no hace falta renovarlo.`);
  process.exit(0);
}

const { token, dias } = await renovarToken();
// En GitHub Actions, que el token quede tapado en los registros
if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${token}`);
console.log(`Token renovado: vale ${dias} días más.`);

const repo = process.env.GITHUB_REPOSITORY || 'varo10uru/orum-instagram';
// `gh secret set` lee el valor de la entrada estándar: no queda en la línea de comando
await new Promise((listo, fallo) => {
  const gh = spawn('gh', ['secret', 'set', 'IG_TOKEN', '--repo', repo], { stdio: ['pipe', 'inherit', 'inherit'] });
  gh.on('error', fallo);
  gh.on('close', (codigo) => (codigo === 0 ? listo() : fallo(new Error(`gh secret set terminó con ${codigo}`))));
  gh.stdin.end(token);
});
console.log('Guardado en el Secret IG_TOKEN.');
