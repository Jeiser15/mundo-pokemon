// Pequeñas funciones que usan varios módulos.

/**
 * Crea un elemento HTML en una sola llamada.
 *   crear('button', { clase: 'pokemon-card', type: 'button', alPulsar: abrir }, hijo1, hijo2)
 * Opciones especiales: clase, texto, atributos {}, estilos {} (admite variables CSS) y alPulsar.
 * Cualquier otra opción se copia como propiedad del elemento (type, src, alt, loading, hidden...).
 */
export function crear(etiqueta, opciones = {}, ...hijos) {
  const { clase, texto, atributos = {}, estilos = {}, alPulsar, ...propiedades } = opciones;
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  for (const [nombre, valor] of Object.entries(atributos)) elemento.setAttribute(nombre, valor);
  for (const [nombre, valor] of Object.entries(estilos)) elemento.style.setProperty(nombre, valor);
  Object.assign(elemento, propiedades);
  if (alPulsar) elemento.addEventListener('click', alPulsar);
  elemento.append(...hijos);
  return elemento;
}

/** Icono de tipo dibujado con trazos SVG propios (viewBox 24×24): se ve igual en todos los dispositivos. */
export function crearIcono(trazo) {
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG, 'svg');
  const atributos = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  for (const [nombre, valor] of Object.entries(atributos)) svg.setAttribute(nombre, valor);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', trazo);
  svg.append(path);
  return svg;
}

/** Imagen que se oculta si no se puede descargar (algunas formas no tienen ilustración). */
export function crearImagen(src, opciones = {}) {
  const imagen = crear('img', { loading: 'lazy', ...opciones, src, alt: opciones.alt ?? '' });
  imagen.onerror = () => { imagen.hidden = true; };
  return imagen;
}

/** Ilustración oficial de un Pokémon a partir de su número. */
export const urlIlustracion = id =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

/** Sprite pequeño (96 px, estilo de los juegos clásicos): ideal para miniaturas. */
export const urlSprite = id =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

/** Sprite ANIMADO (GIF de Pokémon Showdown). No todos los Pokémon lo tienen: usar con respaldo (urlSprite). */
export const urlAnimado = id =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;

/** 25 → "025" */
export const numeroPokedex = id => String(id).padStart(3, '0');

/** "https://pokeapi.co/api/v2/pokemon-species/25/" → "25" */
export const idDesdeUrl = url => url.split('/').filter(Boolean).pop();

/** "mr-mime" → "mr mime" */
export const nombreLegible = nombre => nombre.replaceAll('-', ' ');

/** "mr-mime" → "Mr Mime": para nombres dentro de frases, donde el CSS no puede poner las mayúsculas. */
export const nombreTitulo = nombre => nombreLegible(nombre).replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toUpperCase());

/** "Mr-Mímé" → "mr mime": sin mayúsculas, tildes ni guiones, para comparar al buscar. */
export const normalizar = texto => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replaceAll('-', ' ').trim();

/** Copia de la lista en orden aleatorio (Fisher-Yates). */
export function barajar(lista, azar = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Elemento al azar de una lista. */
export const alAzar = (lista, azar = Math.random) => lista[Math.floor(azar() * lista.length)];
