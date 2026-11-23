"""Genera static/js/datos-evoluciones.js: cómo evoluciona cada especie, en pocas palabras y en español.

PokéAPI describe cada evolución con una lista de «detalles» (evolution-chain → evolves_to → evolution_details): uno
por juego y por camino, con decenas de campos (nivel, objeto, hora, amistad, lugar, sexo, región…). La ficha solo
tiene sitio para una etiqueta corta en la flecha de la cadena evolutiva («Nv. 16», «Piedra Trueno», «Intercambio»),
así que este programa elige el detalle que vale en los juegos actuales y lo resume:

  · se quedan los detalles «por defecto» (is_default) y, entre ellos, los que no dependen de una región
    (Pikachu → Raichu: «Piedra Trueno», no la versión de Alola, que es una forma);
  · las formas regionales que evolucionan a su manera (el Vulpix de Alola, con Piedra Hielo) no cuentan;
  · si quedan varios caminos (Lycanroc de día, de noche o al atardecer; las 63 vueltas de Alcremie), solo se
    escribe lo que tienen en común («Nv. 25», «Girar con un confite»); si no tienen nada en común y cada uno es un
    objeto (los pergaminos de Urshifu), uno u otro;
  · si la evolución solo existe desde una forma regional (Runerigus desde el Yamask de Galar), se guarda también
    la región: la ficha escribe «Forma de Galar» bajo la flecha.

Los nombres de objetos, movimientos, tipos y especies se leen en español de PokéAPI. Solo hace falta volver a
ejecutarlo si PokéAPI añade especies o cambia sus evoluciones:

    python herramientas/generar_evoluciones.py

Necesita internet (lee https://pokeapi.co directamente). Solo usa la biblioteca estándar.
"""

import json
import pathlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

BASE = 'https://pokeapi.co/api/v2/'
SALIDA = pathlib.Path(__file__).resolve().parent.parent / 'static' / 'js' / 'datos-evoluciones.js'

HORA = {'day': 'de día', 'night': 'de noche', 'dusk': 'al atardecer'}
SEXO = {1: 'hembra', 2: 'macho'}
FISICO = {1: 'Ataque > Defensa', -1: 'Ataque < Defensa', 0: 'Ataque = Defensa'}
REGIONES = {'alola': 'Alola', 'galar': 'Galar', 'hisui': 'Hisui', 'paldea': 'Paldea'}


def leer(url):
    # El mismo identificador que usa el servidor (servidor/config.py): PokéAPI rechaza el de Python por defecto.
    solicitud = urllib.request.Request(url, headers={'User-Agent': 'ProyectoPokemon/1.0'})
    with urllib.request.urlopen(solicitud, timeout=60) as respuesta:
        return json.load(respuesta)


@lru_cache(maxsize=None)
def en_espanol(recurso, clave):
    """Nombre en español de un objeto, movimiento, tipo o especie de PokéAPI."""
    nombres = leer(f'{BASE}{recurso}/{clave}')['names']
    return next((n['name'] for n in nombres if n['language']['name'] == 'es'), clave.replace('-', ' ').title())


def nombre(recurso, valor):
    return en_espanol(recurso, valor['name'])


def partes_de(detalle):
    """Las condiciones de un detalle, cada una en pocas palabras: ['Nv. 25', 'de noche']."""
    d = {clave: valor for clave, valor in detalle.items() if valor not in (None, False, '', [])}
    disparo = d['trigger']['name']
    partes = []
    veces = d.get('min_move_count')
    if disparo in ('level-up', 'in-battle-level-up'):
        if 'min_level' in d:
            partes.append(f"Nv. {d['min_level']}")
        if 'min_happiness' in d or 'min_affection' in d:
            partes.append('amistad')
        if 'min_beauty' in d:
            partes.append('belleza')
        if 'known_move' in d:
            partes.append('con ' + nombre('move', d['known_move']))
        if 'known_move_type' in d:
            partes.append('con un mov. ' + nombre('type', d['known_move_type']))
        if 'used_move' in d:
            partes.append(f"usar {nombre('move', d['used_move'])}" + (f' ×{veces}' if veces else ''))
        if 'held_item' in d:
            partes.append('con ' + nombre('item', d['held_item']))
        if 'party_species' in d:
            partes.append(f"con {nombre('pokemon-species', d['party_species'])} en el equipo")
        if 'party_type' in d:
            partes.append(f"{nombre('type', d['party_type'])} en el equipo")
        if 'relative_physical_stats' in d or detalle.get('relative_physical_stats') == 0:
            partes.append(FISICO[detalle['relative_physical_stats']])
        if 'near_special_rock' in d:
            partes.append('junto a una roca especial')
        elif 'location' in d:
            partes.append('en un lugar especial')
        if 'needs_overworld_rain' in d:
            partes.append('con lluvia')
        if 'turn_upside_down' in d:
            partes.append('consola boca abajo')
        if 'min_steps' in d:
            partes.append(f"{d['min_steps']} pasos")
        if 'needs_multiplayer' in d:
            partes.append('con otros jugadores')
        if not partes:
            partes.append('subir de nivel')
    elif disparo == 'use-item':
        partes.append(nombre('item', d['item']))
    elif disparo == 'trade':
        partes.append('intercambio')
        if 'held_item' in d:
            partes.append('con ' + nombre('item', d['held_item']))
        if 'trade_species' in d:
            partes.append('por ' + nombre('pokemon-species', d['trade_species']))
    elif disparo == 'spin':
        partes.append('girar con un confite')
    elif disparo == 'shed':
        partes.append('hueco en el equipo')
    elif disparo == 'three-critical-hits':
        partes.append('3 golpes críticos')
    elif disparo == 'take-damage':
        partes.append(f"tras perder {d['min_damage_taken']} PS")
    elif disparo == 'recoil-damage':
        partes.append(f"{d['min_damage_taken']} PS de retroceso")
    elif disparo in ('use-move', 'strong-style-move', 'agile-style-move'):
        movimiento = d.get('used_move') or d.get('known_move')
        partes.append(f"usar {nombre('move', movimiento)}" + (f' ×{veces}' if veces else ''))
    elif disparo == 'three-defeated-bisharp':
        partes.append('vencer a 3 Bisharp')
    elif disparo == 'meltan-candies':
        partes.append('400 caramelos')
    elif disparo == 'tower-of-darkness':
        partes.append('Torre de la Oscuridad')
    elif disparo == 'tower-of-waters':
        partes.append('Torre del Agua')
    elif disparo == 'gimmighoul-coins':
        partes.append('999 monedas')
    else:
        print('Disparo sin traducir:', disparo)
        partes.append('evolución especial')
    if 'time_of_day' in d and d['time_of_day'] in HORA:
        partes.append(HORA[d['time_of_day']])
    if 'gender' in d:
        partes.append(SEXO[d['gender']])
    # Wurmple: Silcoon o Cascoon según un número oculto del Pokémon (la mitad de las veces cada uno).
    azar = d.get('condition_expression', {}).get('percentage_chance')
    if azar and azar < 100 and 'evolved_pokemon_form' not in d:
        partes.append('al azar')
    return partes


def forma_regional(detalle, padre):
    """La región si la evolución pide la forma regional de su especie ('yamask-galar' → 'Galar'); si no, None."""
    forma = (detalle.get('required_pokemon_form') or {}).get('name') or ''
    return REGIONES.get(forma.removeprefix(padre + '-'))


def resumir(detalles, padre):
    """Etiqueta corta de una evolución y, si solo ocurre desde una forma regional, su región: ['Nv. 28', 'Galar']."""
    if not detalles:
        return None
    candidatos = [d for d in detalles if d.get('is_default')] or detalles
    candidatos = [d for d in candidatos if not d.get('region')] or candidatos
    # Las formas regionales evolucionan a su manera (el Vulpix de Alola, con Piedra Hielo): cuenta la normal.
    candidatos = [d for d in candidatos if not forma_regional(d, padre)] or candidatos
    listas = [partes_de(d) for d in candidatos]
    # Varios caminos: lo que tienen en común, en el orden del primero. Si no tienen nada en común y cada uno es
    # un solo objeto (los pergaminos de Urshifu, las teteras de Polteageist), uno u otro.
    comunes = [p for p in listas[0] if all(p in otra for otra in listas[1:])]
    if not comunes and all(len(partes) == 1 for partes in listas):
        comunes = [' o '.join(dict.fromkeys(partes[0] for partes in listas))]
    texto = ' · '.join(comunes or listas[0])
    texto = texto[0].upper() + texto[1:]
    regiones = {forma_regional(d, padre) for d in candidatos}
    if len(regiones) == 1 and None not in regiones:  # Solo desde una forma regional (Runerigus).
        return [texto, regiones.pop()]
    return texto


def main():
    lista = leer(BASE + 'evolution-chain?limit=2000')['results']
    with ThreadPoolExecutor(max_workers=8) as hilos:
        cadenas = list(hilos.map(lambda c: leer(c['url']), lista))

    filas = {}

    def recorrer(nodo):
        for hijo in nodo['evolves_to']:
            valor = resumir(hijo['evolution_details'], nodo['species']['name'])
            if valor:
                filas[hijo['species']['name']] = valor
            recorrer(hijo)

    for cadena in cadenas:
        recorrer(cadena['chain'])

    lineas = [f'  {json.dumps(clave)}: {json.dumps(valor, ensure_ascii=False)},' for clave, valor in sorted(filas.items())]
    SALIDA.write_text(
        '// Generado por herramientas/generar_evoluciones.py desde PokéAPI: no editar a mano.\n'
        '// Especie → cómo evoluciona desde la anterior de su cadena, en pocas palabras («Nv. 16», «Piedra Trueno»,\n'
        '// «Intercambio · con Roca del Rey»). Si solo evoluciona desde una forma regional: [texto, región]\n'
        "// (Runerigus: ['Tras perder 49 PS', 'Galar'], solo desde el Yamask de Galar).\n"
        '// Lo usa la cadena evolutiva de la ficha (ficha.js).\n'
        'export const COMO_EVOLUCIONA = {\n' + '\n'.join(lineas) + '\n};\n',
        encoding='utf-8')
    print(f'{len(filas)} evoluciones guardadas en {SALIDA}')


if __name__ == '__main__':
    main()
