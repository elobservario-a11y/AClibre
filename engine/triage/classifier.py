import os
import re
import json
from typing import Optional, Literal
from pydantic import BaseModel, Field

class TriageResult(BaseModel):
    afecta_caravaning: bool = Field(description="Si el anuncio regula o restringe autocaravanas/campers/vehículos vivienda")
    tipo_acto: Literal['aprobacion_inicial', 'informacion_publica', 'aprobacion_definitiva', 'derogacion', 'otro'] = Field(description="Tipo de trámite formal del anuncio")
    municipio_nombre: Optional[str] = Field(default=None, description="Nombre del municipio identificado en el texto")
    codigo_ine: Optional[str] = Field(default=None, description="Código INE de 5 dígitos si se infiere")
    plazo_alegaciones_dias: Optional[int] = Field(default=None, description="Días de plazo de alegaciones (ej: 30)")
    confianza: float = Field(default=0.9, description="Nivel de certidumbre entre 0.0 y 1.0")
    justificacion: str = Field(default="", description="Justificación concisa en una frase")

SYSTEM_PROMPT = """Eres el clasificador de triaje del Radar Normativo de Slowvan (España).
Analiza el anuncio de boletín oficial proporcionado y responde ÚNICAMENTE con un objeto JSON válido con los siguientes campos:
{
  "afecta_caravaning": boolean (true si regula o afecta a autocaravanas, campers, pernocta, gálibos o acampada en vía pública),
  "tipo_acto": "aprobacion_inicial" | "informacion_publica" | "aprobacion_definitiva" | "derogacion" | "otro",
  "municipio_nombre": string o null (nombre del municipio al que pertenece el anuncio),
  "codigo_ine": string de 5 dígitos o null,
  "plazo_alegaciones_dias": integer o null (días para alegar si procede, típicamente 30 días),
  "confianza": float entre 0.0 y 1.0,
  "justificacion": string (una frase explicando el motivo)
}"""

def clasificar_con_haiku(titulo: str, texto: str) -> TriageResult:
    """
    Ejecuta el triaje con Claude 3.5 Haiku sobre un anuncio que superó el prefiltro.
    Si no hay API KEY en entorno, utiliza motor heurístico determinista de respaldo.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            prompt = f"Título: {titulo}\n\nTexto:\n{texto[:3000]}"
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=400,
                temperature=0.0,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}]
            )
            raw_text = message.content[0].text.strip()
            # Extraer bloque json
            json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                return TriageResult(**data)
        except Exception as e:
            print(f"[Triage Haiku Warning] Falló llamada API: {e}. Usando clasificador heurístico.")

    # Clasificador heurístico local (fallback sin consumo de API)
    full_text = f"{titulo} {texto}".lower()

    # Detectar trámite
    tipo_acto: Literal['aprobacion_inicial', 'informacion_publica', 'aprobacion_definitiva', 'derogacion', 'otro'] = "otro"
    if "informacion publica" in full_text or "informacio publica" in full_text or "exposicion publica" in full_text:
        tipo_acto = "informacion_publica"
    elif "aprobacion inicial" in full_text or "aprovacio inicial" in full_text:
        tipo_acto = "aprobacion_inicial"
    elif "aprobacion definitiva" in full_text or "aprovacio definitiva" in full_text:
        tipo_acto = "aprobacion_definitiva"
    elif "derogaci" in full_text:
        tipo_acto = "derogacion"

    # Detectar si afecta al caravaning
    afecta = any(term in full_text for term in [
        "autocaravana", "caravana", "camper", "vehiculo vivienda",
        "pernocta", "galibo", "limitador de altura", "area de autocaravanas",
        "pernoctacio", "pernoita"
    ])

    # Inferir plazo
    plazo_dias = 30 if tipo_acto in ("informacion_publica", "aprobacion_inicial") else None

    # Extraer municipio si empieza por Ayuntamiento de X / Ajuntament de X
    muni_match = re.search(r"(ayuntamiento|ajuntament|concello|udala)\s+de\s+([A-Za-zÁÉÍÓÚáéíóúÀÈÒàèòÑñç\s\-]+)", titulo, re.IGNORECASE)
    muni_nombre = muni_match.group(2).strip() if muni_match else None

    return TriageResult(
        afecta_caravaning=afecta,
        tipo_acto=tipo_acto,
        municipio_nombre=muni_nombre,
        codigo_ine=None,
        plazo_alegaciones_dias=plazo_dias,
        confianza=0.92 if afecta else 0.4,
        justificacion="Clasificado según análisis heurístico formal de términos de tráfico y procedimiento administrativo."
    )
