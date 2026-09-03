import time
import psycopg2

def run_benchmark():
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="postgres",
        host="127.0.0.1",
        port=54332
    )
    cursor = conn.cursor()

    # 1. Total municipios y fuentes cargados
    cursor.execute("select count(*) from public.municipios;")
    total_municipios = cursor.fetchone()[0]
    cursor.execute("select count(*) from public.fuentes;")
    total_fuentes = cursor.fetchone()[0]

    print(f"Total municipios en BD: {total_municipios}")
    print(f"Total fuentes en BD: {total_fuentes}")

    assert total_municipios >= 8131, f"Se esperaban al menos 8131 municipios, hay {total_municipios}"
    assert total_fuentes == 52, f"Se esperaban 52 fuentes, hay {total_fuentes}"

    # 2. Benchmarking de autocompletado (simulación de typing en frontend)
    queries = [
        "Villan",     # Prefijo común
        "Sant",       # Muy frecuente (Sant Cugat, Santander, etc.)
        "Daim",       # Específico (Daimiel)
        "Madrid",     # Gran urbe
        "Valenc",     # Prefijo regional
        "Castel",     # Castellón, Castellar...
        "Algec",      # Algeciras
        "Torrem"      # Torremolinos, Torremenga...
    ]

    print("\n--- Benchmark de Autocompletado (< 50 ms requerido) ---")
    tiempos = []
    
    # Warmup
    cursor.execute("select id, codigo_ine, nombre, provincia from public.municipios where nombre ilike 'Mad%' limit 10;")
    cursor.fetchall()

    for q in queries:
        t0 = time.perf_counter()
        cursor.execute(
            """
            select codigo_ine, nombre, provincia, comunidad, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat
            from public.municipios
            where nombre ilike %s
            order by similarity(nombre, %s) desc, nombre asc
            limit 10;
            """,
            (f"{q}%", q)
        )
        rows = cursor.fetchall()
        t1 = time.perf_counter()
        duracion_ms = (t1 - t0) * 1000
        tiempos.append(duracion_ms)
        print(f"Query '{q}': {duracion_ms:.2f} ms ({len(rows)} resultados: {rows[0][1] if rows else 'None'})")

    media_ms = sum(tiempos) / len(tiempos)
    max_ms = max(tiempos)
    print(f"\nTiempo medio: {media_ms:.2f} ms | Tiempo máximo: {max_ms:.2f} ms")

    assert max_ms < 50.0, f"Fallo de rendimiento: el tiempo máximo {max_ms:.2f} ms supera el límite de 50 ms"
    print("\n>> SPRINT 0.2 VERIFICADO: Todas las consultas respondieron en < 50 ms <<")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    run_benchmark()
