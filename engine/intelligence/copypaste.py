import os
import sys
import unicodedata
import re
import json
from typing import List, Dict, Set, Tuple

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import psycopg2

def normalizar_texto(texto: str) -> str:
    """Normaliza texto eliminando acentos, caracteres especiales y dobles espacios."""
    if not texto:
        return ""
    # Descomponer diacríticos NFKD
    nfkd = unicodedata.normalize('NFKD', texto)
    sin_tildes = "".join([c for c in nfkd if not unicodedata.combining(c)])
    # Minúsculas y limpiar puntuación
    limpio = re.sub(r'[^\w\s]', ' ', sin_tildes.lower())
    return re.sub(r'\s+', ' ', limpio).strip()

def generar_ngrams(palabras: List[str], n: int = 3) -> Set[str]:
    """Genera n-gramas de palabras."""
    if len(palabras) < n:
        return {" ".join(palabras)} if palabras else set()
    return {" ".join(palabras[i:i+n]) for i in range(len(palabras) - n + 1)}

def similitud_jaccard(set_a: Set[str], set_b: Set[str]) -> float:
    """Calcula similitud de Jaccard entre dos conjuntos de n-gramas."""
    if not set_a or not set_b:
        return 0.0
    inter = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return inter / union if union > 0 else 0.0

def encontrar_subcadena_comun(texto_a: str, texto_b: str, min_len: int = 40) -> List[str]:
    """Encuentra frases idénticas de longitud significativa compartidas."""
    coincidencias = []
    # Dividir texto A en oraciones o fragmentos de ~15 palabras
    palabras_a = texto_a.split()
    chunk_size = 8
    
    for i in range(0, len(palabras_a) - chunk_size + 1, 4):
        frase = " ".join(palabras_a[i:i+chunk_size])
        if len(frase) >= min_len and frase in texto_b:
            if not any(frase in c for c in coincidencias):
                coincidencias.append(frase)

    return coincidencias[:5]

def detectar_copypaste():
    conn = psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB", "postgres"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", 54332))
    )
    cursor = conn.cursor()

    # 1. Obtener normas con sus textos consolidados de hallazgos
    cursor.execute("""
        select n.id, n.protocol_id, n.tipo, m.id as municipio_id, m.nombre as municipio, m.provincia,
               coalesce(string_agg(h.cita_literal, ' '), '') as texto_citas
        from public.normas n
        join public.municipios m on m.id = n.municipio_id
        left join public.hallazgos h on h.norma_id = n.id
        group by n.id, n.protocol_id, n.tipo, m.id, m.nombre, m.provincia
        order by m.nombre asc;
    """)
    normas = cursor.fetchall()
    print(f"=== Radar de Contagio y Copypaste Intermunicipal ===")
    print(f"Normas a comparar: {len(normas)}")

    # Preparar representaciones n-gram
    items = []
    for n_id, prot_id, tipo, m_id, muni, prov, texto in normas:
        norm_txt = normalizar_texto(texto)
        words = norm_txt.split()
        ngrams = generar_ngrams(words, n=3)
        items.append({
            'norma_id': n_id,
            'protocol_id': prot_id,
            'municipio_id': m_id,
            'municipio': muni,
            'provincia': prov,
            'texto_original': texto,
            'texto_norm': norm_txt,
            'ngrams': ngrams
        })

    total_clusters = 0

    # 2. Comparación cruzada de pares
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a = items[i]
            b = items[j]

            # No comparar la misma norma
            if a['norma_id'] == b['norma_id']:
                continue

            jaccard = similitud_jaccard(a['ngrams'], b['ngrams'])
            fragmentos = encontrar_subcadena_comun(a['texto_norm'], b['texto_norm'])

            # Criterio de contagio: coincidencia Jaccard > 35% o frases literales compartidas
            if jaccard >= 0.30 or len(fragmentos) > 0:
                score = round(max(jaccard * 100, 75.0 if fragmentos else 40.0), 2)
                score = min(score, 98.5)

                # Ordenar IDs para clave única
                id_1, id_2 = (a['norma_id'], b['norma_id']) if a['norma_id'] < b['norma_id'] else (b['norma_id'], a['norma_id'])
                m_1, m_2 = (a['municipio_id'], b['municipio_id']) if a['norma_id'] < b['norma_id'] else (b['municipio_id'], a['municipio_id'])

                cursor.execute("""
                    insert into public.similitudes_normas (
                        norma_a_id, norma_b_id, municipio_a_id, municipio_b_id,
                        porcentaje_similitud, fragmentos_coincidentes, posible_redactor
                    ) values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict (norma_a_id, norma_b_id) do update set
                        porcentaje_similitud = excluded.porcentaje_similitud,
                        fragmentos_coincidentes = excluded.fragmentos_coincidentes,
                        detectado_en = now();
                """, (
                    id_1, id_2, m_1, m_2, score,
                    json.dumps(fragmentos, ensure_ascii=False),
                    "Patrón idéntico de redacción intermunicipal"
                ))
                conn.commit()

                total_clusters += 1
                print(f"  🔗 [Contagio {score}%] {a['municipio']} ({a['provincia']}) <===> {b['municipio']} ({b['provincia']})")
                if fragmentos:
                    print(f"     Cláusula clonada: «{fragmentos[0][:80]}...»")

    print(f"\n>> Detección finalizada: {total_clusters} relaciones de copypaste detectadas.")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    detectar_copypaste()
