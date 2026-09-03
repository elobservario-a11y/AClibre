import re
import unicodedata
from dataclasses import dataclass
from typing import List, Optional

def normalize_text(text: str) -> str:
    """
    Normaliza el texto a minúsculas, forma NFKD y elimina diacríticos.
    Permite casar patrones incluso sobre texto degradado de OCR.
    """
    if not text:
        return ""
    # Descomponer caracteres con acentos
    nfkd = unicodedata.normalize('NFKD', text.lower())
    # Filtrar marcas diacríticas
    without_accents = "".join([c for c in nfkd if not unicodedata.combining(c)])
    # Normalizar espacios y saltos de línea
    return re.sub(r'\s+', ' ', without_accents).strip()

# ====================================================================
# NIVEL A: Específico -> Candidato inmediato
# ====================================================================
PATRONES_NIVEL_A = [
    # Castellano
    r"\bautocaravana[s]?\b",
    r"\bcaravana[s]?\b",
    r"\bcamper[s]?\b",
    r"\bvehiculo[s]?[\s\-]vivienda[s]?\b",
    r"\bcasa[s]?[\s\-]movil(es)?\b",
    r"\bremolque[s]?[\s\-]vivienda[s]?\b",
    r"\bmobil[\s\-]?home[s]?\b",
    r"\bpernocta(r|da|cion)?\b",
    r"\bvivac\b",
    r"\bgalibo[s]?\b",
    r"\blimitador(es)?[\s\-]de[\s\-]altura\b",
    r"\barea[s]?[\s\-]de[\s\-]autocaravana[s]?\b",
    r"\bautocaravanas[\s\-]y[\s\-]similares\b",

    # Català / Valencià
    r"\bpernoctacio(ns)?\b",
    r"\bgalib[s]?\b",
    r"\bautocaravanes\b",

    # Galego
    r"\bpernoita(r)?\b",
    r"\bvehiculo[s]?[\s\-]vivenda[s]?\b",

    # Euskera
    r"\bibilgailu[\s\-]etxebizitza\b",
    r"\bkanpatze\b",
]

REGEX_NIVEL_A = re.compile("|".join(PATRONES_NIVEL_A), re.IGNORECASE)

# ====================================================================
# NIVEL B: Genérico -> Requiere co-ocurrencia con procedimiento o restricción
# ====================================================================
PATRONES_NIVEL_B_BASE = [
    r"\bacampada[s]?\b",
    r"\bestacionamiento[s]?\b",
    r"\bordenanza[\s\-]de[\s\-](circulacion|convivencia|movilidad|trafico)\b",
    r"\bmma\b",
    r"\b3[\s\.]?500[\s\-]?(kg|kilos)\b",
    r"\bacampament(o|s)?\b",
    r"\baparkaleku\b",
]
REGEX_NIVEL_B_BASE = re.compile("|".join(PATRONES_NIVEL_B_BASE), re.IGNORECASE)

PATRONES_NIVEL_B_COOCURRENCIA = [
    # Actos de aprobación / exposición
    r"\baprobacion[\s\-](inicial|definitiva)\b",
    r"\binformacion[\s\-]publica\b",
    r"\bexposicion[\s\-]publica\b",
    r"\btramite[\s\-]de[\s\-]audiencia\b",
    r"\bplazo[\s\-]de[\s\-]alegaciones\b",
    r"\bmodificacion[\s\-]de[\s\-]ordenanza\b",
    # Restricciones
    r"\bprohibi(do|da|dos|das|cion|ciones|r)?\b",
    r"\brestricci(on|ones)?\b",
    r"\brestringi(do|da|dos|das|r)?\b",
    r"\blimitaci(on|ones)?\b",
    r"\baltura[\s\-]maxima\b",
    r"\blongitud[\s\-]maxima\b",
    r"\bvehiculos[\s\-]pesados\b",
    r"\bplaya[s]?\b",
]
REGEX_NIVEL_B_CO = re.compile("|".join(PATRONES_NIVEL_B_COOCURRENCIA), re.IGNORECASE)

@dataclass
class PrefilterResult:
    is_candidate: bool
    nivel: Optional[str]  # 'A', 'B' o None
    matched_terms: List[str]
    excerpt: str

def evaluar_anuncio(titulo: str, texto: str) -> PrefilterResult:
    """
    Evalúa si un anuncio de boletín es candidato para análisis de caravaning.
    Descarta el ~98% del ruido administrativo sin llamadas a IA.
    """
    full_original = f"{titulo}. {texto}"
    normalized = normalize_text(full_original)

    # 1. Chequeo de Nivel A (Específico)
    matches_a = REGEX_NIVEL_A.findall(normalized)
    if matches_a:
        # Extraer términos planos
        terms = list(set([m[0] if isinstance(m, tuple) else m for m in matches_a if m]))
        # Extracto alrededor del primer match
        m = REGEX_NIVEL_A.search(normalized)
        start = max(0, m.start() - 40)
        end = min(len(normalized), m.end() + 60)
        excerpt = full_original[start:end].strip()
        return PrefilterResult(
            is_candidate=True,
            nivel="A",
            matched_terms=terms,
            excerpt=excerpt
        )

    # 2. Chequeo de Nivel B (Genérico con co-ocurrencia)
    matches_b_base = REGEX_NIVEL_B_BASE.findall(normalized)
    if matches_b_base:
        matches_b_co = REGEX_NIVEL_B_CO.findall(normalized)
        if matches_b_co:
            terms_base = [m[0] if isinstance(m, tuple) else m for m in matches_b_base if m]
            terms_co = [m[0] if isinstance(m, tuple) else m for m in matches_b_co if m]
            all_terms = list(set(terms_base + terms_co))
            m = REGEX_NIVEL_B_BASE.search(normalized)
            start = max(0, m.start() - 40)
            end = min(len(normalized), m.end() + 60)
            excerpt = full_original[start:end].strip()
            return PrefilterResult(
                is_candidate=True,
                nivel="B",
                matched_terms=all_terms,
                excerpt=excerpt
            )

    return PrefilterResult(
        is_candidate=False,
        nivel=None,
        matched_terms=[],
        excerpt=""
    )
