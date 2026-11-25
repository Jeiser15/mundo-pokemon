# Mundo Pokémon — contexto del proyecto

Aplicación web de aprendizaje (interfaz en español) para explorar Pokémon con datos de [PokéAPI](https://pokeapi.co/).
La web se llama **«Mundo Pokémon»** (antes «Pokédex»). «Pokédex» sigue siendo el nombre de la vista del catálogo y de
las claves `pokedex.*` de localStorage (no cambiarlas: se perderían el equipo, el récord y la racha guardados).
Sin dependencias: Python estándar en el servidor y HTML/CSS/JS sin frameworks ni build en el navegador.

### Snapshot local (actualización)

`servidor/snapshot.py` descarga en segundo plano los recursos de PokéAPI usados por la aplicación
(Pokémon y formas, especies, tipos, habilidades y cadenas evolutivas) y publica una copia SQLite
en `datos/pokeapi.sqlite3` solo al completarla. Se renueva cada 24 horas mientras el servidor está
abierto; tras un error mantiene la copia anterior y reintenta más tarde. La primera descarga puede
tardar bastante. `/api/snapshot` y `static/js/snapshot.js` muestran su progreso. Las imágenes no
forman parte de la copia. `python -m unittest discover -s tests -v` ejecuta las pruebas del snapshot.

## Ejecutar

```bash
python app.py                # http://127.0.0.1:8000
python app.py --puerto 8080  # si el 8000 está ocupado
```

Necesita internet para actualizar PokéAPI y cargar sprites de GitHub. Las pruebas del snapshot no necesitan internet.

**Repositorio público:** https://github.com/Jeiser15/mundo-pokemon (rama `main`). **App de Android:** cada push que
toque `index.html`, `static/`, `android/` o el flujo hace que GitHub Actions (`.github/workflows/apk.yml`) compile
`android/` con la web dentro y publique `mundo-pokemon.apk` en la release `apk` (se borra y se vuelve a crear:
el enlace `releases/latest/download/mundo-pokemon.apk` no cambia). APK de depuración, firmado con una llave de
pruebas que se guarda en la caché de Actions para poder actualizar sin desinstalar (si la caché caduca, 7 días
sin uso, habrá que desinstalar una vez). En este PC no hay Java ni SDK de Android: solo compila GitHub.

## Arquitectura

```
app.py                  Punto de entrada: arranca el servidor (argparse --puerto)
servidor/
  config.py             Puerto, rutas de carpetas, recursos permitidos, tamaño de caché, tipos MIME
  pokeapi.py            Cliente de PokéAPI con caché LRU en memoria (por bytes), errores tipados y
                        obtener_pokedex() (lista compacta de especies con tipos)
  rutas.py              Manejador HTTP: /, /static/*, /api/pokedex, /api/<recurso>/<nombre>
herramientas/
  generar_movimientos.py  Genera static/js/datos-movimientos.js desde PokéAPI (solo si salen movimientos nuevos)
  generar_formas.py       Genera static/js/datos-formas.js desde PokéAPI (solo si salen especies o formas nuevas)
  generar_evoluciones.py  Genera static/js/datos-evoluciones.js desde PokéAPI (solo si salen especies o cambian
                          sus evoluciones)
index.html              Toda la página: 7 vistas (el Inicio es un <div id="inicio"> con 5 partes; las demás, <section>)
                        + 2 ventanas (<dialog>): la ficha y la batalla. <body data-vista="inicio"> de entrada
static/
  css/                  Una hoja por parte de la página (orden de carga en index.html)
    base.css            Tipografía (@font-face, --serif, --sans y --pixel), variables, reinicio, botones, cabecera, pie,
                        keyframes compartidos y «MUNDO»: el fondo
                        continuo (.mundo-fondo), cabecera y pie transparentes y piezas comunes (.mundo, .mundo-sello,
                        .mundo-cabecera) de las vistas con <body data-mundo> (Inicio y Categorías)
    portada.css         Vista Inicio («Mundo Pokémon»): héroe con reloj y altar, cinta de tipos, caminos,
                        Pokémon del día y regiones
    habitats.css        Hábitats animados de cada tipo (.habitat[data-tipo]) y santuario de leyendas: el portal de
                        la rueda de Categorías y el fondo de la ficha. Medidas en --u (1/150 de la altura)
    categorias.css      «La rueda de los tipos»: círculo de medallones, radios, centro con el hábitat, vuelo, perfil y
                        tabla de efectividad 18×18 plegada (oscura)
    legendarios.css     Vista Legendarios: «santuario» oscuro y dorado, altar, cartas de reliquia
    pokedex.css         Vista Pokédex («el escáner», azul eléctrico oscuro con cabecera y pie a juego): escáner
                        holográfico, panel de filtros y tarjetas oscuras (colores por tipo; legendarios y singulares)
    ficha.css           Ficha: toma los colores de sus tipos (--tipo-a/--tipo-b en #ficha) y, si es legendario
                        o singular, toda la ficha en negro y oro (#ficha[data-rareza], sección al final de la hoja);
                        radar SVG de estadísticas. Paneles en rejilla de 3 columnas (perfil, estadísticas,
                        efectividad; evolución debajo) para que la ficha sea estática (ver «Detalles»). Cartas de
                        la evolución con los colores de sus tipos (--carta-a/--carta-b), carga (anillo) y
                        «Transiciones» (cambiar de Pokémon sin parpadear)
    duelo.css           Vista Duelo Pokémon («la arena»): mismo lenguaje que Legendarios (oscuro, serifa, líneas
                        finas, vidrio) en verde bosque y brasa; brasas que suben, maqueta 3D de la arena (el
                        escenario inclinado con tus Pokémon de pie), récord, pasos I·II·III y paneles de vidrio
    equipo.css          Duelo Pokémon, paso 2 (oscuro): cinturón de 6 huecos (o uno grande:
                        [data-lista="luchador"]), buscador y análisis (plegado en <details>). Usa los colores de .duelo
    simulacro.css       Ventana del combate en estilo de juego de rol (letra pixel, paneles de pizarra con borde
                        claro): los marcadores ENCIMA del campo y, debajo, el cuadro de diálogo (el registro: lo
                        último, grande) y el mando (movimientos del color de su tipo, de dos en dos). La ventana es
                        tan ancha como la arena (sin franjas negras). Las reglas nuevas van en «ESTILO DE JUEGO DE
                        ROL», después de las antiguas, y las corrigen. .en-pantalla-completa: solo la arena
    quien.css           Vista ¿Quién es ese Pokémon? («el teatro de las sombras», violeta noche y lavanda, con cabecera
                        y pie a juego): escenario a contraluz con la silueta, anillo del contrarreloj, revelación sobre el
                        hábitat, panel de vidrio (respuestas, pistas selladas, revelación), rastro, cifras y ajustes
    novedades.css       Inicio, «Ahora también puedes combatir» (acentos brasa, sin fondo propio): muestra en vivo,
                        lo nuevo, tu equipo con tu récord y las 10 arenas (5 + 5)
    aventura.css        Vista Modo aventura («Nueve copas, una leyenda»), A PROPÓSITO DISTINTA del resto (lo pidió
                        el usuario: «que se sienta diferente, llena de vida»): aire de videojuego de rol. Arriba el
                        mapa (.av-mapa: lienzo, botones de las islas, título, tarjeta y ficha de la isla encima; en
                        ≤1100 px van arriba y abajo del mapa, y en el móvil el mapa se desliza a lo ancho). Debajo,
                        ventanas de juego (.av-ventana/.av-pantalla: azul noche, borde crema y otro oscuro), letra
                        pixel (var(--pixel)), botones dorados que se hunden (.av-boton), diálogos letra a letra
                        (.av-dialogo), la previa sobre la arena del partido (.av-previa), pestañas, tabla, cuadro,
                        creador con miniaturas de cada pieza, campeón con confeti, salón de la fama y el trofeo
                        dibujado con CSS (.trofeo). Colores de la región: --region-a/--region-b (@property). Clases
                        con prefijo av-. La tarjeta del Inicio (.camino-aventura) está en portada.css
  js/                   Módulos ES (<script type="module">), uno por responsabilidad
    main.js             Arranca todo en orden
    datos.js            TIPOS (nombre, color, escenario, icono, efecto de su ataque), TABLA_TIPOS,
                        MOMENTOS_DEL_DIA (+ momentoDeHora), SUGERENCIAS, GENERACIONES y LEGENDARIOS (objetos con
                        tipos, poder, especie y grupo; datos sacados de PokéAPI), NIVELES_SIMULACRO, MODOS_BATALLA,
                        MOVIMIENTOS_RESERVA (para quien casi no aprende ataques), PALETAS_ATAQUE, ESCENARIOS (con sus
                        climas), CLIMAS, ESTADOS, ENTRENADORES, FRASES_RIVAL, EVOLUCIONES_REGIONALES
                        y, para ¿Quién es?, MODOS_QUIEN, PISTAS_QUIEN, COLORES_ESPECIE y NOMBRES_ESPANOL (los 38
                        nombres que no son su clave de PokéAPI con mayúsculas: Nidoran♀, Mr. Mime, Código Cero, los Paradoja…).
                        Modo aventura: ASPECTO_ENTRENADOR (colores, pieles y pelos de los entrenadores),
                        ENTRENADOR_ANIME (las piezas del estilo anime: pañuelo, peinado, camiseta, pantalón, bolsa) y
                        ASPECTO_INICIAL, REGIONES_AVENTURA (copa, estadio, lema, colores, nivel, arenas y campeón con
                        su as y su aspecto, y paisaje: cómo se pinta su isla en el mapa), NOMBRES_AVENTURA (13 por región:
                        líderes, alto mando y rivales, [nombre, género, tipo favorito, sprite]), SPRITES_ENTRENADOR +
                        URL_ENTRENADORES (los sprites de los juegos de los rivales, con la caja de su dibujo), RIVAL_AVENTURA
                        (Kael), LEYENDAS_FINAL + ASES_FINAL (la final de Paldea), FRASES_AVENTURA (kael, campeon,
                        leyendas) y ESTADIO_AVENTURA (va aparte de ESCENARIOS: no sale en el Duelo ni en el Inicio)
    datos-movimientos.js GENERADO (no editar): MOVIMIENTOS_DATOS, los 479 movimientos de daño de PokéAPI con
                        nombre en español, tipo, potencia, precisión, clase, prioridad y efectos
    datos-formas.js     GENERADO (no editar): FORMAS, las 363 claves de PokéAPI que no son la de su especie
                        (formas por defecto con apellido como 'giratina-altered' y formas alternativas) →
                        [nombre de la forma en español, clave de la especie, 1 si es la forma por defecto]
    datos-evoluciones.js GENERADO (no editar): COMO_EVOLUCIONA, cómo se llega a cada una de las 484 especies que
                        evolucionan, en pocas palabras ('ivysaur' → «Nv. 16», 'politoed' → «Intercambio · con Roca
                        del Rey»; [texto, región] si solo evoluciona desde una forma regional: Runerigus, Galar)
    mundo.js            Inicio: la luz del fondo continuo. Cada parte lleva data-luz="#a #b"; la que cruza el centro
                        de la pantalla (IntersectionObserver) pasa sus colores a --luz-a/--luz-b. ponerLuz() los cambia
    portada.js          Héroe: sigue la hora local (momentos del día: título, relato con nombres pulsables, cielo y
                        Pokémon del altar; el reloj deja ver otro momento), buscador (número, nombre exacto en
                        español o inglés o una forma → ficha; si no → Pokédex filtrada), sugerencias, destacado que
                        rota (miniaturas) y cinta
    guia.js             Inicio: caminos (18 tipos → Pokédex filtrada, estante animado, silueta de ¿Quién es?),
                        Pokémon del día (cambia cada día; su tipo tiñe la luz) y las 9 regiones
    novedades.js        Inicio, Duelo en vivo: combate de muestra EN VIVO (arena-pixel + combate), lo nuevo, tu
                        equipo y las 10 arenas (pulsar una abre el Duelo con ella: elegirEscenario de duelo.js)
    catalogo.js         Pokédex, el archivo (la única vista de búsqueda): buscador, filtros por región y tipo, orden
                        y tandas de 24 que se cargan solas al bajar (o con «Ver más»). Pulsar una tarjeta la ESCANEA
                        (escaner.js). Exporta mostrarGeneracion(), mostrarTipo() y buscarDesdePortada() para que
                        otras vistas la abran ya filtrada (y escanea el primero). Busca por la clave Y por el nombre
                        en español («Ferrodada», «Código Cero»: contieneNombre de utilidades.js). Sin resultados
                        ofrece «Buscar en PokéAPI» (para formas: «Mega-Charizard X» o charizard-mega-x, claveDe)
    escaner.js          Pokédex, el escáner: escanear(id) lee el registro (ilustración que se materializa, nombre,
                        categoría, tipos, medidas, descripción letra a letra, estadísticas, grito); ‹ › siguen la
                        lista del archivo (vecino) y «Al azar»; lleva la cuenta de vistos (pokedex.vistos)
    especies.js         Descarga /api/pokedex una vez y la comparte (cargarEspecies, tiposDe)
    api.js              Datos de dos maneras: con el servidor local (/api/…) o, si no lo hay (la app de Android,
                        usaServidor() lo averigua una vez), directo a PokéAPI con los mismos mensajes de error;
                        en ese modo arma la Pokédex compacta como el servidor (19 consultas) y la guarda 7 días
    utilidades.js       crear() para construir DOM, crearIcono() (iconos de tipo), crearImagen(), urlIlustracion(),
                        urlSprite(), urlAnimado() (GIF de Showdown; las 14 de SIN_GIF_SHOWDOWN, su sprite fijo),
                        urlGrito() (.ogg; las 1025 siguen ese patrón) y gritoDe(pokemon) (Pikachu y Eevee, con su
                        VOZ: GRITOS_CON_VOZ), normalizar(), contieneNombre() y esSuNombre() (buscar por clave o
                        nombre en español, sin tildes ni signos: «Mr. Mime», «Farfetch'd», «Nidoran♀»),
                        nombreTitulo(clave): el nombre oficial en español de una especie o forma ('mr-mime' → «Mr. Mime»,
                        'giratina-altered' → «Giratina», 'charizard-mega-x' → «Mega-Charizard X») y nombreForma()...
    vistas.js           Navegación por #hash (inicio, aventura, categorias, legendarios, catalogo, duelo, quien;
                        alias: #explorar → catalogo, #equipo y #batalla → duelo, #copa y #liga → aventura). Pone <body data-vista> y, en
                        las vistas de VISTAS_DEL_MUNDO (inicio, categorias), <body data-mundo>. Sube arriba solo si
                        cambia de vista o se pulsa el menú (cerrar una ficha con «Atrás» no mueve la página)
    habitats.js         crearHabitat({ tipo, rareza, semilla }): la escena animada (12 partículas con reparto fijo)
    ficha.js            buscarPokemon(): abre y rellena la ficha (tema por tipo y rareza, especie, radar,
                        etiqueta de su forma, evolución con «Estás aquí», cómo evoluciona cada una y otras formas,
                        efectividad con iconos). La arma fuera de la página y la enseña de una vez; con la ficha
                        abierta, pasa de un Pokémon a otro con una transición (ver «Ficha sin parpadeos»)
    efectividad.js      Lógica pura: calcularMultiplicadores() (ficha, datos de PokéAPI) y
                        multiplicador() / fuerteContra() / debilAnte() (TABLA_TIPOS)
    categorias.js       La rueda de los tipos (elegir(): vuelo al centro, radios, portal, perfil, luz) y la tabla 18×18
    legendarios.js      Leyenda destacada (‹ ›, una distinta cada día), filtros por generación y cartas
                        de 10 en 10 («Ver más»)
    efectos.js          activarInclinacion(): inclinación 3D al pasar el ratón (cartas de Legendarios)
    tarjetas.js         crearTarjetaPokemon({ id, nombre, tipos, alPulsar, visto, enPantalla }): tarjeta con los
                        colores de sus tipos; legendarios y singulares salen como cartas especiales
    mi-equipo.js        Dos listas en localStorage: 'equipo' (máx. 6; también la usa la ficha) y 'luchador'
                        (uno, para «Uno contra uno»; añadir otro lo sustituye) + evento «equipo-cambiado»
                        ({ lista }); detallesDe(id) (tipos, stats, poder, altura, imagen, sprite fijo, animados
                        (GIF), grito (.ogg) y aprende: sus movimientos; caché por visita). Lo usan equipo, duelo,
                        simulacro y ficha
    evoluciones.js      prepararEvoluciones(detalles): el árbol de formas en las que puede evolucionar en combate
                        (siguiente fase de su cadena; si es la última, megaevolución o forma primigenia;
                        las megas no traen movimientos en PokéAPI y heredan los de su forma normal)
    sonido.js           Web Audio: gritos (.ogg de PokéAPI), efectos sintetizados por tipo, música de batalla
                        original generada nota a nota (CANCIONES: combate y, en las finales de la aventura, final)
                        y fanfarria; himno() (el de la copa, original) y efectos ovacion/ovacionGrande (el público
                        del estadio); interruptores guardados (pokedex.sonido)
    duelo.js            Duelo Pokémon: la maqueta de la arena (pintarMaqueta), el récord total (pintarCifras), los
                        tres pasos (configura → elige tus Pokémon o tu luchador → ¡a combatir!), la configuración
                        (modo, dificultad, escenario; se recuerda), la lista del modo (usarLista) y el resumen
                        que llama a empezarCombate()
    equipo.js           Duelo Pokémon, paso 2: trabaja con la lista que le indica duelo.js (usarLista): cinturón,
                        buscador, «Completar al azar» (con el luchador: «Elegir/Otro al azar», uno solo) y análisis (defensa por tipo,
                        tipos que golpea ×2, estadísticas medias, consejos)
    combate.js          Batalla: REGLAS y estrategia del rival (lógica pura, sin DOM; azar inyectable).
                        movimientosDe() elige 4 movimientos reales para cada Pokémon; crearAtaque(clave).
                        Precisión, prioridad, efectos, etapas, clima, estados, energía, evolución y NIVELES (solo
                        en la aventura: factorNivel, FACTOR_NIVEL 1,03 por nivel de diferencia en el daño; en el
                        Duelo nadie lleva nivel). resolverTurno() devuelve sucesos que simulacro.js anima
    simulacro.js        El combate: empezarCombate({ modo, nivel, escenario, pantallaCompleta, aventura? }) abre la
                        ventana (#batalla-ventana); presentación (rival con nombre, clima), preparación (en el uno
                        contra uno empieza solo), turnos animados, evolución, relevos, final, récord (leerRecord),
                        bocadillos de diálogo, sonido y pantalla completa (sobre #simulacro). Con `aventura`: equipos
                        fijos con nivel («Nv. 24» en el marcador), rival de la copa con su aspecto y sus frases,
                        ovaciones en el estadio, himno y letreros en la final, y alTerminar(resultado) en vez del
                        récord del Duelo («Continuar ▸»). Los entrenadores salen también en el Duelo
    escenarios.js       Las 10 arenas en pixel art (bosque, volcan, playa, cueva, nieve, ruinas, jardin, desierto,
                        ciudad, cielo) y el ESTADIO de la aventura (gradas con los colores de la región, focos,
                        emblema de las nueve estrellas): dibujarFondo(escenario, { colores }) (una vez, con semilla)
                        y crearAmbiente() (lo que se mueve). Constantes del mundo (ANCHO, ALTO, SUELO, CASA) y
                        `pixel` (pinceles, ruido, tramado: los usa también el mapa de la aventura)
    arena-pixel.js      Arena en pixel art vista desde arriba (mundo 480×270, lienzo a resolución real): el
                        escenario de escenarios.js (dibujarVistaPrevia para las tarjetas), sprites
                        animados (GIF: ImageDecoder o el lector propio leerGif), cámara, partículas, TODOS los
                        movimientos con los sprites GBA de sprites-ataques.js (ataqueGBA, ver «Ataques GBA»; las
                        familias de antes, ANIMACIONES, quedan como animacionClasica, sin usar), el rótulo
                        con el nombre del movimiento, Poké Ball, evolución (silueta que alterna), clima,
                        estados, transición y confeti. Con `entrenadores` ({ jugador, rival }: su aspecto), los
                        dos entrenadores a los lados: entran caminando, lanzan la Poké Ball desde la mano, señalan
                        al atacar, recogen con el rayo rojo, bajan la cabeza con cada K.O. y celebran.
                        crearModelo() (sin caché, dice de qué archivo salió) lo usan también las pruebas
    sprites-ataques.js  Los ataques en pixel art de la era GBA: hojaDeAtaque(tipo) → tira de 5 fotogramas de 48×48
                        (carga, proyectil, impacto máximo, expansión, dispersión) pintada píxel a píxel con un campo
                        de intensidad (bolas, llamas, rayos, hojas, cristales, rocas, estrellas, anillos, medias
                        lunas) cuantizado a la paleta del tipo (PALETAS_GBA) y con contorno grueso. coloresDe(tipo)
    fuente-pixel.js     Fuente de píxeles 5×7 para los números de daño y los letreros del lienzo (con Ñ)
    entrenador.js       Entrenadores en pixel art, de DOS clases: (1) ESTILO ANIME (tu entrenador, Kael y cualquiera
                        que no sea de los juegos): ANIME, un sprite de 57×108 sacado de la referencia del usuario, en
                        un lienzo de 63×112, recoloreado con tonoComo y con las piezas de ENTRENADOR_ANIME (pañuelo,
                        peinado corto/de punta/largo, camiseta de rayas o lisa, pirata o largo, bandolera);
                        (2) los RIVALES DE LOS JUEGOS (`sprite` en su aspecto): su sprite de Pokémon Showdown, 80×80,
                        cargado al verlo (cargarSprite/prepararEntrenador; si no carga, estilo anime). Una sola imagen:
                        las poses (quieto, paso, lanza1, lanza2, ordena, celebra, triste) la mueven (POSE).
                        medidasDe(aspecto) (ancho, alto, pies, unidad en la arena), manoDe(aspecto, pose),
                        lienzoEntrenador(aspecto, pose, paso), retratoEntrenador()/pintarRetrato() para la página,
                        normalizarAspecto() (los aspectos de antes pasan solos al anime: aAnime) y tu entrenador
                        guardado (leerEntrenador, guardarEntrenador → evento «entrenador-cambiado»)
    liga.js             Modo aventura, LÓGICA PURA (como combate.js; azar con semilla, azarDe): la copa de cada
                        región (crearTemporada, sortearEquipo, sortearGrupos, registrarCombate → cerrarRonda,
                        clasificacion, ganadorCopa), la CURVA de dificultad (dificultad(region, ronda)), los equipos
                        rivales (planEquipoRival sin descargar + completarEquipoRival con los detalles) y tu nivel
                        (nivelJugador). La temporada es un objeto plano que se guarda tal cual
    mapa-aventura.js    Modo aventura, el MAPA: un archipiélago en pixel art (mundo 960×400) con una isla por región
                        (su paisaje, su estadio y una bandera si ganaste su copa; las bloqueadas, apagadas), la ruta
                        entre islas y tu entrenador en la isla en curso. Se pinta una vez por estado y se anima
                        (destellos y espuma, nubes con sombra, un barco, gaviotas, banderas, fuegos al ganar).
                        crearMapa(lienzo) → pintar(), viajar(desde, hasta) (camina por la ruta), celebrar(), pausar()
    aventura.js         Modo aventura, la vista: el mapa con un botón por isla (su ficha: copa, campeón, estado), tu
                        tarjeta de entrenador, y el panel con UNA pantalla cada vez: creador (pestañas con miniaturas
                        de cada pieza), llegada a la región (cartel con su nombre enorme y el campeón con su as),
                        sorteo de tu equipo, sorteo de grupos bola a bola, la copa (previa sobre la arena del
                        partido, con diálogo letra a letra y siluetas; debajo, pestañas Grupo · Cuadro · Tu equipo),
                        campeón (y el viaje por el mapa a la siguiente isla), eliminado y leyenda; salón de la fama y
                        la tarjeta del Inicio (#inicio-aventura). Lanza los combates con empezarCombate
    quien.js            ¿Quién es ese Pokémon?: modos, regiones, pistas a elegir, contrarreloj, revelación (hábitat,
                        grito, registro de la especie), puntos con desglose, rastro, colección y ajustes guardados
  img/
    icono.svg
  fonts/                Playfair (normal y cursiva), Manrope y Pixelify Sans (la del modo aventura y el combate):
                        woff2 variables, solo el juego latino, con su licencia OFL. Descargadas de Google Fonts y
                        servidas desde aquí (sin conexión a Google)
archivo/                Versión original y paisajes que no se usan. No se sirve ni está en git; se puede borrar.
android/                App de Android (WebView con la web dentro, servida con WebViewAssetLoader desde
                        https://appassets.androidplatform.net). Ver android/LEEME.md
.github/workflows/apk.yml  Compila el APK en GitHub Actions y lo publica en Releases
```

### API del servidor local

| Ruta | Devuelve |
|---|---|
| `GET /api/pokemon/<nombre-o-número>` | JSON de PokéAPI tal cual |
| `GET /api/{type,pokemon-species,evolution-chain,ability}/<id>` | ídem |
| `GET /api/pokedex` | `[{id, nombre, tipos}]` de las 1025 especies (~54 KB). Se arma con 19 consultas a PokéAPI la primera vez y luego sale de memoria |

Errores: siempre JSON `{"error": "<mensaje en español>"}` con 400/404/502. El frontend muestra ese mensaje.
Para exponer otro recurso de PokéAPI (p. ej. `move`), añádelo a `RECURSOS_PERMITIDOS` en `servidor/config.py`.

## Convenciones

- **Todo en español**: nombres de variables, funciones, archivos, clases CSS nuevas y textos. Las clases CSS
  antiguas en inglés (`.detail`, `.pokemon-card`...) se mantienen; no renombrarlas sin motivo.
- **Sin dependencias ni build.** Nada de npm, frameworks ni pip. Si algo lo requiere, consultarlo antes. La única
  excepción es `android/` (Gradle, compilado solo en GitHub Actions); la web sigue sin build y debe funcionar
  igual con el servidor y sin él (no añadir nada que dependa solo de `/api/…` sin su versión directa en api.js).
- **DOM con `crear(etiqueta, opciones, ...hijos)`** (utilidades.js) en vez de `innerHTML`: evita inyección de HTML
  con datos de la API.
- **Respuestas que llegan tarde**: `ficha.js` (`versionBusqueda`), `escaner.js` (`versionEscaneo`) y `legendarios.js`
  (`versionDestacada`) numeran cada
  petición y descartan las que ya no son la última. Mantener ese patrón en cualquier carga asíncrona nueva.
- **CSS**: cada componente vive en una sola hoja; las variantes móviles van al final de esa hoja
  (`@media (max-width:700px)`, a veces 800/900px) y cada hoja desactiva sus animaciones en
  `prefers-reduced-motion`. La página no muestra barra de desplazamiento (base.css: `scrollbar-width:none` en
  `html`), a petición del usuario; las ventanas y tiras con scroll propio tampoco. Evitar `!important` (solo queda en `[hidden]` y en reduced-motion).
  Valores por elemento calculados en JS se pasan como variables CSS (`--n`, `--y`, `--i`, `--color-tipo`...),
  no como estilos sueltos. Ninguna vista debe desbordar a lo ancho (comprobado en todas, de 390 a 1440 px): lo
  que gire o sobresalga se recorta con `overflow-x:clip` (no `hidden`, que rompe `position:sticky`).
- **Tipografía**: `var(--serif)` = Playfair (títulos con su palabra en cursiva, nombres, cifras) y `var(--sans)` =
  Manrope (texto, botones, etiquetas en versalitas), definidas UNA vez en `:root` (base.css). No redefinirlas por
  vista ni escribir nombres de fuentes sueltos. Playfair tiene tamaño óptico (se ajusta sola a cada tamaño) y el
  body pide `lining-nums` (cifras alineadas). Se eligió frente a Cormorant y Bodoni (demasiado finas en letra
  pequeña), Fraunces (su «g» cursiva parece una «q») e Instrument Serif (cifras estrechas). `var(--pixel)` =
  Pixelify Sans, SOLO para el modo aventura y la ventana del combate (títulos, botones, diálogos, etiquetas): ahí
  se quiere que se sienta como un videojuego; el texto largo sigue en Manrope.
- **Datos fijos** (tipos, colores, listas) solo en `datos.js`.
- **localStorage** solo para cosas de este navegador, siempre con try/catch: `pokedex.equipo`,
  `pokedex.luchador` (el del uno contra uno), `pokedex.sonido` (efectos y música encendidos o no),
  `pokedex.simulacro` (récord `{ equipo: {nivel: {v, d}}, duelo: {…} }`), `pokedex.duelo` (última
  configuración: modo, nivel, escenario, pantalla completa), `pokedex.quien.mejor-racha` (también la lee el
  Inicio), `pokedex.quien.adivinados` (ids de las especies adivinadas alguna vez: «Tu colección»),
  `pokedex.quien.ajustes` (último modo y región de ¿Quién es?), `pokedex.aventura` (el modo aventura:
  `{ version, region, temporada, conquistas, estadisticas, ajustes }`; la temporada es la de liga.js tal cual),
  `pokedex.entrenador` (tu entrenador: `{ nombre, aspecto }`; también lo usa el Duelo), `pokedex.vistos`
  (los Pokémon escaneados en la Pokédex: el contador «Vistos por ti») y, solo sin servidor, `pokedex.especies`
  (la Pokédex compacta armada desde PokéAPI, `{ fecha, lista }`, vale 7 días).

## Cómo hacer cambios habituales

- **Nueva vista**: `<section id="x">` en index.html → añadir `'x'` a `VISTAS` en vistas.js → enlace `href="#x"`
  en el `<nav>` → módulo `static/js/x.js` con `iniciarX()` llamado desde main.js → hoja `static/css/x.css`.
- **Nueva arena del Duelo**: entrada en `ESCENARIOS` (datos.js: nombre, descripción, climas) + función de dibujo en
  `DIBUJOS` y su caso en `crearAmbiente` (escenarios.js). Sale sola en el paso 1 del Duelo y en las Novedades.
- **Cambiar el hábitat animado de un tipo** (portal de Categorías y fondo de la ficha): su bloque
  `.habitat[data-tipo="…"]` en habitats.css; el símbolo usa el `icono` de `TIPOS`.
- **Ajustar la dificultad de la aventura**: `CURVA` en liga.js (estrategias por región y ronda, poder, niveles,
  contraataque de tipos y `ventajaLeyendas`) y `FACTOR_NIVEL` en combate.js. Después, vuelve a medirla con
  temporadas simuladas (ver «Modo aventura» en «Detalles»).
- **Otra región, copa o campeón de la aventura**: `REGIONES_AVENTURA` y `NOMBRES_AVENTURA` en datos.js (la liga y la
  vista leen de ahí; la curva tiene una fila por región).
- **Cambiar el lema o los Pokémon conocidos de un tipo** (Categorías): `PERFILES_TIPOS` en datos.js (los 72
  representantes se comprobaron contra PokéAPI: todos tienen su tipo).

## Detalles que no son obvios

- `servidor/config.py` fija los tipos MIME a mano: en Windows `mimetypes` puede devolver `text/plain` para `.js`
  y el navegador rechazaría los módulos.
- `app.py` desactiva `allow_reuse_address` en Windows: si no, dos servidores podían abrir el mismo puerto sin error.
- Archivos estáticos: `Cache-Control: no-cache` + `Last-Modified` → el navegador revalida (304) y los cambios se
  ven al recargar sin `?v=` en las URLs. Respuestas de `/api/*`: `no-store` (la caché está en el servidor).
- La caché rápida de PokéAPI vive en memoria y se vacía al reiniciar; el snapshot SQLite permanece en disco.
- Los sprites se piden directamente a `raw.githubusercontent.com` (no pasan por el servidor). Los de los entrenadores
  rivales, a `play.pokemonshowdown.com/sprites/trainers/` (no están en el proyecto); Showdown no manda cabeceras CORS:
  se pueden pintar en un lienzo pero no leer sus píxeles (por eso sus cajas van medidas en datos.js).
- El evento `close` del `<dialog>` llega en una tarea aparte: `ficha.js` lo ignora si la ficha ya se reabrió
  (si no, cancelaría la búsqueda nueva y la ficha se quedaría en «Buscando…»).
- Portada: `--tipo-hero` está registrada con `@property` para que el color del escenario se anime al cambiar
  de destacado. `INTERVALO_MS` (portada.js) y `--intervalo-hero` (portada.css) deben coincidir.
- El Pokémon del día usa `(días desde 1970 × 7919) % 1025 + 1`: igual para todos ese día y sin repetir en 1025 días.
- Cualquier elemento con `data-total-especies` recibe el total real de PokéAPI cuando carga el catálogo.
- Hábitats: todos comparten piezas (escena-fondo, 12 `.particula`, escena-suelo, primer plano) y cada tipo solo
  define su aspecto en un bloque `.habitat[data-tipo="…"]` de habitats.css. Las partículas reciben --x --y --t
  --s --v desde JS (reparto fijo, sin aleatoriedad) para posición, desfase, tamaño y ritmo.
- **La rueda de los tipos** (Categorías, vista «del mundo»): los 18 medallones van en círculo, cada uno SIEMPRE en
  su sitio (--x/--y en %, radio 42 %; no gira: así se aprende dónde está cada tipo). El elegido está en el CENTRO:
  el portal (40 %, con su hábitat —fundido entre el viejo y el nuevo—, su símbolo y su nombre); en el círculo solo
  queda su hueco punteado, que sigue siendo un botón (para el teclado). Al elegir otro, `volar()` mueve una copia
  (`.rueda-viajero`, 100 px escalada con la Web Animations API) del círculo al centro y otra del centro a su sitio;
  las cajas se miden ANTES de cambiar nada, y `.volviendo` / `.esperando` ocultan el medallón y el centro hasta que
  llegan (resiste clics muy seguidos: no quedan copias ni medallones ocultos). Los radios son un SVG de 100×100:
  lima del centro a los tipos contra los que es fuerte y ROJOS de los que lo vencen al centro, con una chispa
  (`animateMotion`) que va del que ataca al que recibe. Los nombres van por FUERA del círculo (--ux/--uy: dirección
  contraria al centro) para que ningún radio los cruce; en el móvil no se ven (el del centro sí). Lima = bueno para
  el tipo del centro y rojo = malo (también en el perfil: ×2 al atacar es lima y ×2 al defenderse, rojo, y en la
  tabla el ½). Cada medallón explica su relación en su `title` («Agua: le hace ×2 a Fuego»). Se elige con un clic
  (medallón, tipo del perfil o fila/columna de la tabla) o con las flechas (un solo `tabIndex=0`). Cada visita
  empieza por un tipo al azar. El botón del perfil abre la Pokédex filtrada y dice cuántas especies tiene.
- Ancho: `.wrap` llega hasta 1520 px. Las rejillas suben de columnas en vez de estirar tarjetas (archivo de la
  Pokédex 4, al lado del escáner; legendarios 5) y bajan con @media.
- **Pokédex, «el escáner»** (#catalogo): azul eléctrico sobre azul noche, con su propia paleta como Legendarios y el
  Duelo (cabecera y pie con `body[data-vista="catalogo"]`). A la izquierda, el escáner (sticky, cabe en ~860 px de
  alto: la pantalla mide `clamp(220px, 33vh, 310px)`); a la derecha, el archivo. La sección usa `overflow-x:clip`
  y NO `hidden`: con hidden, el escáner dejaría de quedarse fijo. Al escanear: `.escaneando` (lente rápida, luces,
  barrido en bucle) mientras llegan el Pokémon, la especie (en caché) y la ilustración; luego `.materializando`
  (la ilustración aparece de arriba abajo tras la línea de barrido). La descripción es la más reciente en español;
  se escribe letra a letra (el texto entero va en un `.solo-lectores`). El grito usa `grito()` de sonido.js con
  `pedido: true`: lo pides con el botón, así que suena aunque los efectos del Duelo estén apagados. Cada visita empieza por una especie al azar (o por la primera
  de la lista si se llega con un filtro). Las tandas se cargan solas con un IntersectionObserver sobre «Ver más»
  (se vuelve a observar tras cada tanda para pantallas altas). En ≤1100 px el escáner pasa arriba a lo ancho y
  pulsar una tarjeta sube hasta él.
- La ficha es **estática** en escritorio: está compactada para ~830 px de alto y `encajarFicha()` (ficha.js,
  con un `ResizeObserver`) baja `--escala` (`zoom` de `.detail`, mínimo 0,7) si la ventana es más baja.
  Usa `offsetHeight`, que no incluye el zoom ni la animación de entrada. El ancho del `<dialog>` también se
  multiplica por `--escala`: así por dentro mide siempre lo mismo. Aun así, con zoom una línea de texto puede
  partirse distinto: Necrozma medía 881 px a 0,971 y 889 a 0,980, y la escala oscilaba sin parar (la ficha
  parpadeaba). Por eso en cada ficha la escala SOLO BAJA (`escalaTope`; se reinicia al abrir otra o al cambiar la
  ventana), se redondea hacia abajo y, si cabe, `.cabe` quita el desplazamiento. En móvil (≤700 px) no
  cabría legible: ahí se desplaza, sin barra visible.
- **Ficha: nombres, formas y evolución.** El título es el nombre de la ESPECIE (`nombreTitulo(species.name)`): la
  forma por defecto de 37 especies lleva apellido en PokéAPI ('giratina-altered', 'deoxys-normal'…) y antes salía
  «Giratina Altered». La forma va en su etiqueta junto a la región («Forma Modificada», «Mega-Charizard X»). Los
  nombres de especies y formas salen de `NOMBRES_ESPANOL` (datos.js) y `FORMAS` (datos-formas.js): úsese siempre
  `nombreTitulo()` para mostrar un Pokémon. La categoría que PokéAPI no tiene en español (especies 899–1025) sale de
  `LEGENDARIOS` o no se muestra (nunca en inglés). Evolución: cada carta lleva los colores de SUS tipos (halo, borde
  y filo; `tiposDe()` de especies.js y, en las formas, su /pokemon). Entre una y la siguiente, el paso: una línea fina
  con un círculo y su flecha en medio y, DEBAJO, cómo evoluciona (`COMO_EVOLUCIONA`, datos-evoluciones.js; «Forma de
  Galar» al final si solo evoluciona desde esa forma). Una versión anterior con el texto encima y una luz que
  recorría la flecha se descartó: «se ve muy raro». Varias posibles van en UN grupo en una sola fila (`.en-grupo`, y
  cada carta dice al pie cómo se llega a ella; con más de cuatro, Eevee, cartas `.compacto`; si alguna sigue evolucionando, Wurmple o Applin, su rama
  entera): en dos filas o apiladas, esas fichas no cabían. En un grupo las cartas comparten alto y el Pokémon es algo
  menor: si no, Scyther o Yamask medían 885 px y se encogían. Si ves una forma (Blastoise Gigamax), la carta «Estás
  aquí» la enseña a ella (antes salía la normal, repetida en «Otras formas»); esa carta no es un botón. Al lado, sus
  otras formas (`species.varieties`, sin las «Dominante», solo las que tienen nombre en español —`formaConNombre`— y
  una por nombre; 4, 3 o 2 según las fases para no partir la fila, con «+N más»); si no evoluciona, lo dice. El sello
  de legendario o singular va en la línea del registro (`.identity-cabecera`): debajo, esas fichas no cabían en 900 px.
  Revisadas las 1025 en Chrome sin ventana (`auditar-fichas.mjs`, fuera del proyecto) a 1440×900 y 1366×768: ninguna
  parpadea, se desplaza, se desborda ni pierde imágenes. Con la cadena nueva se revisaron 167 (una de cada 7 y las
  difíciles, `auditar.mjs`): a 1440×900 todas caben sin zoom (la más alta, 863 px; Dragalge y Crabominable también).
- **Ficha sin parpadeos** (ficha.js + «Transiciones» al final de ficha.css). Antes, pulsar una evolución vaciaba la
  ficha («Buscando…»: se encogía y perdía sus colores) y volvía de golpe, con la evolución y la efectividad llegando
  después. Ahora: (1) la ficha nueva se arma FUERA de la página y se enseña cuando está casi todo (especie, cadena,
  tipos, habilidades e ilustración; como mucho `ESPERA_MAXIMA`, 1,5 s; lo que llegue después ocupa el sitio de su
  panel de espera, `.panel-reserva` con su título y «Cargando…», y aparece con fundido); (2) al abrirla, la ventana
  espera hasta `ESPERA_APERTURA` (400 ms) y se abre YA COMPLETA (con el servidor tarda 20–220 ms); solo si tarda más
  se ve la carga: la barra y un anillo que gira (`.ficha-cargando`, casi del alto de la ficha); (3) con la ficha
  abierta (`hayFicha`), un fundido suave: `.cambiando` baja la cabecera y los paneles a 0,35 (`SALIDA_MINIMA`,
  160 ms) y lo nuevo aparece desde ese mismo punto (`data-entrada="cambio"`, `ficha-fundido` 0,3 s; desde cero no:
  quedaría un hueco vacío donde se pulsó); los colores se funden con `transition` sobre `--tipo-a/--tipo-b`
  (registradas con `@property` en legendarios.css); (4) la ventana va centrada: si la nueva mide distinto (Blastoise
  tiene «Otras formas» y Wartortle no: 848 y 833 px), saltaba 8 px; ahora se desliza a su sitio (`ficha.animate` con
  `translate`, tras `encajarFicha()`). Si el cambio falla, se queda la de antes con un aviso (`.ficha-error`). El foco
  pasa a la nueva carta «Estás aquí». Se probó antes una transición «de evolución» (silueta blanca, difuminado,
  cascada, esqueleto con líneas que brillan) y el usuario la rechazó: «se ve muy raro». Quiere un fundido discreto.
- `api.js` reintenta una vez si el servidor rechaza la conexión (abrir fichas muy deprisa supera sus 5 conexiones)
  y, si vuelve a fallar, da un mensaje en español (antes salía «Failed to fetch»).
- **Batalla (simulacro)**: reglas inspiradas en los juegos, simplificadas, descritas al principio de `combate.js`.
  PV = Salud×2,2+90; daño = `BASE_DANIO` (58) × Ataque÷Defensa (físico) o At.Esp÷Def.Esp (especial) × potencia÷90
  × tipo × clima × azar, y ×⅔ si el movimiento no es de su tipo. Acciones: uno de sus 4 movimientos,
  Concentrarse (½ daño y ×1,7 al siguiente) y Cambiar. El rival se elige entre ~32 candidatos (preselección por
  tipos + poder ≈ media de tu equipo × `factorPoder`: 0,9 / 1,0 / 1,08). Medido con miles de combates simulados
  (`balance.mjs`, fuera del proyecto) con los 4 movimientos reales: con un equipo fuerte, Novato ~99 %, Retador
  ~40–75 % y Maestro ~12–30 % según lo bien que se juegue (con equipos medios o de bebés cuesta más). Si
  cambias reglas, `BASE_DANIO` o `ESTRATEGIA`, vuelve a medirlo.
- **Movimientos reales**: `herramientas/generar_movimientos.py` baja de PokéAPI los movimientos de daño (salvo
  los que no encajan en estas reglas: Explosión, Sorpresa, daño fijo…, en `EXCLUIDOS`) y escribe
  `datos-movimientos.js`: `clave → [nombre, tipo, potencia por turno (los de varios golpes ya multiplicados), precisión
  (null = no falla), 'f'/'e', prioridad, efectos?]`. Efectos que entiende el combate: `estado` + `probEstado`,
  `retroceso` / `drena` (% del daño), `costeVida` (Metaláser, Cabeza Sorpresa, Clorofiláser), `recarga` (Hiperrayo…: pierde el
  turno siguiente), `carga` (Rayo Solar, Vuelo, Excavar…: pierde el anterior; 'aire', 'tierra', 'agua' y 'sombra'
  además lo esconden y los ataques del rival fallan), `segunVida` (Estallido), `amedrentar`, `cambios` de etapas
  (`aQuien` 'propio' o 'rival', `probCambio`) y `golpes`. PokéAPI llama «Cañón Resplandor» a Flash Cannon: se
  corrige en `NOMBRES` (Foco Resplandor). `mi-equipo.js` guarda en `aprende` lo que puede aprender cada Pokémon
  (con `porNivel`) y `movimientosDe()` (combate.js) elige 4: el mejor de cada tipo suyo, los que más tipos
  nuevos golpean ×2 y uno rápido si lo tiene; valora potencia × precisión × afinidad con su mejor estadística ×
  (1,25 si lo aprende por nivel: los «suyos», como en el anime) y penaliza recarga, carga, retroceso, los que le
  bajan estadísticas y Enfado y compañía. Revisado con los 1025 (`auditoria-movimientos.mjs`, fuera del
  proyecto): ninguno falla, todos llevan al menos uno de su tipo, salen 276 movimientos distintos y solo 7
  (Ditto, Wobbuffet, Smeargle…) usan los de `MOVIMIENTOS_RESERVA`. Al evolucionar elige de nuevo (el registro
  dice «ahora conoce…»). Las etapas van de −6 a +6 (+1 = ×1,5; −1 = ×⅔) y se borran al retirarse; los
  estados ya no salen por tipo sino del movimiento (ningún movimiento de daño duerme).
- **Acciones obligadas**: tras Hiperrayo o con un movimiento de carga a medias, `accionObligada()` manda: el
  mando solo muestra «Continuar ▸» y el rival no elige (decidirRival la devuelve). El rival aprovecha para
  concentrarse si tú estás escondido o recargando.
- **Uno contra uno**: luchas con tu LUCHADOR (lista 'luchador', uno solo; se elige en el paso 2) y el rival se
  ajusta a él: poder ≈ el suyo × `factorDuelo` (0,88 / 0,97 / 1,05) y preferencia por la ventaja de tipo
  `ESTRATEGIA.tiposDuelo` (−0,6 / 0 / 0,1: en Novato el rival suele estar en desventaja), también en la
  preselección. Todos tienen el doble de vida (`MODOS_BATALLA.duelo.vida`) y el combate empieza solo. Medido
  con 18 luchadores (`balance-luchador.mjs`, fuera del proyecto) con los 4 movimientos reales: Novato ~94 %,
  Retador ~60 %, Maestro ~34 %; dura unos 4–5 turnos. Con un luchador fijo un rival «jefe» era imposible.
- **Batallas con vida** (cada combate es distinto):
  - Rival: «la Montañera Lucía» (nombre al azar + oficio según el tipo más repetido de su equipo + rango por
    dificultad). Habla en bocadillos (`FRASES_RIVAL`): al desafiar, al sacar Pokémon, al perder uno, con el
    último, al evolucionar, al pegar ×2 y al final.
  - Clima: se sortea por escenario (`ESCENARIOS[…].climas`) y dura todo el combate; potencia o debilita tipos
    (`CLIMAS`, factorClima en combate.js) y la arena lo dibuja (lluvia, granizo, arena, niebla, sol).
  - Estados (`ESTADOS`): los provoca el movimiento con su probabilidad real (Rayo 10 %, Escaldar 30 %,
    Moflete Estático 100 %…), salvo a los tipos inmunes. Quemado: −1/16 por turno y golpes físicos ×0,75.
  - Evolución: energía (atacar +34, recibir +20, concentrarse +34; llena = 100). Con la barra llena,
    «¡Evolucionar!» transforma al Pokémon SIN gastar el turno (luego eliges movimiento con su forma nueva):
    misma parte de vida + 15 %, y puede volver a evolucionar si le queda otra fase. El rival evoluciona al
    empezar su turno (`ESTRATEGIA.evoluciona`). Con varias ramas (Eevee) se elige la que más conviene contra
    el rival (`mejorEvolucion`). El árbol se prepara ANTES del combate (`prepararEvoluciones`, combate.js es
    lógica pura). Revisado con los 1025: 539 pueden evolucionar en combate, ninguno falla; las evoluciones
    exclusivas de una región (Runerigus solo desde el Yamask de Galar…) están en `EVOLUCIONES_REGIONALES`
    porque PokéAPI las mete en la misma cadena; las formas sin sprite (Mega-Zygarde) no se usan.
  - Poké Ball al salir (y rayo rojo al volver), grito al salir y al caer (más grave), transición de entrada,
    confeti al ganar.
  - Sonido (sonido.js): los navegadores solo dejan sonar tras un clic, así que `prepararSonido()` se llama
    al empezar `empezar()` (dentro del clic de «Iniciar combate»). Gritos: los .ogg de PokéAPI (`gritoDe`). En los
    juegos casi todos «rugen» con un sonido electrónico (al usuario le sonaban «todos iguales»); solo Pikachu y
    Eevee HABLAN, con las voces del anime, y PokéAPI guarda esas voces como el grito de sus formas «compañero» de
    Let's Go (10158 y 10159): `GRITOS_CON_VOZ` (datos.js) las usa en el escáner, ¿Quién es? y el Duelo. Comprobado
    analizando el audio: el 25 es ruido sin tono; el 10158, sílabas con tono de voz (580–770 Hz). No hay voces de
    los demás (las del anime no son públicas). Un grito `pedido` (botón «Escuchar», pista del grito) suena aunque
    los efectos estén apagados; los automáticos respetan el interruptor. La arena avisa con `sonar(nombre)`; los
    sonidos de los ataques los pide simulacro.js. La música es original (Lam–Fa–Sol–Mi7), se acelera con
    `tensionMusica` (último Pokémon o vida baja) y se para al cerrar.
- **Duelo Pokémon** (#duelo): un paso visible a la vez. Paso 1: modo («Equipo contra equipo» o «Uno contra uno»,
  claves 'equipo' y 'duelo'; cada uno con su lista en `MODOS_BATALLA[modo].lista`), dificultad y escenario.
  Paso 2: tu equipo o tu luchador. Paso 3: resumen + interruptor de pantalla completa + «Iniciar combate».
  simulacro.js avisa con el evento `batalla-terminada` para que duelo.js refresque el récord.
- **Pantalla completa**: Chrome NO deja poner un `<dialog>` en pantalla completa («Dialog elements are
  invalid»): se pide sobre `#simulacro` (dentro de la ventana), en el mismo clic (si no, el navegador la niega).
  La clase `.en-pantalla-completa` deja solo la arena con los marcadores, la barra y el mando flotando encima
  (el mando se oculta mientras se anima el turno; el registro, siempre). Si la API falla o no existe (iPhone),
  la clase sola hace que la ventana ocupe la del navegador. Esc sale de la pantalla completa (fullscreenchange
  quita la clase) sin cerrar la ventana: el `cancel` de la ventana se anula si está (o acaba de estar, 400 ms) en
  pantalla completa; antes el mismo Esc salía Y abandonaba el combate. Para probarla en Chrome sin ventana: CDP `Browser.setPermission`
  ({ name: 'fullscreen', allowWithoutGesture: true }); sin eso responde «not granted».
- **Arenas** (`ESCENARIOS` en datos.js, dibujadas en escenarios.js): diez lugares de verdad, no campos con líneas
  (los de antes parecían canchas de fútbol): bosque antiguo (troncos gigantes, arroyo, corro de setas, rayos de
  luz y luciérnagas), cráter volcánico (río y cascada de lava, grietas que brillan, fumarolas y ascuas), costa
  tropical (olas, muelle, barca, palmeras, poza de marea, un cangrejo y la sombra de una gaviota), cueva de
  cristal (cristales que tiñen de color, estalactitas, lago con gotas), cumbre nevada (montañas al anochecer,
  aurora, pinos, estanque helado, faroles, nieve) y ruinas antiguas (muro con arco y estatuas, antorchas, losas
  con arena y un mosaico de runas que late), y desde la aventura: jardín de los cerezos (pagoda tras el muro,
  grava rastrillada en círculos alrededor de cada plataforma, estanque con carpas que nadan, puente rojo,
  farolillos, pétalos al viento), cañón del desierto (mesetas con estratos, dunas, oasis, cactus, un esqueleto
  enorme, calima y un matojo que rueda), azotea de la ciudad (rascacielos con ventanas, neones que parpadean,
  helipuerto, charcos, ventiladores que giran, un avión) y pilar celeste (losas antiguas sobre un mar de nubes,
  columnas rotas, islas flotantes, nubes y ráfagas que pasan, una bandada). Cada región de la aventura juega sus
  grupos en tres o cuatro de ellas (`arenas` de REGIONES_AVENTURA). Vista 3/4: fondo arriba, suelo en medio y una PLATAFORMA por
  Pokémon en `CASA` (como en los juegos). Pintadas píxel a píxel con paletas cortas, tramado Bayer y luces
  (`iluminar`, también en escalones tramados); lo animado va en `crearAmbiente` → `suelo(p, t)` y `aire(p, t)`
  con los pinceles de la arena. Si llega una clave antigua (tierra, pradera…), se usa el bosque. 60 fps con
  clima y los ataques más cargados.
- **GIF animados**: se descargan ENTEROS (`arrayBuffer`) antes de decodificarlos; con un flujo, `frameCount`
  aún no tenía todos los fotogramas y el Pokémon repetía solo los primeros a toda velocidad. Van a la
  velocidad del archivo, como en Showdown (30–40 ms por fotograma; ≤10 ms vale 100 ms, como en los
  navegadores): frenarlos los dejaba a cámara lenta. Se leen todos los fotogramas (hasta 400: Regieleki tiene
  315) y cada uno se recorta a la caja que cubre el dibujo en todos (mucha menos memoria). Sin `ImageDecoder`
  (Firefox, Safari) se usa `leerGif`, un lector propio (LZW, transparencia, disposición, entrelazado):
  comparado con ImageDecoder en 144 GIF, idéntico píxel a píxel, con los mismos fotogramas y duraciones.
  En pantallas pequeñas (menos de 0,75 píxeles de pantalla por píxel del sprite) el sprite se reduce
  suavizado en vez de con píxeles enteros.
- **Revisión de los 1025** (`auditoria.mjs`, fuera del proyecto, con ImageDecoder y con el lector propio):
  1011 usan el GIF de Showdown, 6 el de Blanco/Negro y 8 no tienen GIF en PokéAPI (Iron Treads, Iron Bundle,
  Iron Jugulis, Iron Leaves, Ogerpon, Iron Boulder, Iron Crown, Pecharunt): con el sprite fijo, la arena los
  hace respirar y dar saltitos. Ninguno falla, tiene fotogramas vacíos o fondo opaco. Los muy alargados
  (Kyogre, Wailord, Dondozo, Stunfisk…) se limitan a `ANCHO_MAXIMO` (185 unidades) y `posicionDe` los aparta
  hacia fuera para que entre los dos quede hueco; las embestidas frenan delante del rival (no lo tapan aunque
  sea diminuto).
- **Arena pixelada** (arena-pixel.js): la batalla se abre en una ventana emergente. El mundo mide 480×270
  unidades (el campo y lo que lo rodea según el escenario elegido) y el
  `<canvas>` se dibuja a la resolución REAL de la pantalla (ResizeObserver + devicePixelRatio): el campo se
  agranda sin suavizar y cada sprite usa un número ENTERO de píxeles de pantalla por píxel del sprite si así
  su tamaño cambia menos de un 6 % (si no, el valor exacto: redondear agrandaba a algunos hasta un 25 %), y se
  mueve píxel a píxel de pantalla (así no se ve a saltos). Los Pokémon usan sus GIF animados (Showdown y,
  si no, Blanco/Negro) decodificados con `ImageDecoder`; si no hay (o el navegador no lo tiene), el sprite fijo.
  Tamaño según la altura real: `altoObjetivo` = 44 × metros^0,75 (de 16 a 140 unidades): Pikachu 22, Lucario 50,
  Charizard 65, Garchomp 71, Onix 140. Se mide en el fotograma TÍPICO del GIF (`altoTipico`, la mediana): con la
  caja de todos los fotogramas, los que agitan las alas (Charizard) salían más pequeños que Greninja. Cámara con temblor, zoom hacia el objetivo y «marco de impacto» (líneas
  radiales) en golpes eficaces. Colores en `PALETAS_ATAQUE`. Bajo el atacante, una placa con el nombre del
  movimiento (`rotulo`). Medido: 60 fps de media con los especiales más cargados (con lluvia).
- **Efectos en pixel art**: los ataques, partículas, climas y destellos se dibujan en DOS capas a baja
  resolución (`RESOLUCION_EFECTOS` = 2 píxeles por unidad, del tamaño de los píxeles de los sprites) que se
  amplían sin suavizar: `capaSuelo` (bajo los Pokémon: escenario, fondos, charcos) y `capaAire` (encima).
  `usar('real' | 'suelo' | 'aire')` cambia el pincel (`ctx`), la escala `S` y el temblor; los tamaños de los
  luchadores (`anchoDe`, `altoDe`) usan siempre `Sreal` para que no cambien según la capa. Antes se dibujaban
  a la resolución de la pantalla con líneas finas y brillos suaves, y desentonaban con los sprites.
- **Animaciones** (con el anime como referencia): `animacionDe(ataque)` busca la clave en `ANIMACIONES`
  (las 479 tienen la suya) y, si un movimiento nuevo no está, usa la de su tipo y clase (`POR_TIPO`). Son
  FAMILIAS con opciones, así que un gesto sirve para muchos: `embestida` (todo el cuerpo envuelto en su
  elemento: esfera eléctrica en Placaje Eléctrico, bola de fuego en Envite Ígneo, pájaro azul en Pájaro Osado,
  anillos en Gigaimpacto; `giro`, `golpes`), `rafaga` (prioridad: imágenes fantasma, `fantasma()`), `punos`
  (puño o pie de píxeles con su energía; A Bocajarro es una lluvia de golpes), `fauces` (mandíbulas de
  energía que se cierran: Triturar, Colmillo Ígneo…), `garras`, `filo` (sable de energía: Hoja Aguda, Tajo
  Umbrío), `tajoLejano`, `tijeras` (X brillante), `cola` (vuelta y coletazo: Acua Cola, Cola Férrea), `latigos`,
  `terremoto` (salta, grieta que corre hasta el rival y lo levanta), `avalancha`, `rocaAfilada`, `taladro`,
  `emboscada` (Vuelo, Excavar, Buceo, Golpe Fantasma: `ocultarse` el primer turno y ataca por sorpresa),
  `nube` (Carantoña), `haz` (Hiperrayo, Rayo Solar, Foco Resplandor… con su carga y adornos), `esfera`, `ola`
  (Surf…), `cielo` (Trueno, Llamarada con forma de 大, Cometa Draco, Ventisca, tornados, lluvia de monedas),
  `proyectiles` (agujas, estrellas, huesos, burbujas, hojas…), `absorber`, `humo`, `descarga`, `pulsoDragon`
  (dragón con cuerpo de anillos que muerde) y los especiales de antes (Lanzallamas, Hidrobomba, Rayo, Hoja
  Mágica, Rayo Hielo, Bomba Lodo, Tierra Viva, Tajo Aéreo, Psíquico —ondula la imagen—, Zumbido, Joya de Luz,
  Bola Sombra, Pulso Umbrío, Fuerza Lunar, Esfera Aural). Todas con formas de pixel art con borde oscuro y,
  mientras duran, el fondo cambia (`fondo(ms, tipo)`, colores en `FONDOS`). Colores por estilo en `TONOS`.
  Otras piezas de la arena: `preparar()` (primer turno de carga: se esconde o brilla, `dibujarMarcas` pinta
  el hoyo, las ondas o el brillo), `esquivar()` (fallo), `curar()` (drenar), `etapas()` (flechas que suben o
  bajan), `noActua('recarga' | 'amedrentado')` y `revelar()` (si lo dejan K.O. escondido). Revisadas en
  galerías (`galeria-movimientos.mjs`) y con `humo-animaciones.mjs` (una de cada fila + las de reserva, también
  con movimiento reducido): ninguna da error; 60 fps con las más cargadas.
  `atacar()` se cumple en el instante del impacto. Cerrar la ventana a mitad de combate es abandonarlo. La
  ventana cabe sin desplazarse en escritorio (ancho del lienzo limitado con `calc((100dvh - 340px) * 16 / 9)`: debajo van el diálogo y el mando).
- **Inicio («Mundo Pokémon»)**: un `<div id="inicio">` con 5 partes en este orden: héroe, «Elige tu camino»
  (bento: Legendarios grande, los 18 tipos, Pokédex y ¿Quién es?), Duelo en vivo (#novedades), Pokémon del día y
  regiones. Ninguna tiene fondo propio: todas se ven sobre `.mundo-fondo`, una capa FIJA (fuera de main, primer
  hijo de body, `z-index:-1`) con dos luces radiales, viñeta, grano SVG (evita escalones en el degradado) y esporas
  que suben. Al bajar, la luz pasa por el tipo del destacado → lima → brasa (Duelo) → tipo del Pokémon del día →
  azul (regiones), con `transition` sobre `--luz-a/--luz-b` registradas con `@property`. La cabecera y el pie son
  transparentes en Inicio para que el fondo siga por detrás. Las tarjetas NO usan `backdrop-filter`: con el fondo
  fijo tendría que recalcularse en cada fotograma del desplazamiento. Medido: 60 fps bajando toda la página (1440 y
  390 px). Mismo lenguaje que Legendarios y el Duelo (serifa con palabra en cursiva, líneas finas, vidrio) en verde
  noche y lima. Las clases del Inicio no deben repetir las de otras vistas (`.quien-silueta` es del juego: la del
  Inicio es `.camino-silueta`).
- **Momentos del día** (héroe del Inicio): como el ciclo de día y noche de los juegos, `MOMENTOS_DEL_DIA` (datos.js)
  reparte el día en madrugada (0–5 h), mañana (6–11), tarde (12–17), atardecer (18–20) y noche (21–23), con la hora
  LOCAL. Cada uno tiene título (dos partes: la segunda en cursiva, con el color `--cielo`), relato (`{0}`, `{1}`, `{2}`
  = sus tres primeros protagonistas, botones: pasar por encima los sube al altar, pulsar abre su ficha), cielo (luz
  de abajo del fondo y brillo tras el título) y su lista de Pokémon para el altar, con detalles de los juegos
  (Espeon de día y Umbreon de noche, Lycanroc diurno / crepuscular / nocturno, Rowlet y Noctowl nocturnos, los
  Clefairy bailan con luna llena; Rowlet NO va de mañana: la Pokédex dice que es nocturno). Las formas usan su id
  de PokéAPI (Lycanroc nocturno 10126, crepuscular 10152) con `{ numero, forma }` para la tarjeta. El reloj se
  repasa cada 15 s: si nadie eligió otro momento con sus botones, el Inicio cambia solo al pasar de franja. Sin
  `data-momento` (antes del JS) título y relato están ocultos (`.hero-cambia`) para que no cambien de golpe. El
  relato reserva 3 líneas (`min-height`) para que el héroe no salte al cambiar de momento.
- **Duelo en vivo** (#novedades, dentro del Inicio): combate de muestra en vivo (parejas reconocibles en `PAREJAS`,
  4 ataques con sus movimientos reales y el daño real, y en cada ronda otra arena), lo nuevo, las 10 arenas (pulsar
  una abre el Duelo con ella elegida) y tu equipo con tu récord. No descarga nada hasta que se ve; la arena se pausa
  con `arena.pausar()` si sale de la pantalla, cambias de vista o de pestaña (un IntersectionObserver, un
  MutationObserver sobre el `hidden` de `#inicio` y visibilitychange). Con movimiento reducido, una escena quieta.
  No usar `<header>` dentro: base.css le pone el estilo de la cabecera de la web.
- **«Atrás» cierra la ficha y el combate** (navegador y botón del celular en la app de Android, que hace
  `web.goBack()`): al abrir cada ventana se añade un paso al historial (`history.pushState({ ficha: true })`,
  `{ batalla: true }`) y `popstate` la cierra; cerrarla con ✕ o Esc quita ese paso (`history.back()`). Antes «Atrás»
  cambiaba de vista por detrás de la ficha o, recién abierta la app, salía de ella. Cambiar de Pokémon dentro de la
  ficha no añade pasos. `mostrarVista()` (vistas.js) solo sube arriba si cambia de vista: así, al cerrar una ficha
  con «Atrás», la Pokédex se queda donde estaba.
- La ficha tiene «Añadir a mi equipo» en la barra superior (no le quita alto: la ficha sigue estática).
- El servidor (ThreadingHTTPServer) solo encola 5 conexiones: el navegador abre 6 como mucho y va bien, pero un
  script que lance 30 peticiones a la vez recibe «connection refused». Limitar la concurrencia en pruebas.
- «¿Quién es?» no descarga nada hasta que se abre su vista (MutationObserver sobre `hidden`), deja precargadas la
  imagen y el registro (pokemon-species) de la siguiente pregunta y pausa el contrarreloj si cambias de vista, de
  pestaña o abres una ficha.
- **¿Quién es?, «el teatro de las sombras»** (#quien): vista con fondo propio como Legendarios, la Pokédex y el Duelo
  (violeta noche y lavanda; cabecera y pie con `body[data-vista="quien"]`). A la izquierda, el texto y el panel de la
  pregunta; a la derecha, el escenario: una pantalla redonda a contraluz (`.quien-luz`) con la ilustración en
  `brightness(0)`, anillo de runas y anillo del contrarreloj (`--restante`); debajo, la placa y las últimas 10
  respuestas (sprites que abren su ficha). `--quien-luz` (registrada con `@property`) es violeta y toma el color del
  tipo al abrir la pista «Tipo» o al revelar: tiñe la pantalla y el fondo de la sección. Al responder
  (`data-estado="revelado"`) aparece el hábitat del tipo o el santuario (habitats.js), destello, chispas lima si
  aciertas, temblor y borde rojo si no, y suena su grito (`urlGrito`, respeta el interruptor de efectos de
  sonido.js, el mismo del Duelo; el botón del escenario lo cambia; la pista del grito suena siempre: la pagaste). Pistas: cuatro cartas selladas que se eligen
  (tipo, región —o la veintena de su número si ya elegiste región—, categoría —o su color en las 127 especies de la
  899 a la 1025, que no la tienen en español— y grito), −3 cada una. La de la inicial se quitó a propósito: con
  ella era demasiado fácil. Puntos: 10 + segundos que sobran
  (contrarreloj) + 5 (experto) + racha (+1 por acierto seguido, hasta +5) − pistas, mínimo 2; el panel los desglosa.
  En Experto vale el nombre en español o la clave de PokéAPI, sin tildes ni signos y con una letra de error si tiene
  6 o más. La zona de abajo del panel (pistas o revelación) y la placa tienen alto fijo para que nada salte.
  Los nombres que se muestran salen de `NOMBRES_ESPANOL` o de `nombreTitulo(clave)`.
- La ficha marca `#resultado[aria-busy]`: `true` mientras carga y `false` al terminar (también lo usan las pruebas).
- `vistas.js` pone `<body data-vista="…">` con la vista activa: así cada vista puede adaptar cabecera y pie
  (Legendarios los vuelve azul noche y dorado desde legendarios.css).
- Legendarios: las 71 cartas se crean una vez y `actualizarArchivo()` muestra las primeras `mostradas` del
  filtro elegido (tandas de 10 con «Ver más»; cambiar de filtro vuelve a 10). Rejilla de 5 columnas: 10 = 2 filas.
- Menú con 7 enlaces («✦ Aventura» lleva una estrella, `.nav-aventura`): `.brand-note` («Explora · combate ·
  descubre») se oculta por debajo de 1320 px, los enlaces se compactan a 1080 px, el menú puede bajar a su propia
  línea a 960 px («Mundo Pokémon» no se parte: `.logo-texto` con nowrap) y en teléfono (≤520 px) es una rejilla de
  4 + 3. Medido de 360 a 1440 px: nunca desborda.
- **Modo aventura** (#aventura, «Nueve copas, una leyenda»): las nueve regiones EN ORDEN; en cada una, su copa al
  estilo de una liga de campeones (liga.js): 16 entrenadores (tú, Kael, el campeón vigente y 13 con nombre de la
  región: líderes, alto mando y rivales de los juegos, cada uno con su tipo favorito, que elige parte de su equipo), sorteo con 4 bombos (tú en el 4; Kael SIEMPRE en tu grupo; el campeón en la otra mitad
  del cuadro, así que solo puede cruzarse contigo en la final, y gana todos sus combates simulados: la final es
  siempre contra él), grupos de 4 a una vuelta (primero contra el del bombo 3, luego Kael, por último el cabeza de
  serie; 3 puntos por victoria; el marcador son los K.O., «6–2»; desempates: diferencia de K.O., K.O. hechos,
  enfrentamiento directo), cuartos (1.º contra 2.º del grupo vecino), semifinal y final a partido único. Los demás
  combates se simulan con la fuerza de cada entrenador. TU EQUIPO es un «random lock»: 5 al azar y 1 inicial que
  eliges entre 3, todos de la región, cada uno con un 1 % de ser legendario o singular (medido: 1,00 %), sellado
  toda la copa; si te eliminan, la próxima temporada sorteas OTRO equipo (lo pidió el usuario; antes se repetía con
  el mismo) con +1 nivel por intento (hasta +3, «la experiencia de tus intentos»). Subes un nivel
  por victoria. Entre bastidores: niveles de Nv. 5–13 en Kanto a Nv. 88–94 en Paldea; desde Kalos, sin ayudas de
  tipos. Ases de los campeones: el pseudolegendario de su región (en Kanto y Hoenn su fase media, que puede evolucionar
  en plena final: Dragonair y Metang; en Johto, Tyranitar). Los campeones son guiños a los del anime y los juegos:
  Lance, Karen, Steven, Cynthia, Iris, Diantha, Kukui, Leon y Geeta (con aspectos nuestros). Geeta, en PALDEA, lleva Koraidon o
  Miraidon y cinco leyendas «medias» (aves, bestias, gólems, trío del lago, espadas, tapus…) unos niveles por debajo
  de ti: con las de 680 de poder (Mewtwo, Rayquaza, Dialga…) no se ganaba ni con 8 niveles a favor. Las eliminatorias
  y la final se juegan en el ESTADIO (escenarios.js) con público; la final empieza con himno, ovación y letreros.
  El equipo del rival se decide al ver la previa (planEquipoRival → descarga ~32 candidatos → completarEquipoRival,
  con semilla) y se guarda en la temporada; «¡Al combate!» espera a tenerlo (así empezarCombate va dentro del clic).
  Cerrar el combate a medias no cuenta: el partido sigue pendiente. EQUILIBRIO medido con miles de temporadas
  simuladas con el motor real y datos del snapshot (`balance-aventura`, fuera del proyecto; un «jugador» automático
  con la estrategia del Maestro): copa ganada al primer intento ≈ Kanto 59 %, Johto 59 %, Hoenn 41 %, Sinnoh 26 %,
  Teselia 26 %, Kalos 16 %, Alola 12 %, Galar 7 %, Paldea 6 % (la final de Paldea, ≈ 10–20 % si llegas). Un 6
  contra 6 amplifica cualquier ventaja pequeña: por eso la CURVA sube a pasos finos; la estrategia «maestro» del
  rival pesa muchísimo (solo en las finales desde Teselia). Si cambias la curva, vuelve a medir.
- **Entrenadores** (entrenador.js): SOLO hay dos clases. Historia: el usuario rechazó un dibujo de perfil («feos»), luego
  uno de 3/4 hecho pieza a pieza al estilo de HG/SS (gorras, chaquetas, pantalones, peinados…) y, el 2026-11-25, pasó
  una imagen (pixel art ampliado ×5: un chico con pañuelo azul marino, camiseta de rayas azules y blancas, bandolera
  lila, pantalón pirata gris y zapatillas azules) pidiendo «hazlo estilo anime como se ve en la imagen»; al ver a un
  rival con el dibujo antiguo dijo «no quiero que hayan personajes así, quítalos todos»: ese dibujo se BORRÓ.
  - ESTILO ANIME (tu entrenador, Kael y todo el que no sea de los juegos, también un rival cuyo sprite no carga): la
    imagen pasada a su rejilla real (57×108) y a letras por material (ANIME; el script que lo hizo está fuera del
    proyecto), volteada para mirar a la derecha. Sus colores se cambian con tonoComo (mismo giro de tono y misma
    proporción de claridad que en el original: con los colores por defecto queda idéntico; el pelo, con mezclas
    moderadas: con la proporción del original, casi negro, un pelo claro salía lleno de rayas). Piezas
    (ENTRENADOR_ANIME, plantillaAnime): pañuelo o sin él (el pañuelo se vuelve pelo, con brillo y sombra), peinado
    corto, de punta (PINCHOS: mechones hacia atrás) o largo (peloLargo: un mechón a cada lado hasta los hombros; lo
    llevan las chicas al azar), camiseta de rayas o lisa, pirata o largo, bandolera o sin bolsa (quitarBandolera: tapa
    la correa con la camiseta de su fila y redibuja el contorno). `ojos` solo por datos. Los aspectos de antes pasan
    solos (aAnime): sin gorra → sin pañuelo, otra → pañuelo; rayas o lisa; pirata o largo; coleta → largo.
  - KAEL: estilo anime distinto del tuyo (sin pañuelo, pelo plateado de punta, ojos rojos, jersey rojo liso, pantalón
    largo negro); aspectoDeParticipante() le da siempre el de RIVAL_AVENTURA (también en temporadas guardadas).
  - RIVALES DE LOS JUEGOS: el usuario pasó la hoja de sprites de Platino y dijo «estos sean los rivales»: los
    campeones (Cynthia, la de la 4.ª generación), los 13 de cada copa (en Sinnoh, los de su hoja: Barry, Dawn, Lucas,
    líderes, Cyrus, Palmer…; los del anime sin sprite —Ritchie, Paul, Drew, Trip…— se cambiaron por otros de su región;
    en temporadas guardadas antes siguen esos nombres, en estilo anime) y, en el Duelo, la clase de entrenador de su
    oficio (`ENTRENADORES.sprites`: Nadadora, Montañero, Karateka…). aspectoDeParticipante() (liga.js) les pone el
    sprite también a las temporadas ya guardadas. Su aspecto de reserva (si no carga) es de estilo anime.
  - Una sola imagen por entrenador: las poses la mueven (POSE: un paso al lanzar y al señalar, salto al celebrar,
    triste más oscuro). En la arena, a 1 unidad por píxel los de los juegos y a 0,72 los de estilo anime (miden igual);
    7 unidades por detrás de los Pokémon. En el mapa, tú reducido a 0,6 y suavizado. En la página, los retratos de los
    juegos miden múltiplos de 80 px y los de estilo anime (.retrato-anime) múltiplos de 112 y, en pequeño, suavizados.
- **Ataques GBA** (sprites-ataques.js + ataqueGBA en arena-pixel.js): el usuario dijo que los ataques «se veían muy
  sencillos» y pasó una especificación: pixel art de Game Boy Advance, sin suavizado ni alfa parcial, contorno
  exterior grueso y oscuro, núcleo blanco con 2–3 tonos saturados hacia el borde, píxeles sueltos alrededor, tiras de
  5 fotogramas de 48×48 y paletas EXACTAS para fuego (#5A0000 #D81800 #FF7800 #FFE800 #FFFFFF), agua (#001848
  #0058D8 #18B8FF #98F0FF #FFFFFF), eléctrico (#482800 #D89000 #FFF018 #FFFFFF), planta (#083008 #188818 #78E818
  #E8FFB8) y fantasma (#180028 #581088 #C838E8 #F8B8FF): no cambiarlas. Los otros 13 tipos siguen la misma estructura.
  Cada movimiento usa la tira de SU tipo con un patrón (`patronDe`): contacto y golpes (físicos: embiste con el aura
  del tipo y golpea), proyectil, rafaga (varios), haz (rayos, cañones, Lanzallamas, Hidrobomba…), cielo (cae de
  arriba: Trueno, Ventisca, Avalancha…) y suelo (sale de debajo del rival: Terremoto, Surf, Tierra Viva…). El sprite
  se dibuja en la capa de efectos con un número entero de píxeles por píxel del sprite (`spriteAtaque`), el
  impacto pasa por los fotogramas 2→3→4 con temblor, golpe de cámara, destello y chispas, y en los fuertes (potencia
  ≥ 100) el «marco de impacto». atacar() se sigue cumpliendo en el instante del impacto.
- **Mapa de la aventura** (mapa-aventura.js): el archipiélago se pinta píxel a píxel (forma de cada isla con ruido,
  bajíos, arena, acantilados y su paisaje) una vez por estado (región en curso + copas ganadas) y cada fotograma se
  copia y se le dibuja encima lo que se mueve, en un lienzo del mundo (960×400) que se amplía sin suavizar al visible.
  Los botones de las islas son HTML posicionados en % encima (--x, --y). Se pausa si no se ve (IntersectionObserver,
  `hidden` de la sección y visibilitychange). Al ganar una copa, «Viajar a…» hace caminar a tu entrenador por la ruta.
- **Combate con aire de juego de rol** (simulacro.js + el final de simulacro.css): el usuario pasó como referencia
  una escena de combate en pixel art con los marcadores sobre el campo, el cuadro de diálogo abajo a la izquierda y
  el menú abajo a la derecha. El DOM es: barra · `.arena-cuerpo` (rejilla: `escena` arriba; `dialogo` y `mando`
  abajo) con `.arena-lienzo-marco` (lienzo + `.arena-marcadores` encima + bocadillo), `.arena-registro-marco` y el
  mando. En ≤700 px los marcadores vuelven a ir encima del lienzo (no sobre él).
- Legendarios usa su propia paleta (azul medianoche + oro) y la letra con serifa (Playfair) en todo: es intencionado,
  para que la vista se sienta distinta. El Duelo usa el MISMO lenguaje con otra paleta (verde bosque casi
  negro + brasa): una versión anterior «de videojuego» (cielo, Poké Balls, colores chillones) se descartó por
  infantil y por no ir con la web. La maqueta 3D: el plano gira `rotateX(50deg)` y cada figura
  `rotateX(-50deg)` desde sus pies (`transform-style:preserve-3d`); sus medidas van en `cqw` (ancho de la
  maqueta) para que en el móvil no se amontonen. `--tipo-a/--tipo-b` están registradas con `@property` para animar el color.
- Rareza: `rarezaDe(id)` (datos.js) usa `LEGENDARIOS` (71) y `SINGULARES` (23). Ambas listas se comprobaron contra
  las 1025 especies de PokéAPI (is_legendary / is_mythical): no falta ni sobra ninguna. Las formas (Mega…) usan
  el id de su especie (`pokemon.species.url`) para la rareza y la región.
- `LEGENDARIOS` (71) se generó desde PokéAPI y se comprobó que todas son `is_legendary`. La especie en español
  de las de 9.ª generación y Enamorus no existe en PokéAPI: está traducida a mano en datos.js.
- `TABLA_TIPOS` se comprobó contra PokéAPI (/type/<tipo>, damage_relations): coincide en los 18 tipos.
- `.tabla-tipos-marco` necesita `position:relative`: sin él, los textos `.solo-lectores` (absolutos) de la
  tabla escapan del contenedor con scroll y ensanchan toda la página en móvil.

## Pendiente / ideas

- Modo aventura: evolución permanente al subir de nivel (COMO_EVOLUCIONA ya dice «Nv. 16»), más frases y una
  pequeña escena de llegada a cada región; animaciones de ataque más grandes y vistosas (el usuario quiere que se
  parezcan a su referencia de combate: llamas y partículas grandes sobre un escenario muy detallado).

- Movimientos en la ficha (el Duelo ya usa los reales: datos-movimientos.js). El equipo del Duelo Pokémon ya
  hace de favoritos (hasta 6).
- `archivo/` se puede borrar cuando ya no haga falta comparar con la versión anterior.
