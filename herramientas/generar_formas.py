"""Genera static/js/datos-formas.js: el nombre en español de las formas de PokéAPI.

En PokéAPI cada Pokémon tiene una clave. Casi siempre es la de su especie ('pikachu'), pero hay dos casos en que no:
  · 37 especies cuya forma POR DEFECTO lleva apellido: 'giratina-altered', 'deoxys-normal', 'lycanroc-midday'…
    (por eso la ficha de Giratina salía como «Giratina Altered»);
  · las formas alternativas: megaevoluciones, Gigamax, formas regionales, Giratina Origen…
Para cada una guarda el nombre de la forma en español (pokemon-form → form_names), la clave de su especie y si es
la forma por defecto. utilidades.js → nombreTitulo() y nombreForma() lo usan para mostrar nombres correctos.
Solo hace falta volver a ejecutarlo si PokéAPI añade especies o formas nuevas:

    python herramientas/generar_formas.py

Necesita internet (lee https://pokeapi.co directamente). Solo usa la biblioteca estándar.
"""

import json
import pathlib
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = 'https://pokeapi.co/api/v2/'
SALIDA = pathlib.Path(__file__).resolve().parent.parent / 'static' / 'js' / 'datos-formas.js'


def leer(url):
    # El mismo identificador que usa el servidor (servidor/config.py): PokéAPI rechaza el de Python por defecto.
    solicitud = urllib.request.Request(url, headers={'User-Agent': 'ProyectoPokemon/1.0'})
    with urllib.request.urlopen(solicitud, timeout=60) as respuesta:
        return json.load(respuesta)


def id_de(url):
    return int(url.rstrip('/').split('/')[-1])


# Cuando PokéAPI no trae el nombre en español: apellidos con nombre oficial seguro. Las megaevoluciones y
# Gigamax se nombran con la especie (ver por_regla). Lo que no está aquí se queda sin nombre (null) antes que
# inventar uno que no sea el de los juegos.
APELLIDOS = {
    'hisui': 'Forma de Hisui', 'paldea': 'Forma de Paldea', 'alola': 'Forma de Alola', 'galar': 'Forma de Galar',
    'totem': 'Dominante', 'totem-alola': 'Dominante', 'totem-busted': 'Dominante', 'totem-disguised': 'Dominante',
    'female': 'Hembra', 'male': 'Macho', 'origin': 'Forma Origen', 'incarnate': 'Forma Avatar', 'therian': 'Forma Tótem',
    'white-striped': 'Forma Raya Blanca', 'two-segment': 'Forma Binodular', 'three-segment': 'Forma Trinodular',
    'family-of-three': 'Familia de Tres', 'family-of-four': 'Familia de Cuatro', 'zero': 'Forma Ingenua',
    'hero': 'Forma Heroica', 'roaming': 'Forma Andante', 'curly': 'Forma Curvada', 'droopy': 'Forma Lánguida',
    'stretchy': 'Forma Recta', 'green-plumage': 'Plumaje Verde', 'blue-plumage': 'Plumaje Azul',
    'yellow-plumage': 'Plumaje Amarillo', 'white-plumage': 'Plumaje Blanco', 'paldea-combat-breed': 'Raza Combatiente',
    'paldea-blaze-breed': 'Raza Ardiente', 'paldea-aqua-breed': 'Raza Acuática',
}


def nombre_forma(clave):
    """Nombre de la forma en español, o None si PokéAPI no lo tiene."""
    try:
        forma = leer(BASE + 'pokemon-form/' + clave)
    except urllib.error.HTTPError:
        # Unas pocas formas no se llaman igual que su Pokémon: se busca la primera forma del Pokémon.
        forma = leer(leer(BASE + 'pokemon/' + clave)['forms'][0]['url'])
    return next((n['name'] for n in forma['form_names'] if n['language']['name'] == 'es'), None)


def nombre_especie(clave):
    return next(n['name'] for n in leer(BASE + 'pokemon-species/' + clave)['names'] if n['language']['name'] == 'es')


def por_regla(clave, especie):
    """El nombre que PokéAPI no trae: Mega-Absol Z, Charizard Gigamax, Forma de Hisui…"""
    partes = clave[len(especie) + 1:].split('-')
    if 'mega' in partes:
        letra = partes[-1].upper() if partes[-1] in ('x', 'y', 'z') else ''
        return ('Mega-' + nombre_especie(especie) + ' ' + letra).strip()
    if partes[-1] == 'gmax':
        return nombre_especie(especie) + ' Gigamax'
    return APELLIDOS.get('-'.join(partes))


def main():
    especies = {id_de(e['url']): e['name'] for e in leer(BASE + 'pokemon-species?limit=2000')['results']}
    claves_especie = sorted(especies.values(), key=len, reverse=True)  # la más larga primero ('mr-mime' antes que 'mr')
    formas = []
    for pokemon in leer(BASE + 'pokemon?limit=2000')['results']:
        clave, numero = pokemon['name'], id_de(pokemon['url'])
        if numero in especies:  # forma por defecto: su número es el de la especie
            if clave != especies[numero]:
                formas.append((clave, especies[numero], 1))
        else:  # forma alternativa: su clave empieza por la de la especie ('mr-mime-galar' → 'mr-mime')
            especie = next((e for e in claves_especie if clave.startswith(e + '-')), None)
            if especie:
                formas.append((clave, especie, 0))
            else:
                print('Sin especie:', clave)

    with ThreadPoolExecutor(max_workers=8) as hilos:
        nombres = list(hilos.map(lambda f: nombre_forma(f[0]) or por_regla(f[0], f[1]), formas))
    filas = sorted((clave, [nombre, especie, defecto]) for (clave, especie, defecto), nombre in zip(formas, nombres))
    lineas = [f'  {json.dumps(clave)}: {json.dumps(valor, ensure_ascii=False)},' for clave, valor in filas]
    SALIDA.write_text(
        '// Generado por herramientas/generar_formas.py desde PokéAPI: no editar a mano.\n'
        '// Pokémon cuya clave no es la de su especie → [nombre de la forma en español (null si PokéAPI no lo tiene),\n'
        '// clave de la especie, 1 si es la forma POR DEFECTO de la especie]. Lo usan nombreTitulo() y nombreForma()\n'
        "// (utilidades.js): 'giratina-altered' → «Giratina», 'giratina-origin' → «Giratina (Forma Origen)».\n"
        'export const FORMAS = {\n' + '\n'.join(lineas) + '\n};\n',
        encoding='utf-8')
    sin_nombre = sum(1 for _, (nombre, _e, _d) in filas if not nombre)
    print(f'{len(filas)} formas guardadas en {SALIDA} ({sin_nombre} sin nombre en español)')


if __name__ == '__main__':
    main()
