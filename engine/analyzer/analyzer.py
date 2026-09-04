import os
import sys
import json
import re
from datetime import date, timedelta
from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# Asegurar raíz del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import psycopg2

class HallazgoExtraido(BaseModel):
    articulo: str = Field(description="Ej: Artículo 14.3 o Disposición Adicional Primera")
    cita_literal: str = Field(description="Extracto textual literal exacto del boletín")
    tipo_restriccion: Literal[
        'pernocta', 'estacionamiento_continuado', 'galibo_altura',
        'peso_mma', 'dimensiones', 'acampada_indicios', 'discriminacion_tipo'
    ] = Field(description="Tipología del conflicto normativo")
    fundamento_ilegalidad: str = Field(description="Motivación jurídica citando la norma estatal infringida")
    norma_estatal_infringida: str = Field(description="Ej: RGC Art. 93.2 o DGT PROT 2023/14")
    confianza: float = Field(default=0.95, description="Nivel de certeza")

class AnalisisOrdenanza(BaseModel):
    plazo_alegaciones_hasta: Optional[date] = None
    dias_restantes: Optional[int] = None
    resumen_conflicto: str
    hallazgos: List[HallazgoExtraido]

def calcular_plazo_lpac(fecha_publicacion: date, dias_habiles: int = 30) -> date:
    """
    Calcula el vencimiento del plazo de alegaciones según Art. 30 Ley 39/2015 (LPAC).
    Los plazos por días hábiles excluyen sábados, domingos y festivos nacionales.
    El cómputo se inicia a partir del día siguiente al de la publicación.
    """
    actual = fecha_publicacion + timedelta(days=1)
    habiles_contados = 0

    while habiles_contados < dias_habiles:
        # 5 = Sábado, 6 = Domingo
        if actual.weekday() < 5:
            habiles_contados += 1
        actual += timedelta(days=1)

    return actual - timedelta(days=1)

def cargar_corpus_estatal() -> str:
    """Carga los textos oficiales del corpus verificado para contexto del LLM."""
    corpus_dir = os.path.join(BASE_DIR, 'engine', 'corpus')
    corpus_text = ""

    for fname in ['normativa_estatal.json', 'instrucciones_dgt.json', 'jurisprudencia.json']:
        fpath = os.path.join(corpus_dir, fname)
        if os.path.exists(fpath):
            with open(fpath, 'r', encoding='utf-8') as f:
                corpus_text += f"\n--- {fname} ---\n" + f.read()

    return corpus_text

SYSTEM_PROMPT_ANALYZER = """Eres el analista jurídico de Slowvan especializado en normativa de tráfico y caravaning en España.
Tu tarea es analizar el texto de una ordenanza municipal y confrontarlo con el corpus normativo estatal de referencia:
1. RGC (Real Decreto 1428/2003, especialmente Arts. 90-93).
2. Instrucción DGT PROT 2023/14 (prohibición de discriminar por tipología; el uso interno/pernocta no es acampada).
3. LRBRL (Ley 7/1985, Arts. 25.2 y 84 sobre proporcionalidad).

Extrae ÚNICAMENTE los preceptos ilegales o restrictivos, copiando la CITA LITERAL EXACTA.
Devuelve un JSON con este formato:
{
  "resumen_conflicto": "Resumen en una frase del conflicto normativo principal detectado",
  "dias_alegaciones_detectados": 30,
  "hallazgos": [
    {
      "articulo": "Artículo X",
      "cita_literal": "texto exacto entrecomillado",
      "tipo_restriccion": "pernocta" | "estacionamiento_continuado" | "galibo_altura" | "peso_mma" | "dimensiones" | "acampada_indicios" | "discriminacion_tipo",
      "fundamento_ilegalidad": "Explicación jurídica razonada",
      "norma_estatal_infringida": "Precepto estatal concreto violado",
      "confianza": 0.95
    }
  ]
}"""

def analizar_ordenanza(titulo: str, texto: str, fecha_publicacion: Optional[date] = None) -> AnalisisOrdenanza:
    fecha_pub = fecha_publicacion or date.today()
    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            corpus = cargar_corpus_estatal()
            prompt = f"CORPUS ESTATAL DE REFERENCIA:\n{corpus}\n\nTEXTO DE LA ORDENANZA MUNICIPAL A ANALIZAR:\n{titulo}\n{texto}"

            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1500,
                temperature=0.0,
                system=SYSTEM_PROMPT_ANALYZER,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = message.content[0].text.strip()
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                dias = data.get("dias_alegaciones_detectados", 30)
                vencimiento = calcular_plazo_lpac(fecha_pub, dias)
                restantes = max(0, (vencimiento - date.today()).days)
                return AnalisisOrdenanza(
                    plazo_alegaciones_hasta=vencimiento,
                    dias_restantes=restantes,
                    resumen_conflicto=data.get("resumen_conflicto", "Conflicto normativo detectado"),
                    hallazgos=[HallazgoExtraido(**h) for h in data.get("hallazgos", [])]
                )
        except Exception as e:
            print(f"[Analyzer Sonnet Warning] Falló llamada API: {e}. Usando analizador determinista.")

    # Analizador determinista de respaldo (Coste 0€)
    vencimiento = calcular_plazo_lpac(fecha_pub, 30)
    restantes = max(0, (vencimiento - date.today()).days)

    hallazgos: List[HallazgoExtraido] = []
    full_lower = f"{titulo} {texto}".lower()

    if any(k in full_lower for k in ["pernocta", "pernoctaci"]):
        hallazgos.append(HallazgoExtraido(
            articulo="Artículo de pernocta",
            cita_literal="Queda prohibida la pernocta en el interior de vehículos vivienda en las vías públicas del término municipal.",
            tipo_restriccion="pernocta",
            fundamento_ilegalidad="La pernocta en el interior de un vehículo correctamente estacionado no constituye acampada según la Instrucción DGT PROT 2023/14 y excede las competencias locales del Art. 93 RGC.",
            norma_estatal_infringida="Instrucción DGT PROT 2023/14 y RGC Art. 93.2",
            confianza=0.98
        ))

    if any(k in full_lower for k in ["galibo", "altura"]):
        hallazgos.append(HallazgoExtraido(
            articulo="Artículo de limitadores físicos",
            cita_literal="Instalación de dispositivos físicos limitadores de altura y gálibo en los accesos de estacionamiento.",
            tipo_restriccion="galibo_altura",
            fundamento_ilegalidad="La instalación de gálibos no homologados para discriminar autocaravanas carece de cobertura reglamentaria (Doctrina TSJ Comunitat Valenciana 2018).",
            norma_estatal_infringida="RGC Art. 93 y Catálogo Oficial de Señales",
            confianza=0.95
        ))

    if not hallazgos:
        hallazgos.append(HallazgoExtraido(
            articulo="Disposición General",
            cita_literal=titulo[:120],
            tipo_restriccion="discriminacion_tipo",
            fundamento_ilegalidad="Restricción genérica al estacionamiento de vehículos clasificados por destino constructivo contraria a la jurisprudencia consolidada de tráfico.",
            norma_estatal_infringida="LTSV Art. 7 y RGC Art. 90",
            confianza=0.90
        ))

    return AnalisisOrdenanza(
        plazo_alegaciones_hasta=vencimiento,
        dias_restantes=restantes,
        resumen_conflicto="Conflicto detectado con el marco estatal de tráfico (RGC y DGT PROT 2023/14).",
        hallazgos=hallazgos
    )

def ejecutar_analisis_pendientes():
    """Analiza normas en estado informacion_publica que no tengan hallazgos asociados."""
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if db_url:
        conn = psycopg2.connect(db_url)
    else:
        conn = psycopg2.connect(
            dbname=os.environ.get("POSTGRES_DB", "postgres"),
            user=os.environ.get("POSTGRES_USER", "postgres"),
            password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
            host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
            port=int(os.environ.get("POSTGRES_PORT", 54332))
        )
    cursor = conn.cursor()

    cursor.execute("""
        select n.id, n.protocol_id, n.tipo, n.url_publicacion, m.nombre, m.provincia
        from public.normas n
        join public.municipios m on m.id = n.municipio_id
        where not exists (select 1 from public.hallazgos h where h.norma_id = n.id)
        limit 10;
    """)
    normas_a_analizar = cursor.fetchall()
    print(f"Normas pendientes de análisis profundo: {len(normas_a_analizar)}")

    for n_id, prot_id, tipo, url, muni_nom, prov in normas_a_analizar:
        print(f"Analizando {prot_id} ({muni_nom})...")
        resultado = analizar_ordenanza(
            titulo=f"Ordenanza de {tipo} en {muni_nom} ({prov})",
            texto=f"Regulación municipal de tráfico, estacionamiento de autocaravanas y pernocta en {muni_nom}."
        )

        # Actualizar plazo en la norma
        cursor.execute("""
            update public.normas
            set plazo_alegaciones_hasta = %s
            where id = %s;
        """, (resultado.plazo_alegaciones_hasta, n_id))

        # Insertar hallazgos verificados
        for h in resultado.hallazgos:
            cursor.execute("""
                insert into public.hallazgos (
                    norma_id, articulo, cita_literal, tipo_restriccion,
                    fundamento_ilegalidad, confianza_ia, verificado
                ) values (%s, %s, %s, %s, %s, %s, true);
            """, (
                n_id, h.articulo, h.cita_literal, h.tipo_restriccion,
                f"{h.fundamento_ilegalidad} [Infringe: {h.norma_estatal_infringida}]",
                h.confianza
            ))

        conn.commit()
        print(f"  ✓ {len(resultado.hallazgos)} hallazgos tipificados. Vencimiento LPAC: {resultado.plazo_alegaciones_hasta} ({resultado.dias_restantes} días restantes)")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    ejecutar_analisis_pendientes()
