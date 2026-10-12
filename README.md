# Instagram de ORUM

Arma, revisa y publica el Instagram de ORUM. Así es una semana:

1. **Jueves 09:07:** una rutina de Claude Code arma la semana siguiente y
   abre un PR. Son 3 posts (lunes, miércoles y viernes) y 4 historias (los
   otros días).
2. **En el PR:** una Action genera las imágenes y deja un comentario con cómo
   va a salir cada día.
3. **Vos lo revisás**, desde la app de GitHub en el celular o desde la compu.
4. **Hacés merge**, y cada día se publica lo que toca:
   - historias desde las 10:07;
   - posts, carruseles y Reels desde las 12:37.

   GitHub revisa cada hora y publica lo que ya tiene la hora cumplida, así
   que cada cosa sale dentro de la hora siguiente a su horario. GitHub
   atrasa sus tareas programadas, a veces varias horas, y revisando cada
   hora el atraso no se nota.
5. **Miércoles a la noche:** una Action anota los números de la cuenta y de
   cada publicación en `metricas.json`, y el jueves la rutina los usa para
   armar la semana siguiente.

**Sin merge no se publica nada.** Las reglas de contenido (qué se puede decir,
el tono, los formatos) están en [`CLAUDE.md`](CLAUDE.md).

## Revisar y aprobar la semana

- **En la descripción del PR** vienen, además de la semana:
  - "Cómo viene": seguidores, alcance y qué pilares y formatos funcionan,
    sacado de `metricas.json`;
  - "Para hacer a mano esta semana": lo que no se puede automatizar, unos
    15 minutos por día.
  - El primer jueves de cada mes, el PR trae también `informes/AAAA-MM.md`,
    con el mes en números y hasta 3 cambios propuestos. Los decidís vos.
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
  Lanzá las corridas de a una: si hay varias esperando, GitHub cancela las
  anteriores.
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
      `instagram_manage_insights`, `pages_show_list`,
      `pages_read_engagement`, `business_management` y, para publicar
      también en Facebook, `pages_manage_posts`.
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

## Disparador externo (por si GitHub no cumple la hora)

GitHub atrasa las corridas programadas, y a veces las saltea: el
12/10/2026 no corrió ninguna en toda la tarde. Por eso, un servicio
gratuito (cron-job.org) lanza "Publicar" en modo `pendientes` dos veces
por hora, de 10 a 22. Hace lo mismo que la corrida de cada hora: publica lo
de hoy que ya tiene la hora cumplida, y lo ya publicado no se repite.

Se arma una sola vez:
1. **Token de GitHub:** github.com/settings/personal-access-tokens/new
   - Nombre: "Disparador Instagram ORUM". Vencimiento: 1 año.
   - Repository access: Only select repositories → `orum-instagram`.
   - Permissions → Repository permissions → **Actions: Read and write**.
     Nada más.
   - Generate token y copialo. Solo sirve para lanzar Actions de este
     repo: lo peor que se puede hacer con él es publicar antes de hora algo
     que ya aprobaste.
2. **cron-job.org:** creá la cuenta y después "Create cronjob":
   - URL: `https://api.github.com/repos/varo10uru/orum-instagram/actions/workflows/publicar.yml/dispatches`
   - Horario: personalizado. Minutos 9 y 39, horas 10 a 22, todos los
     días, zona horaria America/Montevideo.
   - Advanced → Request method: **POST**.
   - Headers:
     - `Authorization`: `Bearer ` y el token
     - `Accept`: `application/vnd.github+json`
     - `X-GitHub-Api-Version`: `2022-11-28`
   - Request body: `{"ref":"main","inputs":{"franja":"pendientes"}}`
   - Guardá y tocá "Test run": tiene que responder **204**. En Actions
     aparece una corrida de "Publicar".
3. **Cuando venza el token** (cron-job.org empieza a dar 401), generá otro
   y reemplazalo en el header.

## Métricas

Los miércoles a las 19:23, la Action "Métricas" le pide a Instagram:
- los seguidores del día;
- los totales de la cuenta de las dos últimas semanas cerradas: alcance,
  cuentas que interactuaron y toques en los botones de contacto;
- los números de cada post, carrusel y Reel de las últimas 4 semanas:
  alcance, guardados, compartidos, me gusta, comentarios y seguidores que
  trajo.

Lo guarda en `metricas.json`, que es público como todo el repo: son solo
cantidades, sin nombres ni datos de nadie. Para verlo resumido:
`node scripts/metricas.mjs --resumen`.

- **Historias:** no se miden, porque Meta guarda sus números solo 24 horas.
- **Con menos de 100 seguidores,** Meta no da algunos datos (por ejemplo,
  cuántos dejaron de seguir). Quedan en `null` y aparecen solos cuando se
  llega.
- **Los números tardan** hasta 48 horas en estar completos.

**Para que ande hace falta el permiso `instagram_manage_insights`** (una
sola vez):
1. En developers.facebook.com, abrí la app "ORUM Publicaciones" → Casos de
   uso → "Administrar mensajes y contenido en Instagram" → Personalizar, y
   agregá `instagram_manage_insights`.
2. Generá un token nuevo en el Explorador con todos los permisos de la
   puesta en marcha (paso 4) y corré `node scripts/conectar.mjs`. Si al
   token le falta algún permiso, el script avisa.
3. Probalo: `gh workflow run metricas.yml`.

## Página de Facebook

Todo lo que sale en Instagram puede salir también en la página de Facebook
de ORUM, a la misma hora y con el mismo texto:
- un post, como una foto;
- un carrusel, como una publicación con todas las fotos;
- una historia, como una historia de la página;
- un Reel, como un Reel de la página.

Primero sale Instagram. Si Facebook falla, Instagram no se repite: se
reintenta solo Facebook en las corridas siguientes de ese día, y te llega
el mail de GitHub. El link de Facebook queda en `publicados.json`.

**Para prenderla (una sola vez):**
1. **Permiso:** en la app de Meta, sumá `pages_manage_posts`. Si no aparece
   en el caso de uso de Instagram, agregá el caso de uso "Administrar todo
   en tu página". Generá el token con todos los permisos de la puesta en
   marcha (paso 4) y corré `node scripts/conectar.mjs`. Conviene hacerlo
   junto con el permiso de métricas, así el token se genera una sola vez.
2. **Probar sin publicar:** Actions → Publicar → Run workflow, con la
   carpeta de un día que todavía no salió y "Simular" e "Incluir la página
   de Facebook" marcados. Facebook recibe las imágenes, pero no publica
   nada.
3. **Prender:** `gh variable set PUBLICAR_EN_FACEBOOK --body si --repo
   varo10uru/orum-instagram`. También se puede desde GitHub: Settings →
   Secrets and variables → Actions → Variables.

Para apagarla, se borra la variable (`gh variable delete
PUBLICAR_EN_FACEBOOK --repo varo10uru/orum-instagram`).

## Ubicaciones y cuentas

Los posts pueden llevar el lugar, y los de trabajos reales pueden salir
compartidos con el cliente o etiquetarlo. Cómo se usa cada campo está en
`CLAUDE.md`. Mientras no haya nada cargado, no se usa nada.

**Lugares (`ubicaciones.json`):** cada uno necesita el id de la página de
Facebook del lugar. Hoy están Solymar, Ciudad de la Costa y Canelones, sin
id.
1. **Buscar el id:** Meta no deja buscarlo por la API sin un acceso
   especial (se probó el 12/10/2026), así que va a mano:
   1. En Facebook, buscá el lugar (por ejemplo, "Solymar, Canelones") y
      abrí la página que es el lugar, no un comercio.
   2. El id es el número largo. Aparece en la dirección de la página
      (`facebook.com/…/123456789…`) o en Información → Transparencia de la
      página.
2. **Cargarlo:** en `ubicaciones.json`, en el `id` de ese lugar, entre
   comillas.
3. **Probarlo:** Actions → "Ubicaciones y cuentas" → Run workflow, con
   "buscar" vacío. Crea contenedores de prueba y no publica nada. Si el id
   no sirve, Instagram lo rechaza y la corrida sale en rojo.

**Cuentas de clientes:** van en el campo `"instagram"` de cada sitio en
`sitios.json`, sin @. Cargala solo cuando el cliente esté de acuerdo, y
probala con la misma Action.
- Cuando el post sale como colaboración, al cliente le llega una
  invitación. Si la acepta desde su Instagram, el post sale también en su
  perfil.

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
| `informes/` | Un informe por mes, con los números y los cambios propuestos (lo arma la rutina) |
| `perfil/` | Foto, portadas y textos del perfil, y lo que va a mano para crecer (`crecimiento.md`) |
| `ubicaciones.json` | Los lugares que se pueden poner en los posts, con su id de Facebook |
| `metricas.json` | Los números de la cuenta y de cada publicación (los anota la Action "Métricas") |
| `scripts/` | Validar, renderizar, vista previa, Reels, publicar (en Instagram y Facebook), métricas, ubicaciones, conectar y revisar el token |
| `.github/workflows/` | Vista previa en los PR, publicación diaria, métricas de los miércoles, ubicaciones y cuentas (a mano) y renovación del token |
| `ejemplo/`, `ejemplo-reel/` | Una semana de muestra y un Reel de muestra |

## Cambiar algo

- **Horarios:** `HORA_POR_TIPO` en `scripts/comun.mjs` (hora de Uruguay).
  El workflow `publicar.yml` corre cada hora y publica lo que ya tiene la
  hora cumplida.
- **Colores, tamaños o diseño:** `plantillas/base.css` y cada plantilla.
  Están comentadas por sección.
- **Agregar un sitio para mostrar:** se suma a `sitios.json`, con lo que
  tiene de verdad en "notas".
