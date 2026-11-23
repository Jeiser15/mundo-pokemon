// Pequeñas funciones que usan varios módulos.

import { FORMAS } from './datos-formas.js';
import { NOMBRES_ESPANOL } from './datos.js';

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

/** Grito de la especie (.ogg de PokéAPI). Las 1025 lo tienen en esta dirección (pokemon → cries.latest). */
export const urlGrito = id =>
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

/** 25 → "025" */
export const numeroPokedex = id => String(id).padStart(3, '0');

/** "https://pokeapi.co/api/v2/pokemon-species/25/" → "25" */
export const idDesdeUrl = url => url.split('/').filter(Boolean).pop();

/** "mr-mime" → "mr mime" */
export const nombreLegible = nombre => nombre.replaceAll('-', ' ');

/** "rock-star" → "Rock Star": solo mayúsculas, sin consultar ninguna tabla. */
const mayusculas = clave => nombreLegible(clave).replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toUpperCase());

/**
 * Nombre oficial en español de una clave de PokéAPI, de especie o de forma:
 *   'pikachu' → «Pikachu» · 'mr-mime' → «Mr. Mime» · 'type-null' → «Código Cero» (NOMBRES_ESPANOL)
 *   'giratina-altered' → «Giratina» (forma por defecto) · 'giratina-origin' → «Giratina (Forma Origen)»
 *   'charizard-mega-x' → «Mega-Charizard X» (el nombre de la forma ya lleva el de la especie)  (FORMAS)
 */
export function nombreTitulo(clave) {
  const forma = FORMAS[clave];
  if (!forma) return NOMBRES_ESPANOL[clave] || mayusculas(clave);
  const [nombre, especie, porDefecto] = forma;
  const base = nombreTitulo(especie);
  if (porDefecto) return base;
  if (!nombre) return mayusculas(clave);
  return nombre.includes(base) ? nombre : `${base} (${nombre})`;
}

/** Si la clave tiene nombre oficial en español: las especies y casi todas las formas (no las 18 sin él en PokéAPI). */
export const formaConNombre = clave => !FORMAS[clave] || Boolean(FORMAS[clave][0]);

/** Solo el nombre de la forma («Forma Origen», «Mega-Charizard X»), o null si la clave es la de su especie. */
export function nombreForma(clave) {
  const forma = FORMAS[clave];
  return forma ? forma[0] || mayusculas(clave.slice(forma[1].length + 1)) : null;
}

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
