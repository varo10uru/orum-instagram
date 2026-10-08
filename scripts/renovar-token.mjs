// ===========================================================================
// RENOVAR EL TOKEN DE INSTAGRAM
//
// El token dura 60 días. Una Action lo renueva cada semana y guarda el nuevo
// en el Secret IG_TOKEN del repo, así nunca vence. Para guardarlo usa `gh`
// con un token de GitHub que puede escribir Secrets (GH_TOKEN).
//
// Uso:  node scripts/renovar-token.mjs            (renueva y guarda)
//       node scripts/renovar-token.mjs --probar   (solo renueva y muestra
//                                                   cuántos días dura)
// El token nunca se muestra en pantalla.
// ===========================================================================

import { spawn } from 'node:child_process';
import { renovarToken } from './instagram.mjs';

// Antes de la puesta en marcha no hay token: no es un error
if (!process.env.IG_TOKEN){
  console.log('Todavía no hay token de Instagram cargado: no hay nada que renovar.');
  process.exit(0);
}

const { token, dias } = await renovarToken();
// En GitHub Actions, que el token quede tapado en los registros
if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${token}`);
console.log(`Token renovado: vale ${dias} días más.`);

if (!process.argv.includes('--probar')){
  const repo = process.env.GITHUB_REPOSITORY || 'varo10uru/orum-instagram';
  // `gh secret set` lee el valor de la entrada estándar: no queda en la línea de comando
  await new Promise((listo, fallo) => {
    const gh = spawn('gh', ['secret', 'set', 'IG_TOKEN', '--repo', repo], { stdio: ['pipe', 'inherit', 'inherit'] });
    gh.on('error', fallo);
    gh.on('close', (codigo) => (codigo === 0 ? listo() : fallo(new Error(`gh secret set terminó con ${codigo}`))));
    gh.stdin.end(token);
  });
  console.log('Guardado en el Secret IG_TOKEN.');
}
