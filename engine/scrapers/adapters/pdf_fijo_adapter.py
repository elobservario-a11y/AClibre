import urllib.request
import io
import pypdf
from datetime import date
from typing import List, Optional
from engine.scrapers.base import BaseAdapter, AnuncioRaw

class PDFFijoAdapter(BaseAdapter):
    """
    Adaptador para boletines que publican un PDF único diario.
    Extrae texto de sumario. Si el PDF es una imagen escaneada sin capa de texto,
    marca necesita_ocr=True y NO ejecuta OCR para no bloquear el runner.
    """
    def fetch_anuncios(self, fecha: Optional[date] = None) -> List[AnuncioRaw]:
        fecha_obj = fecha or date.today()
        anuncios: List[AnuncioRaw] = []

        try:
            target_url = self.url_base.replace("{YYYY}", str(fecha_obj.year))\
                                      .replace("{MM}", f"{fecha_obj.month:02d}")\
                                      .replace("{DD}", f"{fecha_obj.day:02d}")\
                                      .replace("{YYYYMMDD}", fecha_obj.strftime("%Y%m%d"))

            req = urllib.request.Request(
                target_url,
                headers={"User-Agent": "SlowvanRadar/1.0 (+https://slowvan.com; radar@slowvan.com)"}
            )

            # Descargar con límite de tamaño (máx 15 MB)
            with urllib.request.urlopen(req, timeout=30) as resp:
                pdf_bytes = resp.read(15 * 1024 * 1024)

            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            total_pages = min(len(reader.pages), 10) # Leer hasta 10 páginas de sumario

            extracted_text = ""
            for i in range(total_pages):
                page_text = reader.pages[i].extract_text() or ""
                extracted_text += "\n" + page_text

            extracted_text = extracted_text.strip()

            # Si apenas hay caracteres extraídos, el PDF es escaneado y requiere OCR en cola aislada
            if len(extracted_text) < 60:
                anuncios.append(AnuncioRaw(
                    titulo=f"Boletín provincial {self.provincia} del {fecha_obj.isoformat()}",
                    fecha_boletin=fecha_obj,
                    url_origen=target_url,
                    texto_extraido="",
                    necesita_ocr=True
                ))
            else:
                # Tratar cada párrafo o sección como anuncio
                lines = [l.strip() for l in extracted_text.splitlines() if len(l.strip()) > 20]
                for l in lines[:30]:
                    anuncios.append(AnuncioRaw(
                        titulo=l[:250],
                        fecha_boletin=fecha_obj,
                        url_origen=target_url,
                        texto_extraido=l,
                        necesita_ocr=False
                    ))
        except Exception as e:
            print(f"[PDFFijoAdapter] Error en {self.provincia} ({self.url_base}): {e}")

        return anuncios
