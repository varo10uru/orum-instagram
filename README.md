# Instagram de ORUM

Arma, revisa y publica el Instagram de ORUM. Así es una semana:

1. **Jueves 09:07:** una rutina de Claude Code arma la semana siguiente y
   abre un PR. Son 3 posts (lunes, miércoles y viernes) y 4 historias (los
   otros días).
2. **En el PR:** una Action genera las imágenes y deja un comentario con cómo
   va a salir cada día.
3. **Vos lo revisás**, desde la app de GitHub en el celular o desde la compu.
4. **Hacés merge**, y cada día se publica lo que toca:
   - historias a las 10:07;
   - posts, carruseles y Reels a las 12:37.

**Sin merge no se publica nada.** Las reglas de contenido (qué se puede decir,
el tono, los formatos) están en [`CLAUDE.md`](CLAUDE.md).

## Revisar y aprobar la semana

- **Aprobar:** "Merge pull request".
- **Corregir un texto:**
  1. En el PR, entrá a "Files changed".
  2. Buscá el `post.json` de ese día, tocá los tres puntos y elegí "Edit
     file". Cambiá el texto y guardá (Commit).
  3. En un par de minutos se regeneran las imágenes y se actualiza el
     comentario.
- **Sacar un día:** borrá su carpeta (el `post.json` y sus imágenes).
- **Cambios grandes ("rehacé el miércoles"):**
  1. Abrí la corrida de la rutina en la app de Claude
     (claude.ai/code/routines → la corrida del jueves).
  2. Pedíselo ahí: trabaja sobre el mismo PR.
- **Si el PR está en rojo,** la revisión encontró algo (un texto que no entra,
  un hashtag de más). El comentario dice qué es.

## Si algo falla

- **Te avisa GitHub:** cuando una publicación falla, te llega un mail de
  GitHub Actions.
- **Ver qué pasó:** pestaña Actions → "Publicar" → la corrida en rojo.
- **Relanzar un día:** Actions → "Publicar" → "Run workflow", con la fecha y
  la franja (historias o posts). O desde la terminal:
  `gh workflow run publicar.yml -f fecha=2026-10-12 -f franja=posts`.
  Lo que ya se publicó no se repite: queda anotado en `publicados.json`.
- **Probar sin publicar:** lo mismo, marcando "Simular". Instagram revisa las
  imágenes, pero no publica nada.
- **Token que dejó de andar** (el error habla de "token" o "OAuth"):
  - El token de la página no vence, pero se invalida si cambiás la
    contraseña de Facebook o le sacás permisos a la app.
  - La Action "Renovar token" lo revisa cada lunes y te avisa.
  - Para arreglarlo, se vuelve a correr `node scripts/conectar.mjs`.

## Puesta en marcha (una sola vez)

1. **Cuenta de Instagram:**
   - Creala y pasala a cuenta profesional de tipo **Empresa** (Configuración
     → Tipo de cuenta). Con cuenta de Creador, los Reels por API no
     funcionan.
   - Foto de perfil: `prototipos/logo/perfil-whatsapp.png` del repo del
     sitio.
2. **Página de Facebook:**
   - En la app de Instagram: Editar perfil → Página → crear (o conectar)
     la página "ORUM".
   - Puede quedar mínima, sin publicar nada.
   - Hace falta porque, en octubre de 2026, Meta no mostraba la opción de
     conectar Instagram sin Facebook.
3. **App de Meta "ORUM Publicaciones"** (ya creada):
   - Caso de uso "Administrar mensajes y contenido en Instagram", con los
     permisos de contenido agregados.
   - Está en modo desarrollo, que alcanza para publicar en tu propia cuenta.
4. **Token y Secrets:**
   1. En el Explorador de la API Graph
      (developers.facebook.com/tools/explorer), elegí la app y "Obtener
      token de acceso de usuario".
   2. Agregá los permisos `instagram_basic`, `instagram_content_publish`,
      `pages_show_list`, `pages_read_engagement` y `business_management`.
   3. Tocá "Generate Access Token" y autorizá la página y el Instagram de
      ORUM.
   4. En la terminal, corré `node scripts/conectar.mjs`. Pide el App ID, la
      clave secreta y ese token (los secretos no se ven al escribirlos).
      Guarda en GitHub el token de la página (no vence) y el id de la
      cuenta de Instagram.
   - **Los tokens nunca se pegan en un chat.**
5. **Probar la conexión:** Actions → "Publicar" → "Run workflow" con
   "Simular", o en la Mac:
   `IG_TOKEN=… IG_USER_ID=… node scripts/publicar.mjs --probar`.
6. **Rutina de los jueves:** se crea con `/schedule` en Claude Code. El texto
   está abajo.

### Texto de la rutina

> Armá la semana que viene del Instagram de ORUM en este repo, siguiendo la
> sección "Armar la semana" de CLAUDE.md al pie de la letra. Respetá todas las
> reglas de contenido: no inventes nada que no esté en sitios.json o en
> CLAUDE.md. Al terminar, abrí el PR a main y no hagas merge.

## Ver una semana en la Mac

```bash
npm ci                                            # la primera vez
node scripts/renderizar.mjs semanas/2026-10-12    # genera las imágenes
node scripts/vista-previa.mjs semanas/2026-10-12  # arma la página para revisar
open semanas/2026-10-12/vista-previa.html
```

Para ver una plantilla sola, abrila en Chrome (por ejemplo,
`plantillas/carrusel.html`): trae textos de ejemplo.

## Qué hay acá

| Carpeta o archivo | Qué es |
|---|---|
| `semanas/` | Una carpeta por semana, con un `post.json` por día y sus imágenes |
| `plantillas/` | Las placas en HTML: post con consejo, post con un trabajo, carrusel e historia |
| `marca/` | Logo, fuentes (licencia OFL) y cuadros del render 3D del sitio |
| `sitios.json` | Los sitios reales que se pueden mostrar, con lo que tienen de verdad |
| `publicados.json` | Historial de lo publicado (fecha, tema y link) |
| `scripts/` | Validar, renderizar, vista previa, Reels, publicar, conectar y revisar el token |
| `.github/workflows/` | Vista previa en los PR, publicación diaria y renovación del token |
| `ejemplo/`, `ejemplo-reel/` | Una semana de muestra y un Reel de muestra |

## Cambiar algo

- **Horarios:** los `cron` de `.github/workflows/publicar.yml` (en UTC:
  Uruguay es UTC-3) y `HORA_POR_TIPO` en `scripts/comun.mjs`.
- **Colores, tamaños o diseño:** `plantillas/base.css` y cada plantilla.
  Están comentadas por sección.
- **Agregar un sitio para mostrar:** se suma a `sitios.json`, con lo que
  tiene de verdad en "notas".
