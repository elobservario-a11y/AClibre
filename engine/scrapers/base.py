from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import List, Optional
import hashlib

@dataclass
class AnuncioRaw:
    titulo: str
    fecha_boletin: date
    url_origen: str
    texto_extraido: str
    necesita_ocr: bool = False
    hash_sha256: str = ""

    def __post_init__(self):
        if not self.hash_sha256:
            # Hash único anti-duplicados basado en URL y contenido/título
            raw_id = f"{self.url_origen}_{self.titulo}_{self.fecha_boletin}"
            self.hash_sha256 = hashlib.sha256(raw_id.encode('utf-8')).hexdigest()

class BaseAdapter(ABC):
    def __init__(self, provincia: str, url_base: str):
        self.provincia = provincia
        self.url_base = url_base

    @abstractmethod
    def fetch_anuncios(self, fecha: Optional[date] = None) -> List[AnuncioRaw]:
        """
        Extrae los anuncios del sumario del boletín para la fecha dada.
        Si la capa de texto no existe (PDF escaneado), devuelve necesita_ocr=True
        sin realizar procesamiento pesado de OCR en este job.
        """
        pass
