# Instagram de ORUM

Este repo arma y publica el Instagram de ORUM, mi marca de desarrollo web en
Solymar, Canelones. Cada semana se arma una tanda de posts e historias; yo la
reviso en un PR y, cuando hago merge, se publica sola, día por día.

Cliente al que le hablamos: dueño de pyme o comercio de la Costa, de 35 a
60 años, no técnico, que decide por WhatsApp. También dueños de alquileres de
temporada de la Costa y de Rocha (desde que ALMILU es cliente).

Cada post del muro también sale en TikTok: va en el kit de la semana (ver
"TikTok", más abajo).

## Reglas que no se negocian

- **Nunca inventar** clientes, trabajos, testimonios, cifras, premios ni
  funciones de un sitio. De cada trabajo se dice solo lo que figura en
  `sitios.json` ("notas" y "avisos"). Si algo no está ahí, no se dice.
- **Números:** cualquier porcentaje o cifra necesita su fuente en
  `"fuentes"`. Si no hay fuente, se escribe sin el número.
- **Decorartesano no se muestra** hasta que su sitio esté publicado con obras
  reales. Hoy es una demo privada con renders de ejemplo (decisión del
  2026-10-08).
- **ALMILU** (alquiler en Punta del Diablo) es cliente desde octubre de 2026.
  Se muestra solo lo que dice `sitios.json`: el panel de reservas está en
  desarrollo y no se nombra, y los monoambientes son "próximamente".
- **Crédito obligatorio:** el video del inicio de ALMILU es de Marcelo Campi
  (CC BY 3.0). Si una captura o un Reel muestra el inicio, el texto lleva
  "Video aéreo del inicio: Marcelo Campi (CC BY 3.0)." `validar.mjs` lo exige.
- **Imágenes:** solo las plantillas de este repo, capturas de sitios reales y
  los renders de `marca/hero/`. Nada de fotos de stock ni imágenes generadas
  con IA.
- **Nunca publicar ni hacer merge.** Claude arma la semana y abre el PR; la
  aprobación es mía.

## Tono

- Primera persona del singular ("hago", "trabajo", "hablás conmigo"), voseo y
  un tono tranquilo y cercano.
- Hablar de lo que logra el cliente (que lo encuentren, le escriban, lo
  elijan), no de vender.
- **Sin venta agresiva** ("no te quedes afuera", "última oportunidad",
  "vendé mientras dormís") y **sin jerga** ("landing", "responsive", "SEO",
  "fricción", "checkout", "leads", "conversión"). `validar.mjs` frena las
  más comunes.
- Cierre de los posts: una invitación tranquila a escribir por WhatsApp al
  **091 541 848**. Las historias no pueden llevar links, así que el número va
  escrito.

## Pilares

| Pilar | Qué es | Ejemplos |
|---|---|---|
| `trabajos` | Sitios reales que hice (hoy la barraca y ALMILU) | Una función contada en simple, una captura, un Reel con el recorrido |
| `consejos` | Ideas útiles para un comercio, sin tecnicismos | Aparecer en Google Maps, el WhatsApp a mano en la web, fotos propias, horario al día |
| `proceso` | Cómo trabajo, detrás de escena | El render 3D del sitio de ORUM, del boceto al sitio, hablar directo conmigo |
| `local` | La Costa: Solymar, Ciudad de la Costa, Costa de Oro | Quién soy, desde dónde trabajo, invitación a escribir |

Cada semana, los 3 posts del muro son de 3 pilares distintos. Los trabajos se
reparten: como mucho 2 piezas del mismo cliente por semana.

## La semana

- Carpeta: `semanas/AAAA-MM-DD/`, con la fecha del lunes.
- Adentro, una carpeta por día con su `post.json`: `1-lunes`, `2-martes`,
  `3-miercoles`, `4-jueves`, `5-viernes`, `6-sabado`, `7-domingo`.
- **Lunes, miércoles y viernes:** `post`, `carrusel` o `reel`. Se publican a
  partir de las 12:37.
- **Martes, jueves, sábado y domingo:** `historia`. Se publican a partir de las 10:07.
- **Reels:** como máximo uno cada dos semanas. Hay que mirar las semanas
  anteriores en `semanas/` y en `publicados.json`.
- **Temas:** no se repiten temas de las últimas 6 semanas (`publicados.json`).

## Formato del `post.json`

```json
{
  "fecha": "2026-10-16",
  "tipo": "post",
  "pilar": "consejos",
  "tema": "Perfil de empresa de Google",
  "plantilla": "post-consejo",
  "piezas": [
    {
      "etiqueta": "Consejo",
      "titulo": "¿Tu negocio aparece en *Google Maps*?",
      "cuerpo": "El perfil de empresa de Google es gratis. Con horario, dirección y fotos reales, es más fácil que te encuentren.",
      "pie": "Solymar · Canelones",
      "alt": "Placa con la pregunta: ¿tu negocio aparece en Google Maps?"
    }
  ],
  "texto": "Lo que va debajo de la imagen, sin hashtags.",
  "hashtags": ["#Solymar", "#Canelones", "#GoogleMaps", "#PymesUruguay"],
  "fuentes": ["https://support.google.com/business/answer/7091"]
}
```

- **`tipo`:** `post` (una imagen), `carrusel` (de 2 a 10), `historia` (una) o
  `reel`.
- **`tema`:** una frase corta y única. Sirve para no repetir.
- **Textos de las piezas:** `*palabra*` se pinta con el verde de la marca (una
  o dos palabras por titular, no más); `**palabra**` va en negrita blanca;
  `\n` es un salto de línea.
- **`alt`:** obligatorio en posts y carruseles. Describe la imagen para quien
  no la ve.
- **Historias:** no llevan `texto` ni `hashtags`.
- Ejemplos completos: `ejemplo/` (una semana entera) y `ejemplo-reel/`.

### Plantillas

| Plantilla | Para | Campos |
|---|---|---|
| `post-consejo` | Post con una idea | `etiqueta`, `titulo` (hasta ~60 caracteres), `cuerpo` (hasta ~150), `pie`, `fondo` (opcional) |
| `post-trabajo` | Post con un sitio real en un celular | `etiqueta`, `cliente`, `titulo` (hasta ~45), `cuerpo` (hasta ~90), `captura` |
| `carrusel` | Cada diapositiva de un carrusel | `variante`: `portada` (`titulo`), `paso` (`numero` "01", `titulo`, `cuerpo`) o `cierre` (`titulo`, `cuerpo`); `etiqueta` |
| `historia` | Historias y placas de los Reels | `variante`: `frase` (`titulo`, `cuerpo`, `fondo` opcional), `captura` (`titulo`, `cuerpo`, `captura`) o `cierre` (`titulo`, `cuerpo`); `etiqueta` |

**Si un texto no entra**, `renderizar.mjs` lo marca en rojo y falla. Se
acorta el texto: nunca se toca la plantilla para hacerlo entrar.

**Fondos** (`"fondo": "072"`): cuadros del render 3D del sitio de ORUM.
- En el muro: `001`, `024`, `048`, `060`, `072` y `096`.
- En las historias: `048`, `072` y `096`.

### Sitios reales

- **`"captura": { "sitio": "barraca", "seccion": "simulador" }`:** las
  secciones de cada sitio están en `sitios.json`. Sin `seccion` se captura el
  inicio.
- **Reel:** `"recorrido": { "sitio": "barraca", "paradas": ["simulador", "catalogo"] }`
  con dos piezas de plantilla `historia`: la entrada (`frase`) y el cierre
  (`cierre`).
- **Antes de usar una sección:** leer los "avisos" del sitio en `sitios.json`.

### Hashtags

- De 3 a 5. Instagram no deja poner más de 5.
- **Uno o dos locales:** #Solymar, #CiudadDeLaCosta, #Canelones, #CostaDeOro.
- **Uno o dos del tema:** #PaginasWeb, #PymesUruguay, #ComerciosUruguay,
  #GoogleMaps.
- **Nada genérico:** #reels, #explore, #love, #instagood.

### Ubicación, colaboradores y etiquetas

Son tres campos opcionales que ayudan a que el post llegue a gente de la zona:

| Campo | Qué hace | Va en |
|---|---|---|
| `"ubicacion": "solymar"` | Muestra el lugar arriba del post. Sale de `ubicaciones.json` | post, carrusel, reel |
| `"colaboradores": ["barraca"]` | Publicación compartida: cuando el cliente la acepta, sale también en su perfil. Hasta 3 | post, carrusel, reel |
| `"etiquetas": ["barraca"]` | Etiqueta al cliente. En una historia le llega el aviso y la puede compartir | post, historia, reel |

- **Ubicación:** va en todos los posts, carruseles y Reels, con el lugar del
  tema. Si no hay uno en particular, `solymar`. Solo se usan los lugares de
  `ubicaciones.json` que ya tienen `id`. Si ninguno lo tiene, no se pone.
- **Colaboradores y etiquetas:** solo en publicaciones de trabajos reales, y
  solo con sitios que tengan `"instagram"` en `sitios.json`. Si está en
  `null`, no se usa: hace falta mi OK y el del cliente.
  - En el post o el Reel del trabajo, el cliente va como colaborador.
  - En la historia del trabajo, va como etiqueta.
- `validar.mjs` rechaza lo que no se puede usar.

## Armar la semana (lo que hace la rutina de los jueves)

1. Calcular el lunes de la semana que viene, en hora de Uruguay.
2. Leer `publicados.json`, las últimas semanas de `semanas/` y `sitios.json`.
3. Ver cómo viene la cuenta: `node scripts/metricas.mjs --resumen` (ver
   "Usar las métricas", abajo).
4. Crear `semanas/<lunes>/` con los 7 `post.json`, siguiendo todo lo de
   arriba.
5. Correr `node scripts/validar.mjs semanas/<lunes>` y corregir hasta que
   pase. No hace falta `npm install`.
6. Si hay Chrome (por ejemplo, en la Mac), además:
   - `npm ci` y `node scripts/renderizar.mjs semanas/<lunes>`.
   - Mirar las imágenes.
   - Si no hay Chrome, las genera la Action del PR.
7. Si es el primer jueves del mes (día 1 a 7), crear también
   `informes/AAAA-MM.md` del mes anterior (ver "Informe del mes").
8. Commit en una rama nueva y un PR a `main`:
   - Título: "Semana del 12 al 18 de octubre".
   - Descripción, en este orden:
     1. Una tabla con día, tipo, pilar y tema.
     2. **Cómo viene:** la salida de `--resumen` tal cual, más una línea
        con lo que se ajustó y por qué. Si no se ajustó nada, decirlo.
     3. **Para hacer a mano esta semana:** ver la lista de abajo.
9. No hacer merge.

### Usar las métricas

- **Los números salen solo del script.** No se calculan, no se redondean
  ni se completan a mano. Si el resumen dice "—", ese dato no existe.
- **Con menos de 4 semanas con datos** (el resumen lo dice), el reparto no
  se cambia.
- **Con 4 o más:**
  - Los pilares y formatos del muro se eligen según lo que trae
    seguidores, guardados y compartidos, en ese orden. Los me gusta casi no
    cuentan.
  - Siguen valiendo todas las reglas de "La semana": 3 pilares distintos en
    el muro, como máximo un Reel cada dos semanas y ningún tema repetido.
  - Ningún pilar queda afuera del muro dos semanas seguidas, aunque vaya
    peor: con tan pocos datos, un mal número puede ser casualidad.
- **La frecuencia y los horarios no se tocan.** Si los números sugieren
  cambiarlos (por ejemplo, más Reels), se propone en el informe del mes.

### Para hacer a mano esta semana

Lo que no se puede automatizar sin romper las reglas de Instagram. Va en
el PR, con como mucho 6 tareas, unos 15 minutos por día. Se arma con los
posts de esa semana, con el día y el post concretos, a partir de esta
lista:
- Compartir en tus historias el post del día (lunes, miércoles o viernes).
- Contestar los comentarios y los mensajes en el día.
- Comentar 2 o 3 publicaciones de comercios de la zona que sigas, con una
  frase propia (no un emoji suelto).
- Seguir algunos comercios de la Costa que te interesen de verdad. Pocos
  por día, y sin seguir para después dejar de seguir.
- Si sale un trabajo real, avisarle al cliente para que lo comparta.
- Si cambió cuál es el post que mejor anduvo, fijarlo en el perfil.

Nunca se proponen cosas automáticas: seguir, dar me gusta, comentar o
mandar mensajes con programas, comprar seguidores o sumarse a grupos de
interacción.

### Informe del mes

`informes/AAAA-MM.md`, con:
1. La salida de `node scripts/metricas.mjs --mes AAAA-MM`, tal cual.
2. **Hasta 3 cambios propuestos**, cada uno con el número que lo
   justifica. Por ejemplo: pasar a un Reel por semana, o sumar un tema que
   anduvo bien. Si no hay datos suficientes, se dice y no se propone nada.

Los cambios los decido yo: el informe no cambia nada por sí solo.

## TikTok

- **Qué va:** cada post del muro (post, carrusel o Reel) va también a
  TikTok. Las historias no van.
- **El kit:** lo arma la vista previa del PR con `scripts/tiktok.mjs`: un
  video vertical por post y un LEEME.md con el texto para pegar. Lo sube y
  lo programa el dueño, a mano, desde TikTok Studio: TikTok no deja
  publicar solo hasta auditar la app.
- **El texto:** por defecto es el mismo del post. Si conviene uno distinto
  (en TikTok funcionan más cortos, con una primera línea que enganche), va
  en `"tiktok": { "texto": "..." }`. Si el post muestra material con
  crédito, el texto de TikTok también lo lleva.

## Scripts

| Comando | Qué hace |
|---|---|
| `node scripts/validar.mjs <carpeta>` | Revisa los `post.json` (formato, límites, tono, números, repetidos) |
| `node scripts/renderizar.mjs <carpeta>` | Genera los JPG (y el MP4 de los Reels) al lado de cada `post.json` |
| `node scripts/tiktok.mjs <carpeta>` | Arma el kit de TikTok de la semana en `.tmp/tiktok/` (necesita las imágenes y ffmpeg) |
| `node scripts/vista-previa.mjs <carpeta>` | Arma `vista-previa.html` para revisar la semana en el navegador |
| `node scripts/metricas.mjs --resumen` | Cómo viene la cuenta y qué pilares y formatos funcionan (lee `metricas.json`, no necesita token) |
| `node scripts/metricas.mjs --mes AAAA-MM` | Lo mismo para un mes entero, para el informe |
| `node scripts/ubicaciones.mjs --buscar "lugar"` / `--probar` | Busca el id de un lugar, o prueba los lugares y las cuentas cargados (necesita token: corre en la Action "Ubicaciones y cuentas") |

Se necesita Node 22 o más nuevo, Chrome y, para los Reels, ffmpeg.
