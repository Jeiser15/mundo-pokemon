// Datos fijos de la aplicación: no dependen de PokéAPI y se pueden editar a mano.

/**
 * Los 18 tipos, en el orden en que aparecen en «Categorías» y en las tablas de efectividad.
 * - nombre:    texto en español.
 * - color:     color de la tarjeta, de las etiquetas y del fondo de la ficha.
 * - icono:     trazo SVG (viewBox 24×24) de la insignia.
 * - efecto:    cómo se anima su ataque en la arena pixelada (arena-pixel.js): contacto, proyectil,
 *              chorro, rayo, rafaga, onda, terremoto o caida. Sus colores están en PALETAS_ATAQUE.
 */
export const TIPOS = {
  normal:   { nombre: 'Normal',     color: '#8a917e', efecto: 'contacto', icono: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16 M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8' },
  fire:     { nombre: 'Fuego',      color: '#d8703c', efecto: 'proyectil', icono: 'M12 3c1 4-3 5-3 9-1-1-2-2-2-4-3 4-3 7-1 10 2 4 10 4 12 0 3-5-1-9-3-11 0 3-1 4-2 4 1-3 0-6-1-8z' },
  water:    { nombre: 'Agua',       color: '#4b8fbd', efecto: 'chorro', icono: 'M12 3C9 8 6 11 6 15a6 6 0 0 0 12 0c0-4-3-7-6-12z M9 16c0 1 1 2 2 2' },
  electric: { nombre: 'Eléctrico',  color: '#c59c28', efecto: 'rayo', icono: 'M13 2 6 13h5l-1 9 8-12h-5z' },
  grass:    { nombre: 'Planta',     color: '#5f9b60', efecto: 'rafaga', icono: 'M20 4C10 4 5 8 5 15c0 3 2 5 5 5 7 0 10-6 10-16z M5 20c3-4 6-7 11-10' },
  ice:      { nombre: 'Hielo',      color: '#65aeb3', efecto: 'proyectil', icono: 'M12 3v18 M4 7l16 10 M4 17 20 7 M9 5l3 3 3-3 M9 19l3-3 3 3' },
  fighting: { nombre: 'Lucha',      color: '#b75f50', efecto: 'contacto', icono: 'M7 11V6a2 2 0 0 1 4 0v4 M11 10V5a2 2 0 0 1 4 0v5 M15 10V7a2 2 0 0 1 4 0v7c0 4-2 6-6 6H9c-2 0-4-2-4-4v-3a2 2 0 0 1 4 0' },
  poison:   { nombre: 'Veneno',     color: '#9162a2', efecto: 'proyectil', icono: 'M8 13a6 6 0 1 1 8 0l1 2v3h-3v2h-4v-2H7v-3z M9 10h.1 M15 10h.1' },
  ground:   { nombre: 'Tierra',     color: '#ae8555', efecto: 'terremoto', icono: 'M3 18 9 7l3 5 3-6 6 12z M6 21h12' },
  flying:   { nombre: 'Volador',    color: '#8095bd', efecto: 'rafaga', icono: 'M3 7c4 0 7 2 9 5 2-3 5-5 9-5-1 5-4 8-9 9-5-1-8-4-9-9z M12 12v8' },
  psychic:  { nombre: 'Psíquico',   color: '#ce7191', efecto: 'onda', icono: 'M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6' },
  bug:      { nombre: 'Bicho',      color: '#8da54c', efecto: 'rafaga', icono: 'M12 8c-3 0-5 2-5 6s2 6 5 6 5-2 5-6-2-6-5-6z M9 8 7 4 M15 8l2-4 M7 12H4 M20 12h-3 M7 16H4 M20 16h-3 M12 9v10' },
  rock:     { nombre: 'Roca',       color: '#9f8b60', efecto: 'caida', icono: 'M5 8 10 4h6l4 5-2 9-7 3-7-4z M5 8l7 3 8-2 M12 11l-1 10' },
  ghost:    { nombre: 'Fantasma',   color: '#766591', efecto: 'proyectil', icono: 'M5 20V11a7 7 0 0 1 14 0v9l-3-2-4 2-4-2z M9 11h.1 M15 11h.1' },
  dragon:   { nombre: 'Dragón',     color: '#626faf', efecto: 'chorro', icono: 'M5 19 8 5l4 4 4-4 3 14-4-3-3 4-3-4z M9 12h.1 M15 12h.1' },
  dark:     { nombre: 'Siniestro',  color: '#626574', efecto: 'onda', icono: 'M16 3a8 8 0 1 0 5 13A8 8 0 0 1 16 3z' },
  steel:    { nombre: 'Acero',      color: '#788f99', efecto: 'contacto', icono: 'M8 3h8l5 9-5 9H8l-5-9z M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8' },
  fairy:    { nombre: 'Hada',       color: '#cb83a8', efecto: 'rafaga', icono: 'M12 3c1 5 3 7 8 9-5 1-7 3-8 9-1-6-3-8-8-9 5-2 7-4 8-9z' },
};

/**
 * Tabla de tipos (a partir de la 6.ª generación): multiplicador de daño de cada tipo de ATAQUE
 * contra cada tipo de DEFENSA. Solo se anotan los que no son ×1.
 * La ficha calcula su efectividad con los datos de PokéAPI; esta tabla se usa en «Categorías».
 */
export const TABLA_TIPOS = {
  normal:   { rock: 0.5, steel: 0.5, ghost: 0 },
  fire:     { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water:    { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  grass:    { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
  ice:      { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison:   { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground:   { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying:   { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug:      { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost:    { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel:    { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy:    { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

/**
 * La rueda de los tipos (vista «Categorías»): un lema propio para cada tipo (lo que dice está sacado de TABLA_TIPOS)
 * y cuatro Pokémon muy conocidos que lo tienen, [número, nombre], para verlos animados en su ficha.
 */
export const PERFILES_TIPOS = {
  normal:   { lema: 'Los que se adaptan a todo. No destacan en nada en particular… y por eso están en todas partes.',
              representantes: [[133, 'Eevee'], [143, 'Snorlax'], [52, 'Meowth'], [137, 'Porygon']] },
  fire:     { lema: 'Una pasión que no se apaga: derrite el hielo y el acero y arrasa la hierba, pero el agua y la roca lo sofocan.',
              representantes: [[4, 'Charmander'], [37, 'Vulpix'], [155, 'Cyndaquil'], [59, 'Arcanine']] },
  water:    { lema: 'Ríos, mares y lluvia. Apaga el fuego y erosiona la roca; solo la hierba y el rayo le plantan cara.',
              representantes: [[7, 'Squirtle'], [54, 'Psyduck'], [393, 'Piplup'], [130, 'Gyarados']] },
  electric: { lema: 'Velocidad y chispa. Ningún volador escapa de un rayo, pero la tierra se lo traga sin inmutarse.',
              representantes: [[25, 'Pikachu'], [135, 'Jolteon'], [179, 'Mareep'], [405, 'Luxray']] },
  grass:    { lema: 'Raíces pacientes que beben del sol y del agua. Vencen a la tierra y a la roca; el fuego es su gran miedo.',
              representantes: [[1, 'Bulbasaur'], [152, 'Chikorita'], [43, 'Oddish'], [470, 'Leafeon']] },
  ice:      { lema: 'Belleza frágil y ataques temibles: congela dragones y voladores, aunque solo resiste su propio frío.',
              representantes: [[131, 'Lapras'], [471, 'Glaceon'], [361, 'Snorunt'], [363, 'Spheal']] },
  fighting: { lema: 'Disciplina y puños. Rompe la roca, el hielo y el acero, pero nada puede contra lo que no se ve.',
              representantes: [[66, 'Machop'], [448, 'Lucario'], [106, 'Hitmonlee'], [447, 'Riolu']] },
  poison:   { lema: 'Toxinas, gases y lodo. Marchita la hierba y es de los pocos que se atreven con las hadas.',
              representantes: [[23, 'Ekans'], [109, 'Koffing'], [88, 'Grimer'], [34, 'Nidoking']] },
  ground:   { lema: 'Terremotos y arena. Ninguna descarga le hace efecto, y derriba al fuego, a la roca y al acero.',
              representantes: [[50, 'Diglett'], [104, 'Cubone'], [27, 'Sandshrew'], [445, 'Garchomp']] },
  flying:   { lema: 'Dueños del viento. Los terremotos no los alcanzan, pero temen al rayo, al hielo y a la roca.',
              representantes: [[16, 'Pidgey'], [821, 'Rookidee'], [714, 'Noibat'], [641, 'Tornadus']] },
  psychic:  { lema: 'La mente por encima del músculo. Doblega a la lucha y al veneno, pero teme a lo que acecha en la oscuridad.',
              representantes: [[63, 'Abra'], [196, 'Espeon'], [280, 'Ralts'], [150, 'Mewtwo']] },
  bug:      { lema: 'Pequeños, numerosos y sorprendentes. Plaga de plantas, psíquicos y siniestros; el fuego los dispersa.',
              representantes: [[10, 'Caterpie'], [123, 'Scyther'], [214, 'Heracross'], [637, 'Volcarona']] },
  rock:     { lema: 'Duros como la montaña. Derriban al fuego y a los voladores, pero el agua y la hierba los desgastan.',
              representantes: [[74, 'Geodude'], [95, 'Onix'], [744, 'Rockruff'], [248, 'Tyranitar']] },
  ghost:    { lema: 'Lo que no se puede tocar: los golpes normales y de lucha lo atraviesan. Solo otro fantasma o la oscuridad lo alcanzan.',
              representantes: [[92, 'Gastly'], [94, 'Gengar'], [425, 'Drifloon'], [778, 'Mimikyu']] },
  dragon:   { lema: 'Criaturas de leyenda. Solo un dragón vence de verdad a otro dragón… y el hielo y las hadas les bajan los humos.',
              representantes: [[147, 'Dratini'], [149, 'Dragonite'], [371, 'Bagon'], [443, 'Gible']] },
  dark:     { lema: 'Juego sucio y sombras. Lo psíquico no le hace mella, pero la lucha, los bichos y las hadas lo descubren.',
              representantes: [[197, 'Umbreon'], [359, 'Absol'], [215, 'Sneasel'], [570, 'Zorua']] },
  steel:    { lema: 'Una armadura casi perfecta: resiste diez tipos y el veneno ni le roza. Solo el fuego, la tierra y la lucha lo doblan.',
              representantes: [[81, 'Magnemite'], [304, 'Aron'], [599, 'Klink'], [376, 'Metagross']] },
  fairy:    { lema: 'Encanto con colmillos. Los dragones no pueden tocarla; el veneno y el acero son su punto débil.',
              representantes: [[35, 'Clefairy'], [175, 'Togepi'], [669, 'Flabébé'], [700, 'Sylveon']] },
};

/** Color de respaldo si PokéAPI devuelve un tipo que no está en la lista. */
export const COLOR_POR_DEFECTO = '#5f9b60';

export const NOMBRES_ESTADISTICAS = {
  hp: 'Salud',
  attack: 'Ataque',
  defense: 'Defensa',
  'special-attack': 'Ataque especial',
  'special-defense': 'Defensa especial',
  speed: 'Velocidad',
};

/**
 * Momentos del día del Inicio, como el ciclo de día y noche de los juegos: según la hora local cambian el título,
 * el relato, el color del cielo (la luz del fondo y la palabra en cursiva) y los Pokémon que rotan en el altar.
 *   desde:  hora en que empieza (0–23); dura hasta el «desde» del siguiente. cuando: para «Así es el mundo …».
 *   icono:  trazo SVG (24×24) del botón para verlo en otro momento.
 *   relato: {0}, {1} y {2} son los tres primeros protagonistas (se pueden pulsar para abrir su ficha).
 *   protagonistas: [id, nombre, tipos, { numero, forma }?]. El id puede ser de una forma (Lycanroc nocturno es
 *   el 10126 en PokéAPI); entonces «numero» es el de su especie en la Pokédex y «forma» se muestra en la tarjeta.
 * Los detalles son de los juegos y la Pokédex: Espeon evoluciona de día y Umbreon de noche, Lycanroc cambia de forma
 * según la hora, Rowlet y Noctowl son nocturnos, Sunflora sigue al sol, los Clefairy bailan con luna llena.
 */
export const MOMENTOS_DEL_DIA = [
  { clave: 'madrugada', desde: 0, nombre: 'Madrugada', cuando: 'de madrugada', cielo: '#6a5fd6',
    icono: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z M18 2v4 M16 4h4',
    titulo: ['Mientras duermes,', 'ellos despiertan.'],
    relato: 'A estas horas no queda nadie en el camino… salvo {0}, {1} y {2}. Dicen que Darkrai trae pesadillas a quien duerme cerca de él.',
    protagonistas: [[491, 'Darkrai', ['dark']], [429, 'Mismagius', ['ghost']], [792, 'Lunala', ['psychic', 'ghost']],
      [94, 'Gengar', ['ghost', 'poison']], [302, 'Sableye', ['dark', 'ghost']], [10126, 'Lycanroc', ['rock'], { numero: 745, forma: 'Forma nocturna' }],
      [571, 'Zoroark', ['dark']]] },
  { clave: 'manana', desde: 6, nombre: 'Mañana', cuando: 'por la mañana', cielo: '#e8c873',
    icono: 'M17 18a5 5 0 0 0-10 0 M12 2v7 M4.2 10.2l1.4 1.4 M1 18h2 M21 18h2 M18.4 11.6l1.4-1.4 M23 22H1 M8 6l4-4 4 4',
    titulo: ['Amanece sobre', 'la hierba alta.'],
    relato: 'Con la primera luz despiertan {0}, {1} y {2}. Si un Eevee muy amigo tuyo evoluciona ahora, de día, será un Espeon.',
    protagonistas: [[192, 'Sunflora', ['grass']], [12, 'Butterfree', ['bug', 'flying']], [196, 'Espeon', ['psychic']],
      [745, 'Lycanroc', ['rock'], { forma: 'Forma diurna' }], [468, 'Togekiss', ['fairy', 'flying']], [1, 'Bulbasaur', ['grass', 'poison']],
      [25, 'Pikachu', ['electric']], [133, 'Eevee', ['normal']]] },
  { clave: 'tarde', desde: 12, nombre: 'Tarde', cuando: 'por la tarde', cielo: '#f2a54a',
    icono: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
    titulo: ['Las arenas', 'arden al sol.'],
    relato: '{0}, {1} y {2} buscan rival. Bajo un sol intenso, los ataques de tipo fuego pegan más fuerte y los de agua pierden fuerza.',
    protagonistas: [[448, 'Lucario', ['fighting', 'steel']], [445, 'Garchomp', ['dragon', 'ground']], [6, 'Charizard', ['fire', 'flying']],
      [257, 'Blaziken', ['fire', 'fighting']], [658, 'Greninja', ['water', 'dark']], [791, 'Solgaleo', ['psychic', 'steel']],
      [149, 'Dragonite', ['dragon', 'flying']], [25, 'Pikachu', ['electric']]] },
  { clave: 'atardecer', desde: 18, nombre: 'Atardecer', cuando: 'al atardecer', cielo: '#e8643c',
    icono: 'M17 18a5 5 0 0 0-10 0 M12 9V2 M4.2 10.2l1.4 1.4 M1 18h2 M21 18h2 M18.4 11.6l1.4-1.4 M23 22H1 M16 5l-4 4-4-4',
    titulo: ['El cielo', 'se tiñe de fuego.'],
    relato: 'Al caer el sol cambian los encuentros: {0} adopta su forma crepuscular, y {1} y {2} salen a cazar.',
    protagonistas: [[10152, 'Lycanroc', ['rock'], { numero: 745, forma: 'Forma crepuscular' }], [229, 'Houndoom', ['dark', 'fire']],
      [198, 'Murkrow', ['dark', 'flying']], [38, 'Ninetales', ['fire']], [571, 'Zoroark', ['dark']], [4, 'Charmander', ['fire']],
      [133, 'Eevee', ['normal']]] },
  { clave: 'noche', desde: 21, nombre: 'Noche', cuando: 'de noche', cielo: '#4a7ae0',
    icono: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    titulo: ['Cae la noche', 'y algo se mueve…'],
    relato: 'Es la hora de {0}, {1} y {2}. Cuentan que, bajo la luna llena, los Clefairy salen a bailar.',
    protagonistas: [[197, 'Umbreon', ['dark']], [94, 'Gengar', ['ghost', 'poison']], [164, 'Noctowl', ['normal', 'flying']],
      [35, 'Clefairy', ['fairy']], [359, 'Absol', ['dark']], [10126, 'Lycanroc', ['rock'], { numero: 745, forma: 'Forma nocturna' }],
      [722, 'Rowlet', ['grass', 'flying']], [151, 'Mew', ['psychic']]] },
];

/** El momento del día que toca a una hora (0–23). */
export const momentoDeHora = hora => MOMENTOS_DEL_DIA.findLast(momento => hora >= momento.desde);

/** Accesos rápidos bajo el buscador de la portada: [número, nombre]. */
export const SUGERENCIAS = [[25, 'Pikachu'], [6, 'Charizard'], [150, 'Mewtwo'], [445, 'Garchomp']];

/** Especies en la Pokédex nacional (el catálogo actualiza la cifra con el dato real de PokéAPI). */
export const TOTAL_ESPECIES = 1025;

/** Generaciones: número romano, región, rango de la Pokédex nacional y sus tres iniciales. */
export const GENERACIONES = [
  { numero: 'I', region: 'Kanto', desde: 1, hasta: 151, iniciales: [1, 4, 7] },
  { numero: 'II', region: 'Johto', desde: 152, hasta: 251, iniciales: [152, 155, 158] },
  { numero: 'III', region: 'Hoenn', desde: 252, hasta: 386, iniciales: [252, 255, 258] },
  { numero: 'IV', region: 'Sinnoh', desde: 387, hasta: 493, iniciales: [387, 390, 393] },
  { numero: 'V', region: 'Teselia', desde: 494, hasta: 649, iniciales: [495, 498, 501] },
  { numero: 'VI', region: 'Kalos', desde: 650, hasta: 721, iniciales: [650, 653, 656] },
  { numero: 'VII', region: 'Alola', desde: 722, hasta: 809, iniciales: [722, 725, 728] },
  { numero: 'VIII', region: 'Galar', desde: 810, hasta: 905, iniciales: [810, 813, 816] },
  { numero: 'IX', region: 'Paldea', desde: 906, hasta: 1025, iniciales: [906, 909, 912] },
];

/**
 * Las 71 especies legendarias hasta la novena generación (los singulares van en el catálogo general).
 * tipos, poder (suma de estadísticas base) y especie vienen de PokéAPI; la generación se deduce del
 * número con GENERACIONES. «grupo» es el linaje o grupo de la historia al que pertenece (nombres descriptivos).
 * PokéAPI no tiene la especie en español de las leyendas de la 9.ª generación ni de Enamorus: esas las traducimos aquí.
 */
export const LEGENDARIOS = [
  { id: 144, nombre: 'Articuno', tipos: ['ice', 'flying'], poder: 580, especie: 'Pokémon Congelar', grupo: 'Aves legendarias' },
  { id: 145, nombre: 'Zapdos', tipos: ['electric', 'flying'], poder: 580, especie: 'Pokémon Eléctrico', grupo: 'Aves legendarias' },
  { id: 146, nombre: 'Moltres', tipos: ['fire', 'flying'], poder: 580, especie: 'Pokémon Llama', grupo: 'Aves legendarias' },
  { id: 150, nombre: 'Mewtwo', tipos: ['psychic'], poder: 680, especie: 'Pokémon Genético', grupo: 'Leyenda genética' },
  { id: 243, nombre: 'Raikou', tipos: ['electric'], poder: 580, especie: 'Pokémon Trueno', grupo: 'Bestias legendarias' },
  { id: 244, nombre: 'Entei', tipos: ['fire'], poder: 580, especie: 'Pokémon Volcán', grupo: 'Bestias legendarias' },
  { id: 245, nombre: 'Suicune', tipos: ['water'], poder: 580, especie: 'Pokémon Aurora', grupo: 'Bestias legendarias' },
  { id: 249, nombre: 'Lugia', tipos: ['psychic', 'flying'], poder: 680, especie: 'Pokémon Buceo', grupo: 'Guardianes de las torres' },
  { id: 250, nombre: 'Ho-Oh', tipos: ['fire', 'flying'], poder: 680, especie: 'Pokémon Arcoíris', grupo: 'Guardianes de las torres' },
  { id: 377, nombre: 'Regirock', tipos: ['rock'], poder: 580, especie: 'Pokémon Pico Roca', grupo: 'Gólems legendarios' },
  { id: 378, nombre: 'Regice', tipos: ['ice'], poder: 580, especie: 'Pokémon Iceberg', grupo: 'Gólems legendarios' },
  { id: 379, nombre: 'Registeel', tipos: ['steel'], poder: 580, especie: 'Pokémon Hierro', grupo: 'Gólems legendarios' },
  { id: 380, nombre: 'Latias', tipos: ['dragon', 'psychic'], poder: 600, especie: 'Pokémon Eón', grupo: 'Dúo eón' },
  { id: 381, nombre: 'Latios', tipos: ['dragon', 'psychic'], poder: 600, especie: 'Pokémon Eón', grupo: 'Dúo eón' },
  { id: 382, nombre: 'Kyogre', tipos: ['water'], poder: 670, especie: 'Pokémon Cuenca Mar', grupo: 'Trío del clima' },
  { id: 383, nombre: 'Groudon', tipos: ['ground'], poder: 670, especie: 'Pokémon Continente', grupo: 'Trío del clima' },
  { id: 384, nombre: 'Rayquaza', tipos: ['dragon', 'flying'], poder: 680, especie: 'Pokémon Cielo', grupo: 'Trío del clima' },
  { id: 480, nombre: 'Uxie', tipos: ['psychic'], poder: 580, especie: 'Pokémon Sabiduría', grupo: 'Trío del lago' },
  { id: 481, nombre: 'Mesprit', tipos: ['psychic'], poder: 580, especie: 'Pokémon Sensorio', grupo: 'Trío del lago' },
  { id: 482, nombre: 'Azelf', tipos: ['psychic'], poder: 580, especie: 'Pokémon Voluntad', grupo: 'Trío del lago' },
  { id: 483, nombre: 'Dialga', tipos: ['steel', 'dragon'], poder: 680, especie: 'Pokémon Temporal', grupo: 'Trío de la creación' },
  { id: 484, nombre: 'Palkia', tipos: ['water', 'dragon'], poder: 680, especie: 'Pokémon Espacial', grupo: 'Trío de la creación' },
  { id: 485, nombre: 'Heatran', tipos: ['fire', 'steel'], poder: 600, especie: 'Pokémon Domo Lava', grupo: 'Señor del volcán' },
  { id: 486, nombre: 'Regigigas', tipos: ['normal'], poder: 670, especie: 'Pokémon Colosal', grupo: 'Gólems legendarios' },
  { id: 487, nombre: 'Giratina', tipos: ['ghost', 'dragon'], poder: 680, especie: 'Pokémon Renegado', grupo: 'Trío de la creación' },
  { id: 488, nombre: 'Cresselia', tipos: ['psychic'], poder: 580, especie: 'Pokémon Lunar', grupo: 'Guardiana de los sueños' },
  { id: 638, nombre: 'Cobalion', tipos: ['steel', 'fighting'], poder: 580, especie: 'Pokémon Tesón Acero', grupo: 'Espadas de la justicia' },
  { id: 639, nombre: 'Terrakion', tipos: ['rock', 'fighting'], poder: 580, especie: 'Pokémon Gruta', grupo: 'Espadas de la justicia' },
  { id: 640, nombre: 'Virizion', tipos: ['grass', 'fighting'], poder: 580, especie: 'Pokémon Prado', grupo: 'Espadas de la justicia' },
  { id: 641, nombre: 'Tornadus', tipos: ['flying'], poder: 580, especie: 'Pokémon Torbellino', grupo: 'Fuerzas de la naturaleza' },
  { id: 642, nombre: 'Thundurus', tipos: ['electric', 'flying'], poder: 580, especie: 'Pokémon Centella', grupo: 'Fuerzas de la naturaleza' },
  { id: 643, nombre: 'Reshiram', tipos: ['dragon', 'fire'], poder: 680, especie: 'Pokémon Blanco Veraz', grupo: 'Dragones del Tao' },
  { id: 644, nombre: 'Zekrom', tipos: ['dragon', 'electric'], poder: 680, especie: 'Pokémon Negro Puro', grupo: 'Dragones del Tao' },
  { id: 645, nombre: 'Landorus', tipos: ['ground', 'flying'], poder: 600, especie: 'Pokémon Fertilidad', grupo: 'Fuerzas de la naturaleza' },
  { id: 646, nombre: 'Kyurem', tipos: ['dragon', 'ice'], poder: 660, especie: 'Pokémon Frontera', grupo: 'Dragones del Tao' },
  { id: 716, nombre: 'Xerneas', tipos: ['fairy'], poder: 680, especie: 'Pokémon Creación', grupo: 'Trío del equilibrio' },
  { id: 717, nombre: 'Yveltal', tipos: ['dark', 'flying'], poder: 680, especie: 'Pokémon Destrucción', grupo: 'Trío del equilibrio' },
  { id: 718, nombre: 'Zygarde', tipos: ['dragon', 'ground'], poder: 600, especie: 'Pokémon Equilibrio', grupo: 'Trío del equilibrio' },
  { id: 772, nombre: 'Type: Null', tipos: ['normal'], poder: 534, especie: 'Pokémon Multigénico', grupo: 'Quimera artificial' },
  { id: 773, nombre: 'Silvally', tipos: ['normal'], poder: 570, especie: 'Pokémon Multigénico', grupo: 'Quimera artificial' },
  { id: 785, nombre: 'Tapu Koko', tipos: ['electric', 'fairy'], poder: 570, especie: 'Pokémon Dios Nativo', grupo: 'Guardianes de Alola' },
  { id: 786, nombre: 'Tapu Lele', tipos: ['psychic', 'fairy'], poder: 570, especie: 'Pokémon Dios Nativo', grupo: 'Guardianes de Alola' },
  { id: 787, nombre: 'Tapu Bulu', tipos: ['grass', 'fairy'], poder: 570, especie: 'Pokémon Dios Nativo', grupo: 'Guardianes de Alola' },
  { id: 788, nombre: 'Tapu Fini', tipos: ['water', 'fairy'], poder: 570, especie: 'Pokémon Dios Nativo', grupo: 'Guardianes de Alola' },
  { id: 789, nombre: 'Cosmog', tipos: ['psychic'], poder: 200, especie: 'Pokémon Nebulosa', grupo: 'Linaje del sol y la luna' },
  { id: 790, nombre: 'Cosmoem', tipos: ['psychic'], poder: 400, especie: 'Pokémon Protostrella', grupo: 'Linaje del sol y la luna' },
  { id: 791, nombre: 'Solgaleo', tipos: ['psychic', 'steel'], poder: 680, especie: 'Pokémon Corona Solar', grupo: 'Linaje del sol y la luna' },
  { id: 792, nombre: 'Lunala', tipos: ['psychic', 'ghost'], poder: 680, especie: 'Pokémon Corona Lunar', grupo: 'Linaje del sol y la luna' },
  { id: 800, nombre: 'Necrozma', tipos: ['psychic'], poder: 600, especie: 'Pokémon Prisma', grupo: 'Prisma de luz' },
  { id: 888, nombre: 'Zacian', tipos: ['fairy'], poder: 660, especie: 'Pokémon Guerrero', grupo: 'Héroes de Galar' },
  { id: 889, nombre: 'Zamazenta', tipos: ['fighting'], poder: 660, especie: 'Pokémon Guerrero', grupo: 'Héroes de Galar' },
  { id: 890, nombre: 'Eternatus', tipos: ['poison', 'dragon'], poder: 690, especie: 'Pokémon Gigantesco', grupo: 'Noche Oscura' },
  { id: 891, nombre: 'Kubfu', tipos: ['fighting'], poder: 385, especie: 'Pokémon Kung-fu', grupo: 'Maestro del puño' },
  { id: 892, nombre: 'Urshifu', tipos: ['fighting', 'dark'], poder: 550, especie: 'Pokémon Kung-fu', grupo: 'Maestro del puño' },
  { id: 894, nombre: 'Regieleki', tipos: ['electric'], poder: 580, especie: 'Pokémon Electrón', grupo: 'Gólems legendarios' },
  { id: 895, nombre: 'Regidrago', tipos: ['dragon'], poder: 580, especie: 'Pokémon Dragosfera', grupo: 'Gólems legendarios' },
  { id: 896, nombre: 'Glastrier', tipos: ['ice'], poder: 580, especie: 'Pokémon Corcel Feroz', grupo: 'Rey y corceles' },
  { id: 897, nombre: 'Spectrier', tipos: ['ghost'], poder: 580, especie: 'Pokémon Corcel Veloz', grupo: 'Rey y corceles' },
  { id: 898, nombre: 'Calyrex', tipos: ['psychic', 'grass'], poder: 500, especie: 'Pokémon Rey', grupo: 'Rey y corceles' },
  { id: 905, nombre: 'Enamorus', tipos: ['fairy', 'flying'], poder: 580, especie: 'Pokémon Amor-Odio', grupo: 'Fuerzas de la naturaleza' },
  { id: 1001, nombre: 'Wo-Chien', tipos: ['dark', 'grass'], poder: 570, especie: 'Pokémon Funesto', grupo: 'Tesoros funestos' },
  { id: 1002, nombre: 'Chien-Pao', tipos: ['dark', 'ice'], poder: 570, especie: 'Pokémon Funesto', grupo: 'Tesoros funestos' },
  { id: 1003, nombre: 'Ting-Lu', tipos: ['dark', 'ground'], poder: 570, especie: 'Pokémon Funesto', grupo: 'Tesoros funestos' },
  { id: 1004, nombre: 'Chi-Yu', tipos: ['dark', 'fire'], poder: 570, especie: 'Pokémon Funesto', grupo: 'Tesoros funestos' },
  { id: 1007, nombre: 'Koraidon', tipos: ['fighting', 'dragon'], poder: 670, especie: 'Pokémon Paradoja', grupo: 'Leyendas paradoja' },
  { id: 1008, nombre: 'Miraidon', tipos: ['electric', 'dragon'], poder: 670, especie: 'Pokémon Paradoja', grupo: 'Leyendas paradoja' },
  { id: 1014, nombre: 'Okidogi', tipos: ['poison', 'fighting'], poder: 555, especie: 'Pokémon Vasallo', grupo: 'Trío leal' },
  { id: 1015, nombre: 'Munkidori', tipos: ['poison', 'psychic'], poder: 555, especie: 'Pokémon Vasallo', grupo: 'Trío leal' },
  { id: 1016, nombre: 'Fezandipiti', tipos: ['poison', 'fairy'], poder: 555, especie: 'Pokémon Vasallo', grupo: 'Trío leal' },
  { id: 1017, nombre: 'Ogerpon', tipos: ['grass'], poder: 550, especie: 'Pokémon Máscara', grupo: 'Guardiana de las máscaras' },
  { id: 1024, nombre: 'Terapagos', tipos: ['normal'], poder: 450, especie: 'Pokémon Tera', grupo: 'Corazón teracristal' },
];

/**
 * Los 23 Pokémon singulares (míticos) hasta la novena generación. Comprobado con PokéAPI (is_mythical)
 * en las 1025 especies: no falta ninguno.
 */
// Gritos con VOZ. En los juegos casi todos los Pokémon «rugen» (un sonido electrónico); solo Pikachu y Eevee hablan,
// con las voces del anime («¡Pikachu!», «¡Vui!»), desde Pokémon: Let's Go. PokéAPI guarda esas voces como el grito de
// sus formas «compañero» (pikachu-starter y eevee-starter). Especie → número del Pokémon cuyo grito se usa
// (utilidades.js → urlGrito y gritoDe). Comprobado: el de 25 es ruido sin tono; el de 10158, sílabas con tono de voz.
export const GRITOS_CON_VOZ = { 25: 10158, 133: 10159 };

// Las 14 especies sin GIF animado de Showdown en PokéAPI (casi todas, los Paradoja «Ferro-»): urlAnimado (utilidades.js)
// da su sprite fijo en vez de pedir un archivo que no existe (la petición fallida salía como error en la consola).
export const SIN_GIF_SHOWDOWN = new Set([990, 991, 992, 993, 994, 995, 1006, 1008, 1010, 1017, 1022, 1023, 1024, 1025]);

export const SINGULARES = [151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721, 801, 802, 807, 808, 809, 893, 1025];

const ID_LEGENDARIOS = new Set(LEGENDARIOS.map(leyenda => leyenda.id));
const ID_SINGULARES = new Set(SINGULARES);

/** 'legendario', 'singular' o null. Sirve para que destaquen en la Pokédex y en su ficha. */
export const rarezaDe = id => (ID_LEGENDARIOS.has(Number(id)) ? 'legendario' : ID_SINGULARES.has(Number(id)) ? 'singular' : null);

/**
 * Niveles del simulacro de combate (las reglas y la estrategia del rival están en combate.js).
 * - factorPoder: poder del rival (suma de estadísticas) frente a la media de tu equipo (1,1 = un 10 % más).
 * - factorDuelo: lo mismo en el uno contra uno (frente al poder de tu luchador). Es más bajo porque tu
 *                luchador está elegido de antemano: no puedes responder al rival con otro.
 * Medidos con miles de combates simulados con los 4 movimientos reales (ver CLAUDE.md).
 * - leyendas:    si el rival puede llevar legendarios y singulares.
 * - ayudas:      si los botones de ataque muestran el multiplicador de tipo (×2, ×½…).
 * - color:       el de su medalla en la configuración del Duelo.
 */
export const NIVELES_SIMULACRO = {
  novato: { nombre: 'Novato', estrellas: 1, color: '#3fae5a', factorPoder: 0.9, factorDuelo: 0.88, leyendas: false, ayudas: true,
    descripcion: 'Un rival algo más débil que ataca sin mucha estrategia. Ideal para aprender las reglas.' },
  retador: { nombre: 'Retador', estrellas: 2, color: '#2f63d8', factorPoder: 1.0, factorDuelo: 0.97, leyendas: false, ayudas: true,
    descripcion: 'Un rival de tu nivel: busca la ventaja de tipo, remata cuando puede y cambia cuando le conviene.' },
  maestro: { nombre: 'Maestro', estrellas: 3, color: '#e8483a', factorPoder: 1.08, factorDuelo: 1.05, leyendas: true, ayudas: false,
    descripcion: 'Más fuerte, armado para contrarrestar tu equipo y sin ayudas: tendrás que saberte la tabla de tipos.' },
};

/**
 * Modos de «¿Quién es ese Pokémon?» (quien.js).
 * - tiempo:   segundos por pregunta (0 = sin límite).
 * - opciones: nombres entre los que elegir (0 = escribirlo).
 * - titulo:   la pregunta del panel [texto, palabra en cursiva].
 * - marcador y premio: lo que enseña su tarjeta en los ajustes.
 */
export const MODOS_QUIEN = {
  clasico: { nombre: 'Clásico', descripcion: 'Cuatro nombres y todo el tiempo del mundo para pensarlo.', tiempo: 0, opciones: 4,
    titulo: ['¿Quién se esconde ', 'tras la sombra?'], marcador: '4', premio: '10 puntos por acierto' },
  contrarreloj: { nombre: 'Contrarreloj', descripcion: 'Diez segundos por sombra: cuanto antes respondas, más puntos.', tiempo: 10, opciones: 4,
    titulo: ['¡Rápido! ', '¿Quién es?'], marcador: '10 s', premio: '+1 por cada segundo que te sobre' },
  experto: { nombre: 'Experto', descripcion: 'Sin opciones: escribe su nombre, en español o en inglés.', tiempo: 0, opciones: 0,
    titulo: ['Escribe ', 'su nombre.'], marcador: 'Aa', premio: '+5 por acierto' },
};

/** Pistas de «¿Quién es?»: cada una resta puntos (quien.js). icono: trazo SVG (viewBox 24×24). */
export const PISTAS_QUIEN = [
  { clave: 'tipo', nombre: 'Tipo', icono: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 3v18 M4 7.5l16 9 M20 7.5l-16 9' },
  { clave: 'region', nombre: 'Región', icono: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 8a2 2 0 1 0 0 4a2 2 0 1 0 0-4' },
  { clave: 'categoria', nombre: 'Categoría', icono: 'M4 4h7l9 9-7 7-9-9z M8 8h.01' },
  { clave: 'grito', nombre: 'Grito', icono: 'M11 5 6 9H2v6h4l5 4z M15.5 8.5a5 5 0 0 1 0 7 M19 5a10 10 0 0 1 0 14' },
];

/** El color de cada especie en PokéAPI (pokemon-species → color). En «¿Quién es?» es la pista de las
 *  127 especies (de la 899 a la 1025) cuya categoría aún no está en español. */
export const COLORES_ESPECIE = {
  black: 'Negro', blue: 'Azul', brown: 'Marrón', gray: 'Gris', green: 'Verde',
  pink: 'Rosa', purple: 'Morado', red: 'Rojo', white: 'Blanco', yellow: 'Amarillo',
};

/**
 * Nombres en español que no se escriben como su clave de PokéAPI con mayúsculas (signos, puntos, guiones) o que
 * cambian en español (Código Cero y los Pokémon Paradoja). Sacados de PokéAPI (pokemon-species → names, 'es'):
 * son los 38 de las 1025 especies. Por clave de especie. Los usa nombreTitulo() (utilidades.js); los nombres de
 * las FORMAS (Giratina Origen, megaevoluciones…) están en datos-formas.js.
 */
export const NOMBRES_ESPANOL = {
  'nidoran-f': 'Nidoran♀', 'nidoran-m': 'Nidoran♂', farfetchd: 'Farfetch’d', 'mr-mime': 'Mr. Mime', 'ho-oh': 'Ho-Oh',
  'mime-jr': 'Mime Jr.', 'porygon-z': 'Porygon-Z', flabebe: 'Flabébé', 'type-null': 'Código Cero', 'jangmo-o': 'Jangmo-o',
  'hakamo-o': 'Hakamo-o', 'kommo-o': 'Kommo-o', sirfetchd: 'Sirfetch’d', 'mr-rime': 'Mr. Rime',
  'great-tusk': 'Colmilargo', 'scream-tail': 'Colagrito', 'brute-bonnet': 'Furioseta', 'flutter-mane': 'Melenaleteo',
  'slither-wing': 'Reptalada', 'sandy-shocks': 'Pelarena', 'iron-treads': 'Ferrodada', 'iron-bundle': 'Ferrosaco',
  'iron-hands': 'Ferropalmas', 'iron-jugulis': 'Ferrocuello', 'iron-moth': 'Ferropolilla', 'iron-thorns': 'Ferropúas',
  'wo-chien': 'Wo-Chien', 'chien-pao': 'Chien-Pao', 'ting-lu': 'Ting-Lu', 'chi-yu': 'Chi-Yu', 'roaring-moon': 'Bramaluna',
  'iron-valiant': 'Ferropaladín', 'walking-wake': 'Ondulagua', 'iron-leaves': 'Ferroverdor', 'gouging-fire': 'Flamariete',
  'raging-bolt': 'Electrofuria', 'iron-boulder': 'Ferromole', 'iron-crown': 'Ferrotesta',
};

/**
 * Modos de la batalla. lista: qué Pokémon tuyos combaten (mi-equipo.js): tu equipo de hasta 6 o tu
 * luchador (uno solo). vida: multiplicador de los PV de todos.
 */
export const MODOS_BATALLA = {
  equipo: { nombre: 'Equipo contra equipo', descripcion: 'Hasta seis contra seis, con cambios.', lista: 'equipo' },
  duelo: { nombre: 'Uno contra uno', descripcion: 'Tu luchador contra un rival a su altura. Doble de vida y sin cambios.', lista: 'luchador', vida: 2 },
};

/**
 * Movimientos de reserva (claves de PokéAPI, ver datos-movimientos.js) para los pocos Pokémon que casi no
 * aprenden movimientos de daño (Ditto, Wobbuffet, Unown…): uno físico y uno especial por tipo. Los demás
 * usan 4 de los que aprenden de verdad (combate.js → movimientosDe).
 */
export const MOVIMIENTOS_RESERVA = {
  normal:   { fisico: 'body-slam',    especial: 'hyper-voice' },
  fire:     { fisico: 'fire-punch',   especial: 'flamethrower' },
  water:    { fisico: 'aqua-tail',    especial: 'hydro-pump' },
  electric: { fisico: 'wild-charge',  especial: 'thunderbolt' },
  grass:    { fisico: 'leaf-blade',   especial: 'energy-ball' },
  ice:      { fisico: 'ice-punch',    especial: 'ice-beam' },
  fighting: { fisico: 'brick-break',  especial: 'aura-sphere' },
  poison:   { fisico: 'poison-jab',   especial: 'sludge-bomb' },
  ground:   { fisico: 'earthquake',   especial: 'earth-power' },
  flying:   { fisico: 'drill-peck',   especial: 'air-slash' },
  psychic:  { fisico: 'zen-headbutt', especial: 'psychic' },
  bug:      { fisico: 'x-scissor',    especial: 'bug-buzz' },
  rock:     { fisico: 'rock-slide',   especial: 'power-gem' },
  ghost:    { fisico: 'shadow-claw',  especial: 'shadow-ball' },
  dragon:   { fisico: 'dragon-claw',  especial: 'dragon-pulse' },
  dark:     { fisico: 'crunch',       especial: 'dark-pulse' },
  steel:    { fisico: 'iron-head',    especial: 'flash-cannon' },
  fairy:    { fisico: 'play-rough',   especial: 'moonblast' },
};

/**
 * Colores de los efectos de ataque en la arena pixelada (arena-pixel.js): [principal, claro, oscuro].
 * 'directo': colores neutros de reserva (el golpe del retroceso, o si a un ataque le faltara el tipo).
 */
export const PALETAS_ATAQUE = {
  directo: ['#f4f1e6', '#ffffff', '#a59f8a'], normal: ['#e6e3d6', '#ffffff', '#8a917e'],
  fire: ['#ff7a2e', '#ffd36a', '#c4321a'], water: ['#3fa0e6', '#c8ecff', '#1e5f9e'],
  electric: ['#ffd83a', '#fff8c8', '#c89200'], grass: ['#5fbf5a', '#cff59f', '#2f7a32'],
  ice: ['#8fe3ef', '#ffffff', '#3a9fb0'], fighting: ['#e9684f', '#ffc9b0', '#8a2f22'],
  poison: ['#a65fc7', '#e9bdff', '#5c2a78'], ground: ['#c4945a', '#f0d7a8', '#7a5528'],
  flying: ['#a9c2ee', '#ffffff', '#5f7cb8'], psychic: ['#f06a9c', '#ffcadf', '#a8285c'],
  bug: ['#9cc23a', '#e4f69e', '#5a7a14'], rock: ['#b49a66', '#e6d6ad', '#6e5a34'],
  ghost: ['#8a6ccf', '#dccbff', '#3d2a66'], dragon: ['#6e7cf0', '#cdd3ff', '#2f3aa0'],
  dark: ['#5a5270', '#b3a8cf', '#1d1826'], steel: ['#b8c8d2', '#ffffff', '#5f7380'],
  fairy: ['#f5a0cf', '#ffe3f2', '#c25a92'],
};

/**
 * Escenarios del Duelo Pokémon. El campo de cada uno se dibuja en pixel art con código (arena-pixel.js →
 * dibujarCampo); aquí solo están su nombre y su descripción.
 */
export const ESCENARIOS = {
  bosque: { nombre: 'Bosque antiguo', descripcion: 'Un claro entre troncos gigantes, con un arroyo, setas y luciérnagas.',
    climas: { despejado: 2, lluvia: 3, niebla: 2 } },
  volcan: { nombre: 'Cráter volcánico', descripcion: 'Ríos de lava, grietas que brillan y ascuas en el aire.',
    climas: { despejado: 2, sol: 3, arena: 1 } },
  playa: { nombre: 'Costa tropical', descripcion: 'Olas, un muelle, palmeras y una poza llena de estrellas de mar.',
    climas: { despejado: 2, sol: 3, lluvia: 2 } },
  cueva: { nombre: 'Cueva de cristal', descripcion: 'Cristales gigantes que lo tiñen todo de colores, junto a un lago oculto.',
    climas: { despejado: 3, niebla: 2 } },
  nieve: { nombre: 'Cumbre nevada', descripcion: 'Anochece en la montaña: aurora, pinos nevados y un estanque helado.',
    climas: { despejado: 2, granizo: 3, niebla: 1 } },
  ruinas: { nombre: 'Ruinas antiguas', descripcion: 'Un templo olvidado: antorchas, estatuas y un mosaico de runas.',
    climas: { despejado: 2, arena: 3, sol: 2 } },
};

/**
 * Clima del combate: se sortea al empezar según el escenario (pesos en ESCENARIOS[…].climas) y dura todo
 * el combate. potencia: multiplica el daño de los movimientos de esos tipos (combate.js). La arena dibuja
 * cada clima (arena-pixel.js) y simulacro.js lo anuncia.
 */
export const CLIMAS = {
  sol: { nombre: 'Sol radiante', icono: '☀', anuncio: '¡El sol pega con fuerza!', potencia: { fire: 1.3, water: 0.7 } },
  lluvia: { nombre: 'Lluvia', icono: '☂', anuncio: '¡Empieza a llover!', potencia: { water: 1.3, electric: 1.15, fire: 0.7 } },
  arena: { nombre: 'Tormenta de arena', icono: '≋', anuncio: '¡Se levanta una tormenta de arena!', potencia: { rock: 1.3, ground: 1.2 } },
  granizo: { nombre: 'Granizo', icono: '❄', anuncio: '¡Empieza a granizar!', potencia: { ice: 1.3 } },
  niebla: { nombre: 'Niebla', icono: '☁', anuncio: '¡Una niebla espesa cubre el campo!', potencia: { ghost: 1.25, dark: 1.25 } },
};

/**
 * Estados alterados (combate.js). Los provocan los movimientos que los tienen (con su probabilidad: Rayo
 * paraliza el 10 % de las veces, Escaldar quema el 30 %…; datos-movimientos.js), salvo a los Pokémon de los
 * tipos `inmunes`. quemado: pierde 1/16 de su vida al final de cada turno y sus golpes físicos hacen un 25 %
 * menos · envenenado: pierde 1/10 · paralizado: va a mitad de velocidad y a veces no puede moverse ·
 * congelado: no actúa hasta descongelarse (o recibir fuego) · dormido: no actúa durante 1–3 turnos (hoy
 * ningún movimiento de daño lo provoca).
 */
export const ESTADOS = {
  quemado:    { nombre: 'Quemado',    corto: 'QUE', color: '#e8743b', inmunes: ['fire'] },
  envenenado: { nombre: 'Envenenado', corto: 'ENV', color: '#a65fc7', inmunes: ['poison', 'steel'] },
  paralizado: { nombre: 'Paralizado', corto: 'PAR', color: '#d9b42a', inmunes: ['electric'] },
  congelado:  { nombre: 'Congelado',  corto: 'CON', color: '#6fc8dc', inmunes: ['ice'] },
  dormido:    { nombre: 'Dormido',    corto: 'DOR', color: '#8d97ad', inmunes: ['grass'] },
};

/**
 * Entrenadores rivales: nombre al azar y oficio según el tipo que más se repite en su equipo (forma
 * masculina y femenina). simulacro.js arma «la Montañera Lucía» y le pone frases (FRASES_RIVAL).
 */
export const ENTRENADORES = {
  nombres: [['Lucía', 'f'], ['Mateo', 'm'], ['Valentina', 'f'], ['Santiago', 'm'], ['Camila', 'f'], ['Sebastián', 'm'],
    ['Isabela', 'f'], ['Nicolás', 'm'], ['Mariana', 'f'], ['Andrés', 'm'], ['Daniela', 'f'], ['Tomás', 'm'],
    ['Sara', 'f'], ['Julián', 'm'], ['Gabriela', 'f'], ['Emilio', 'm'], ['Renata', 'f'], ['Joaquín', 'm']],
  oficios: {
    normal: ['Aficionado', 'Aficionada'], fire: ['Pirotécnico', 'Pirotécnica'], water: ['Nadador', 'Nadadora'],
    electric: ['Ingeniero', 'Ingeniera'], grass: ['Jardinero', 'Jardinera'], ice: ['Esquiador', 'Esquiadora'],
    fighting: ['Karateka', 'Karateka'], poison: ['Alquimista', 'Alquimista'], ground: ['Excavador', 'Excavadora'],
    flying: ['Piloto', 'Piloto'], psychic: ['Médium', 'Médium'], bug: ['Cazabichos', 'Cazabichos'],
    rock: ['Montañero', 'Montañera'], ghost: ['Exorcista', 'Exorcista'], dragon: ['Domador de dragones', 'Domadora de dragones'],
    dark: ['Pandillero', 'Pandillera'], steel: ['Herrero', 'Herrera'], fairy: ['Hechicero', 'Hechicera'],
  },
  /** Lo que se antepone al oficio según la dificultad («Gran Montañera Lucía»). */
  rango: { novato: ['Joven', 'Joven'], retador: ['', ''], maestro: ['Gran', 'Gran'] },
};

/**
 * Evoluciones que solo hace una forma regional (PokéAPI las pone en la misma cadena que las normales):
 * id de la especie evolucionada → final del nombre de la forma que puede evolucionar en ella. Así el
 * Yamask normal evoluciona en Cofagrigus y solo el de Galar en Runerigus (evoluciones.js).
 */
export const EVOLUCIONES_REGIONALES = {
  862: '-galar', 863: '-galar', 864: '-galar', 865: '-galar', 866: '-galar', 867: '-galar', // Obstagoon, Perrserker, Cursola, Sirfetch'd, Mr. Rime, Runerigus
  902: '-white-striped', 903: '-hisui', 904: '-hisui', 980: '-paldea', // Basculegion, Sneasler, Overqwil, Clodsire
};

/** Lo que dice el rival en cada momento del combate (se elige una al azar). */
export const FRASES_RIVAL = {
  inicio: ['¡Mi equipo y yo llevamos semanas entrenando para esto!', '¿Crees que puedes ganarme? ¡Demuéstralo!',
    'No pienso ponértelo fácil.', '¡Que empiece el combate!', 'He oído hablar de ti. Veamos si es verdad.'],
  sale: ['¡Adelante, {p}!', '¡Te toca, {p}!', '¡A por ellos, {p}!', '¡Confío en ti, {p}!'],
  pierde: ['¡Buen trabajo, {p}! Descansa.', 'Vaya golpe… ¡pero aún no he terminado!', '¡Vuelve, {p}! Lo hiciste genial.'],
  ultimo: ['Es mi último Pokémon… ¡pero es el mejor!', '¡Todo depende de ti, {p}!', 'No me rindo. ¡Vamos, {p}!'],
  evoluciona: ['¡Ha llegado el momento, {p}! ¡Evoluciona!', '¡Mira esto: el poder de la evolución!'],
  ventaja: ['¡Justo donde más duele!', '¡Eso es! ¡Sigue así, {p}!', '¡Ja! ¿Viste ese golpe?'],
  gana: ['¡La victoria es mía! Buen combate.', '¡Gané! Entrena un poco más y vuelve.', 'Ha estado reñido… ¡pero gano yo!'],
  pierdeCombate: ['¡Increíble! Me has ganado limpiamente.', 'Perdí… Eres muy buen entrenador.', '¡Qué combate! La próxima será mía.'],
};
