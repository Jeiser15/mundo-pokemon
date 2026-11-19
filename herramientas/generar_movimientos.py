"""Genera static/js/datos-movimientos.js: los movimientos de daño de PokéAPI que se usan en el Duelo.

Para cada movimiento guarda su nombre en español, tipo, potencia, precisión, clase (físico o especial),
prioridad y sus efectos (retroceso, drenar, recarga, estados, cambios de estadísticas…). El combate elige
con ellos los 4 movimientos de cada Pokémon entre los que aprende de verdad (combate.js → movimientosDe).
Solo hace falta volver a ejecutarlo si PokéAPI añade movimientos nuevos:

    python herramientas/generar_movimientos.py

Necesita internet (lee https://pokeapi.co directamente). Solo usa la biblioteca estándar.
"""

import json
import pathlib
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = 'https://pokeapi.co/api/v2/'
SALIDA = pathlib.Path(__file__).resolve().parent.parent / 'static' / 'js' / 'datos-movimientos.js'

# Movimientos que no tienen sentido en estas reglas (el usuario se debilita, daño fijo, solo el primer
# turno, esperan turnos, dependen de objetos o de estados que no existen aquí, formas especiales…).
EXCLUIDOS = {
    'explosion', 'self-destruct', 'misty-explosion', 'final-gambit', 'memento', 'healing-wish', 'lunar-dance',
    'fake-out', 'first-impression', 'last-resort', 'belch', 'snore', 'sleep-talk', 'dream-eater', 'focus-punch',
    'synchronoise', 'spit-up', 'natural-gift', 'fling', 'future-sight', 'doom-desire', 'bide', 'struggle',
    'shell-trap', 'sky-drop', 'beat-up', 'present', 'echoed-voice', 'round', 'fusion-flare', 'fusion-bolt',
    'pollen-puff', 'steel-roller', 'expanding-force', 'rising-voltage', 'terrain-pulse', 'misty-terrain',
    'burn-up', 'double-shock', 'hyperspace-fury', 'dark-void', 'relic-song', 'judgment', 'multi-attack',
    'techno-blast', 'revelation-dance', 'tera-blast', 'tera-starstorm', 'upper-hand', 'thunderclap', 'fickle-beam',
    'ruination', 'comeuppance',
    # Los de Pokémon: Let's Go (solo los usan el Pikachu y el Eevee compañeros).
    'buzzy-buzz', 'sizzly-slide', 'zippy-zap', 'bouncy-bubble', 'glitzy-glow', 'baddy-bad', 'freezy-frost',
    'floaty-fall', 'splishy-splash', 'sappy-seed', 'sparkly-swirl',
}

# Nombres en español de PokéAPI que no coinciden con los oficiales de los juegos.
NOMBRES = {'flash-cannon': 'Foco Resplandor'}

# Potencia que usa el combate cuando la de PokéAPI no sirve tal cual (golpes que suben de fuerza, o
# que doblan su potencia sin objeto, como Acróbata: aquí no hay objetos).
# (PokéAPI no trae los golpes de algunos de la 9.ª generación: Láser Doble, Cuchilla Taquiónica.)
POTENCIA = {'triple-kick': 50, 'triple-axel': 100, 'population-bomb': 100, 'acrobatics': 110, 'twin-beam': 80,
            'tachyon-cutter': 100, 'triple-dive': 90}

# Pierde un turno: después (recarga) o antes (carga; con el modo de la animación del primer turno).
RECARGA = {'hyper-beam', 'giga-impact', 'blast-burn', 'hydro-cannon', 'frenzy-plant', 'rock-wrecker',
           'roar-of-time', 'prismatic-laser', 'eternabeam', 'meteor-assault'}
CARGA = {
    'solar-beam': 'sol', 'solar-blade': 'sol', 'sky-attack': 'brillo', 'skull-bash': 'brillo',
    'razor-wind': 'brillo', 'meteor-beam': 'brillo', 'electro-shot': 'brillo', 'freeze-shock': 'brillo',
    'ice-burn': 'brillo', 'fly': 'aire', 'bounce': 'aire', 'dig': 'tierra', 'dive': 'agua',
    'phantom-force': 'sombra', 'shadow-force': 'sombra',
}
# Cuestan la mitad de la vida máxima de quien los usa.
COSTE_VIDA = {'mind-blown': 50, 'steel-beam': 50, 'chloroblast': 50}
# Más fuertes cuanta más vida le queda (a vida llena, su potencia).
SEGUN_VIDA = {'eruption', 'water-spout', 'dragon-energy'}

ESTADOS = {'paralysis': 'paralizado', 'burn': 'quemado', 'freeze': 'congelado', 'poison': 'envenenado',
           'sleep': 'dormido'}
ESTADISTICAS = {'attack', 'defense', 'special-attack', 'special-defense', 'speed'}


def leer(url):
    # El mismo identificador que usa el servidor (servidor/config.py): PokéAPI rechaza el de Python por defecto.
    solicitud = urllib.request.Request(url, headers={'User-Agent': 'ProyectoPokemon/1.0'})
    with urllib.request.urlopen(solicitud, timeout=60) as respuesta:
        return json.load(respuesta)


def nombre_en(datos, idioma):
    return next((n['name'] for n in datos['names'] if n['language']['name'] == idioma), None)


def efectos(datos):
    """Los efectos que entiende el combate, solo los que tiene (un objeto vacío si ninguno)."""
    clave = datos['name']
    meta = datos.get('meta') or {}
    extra = {}
    estado = ESTADOS.get((meta.get('ailment') or {}).get('name'))
    if estado:
        extra['estado'] = estado
        extra['probEstado'] = meta.get('ailment_chance') or 100
    drena = meta.get('drain') or 0
    if drena < 0:
        extra['retroceso'] = -drena  # % del daño hecho que se hace a sí mismo
    elif drena > 0:
        extra['drena'] = drena  # % del daño hecho que recupera
    if clave in COSTE_VIDA:
        extra['costeVida'] = COSTE_VIDA[clave]
    if clave in RECARGA:
        extra['recarga'] = True
    if clave in CARGA:
        extra['carga'] = CARGA[clave]
    if clave in SEGUN_VIDA:
        extra['segunVida'] = True
    if meta.get('flinch_chance'):
        extra['amedrentar'] = meta['flinch_chance']
    cambios = {c['stat']['name']: c['change'] for c in datos.get('stat_changes') or []
               if c['stat']['name'] in ESTADISTICAS}
    categoria = (meta.get('category') or {}).get('name', '')
    if cambios and categoria in ('damage-raise', 'damage-lower'):
        extra['cambios'] = cambios
        extra['aQuien'] = 'propio' if categoria == 'damage-raise' else 'rival'
        extra['probCambio'] = meta.get('stat_chance') or 100
    minimo, maximo = meta.get('min_hits'), meta.get('max_hits')
    if minimo and maximo and maximo > 1:
        extra['golpes'] = [minimo, maximo]
    return extra


def potencia(datos, extra):
    """Potencia por turno: con varios golpes, la de cada golpe por los golpes que da de media."""
    if datos['name'] in POTENCIA:
        return POTENCIA[datos['name']]
    golpes = extra.get('golpes')
    if not golpes:
        return datos['power']
    media = 3.1 if golpes == [2, 5] else (golpes[0] + golpes[1]) / 2  # de 2 a 5: 35 %, 35 %, 15 %, 15 %
    return round(datos['power'] * media)


def movimiento(item):
    for intento in range(3):
        try:
            datos = leer(item['url'])
            break
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None  # la lista de PokéAPI enlaza alguno que aún no existe
            if intento == 2:
                raise
        except OSError:
            if intento == 2:
                raise
    if datos['name'] in EXCLUIDOS or datos['damage_class']['name'] == 'status' or not datos['power']:
        return None
    if datos['name'].startswith('max-') or datos['name'].startswith('g-max-') or not datos['learned_by_pokemon']:
        return None  # movimientos Dinamax y Z: no los aprende ningún Pokémon
    nombre = (NOMBRES.get(datos['name']) or nombre_en(datos, 'es') or nombre_en(datos, 'en')
              or datos['name'].replace('-', ' ').title())
    clase = 'f' if datos['damage_class']['name'] == 'physical' else 'e'
    extra = efectos(datos)
    precision = datos['accuracy'] or None  # sin precisión (o 0, en alguno nuevo): no falla nunca
    fila = [nombre, datos['type']['name'], potencia(datos, extra), precision, clase, datos['priority']]
    if extra:
        fila.append(extra)
    return datos['name'], fila


def main():
    lista = leer(BASE + 'move?limit=2000')['results']
    with ThreadPoolExecutor(max_workers=8) as hilos:
        resultado = [r for r in hilos.map(movimiento, lista) if r]
    resultado.sort()
    lineas = [f'  {json.dumps(clave)}: {json.dumps(valor, ensure_ascii=False)},' for clave, valor in resultado]
    SALIDA.write_text(
        '// Generado por herramientas/generar_movimientos.py desde PokéAPI: no editar a mano.\n'
        '// Movimientos de daño que se usan en el Duelo (combate.js → movimientosDe):\n'
        '// clave de PokéAPI → [nombre en español, tipo, potencia (por turno), precisión (null = no falla),\n'
        "//                     clase ('f' físico, 'e' especial), prioridad (más alta = actúa antes), efectos?]\n"
        '// efectos (solo los que tiene): estado + probEstado (%), retroceso / drena (% del daño hecho),\n'
        '// costeVida (% de su vida máxima), recarga (pierde el turno siguiente), carga (pierde el turno de antes;\n'
        "// 'aire', 'tierra', 'agua' y 'sombra' además lo esconden), segunVida, amedrentar (%), cambios\n"
        "// ({ estadística: etapas }) + aQuien ('propio' o 'rival') + probCambio (%), golpes ([mínimo, máximo]).\n"
        'export const MOVIMIENTOS_DATOS = {\n' + '\n'.join(lineas) + '\n};\n',
        encoding='utf-8')
    print(f'{len(resultado)} movimientos de daño guardados en {SALIDA}')


if __name__ == '__main__':
    main()
