# Instagram de ORUM

Arma, revisa y publica el Instagram de ORUM.

- **Cada jueves:** una rutina de Claude Code arma la semana siguiente y abre
  un PR. Son 3 posts (lunes, miércoles y viernes) y 4 historias (los otros
  días).
- **Para aprobarla:** la revisás y hacés merge.
- **Después:** se publica sola, un día a la vez.

Las reglas de contenido (qué se puede decir, el tono, los formatos) están en
[`CLAUDE.md`](CLAUDE.md).

## Qué hay acá

| Carpeta o archivo | Qué es |
|---|---|
| `semanas/` | Una carpeta por semana, con un `post.json` por día y sus imágenes |
| `plantillas/` | Las placas en HTML: post con consejo, post con un trabajo, carrusel e historia |
| `marca/` | Logo, fuentes (licencia OFL) y cuadros del render 3D del sitio |
| `sitios.json` | Los sitios reales que se pueden mostrar, con lo que tienen de verdad |
| `publicados.json` | Historial de lo publicado (fecha, tema y link) |
| `scripts/` | Validar, renderizar, vista previa y Reels |
| `ejemplo/`, `ejemplo-reel/` | Una semana de muestra y un Reel de muestra |

## Ver una semana en la Mac

```bash
npm ci                                            # la primera vez
node scripts/renderizar.mjs semanas/2026-10-12    # genera las imágenes
node scripts/vista-previa.mjs semanas/2026-10-12  # arma la página para revisar
open semanas/2026-10-12/vista-previa.html
```

Para ver una plantilla sola, abrila en Chrome (por ejemplo,
`plantillas/carrusel.html`): trae textos de ejemplo.

## Cambiar algo

- **Un texto de un post:** se edita su `post.json` y se vuelve a renderizar.
- **Colores, tamaños o diseño:** `plantillas/base.css` y cada plantilla.
  Están comentadas por sección.
- **Agregar un sitio para mostrar:** se suma a `sitios.json`, con lo que
  tiene de verdad en "notas".
