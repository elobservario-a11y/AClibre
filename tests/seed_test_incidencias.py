import psycopg2
import urllib.request
import json
import io
import base64

# Imagen de prueba mínima (PNG 100x100 transparente/simple)
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVHhe7cExAQAAAMKg9U9tCj+gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOBqBjsAAaA/oB0AAAAASUVORK5CYII="
)

def seed_20_incidencias():
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="postgres",
        host="127.0.0.1",
        port=54332
    )
    cursor = conn.cursor()

    # 1. Obtener 20 municipios variados
    cursor.execute("""
        select id, codigo_ine, nombre, provincia, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat
        from public.municipios
        order by id asc
        limit 20;
    """)
    munis = cursor.fetchall()
    print(f"Municipios seleccionados: {len(munis)}")

    tipos = ['senal_ilegal', 'multa', 'desalojo', 'bloqueo_acceso']
    descripciones = [
        "Señal de prohibido autocaravanas colocada en entrada de playa, sin número de expediente ni ordenanza.",
        "Aviso de sanción de 200€ por estacionar sin desplegar elementos en vía urbana.",
        "Policía Local requirió desalojo a las 23:30 indicando que no se permite pernoctar en el término municipal.",
        "Gálibo físico de 2.10 metros instalado en parking público asfaltado junto al puerto.",
        "Cartel municipal prohibiendo estacionar a vehículos de más de 5 metros de longitud.",
    ]

    # Supabase service role key para subir al storage
    service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    storage_api_url = "http://127.0.0.1:54331/storage/v1/object/evidencias"

    insertados = 0
    for i, m in enumerate(munis):
        m_id, ine, nombre, prov, lon, lat = m
        tipo = tipos[i % len(tipos)]
        desc = f"[{i+1}/20] {descripciones[i % len(descripciones)]} en {nombre}."

        # Generar protocol_id para la incidencia
        cursor.execute("select public.generar_protocol_id(%s, 'INC');", (ine,))
        protocol_id = cursor.fetchone()[0]

        # Insertar incidencia pendiente
        cursor.execute(
            """
            insert into public.incidencias (
                protocol_id, municipio_id, tipo, descripcion, geom, geom_publica,
                nivel_confianza, estado_moderacion
            ) values (
                %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                1, 'pendiente'
            ) returning id;
            """,
            (protocol_id, m_id, tipo, desc, lon, lat, lon + 0.0005, lat + 0.0005)
        )
        inc_id = cursor.fetchone()[0]

        # Subir imagen al storage
        file_path = f"test/{inc_id}/evidencia.png"
        req = urllib.request.Request(
            f"{storage_api_url}/{file_path}",
            data=TINY_PNG,
            headers={
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "image/png",
                "x-upsert": "true"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                pass
        except Exception as e:
            # Fallback upload if already exists
            pass

        # Generar protocol_id de evidencia
        cursor.execute("select public.generar_protocol_id(%s, 'EVI');", (ine,))
        evi_protocol = cursor.fetchone()[0]

        # Insertar evidencia
        cursor.execute(
            """
            insert into public.evidencias (
                protocol_id, incidencia_id, url_storage, hash_sha256
            ) values (
                %s, %s, %s, %s
            );
            """,
            (evi_protocol, inc_id, file_path, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        )
        insertados += 1

    conn.commit()
    print(f">> ÉXITO: {insertados} incidencias de prueba pendientes creadas con evidencias <<")

    cursor.execute("select count(*) from public.incidencias where estado_moderacion = 'pendiente';")
    total_pendientes = cursor.fetchone()[0]
    print(f"Total incidencias pendientes en cola: {total_pendientes}")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    seed_20_incidencias()
