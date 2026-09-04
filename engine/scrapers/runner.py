import os
import sys

# Asegurar raíz del proyecto en sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import psycopg2
from datetime import date
from typing import Dict, Type
from engine.scrapers.base import BaseAdapter, AnuncioRaw
from engine.scrapers.adapters.rss_adapter import RSSAdapter
from engine.scrapers.adapters.json_adapter import JSONAdapter
from engine.scrapers.adapters.html_adapter import HTMLAdapter
from engine.scrapers.adapters.pdf_fijo_adapter import PDFFijoAdapter
from engine.prefilter.filter import evaluar_anuncio

ADAPTER_MAP: Dict[str, Type[BaseAdapter]] = {
    "rss": RSSAdapter,
    "json": JSONAdapter,
    "html": HTMLAdapter,
    "pdf_fijo": PDFFijoAdapter,
}

def run_radar(fecha: date = None):
    fecha_obj = fecha or date.today()

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

    # 1. Obtener fuentes activadas
    cursor.execute("""
        select id, provincia, tipo, url_base
        from public.fuentes
        where activo = true
        order by provincia;
    """)
    fuentes_activas = cursor.fetchall()
    print(f"=== Radar Normativo Slowvan - Ejecución {fecha_obj.isoformat()} ===")
    print(f"Fuentes activas a rastrear: {len(fuentes_activas)}")

    total_brutos = 0
    total_candidatos = 0
    total_ocr = 0

    for fuente_id, provincia, tipo, url_base in fuentes_activas:
        adapter_cls = ADAPTER_MAP.get(tipo)
        if not adapter_cls:
            print(f"[{provincia}] Tipo desconocido: {tipo}")
            continue

        adapter = adapter_cls(provincia=provincia, url_base=url_base)
        anuncios = adapter.fetch_anuncios(fecha_obj)
        print(f"[{provincia} - {tipo.upper()}] Anuncios capturados: {len(anuncios)}")
        total_brutos += len(anuncios)

        for a in anuncios:
            # Prefiltrar
            pre_res = evaluar_anuncio(a.titulo, a.texto_extraido)
            es_candidato = pre_res.is_candidate
            if es_candidato:
                total_candidatos += 1
                print(f"  ⭐ Candidato detectado (Nivel {pre_res.nivel}): {a.titulo[:80]}...")

            if a.necesita_ocr:
                total_ocr += 1

            cursor.execute("""
                insert into public.publicaciones (
                    fuente_id, fecha_boletin, titulo, url_origen,
                    hash_sha256, texto_extraido, necesita_ocr, revisado_prefiltro
                ) values (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s
                ) on conflict (hash_sha256) do nothing;
            """, (
                fuente_id, a.fecha_boletin, a.titulo, a.url_origen,
                a.hash_sha256, a.texto_extraido, a.necesita_ocr, es_candidato
            ))

        # Marcar última ejecución
        cursor.execute("update public.fuentes set ultimo_escaneo = now() where id = %s;", (fuente_id,))
        conn.commit()

    descarte_pct = (
        ((total_brutos - total_candidatos) / total_brutos * 100) if total_brutos > 0 else 0
    )

    print("\n--- RESUMEN DEL RADAR ---")
    print(f"Total anuncios brutos procesados: {total_brutos}")
    print(f"Candidatos seleccionados por prefiltro: {total_candidatos} ({100-descarte_pct:.1f}%)")
    print(f"Descartados por prefiltro (coste 0€ en IA): {total_brutos - total_candidatos} ({descarte_pct:.1f}%)")
    print(f"Encolados para OCR aislado: {total_ocr}")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    run_radar()
