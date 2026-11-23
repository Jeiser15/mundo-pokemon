// Navegación entre vistas. La página es una sola: cada vista es una <section> que se
// muestra u oculta según el #hash de la dirección (#inicio, #categorias...).

const VISTAS = ['inicio', 'categorias', 'legendarios', 'catalogo', 'duelo', 'quien'];
// Nombres antiguos: «Buscar» ahora es la Pokédex; «Mi equipo» y «Batalla de equipos», el Duelo Pokémon.
const ALIAS = { explorar: 'catalogo', equipo: 'duelo', batalla: 'duelo' };
// Vistas «del mundo»: comparten el fondo continuo oscuro de base.css (<body data-mundo>).
const VISTAS_DEL_MUNDO = ['inicio', 'categorias'];

let vistaActual = null;

/**
 * Enseña la vista del #hash. Sube al principio si cambia de vista o si se pide (`subir`: un enlace del menú). Al
 * volver atrás en el historial dentro de la misma vista (cerrar una ficha con «Atrás»: ver ficha.js) no se mueve.
 */
export function mostrarVista(subir = false) {
  const solicitada = ALIAS[location.hash.slice(1)] || location.hash.slice(1);
  const activa = VISTAS.includes(solicitada) ? solicitada : 'inicio';
  const cambia = activa !== vistaActual;
  vistaActual = activa;
  if (!cambia && !subir) return;
  document.body.dataset.vista = activa; // Permite que el CSS adapte cabecera y pie a cada vista.
  document.body.toggleAttribute('data-mundo', VISTAS_DEL_MUNDO.includes(activa));
  for (const id of VISTAS) document.getElementById(id).hidden = id !== activa; // #inicio envuelve todas sus partes
  document.querySelector('#volver-inicio').hidden = activa === 'inicio';
  document.querySelectorAll('nav a').forEach(enlace => {
    if (enlace.hash === '#' + activa) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/** Cambia de vista y la guarda en el historial (el botón «Atrás» del navegador funciona). */
export function irA(vista) {
  if (location.hash !== '#' + vista) history.pushState(null, '', '#' + vista);
  mostrarVista(true);
}

export function iniciarVistas() {
  window.addEventListener('hashchange', () => mostrarVista());
  window.addEventListener('popstate', () => mostrarVista());
  document.querySelectorAll('a[href^="#"]').forEach(enlace => enlace.addEventListener('click', evento => {
    const destino = enlace.hash.slice(1);
    if (!VISTAS.includes(destino)) return;
    evento.preventDefault();
    irA(destino);
  }));
  mostrarVista();
}
