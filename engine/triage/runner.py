import os
import sys

# Asegurar raíz del proyecto en sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import json
import psycopg2
from engine.triage.classifier import clasificar_con_haiku

def run_triage():
    conn = psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB", "postgres"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", 54332))
    )
    cursor = conn.cursor()

    # 1. Obtener publicaciones candidatas pendientes de triaje
    cursor.execute("""
        select id, titulo, texto_extraido, fecha_boletin
        from public.publicaciones
        where revisado_prefiltro = true
          and estado_triaje = 'pendiente'
        order by creado_en asc;
    """)
    candidatos = cursor.fetchall()
    print(f"=== Triaje Slowvan (Haiku) ===")
    print(f"Publicaciones candidatas a procesar: {len(candidatos)}")

    afectados_count = 0

    for pub_id, titulo, texto, fecha in candidatos:
        res = clasificar_con_haiku(titulo, texto or "")

        # Intentar vincular municipio si se detectó nombre
        muni_id = None
        if res.municipio_nombre:
            cursor.execute("""
                select id from public.municipios
                where nombre ilike %s
                limit 1;
            """, (f"%{res.municipio_nombre}%",))
            row = cursor.fetchone()
            if row:
                muni_id = row[0]

        if res.afecta_caravaning:
            afectados_count += 1
            print(f"  🚨 Relevante: {titulo[:70]}... -> {res.tipo_acto} (Confianza: {res.confianza})")

        cursor.execute("""
            update public.publicaciones
            set resultado_triaje = %s,
                afecta_caravaning = %s,
                tipo_acto = %s,
                confianza_triaje = %s,
                municipio_detectado_id = %s,
                estado_triaje = 'procesado',
                triado_en = now()
            where id = %s;
        """, (
            json.dumps(res.model_dump(), ensure_ascii=False),
            res.afecta_caravaning,
            res.tipo_acto,
            res.confianza,
            muni_id,
            pub_id
        ))
        conn.commit()

    print(f"\n>> Triaje finalizado: {len(candidatos)} procesados | {afectados_count} confirmados como relevantes.")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    run_triage()
