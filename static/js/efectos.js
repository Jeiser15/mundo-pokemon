// Efectos visuales compartidos por varias vistas.

/**
 * Inclinación 3D: con ratón, la carta bajo el cursor se inclina hacia él y su contenido se desplaza un poco.
 * Escribe en la carta las variables CSS --rx y --ry (grados) y --px y --py (desplazamiento sin unidades),
 * y le pone la clase .siguiendo mientras el cursor está encima. Cada hoja CSS decide cómo usarlas.
 *   activarInclinacion(contenedor, '.leyenda')
 * @param {Element} contenedor  Elemento que contiene las cartas (un solo oyente para todas).
 * @param {string} selector     Qué es una carta dentro del contenedor.
 */
export function activarInclinacion(contenedor, selector, { giro = 12, paralaje = 10 } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  contenedor.addEventListener('pointermove', evento => {
    const carta = evento.target.closest(selector);
    if (!carta || evento.pointerType !== 'mouse') return;
    const caja = carta.getBoundingClientRect();
    const x = (evento.clientX - caja.left) / caja.width - 0.5;  // -0,5 (izquierda) … 0,5 (derecha)
    const y = (evento.clientY - caja.top) / caja.height - 0.5;  // -0,5 (arriba) … 0,5 (abajo)
    carta.classList.add('siguiendo');
    carta.style.setProperty('--rx', (-y * giro * 0.85).toFixed(2) + 'deg');
    carta.style.setProperty('--ry', (x * giro).toFixed(2) + 'deg');
    carta.style.setProperty('--px', (x * -paralaje).toFixed(1));
    carta.style.setProperty('--py', (y * -paralaje * 0.6).toFixed(1));
  });
  contenedor.addEventListener('pointerout', evento => {
    const carta = evento.target.closest(selector);
    if (!carta || carta.contains(evento.relatedTarget)) return;
    carta.classList.remove('siguiendo');
    for (const variable of ['--rx', '--ry', '--px', '--py']) carta.style.removeProperty(variable);
  });
}
