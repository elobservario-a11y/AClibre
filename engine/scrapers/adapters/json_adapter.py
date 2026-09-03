import urllib.request
import json
from datetime import date
from typing import List, Optional
from engine.scrapers.base import BaseAdapter, AnuncioRaw

class JSONAdapter(BaseAdapter):
    """
    Adaptador para sedes y boletines con API REST/JSON abierta.
    """
    def fetch_anuncios(self, fecha: Optional[date] = None) -> List[AnuncioRaw]:
        fecha_obj = fecha or date.today()
        anuncios: List[AnuncioRaw] = []

        try:
            # Formatear URL con fecha si procede
            target_url = self.url_base.replace("{YYYY}", str(fecha_obj.year))\
                                      .replace("{MM}", f"{fecha_obj.month:02d}")\
                                      .replace("{DD}", f"{fecha_obj.day:02d}")

            req = urllib.request.Request(
                target_url,
                headers={
                    "User-Agent": "SlowvanRadar/1.0 (+https://slowvan.com; radar@slowvan.com)",
                    "Accept": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            items = data.get("anuncios") or data.get("items") or data.get("results") or []
            if isinstance(data, list):
                items = data

            for item in items:
                titulo = item.get("titulo") or item.get("title") or item.get("asunto") or "Sin título"
                url = item.get("url") or item.get("link") or item.get("url_pdf") or target_url
                texto = item.get("texto") or item.get("sumario") or item.get("descripcion") or ""

                anuncios.append(AnuncioRaw(
                    titulo=titulo.strip(),
                    fecha_boletin=fecha_obj,
                    url_origen=url.strip(),
                    texto_extraido=texto.strip(),
                    necesita_ocr=False
                ))
        except Exception as e:
            print(f"[JSONAdapter] Error en {self.provincia} ({self.url_base}): {e}")

        return anuncios
