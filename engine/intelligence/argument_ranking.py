import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import psycopg2

def recalcular_ranking_argumentos():
    conn = psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB", "postgres"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", 54332))
    )
    cursor = conn.cursor()

    # 1. Obtener resoluciones reales de la tabla de acciones
    cursor.execute("""
        select a.estado, coalesce(h.tipo_restriccion, 'pernocta') as tipo
        from public.acciones a
        left join public.normas n on n.id = a.norma_id
        left join public.hallazgos h on h.norma_id = n.id
        where a.estado in ('estimada', 'desestimada');
    """)
    resoluciones = cursor.fetchall()
    print(f"=== Análisis de Argumentos Ganadores Slowvan ===")
    print(f"Resoluciones registradas en acciones: {len(resoluciones)}")

    # Conteo por tipo de restricción
    stats: dict = {}
    for estado, tipo in resoluciones:
        if tipo not in stats:
            stats[tipo] = {'estimado': 0, 'desestimado': 0}
        if estado == 'estimada':
            stats[tipo]['estimado'] += 1
        else:
            stats[tipo]['desestimado'] += 1

    # Actualizar tabla de efectividad incorporando la evidencia empírica
    for tipo, counts in stats.items():
        est = counts['estimado']
        des = counts['desestimado']
        total = est + des
        if total > 0:
            cursor.execute("""
                update public.efectividad_argumentos
                set veces_alegado = veces_alegado + %s,
                    veces_estimado = veces_estimado + %s,
                    veces_desestimado = veces_desestimado + %s,
                    tasa_exito = round(((veces_estimado + %s)::numeric / (veces_alegado + %s)::numeric) * 100, 2),
                    peso_prioridad = round(((veces_estimado + %s)::numeric / (veces_alegado + %s)::numeric) * 100)::integer,
                    actualizado_en = now()
                where tipo_restriccion = %s;
            """, (total, est, des, est, total, est, total, tipo))
            conn.commit()

    # 2. Imprimir ranking consolidado
    cursor.execute("""
        select tipo_restriccion, titulo_argumento, tasa_exito, veces_alegado, veces_estimado, peso_prioridad
        from public.efectividad_argumentos
        order by tasa_exito desc, peso_prioridad desc;
    """)
    ranking = cursor.fetchall()

    print("\n--- RANKING DE ARGUMENTOS GANADORES ---")
    for idx, (tipo, titulo, tasa, total, ganados, peso) in enumerate(ranking, 1):
        print(f"{idx}. [{tasa}% éxito | Peso {peso}] {titulo} ({ganados}/{total} victorias)")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    recalcular_ranking_argumentos()
