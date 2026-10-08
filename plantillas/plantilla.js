/* =========================================================================
   LÓGICA COMÚN DE LAS PLANTILLAS
   Cada plantilla tiene elementos con data-campo="nombre". Este script los
   llena con los datos de la pieza y avisa cuando la imagen está lista para
   capturar.

   De dónde salen los datos:
   - Al renderizar: scripts/renderizar.mjs los deja en window.DATOS.
   - Al abrir la plantilla a mano en el navegador: del #hash de la URL
     (JSON codificado), o los de ejemplo que trae cada plantilla.

   Formato de los textos:
   - *palabra*  → se pinta con el acento
   - **palabra** → en negrita blanca (solo en el cuerpo)
   - Salto de línea (\n) → nueva línea
   ========================================================================= */

(function(){
  // ----- Leer los datos -----
  function leerDatos(){
    if (window.DATOS) return window.DATOS;
    if (location.hash.length > 1){
      try { return JSON.parse(decodeURIComponent(location.hash.slice(1))); }
      catch (e) { console.warn('El #hash no es un JSON válido'); }
    }
    return window.EJEMPLO || {};
  }

  // ----- Pasar el texto a HTML seguro, con los marcadores -----
  function marcar(texto){
    const seguro = String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return seguro
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  // ----- Llenar los campos -----
  function llenar(datos){
    // Variante de la plantilla (portada, paso, cierre, etc.)
    if (datos.variante) document.body.dataset.variante = datos.variante;

    document.querySelectorAll('[data-campo]').forEach(function(el){
      const valor = datos[el.dataset.campo];
      const vacio = valor === undefined || valor === null || valor === '';
      if (el.tagName === 'IMG'){
        if (vacio) el.remove(); else el.src = valor;
      } else if (vacio){
        el.hidden = true;
      } else {
        el.innerHTML = marcar(valor);
      }
    });
  }

  // ----- Revisar que ningún texto se salga de su lugar -----
  // 1. Cada caja con data-limite tiene un max-height en el CSS: se mide
  //    cuánto alto necesitaría sin ese límite.
  // 2. Nada del contenido puede bajar más allá del margen inferior del lienzo.
  function revisarDesbordes(){
    const problemas = [];
    document.querySelectorAll('[data-limite]').forEach(function(el){
      if (el.hidden || getComputedStyle(el).display === 'none') return;
      const limite = parseFloat(getComputedStyle(el).maxHeight);
      el.style.maxHeight = 'none';
      const necesita = Math.round(el.getBoundingClientRect().height);
      el.style.maxHeight = '';
      if (limite && necesita > limite){
        el.dataset.desborde = '';
        problemas.push(el.dataset.campo + ': necesita ' + necesita + 'px y tiene ' + limite + 'px');
      }
    });

    const lienzo = document.querySelector('.lienzo');
    const caja = lienzo.getBoundingClientRect();
    const piso = caja.bottom - parseFloat(getComputedStyle(lienzo).paddingBottom);
    Array.from(lienzo.children).forEach(function(el){
      if (el.classList.contains('capa') || el.hidden) return;
      const abajo = el.getBoundingClientRect().bottom;
      if (abajo > piso + 1){
        el.dataset.desborde = '';
        problemas.push((el.dataset.campo || el.className) + ': se pasa ' + Math.round(abajo - piso) + 'px del margen de abajo');
      }
    });
    return problemas;
  }

  // ----- Esperar fuentes e imágenes -----
  async function prepararse(){
    llenar(leerDatos());
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(function(img){
      return img.complete ? Promise.resolve() :
        new Promise(function(listo){ img.onload = img.onerror = listo; });
    }));
    // Ajustes de cada plantilla que dependen del tamaño final de los textos
    if (typeof window.AJUSTAR === 'function') window.AJUSTAR();
    window.DESBORDES = revisarDesbordes();
    document.body.dataset.listo = '1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepararse);
  else prepararse();
})();
