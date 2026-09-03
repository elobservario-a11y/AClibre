import urllib.request
import html
from bs4 import BeautifulSoup
from datetime import date
from typing import List, Optional
from engine.scrapers.base import BaseAdapter, AnuncioRaw

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, application/atom+xml, text/xml, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}

class RSSAdapter(BaseAdapter):
    """
    Adaptador tolerante para boletines oficiales con canales RSS/Atom.
    Maneja entidades HTML no escapadas (&ntilde;, &aacute;) comunes en sedes electrónicas públicas.
    """
    def fetch_anuncios(self, fecha: Optional[date] = None) -> List[AnuncioRaw]:
        fecha_obj = fecha or date.today()
        anuncios: List[AnuncioRaw] = []

        try:
            req = urllib.request.Request(self.url_base, headers=BROWSER_HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                content = resp.read()

            # Parsear con html.parser para tolerar entidades HTML en feeds XML oficiales
            soup = BeautifulSoup(content, "html.parser")
            items = soup.find_all("item")
            if not items:
                items = soup.find_all("entry")

            for item in items:
                title_elem = item.find("title")
                link_elem = item.find("link")
                desc_elem = item.find("description") or item.find("summary")

                titulo = html.unescape(title_elem.get_text().strip()) if title_elem else "Sin título"
                
                if link_elem:
                    url = link_elem.get("href") or link_elem.get_text().strip() or self.url_base
                else:
                    url = self.url_base

                texto = html.unescape(desc_elem.get_text().strip()) if desc_elem else ""

                anuncios.append(AnuncioRaw(
                    titulo=titulo,
                    fecha_boletin=fecha_obj,
                    url_origen=url.strip(),
                    texto_extraido=texto,
                    necesita_ocr=False
                ))
        except Exception as e:
            print(f"[RSSAdapter] Error en {self.provincia} ({self.url_base}): {e}")

        return anuncios
