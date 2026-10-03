/* revision.js — LA CUENTA DEL REVISOR DE META VE CHERRY CONGELADO (3-oct-2026).
 *
 * Sergio: «etiquetemos la cuenta del revisor como cuenta de revisor y en su cuenta no cambiará nada, y en Cherry podemos
 * hacer varias modificaciones de diseño pero que él la siga viendo igual».
 *
 * Mientras Meta revisa los permisos, la cuenta marcada como de revisión (`app_metadata.cuenta_revision` en Supabase, o su
 * id en REVISORES) se manda a /revision/: una copia de Cherry tal como estaba publicado el 3-oct (la que se ve en los
 * videos de la revisión). Todos los demás siguen en el Cherry de siempre, que ya se puede rediseñar.
 *
 * Va de PRIMERO en el <head> de app.html y de cada herramienta (antes de pintar nada) y también corre al guardar la sesión
 * (js/api.js › guardarSesion), para el momento en que el revisor entra. Conserva la dirección completa: la vuelta de
 * Instagram (?instagram=ok…) llega a /app.html o a la herramienta y de aquí sigue a la copia con los mismos datos.
 *
 * La copia NO trae este archivo: allá no se redirige nada. Se quita todo cuando Meta apruebe (docs/CUENTA-DE-REVISION.md).
 */
(function () {
  'use strict';
  var REVISORES = ['abbac53b-547f-400b-8fe1-ba54d4a8ecc1'];   // review@cherrysweet.app

  // la carpeta raíz del sitio y la página relativa (app.html o herramientas/x.html)
  function partes() {
    var p = location.pathname, i = p.indexOf('/herramientas/');
    if (i >= 0) return { raiz: p.slice(0, i + 1), pagina: p.slice(i + 1) };
    var j = p.lastIndexOf('/');
    return { raiz: p.slice(0, j + 1), pagina: p.slice(j + 1) || 'app.html' };
  }

  function esRevisor() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem('carrete-sesion') || 'null'); } catch (e) { return false; }
    var u = s && s.user;
    if (!u) return false;
    return (u.app_metadata && u.app_metadata.cuenta_revision === true) || REVISORES.indexOf(u.id) >= 0;
  }

  function revisar() {
    if (location.pathname.indexOf('/revision/') >= 0 || !esRevisor()) return false;
    var x = partes();
    location.replace(x.raiz + 'revision/' + x.pagina + location.search + location.hash);
    return true;
  }

  window.CherryRevision = { revisar: revisar };
  revisar();
})();
