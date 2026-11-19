// Fondo continuo de las vistas «del mundo» (Inicio y Categorías). Detrás de toda la página hay una sola capa
// fija (.mundo-fondo, en index.html) con dos luces suaves: --luz-a (arriba a la derecha) y --luz-b (abajo a la
// izquierda). Cada parte dice qué luces quiere con data-luz="#color-a #color-b" y, cuando una
// cruza el centro de la pantalla, la capa pasa a sus colores con una transición lenta (las variables están
// registradas con @property en base.css). Así no hay bandas con bordes: el color se funde al bajar.

const fondo = document.querySelector('.mundo-fondo');
let activa = null;

/** Cambia las luces de una parte (el color del Pokémon destacado, del Pokémon del día, del tipo elegido…). */
export function ponerLuz(seccion, a, b = a) {
  seccion.dataset.luz = `${a} ${b}`;
  if (seccion === activa) aplicar(seccion);
}

function aplicar(seccion) {
  const [a, b = a] = seccion.dataset.luz.trim().split(/\s+/);
  fondo.style.setProperty('--luz-a', a);
  fondo.style.setProperty('--luz-b', b);
}

export function iniciarMundo() {
  // La «pantalla» del observador es una franja fina en el centro: manda la parte que la está cruzando.
  const observador = new IntersectionObserver(entradas => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      activa = entrada.target;
      aplicar(activa);
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('[data-luz]').forEach(seccion => observador.observe(seccion));
}
