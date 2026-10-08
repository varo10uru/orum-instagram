# Instagram de ORUM

Este repo arma y publica el Instagram de ORUM, mi marca de desarrollo web en
Solymar, Canelones. Cada semana se arma una tanda de posts e historias; yo la
reviso en un PR y, cuando hago merge, se publica sola, día por día.

Cliente al que le hablamos: dueño de pyme o comercio de la Costa, de 35 a
60 años, no técnico, que decide por WhatsApp.

## Reglas que no se negocian

- **Nunca inventar** clientes, trabajos, testimonios, cifras, premios ni
  funciones de un sitio. De cada trabajo se dice solo lo que figura en
  `sitios.json` ("notas" y "avisos"). Si algo no está ahí, no se dice.
- **Números:** cualquier porcentaje o cifra necesita su fuente en
  `"fuentes"`. Si no hay fuente, se escribe sin el número.
- **Decorartesano no se muestra** hasta que su sitio esté publicado con obras
  reales. Hoy es una demo privada con renders de ejemplo (decisión del
  2026-10-08).
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
| `trabajos` | Sitios reales que hice (hoy solo la barraca) | Una función contada en simple, una captura, un Reel con el recorrido |
| `consejos` | Ideas útiles para un comercio, sin tecnicismos | Aparecer en Google Maps, el WhatsApp a mano en la web, fotos propias, horario al día |
| `proceso` | Cómo trabajo, detrás de escena | El render 3D del sitio de ORUM, del boceto al sitio, hablar directo conmigo |
| `local` | La Costa: Solymar, Ciudad de la Costa, Costa de Oro | Quién soy, desde dónde trabajo, invitación a escribir |

Cada semana, los 3 posts del muro son de 3 pilares distintos.

## La semana

- Carpeta: `semanas/AAAA-MM-DD/`, con la fecha del lunes.
- Adentro, una carpeta por día con su `post.json`: `1-lunes`, `2-martes`,
  `3-miercoles`, `4-jueves`, `5-viernes`, `6-sabado`, `7-domingo`.
- **Lunes, miércoles y viernes:** `post`, `carrusel` o `reel`. Se publican a
  las 12:37.
- **Martes, jueves, sábado y domingo:** `historia`. Se publican a las 10:07.
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
- **`hora`:** es opcional ("HH:MM") y solo se usa si hay un motivo.
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

## Armar la semana (lo que hace la rutina de los jueves)

1. Calcular el lunes de la semana que viene, en hora de Uruguay.
2. Leer `publicados.json`, las últimas semanas de `semanas/` y `sitios.json`.
3. Crear `semanas/<lunes>/` con los 7 `post.json`, siguiendo todo lo de
   arriba.
4. Correr `node scripts/validar.mjs semanas/<lunes>` y corregir hasta que
   pase. No hace falta `npm install`.
5. Si hay Chrome (por ejemplo, en la Mac), además:
   - `npm ci` y `node scripts/renderizar.mjs semanas/<lunes>`.
   - Mirar las imágenes.
   - Si no hay Chrome, las genera la Action del PR.
6. Commit en una rama nueva y un PR a `main`:
   - Título: "Semana del 12 al 18 de octubre".
   - En la descripción, una tabla con día, tipo, pilar y tema.
7. No hacer merge.

## Scripts

| Comando | Qué hace |
|---|---|
| `node scripts/validar.mjs <carpeta>` | Revisa los `post.json` (formato, límites, tono, números, repetidos) |
| `node scripts/renderizar.mjs <carpeta>` | Genera los JPG (y el MP4 de los Reels) al lado de cada `post.json` |
| `node scripts/vista-previa.mjs <carpeta>` | Arma `vista-previa.html` para revisar la semana en el navegador |

Se necesita Node 22 o más nuevo, Chrome y, para los Reels, ffmpeg.
