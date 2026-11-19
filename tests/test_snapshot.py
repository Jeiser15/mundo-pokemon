"""Pruebas del snapshot con datos simulados; no hacen peticiones a PokéAPI."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from servidor import config, snapshot


class PruebasSnapshot(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.TemporaryDirectory()
        self.archivo = Path(self.carpeta.name) / "copia.sqlite3"
        self.configuracion = patch.multiple(config, SNAPSHOT_ARCHIVO=self.archivo, SNAPSHOT_PAUSA=0,
                                            RECURSOS_PERMITIDOS=("pokemon", "pokemon-species"))
        self.configuracion.start()
        self.addCleanup(self.configuracion.stop)
        self.addCleanup(self.carpeta.cleanup)

    @staticmethod
    def descargar(ruta):
        recurso = ruta.split("?", 1)[0]
        if "?" in ruta:
            return json.dumps({"results": [{"name": "pikachu", "url": f"https://pokeapi.co/api/v2/{recurso}/25/"}],
                               "next": None}).encode()
        return json.dumps({"id": 25, "name": "pikachu"}).encode()

    def test_copia_completa_se_consulta_por_nombre_y_numero(self):
        publicado = []
        snapshot.construir(self.descargar, lambda: publicado.append(True))
        self.assertTrue(publicado)
        self.assertEqual(json.loads(snapshot.leer("pokemon", "25"))["name"], "pikachu")
        self.assertEqual(snapshot.leer("pokemon", "pikachu"), snapshot.leer("pokemon", "25"))
        self.assertEqual(snapshot.listar_especies(), [{"id": 25, "name": "pikachu"}])
        self.assertIsNotNone(snapshot.estado()["actualizado"])

    def test_error_conserva_copia_anterior(self):
        snapshot.construir(self.descargar)
        original = self.archivo.read_bytes()
        with patch("servidor.snapshot.time.sleep"):
            snapshot.construir(lambda ruta: (_ for _ in ()).throw(OSError("sin conexión")))
        self.assertEqual(original, self.archivo.read_bytes())
        self.assertEqual(snapshot.estado()["error"], "sin conexión")
        self.assertEqual(json.loads(snapshot.leer("pokemon", "pikachu"))["id"], 25)

    def test_rechaza_respuesta_incompleta(self):
        def descargar_invalido(ruta):
            return b'{"id": 99}' if "?" not in ruta else self.descargar(ruta)
        snapshot.construir(descargar_invalido)
        self.assertFalse(self.archivo.exists())
        self.assertIsNotNone(snapshot.estado()["error"])


if __name__ == "__main__":
    unittest.main()
