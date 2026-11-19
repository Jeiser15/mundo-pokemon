"""Copia persistente de PokéAPI. Solo se publica cuando la descarga termina completa."""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import tempfile
import threading
import time
from contextlib import closing

from . import config

_log = logging.getLogger(__name__)
_candado = threading.Lock()  # Protege la sustitución mientras se lee, también en Windows.
_estado = {"actualizando": False, "completados": 0, "total": 0, "error": None}
_iniciado = False


def leer(recurso: str, identificador: str) -> bytes | None:
    """Busca por nombre o número; no consulta la red."""
    with _candado:
        if not config.SNAPSHOT_ARCHIVO.is_file():
            return None
        try:
            with closing(sqlite3.connect(config.SNAPSHOT_ARCHIVO)) as conexion:
                fila = conexion.execute(
                    "SELECT d.contenido FROM alias a JOIN datos d ON d.recurso=a.recurso AND d.id=a.id "
                    "WHERE a.recurso=? AND a.alias=?", (recurso, identificador)
                ).fetchone()
                return fila[0] if fila else None
        except sqlite3.Error:
            _log.exception("No se pudo leer el snapshot.")
            return None


def listar_especies() -> list[dict] | None:
    """Devuelve las especies del snapshot para construir la Pokédex sin acceder a la red."""
    with _candado:
        if not config.SNAPSHOT_ARCHIVO.is_file():
            return None
        try:
            with closing(sqlite3.connect(config.SNAPSHOT_ARCHIVO)) as conexion:
                filas = conexion.execute("SELECT id, contenido FROM datos WHERE recurso='pokemon-species'").fetchall()
                return [{"id": int(id_), "name": json.loads(datos)["name"]} for id_, datos in filas]
        except (sqlite3.Error, ValueError, KeyError):
            _log.exception("No se pudo leer la lista de especies del snapshot.")
            return None


def estado() -> dict:
    with _candado:
        copia = dict(_estado)
        try:
            if config.SNAPSHOT_ARCHIVO.is_file():
                with closing(sqlite3.connect(config.SNAPSHOT_ARCHIVO)) as conexion:
                    fila = conexion.execute("SELECT valor FROM metadata WHERE clave='actualizado'").fetchone()
                    copia["actualizado"] = float(fila[0]) if fila else None
            else:
                copia["actualizado"] = None
        except (sqlite3.Error, ValueError, OSError):
            copia["actualizado"] = None
        return copia


def _descargar(descargar, ruta: str) -> bytes:
    """Reintenta errores temporales sin usar la caché de la versión anterior."""
    for intento in range(3):
        try:
            datos = descargar(ruta)
            time.sleep(config.SNAPSHOT_PAUSA)
            return datos
        except Exception:
            if intento == 2:
                raise
            time.sleep(2 ** intento)
    raise RuntimeError("No se pudo descargar el recurso")


def construir(descargar, al_publicar=lambda: None):
    """Crea una base temporal y sustituye la anterior únicamente si todo salió bien."""
    temporal = None
    with _candado:
        _estado.update(actualizando=True, completados=0, total=0, error=None)
    try:
        config.SNAPSHOT_ARCHIVO.parent.mkdir(parents=True, exist_ok=True)
        fd, temporal = tempfile.mkstemp(prefix="snapshot-", suffix=".tmp", dir=config.SNAPSHOT_ARCHIVO.parent)
        os.close(fd)
        recursos = []
        for recurso in config.RECURSOS_PERMITIDOS:
            # La lista puede crecer: se descargan todas las páginas, no solo las primeras 1025 especies.
            offset, limite = 0, 1000
            while True:
                pagina = json.loads(_descargar(descargar, f"{recurso}?limit={limite}&offset={offset}"))
                resultados = pagina["results"]
                for entrada in resultados:
                    identificador = entrada["url"].rstrip("/").split("/")[-1]
                    if not identificador.isdigit():
                        raise ValueError(f"Identificador inválido en {recurso}")
                    recursos.append((recurso, identificador, entrada.get("name")))
                offset += len(resultados)
                if not pagina.get("next"):
                    break
                if not resultados:
                    raise ValueError(f"Página vacía inesperada en {recurso}")
        if not recursos:
            raise ValueError("PokéAPI devolvió un snapshot vacío")
        with _candado:
            _estado["total"] = len(recursos)
        with closing(sqlite3.connect(temporal)) as conexion, conexion:
            conexion.execute("CREATE TABLE datos (recurso TEXT, id TEXT, contenido BLOB, PRIMARY KEY (recurso,id))")
            conexion.execute("CREATE TABLE alias (recurso TEXT, alias TEXT, id TEXT, PRIMARY KEY (recurso,alias))")
            conexion.execute("CREATE TABLE metadata (clave TEXT PRIMARY KEY, valor TEXT)")
            for indice, (recurso, identificador, nombre) in enumerate(recursos, 1):
                contenido = _descargar(descargar, f"{recurso}/{identificador}")
                objeto = json.loads(contenido)  # No publicar datos incompletos o inválidos.
                if str(objeto.get("id")) != identificador:
                    raise ValueError(f"Respuesta inesperada para {recurso}/{identificador}")
                conexion.execute("INSERT INTO datos VALUES (?,?,?)", (recurso, identificador, contenido))
                conexion.execute("INSERT INTO alias VALUES (?,?,?)", (recurso, identificador, identificador))
                if nombre and nombre != identificador:
                    conexion.execute("INSERT INTO alias VALUES (?,?,?)", (recurso, nombre.lower(), identificador))
                if indice % 25 == 0 or indice == len(recursos):
                    with _candado:
                        _estado["completados"] = indice
            conexion.execute("INSERT INTO metadata VALUES ('actualizado',?)", (str(time.time()),))
        with _candado:
            os.replace(temporal, config.SNAPSHOT_ARCHIVO)
            temporal = None
        al_publicar()
        _log.warning("Snapshot de PokéAPI actualizado: %s recursos.", len(recursos))
    except Exception as error:
        _log.exception("No se pudo actualizar el snapshot; se conserva la copia anterior.")
        with _candado:
            _estado["error"] = str(error)
    finally:
        if temporal:
            try:
                os.unlink(temporal)
            except OSError:
                _log.exception("No se pudo borrar el archivo temporal del snapshot.")
        with _candado:
            _estado["actualizando"] = False


def iniciar(descargar, al_publicar=lambda: None):
    """Inicia un único programador en segundo plano mientras el servidor esté abierto."""
    global _iniciado
    with _candado:
        if _iniciado:
            return
        _iniciado = True

    def ciclo():
        while True:
            ultimo = estado()["actualizado"]
            restante = config.SNAPSHOT_INTERVALO - (time.time() - ultimo) if ultimo else 0
            if restante > 0:
                time.sleep(restante)
                continue
            construir(descargar, al_publicar)
            if estado()["error"]:
                time.sleep(config.SNAPSHOT_REINTENTO)

    threading.Thread(target=ciclo, name="actualizador-snapshot", daemon=True).start()
