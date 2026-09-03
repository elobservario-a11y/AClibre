import urllib.request
from bs4 import BeautifulSoup
from datetime import date
from typing import List, Optional
from urllib.parse import urljoin
from engine.scrapers.base import BaseAdapter, AnuncioRaw

class HTMLAdapter(BaseAdapter):
    """
    Adaptador genérico para sumarios HTML de boletines oficiales.
    Extrae enlaces y títulos de disposiciones de la jornada.
    """
    def fetch_anuncios(self, fecha: Optional[date] = None) -> List[AnuncioRaw]:
        fecha_obj = fecha or date.today()
        anuncios: List[AnuncioRaw] = []

        try:
            target_url = self.url_base.replace("{YYYY}", str(fecha_obj.year))\
                                      .replace("{MM}", f"{fecha_obj.month:02d}")\
                                      .replace("{DD}", f"{fecha_obj.day:02d}")

            req = urllib.request.Request(
                target_url,
                headers={"User-Agent": "SlowvanRadar/1.0 (+https://slowvan.com; radar@slowvan.com)"}
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                html_content = resp.read()

            soup = BeautifulSoup(html_content, "html.parser")

            # Buscar bloques de anuncios típicos (listados, tablas, articulos)
            entries = soup.select("article, .anuncio, .disposicion, li, tr")
            if not entries:
                entries = soup.find_all("a")

            for entry in entries:
                link = entry.find("a") if entry.name != "a" else entry
                if not link or not link.get("href"):
                    continue

                titulo = entry.get_text(separator=" ", strip=True)
                if len(titulo) < 15:  # Descartar links de navegación o menú
                    continue

                url = urljoin(target_url, link.get("href", ""))

                anuncios.append(AnuncioRaw(
                    titulo=titulo[:300],
                    fecha_boletin=fecha_obj,
                    url_origen=url,
                    texto_extraido=titulo,
                    necesita_ocr=False
                ))
        except Exception as e:
            print(f"[HTMLAdapter] Error en {self.provincia} ({self.url_base}): {e}")

        return anuncios
