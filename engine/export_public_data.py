import os
import json
import csv
import hashlib
from datetime import datetime, timezone
import psycopg2

def calcular_hash_archivo(filepath: str) -> str:
    """Calcula el hash SHA-256 de un archivo en disco."""
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def export_public_datasets():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)

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

    # 1. Exportar Incidencias Aprobadas
    cursor.execute("""
        select 
            i.protocol_id,
            m.codigo_ine,
            m.nombre as municipio,
            m.provincia,
            m.comunidad,
            i.tipo,
            i.descripcion,
            i.nivel_confianza,
            ST_X(i.geom_publica::geometry) as lon_publica,
            ST_Y(i.geom_publica::geometry) as lat_publica,
            i.creado_en
        from public.incidencias i
        join public.municipios m on m.id = i.municipio_id
        where i.estado_moderacion = 'aprobado'
        order by i.creado_en desc;
    """)
    rows = cursor.fetchall()
    cols = [desc[0] for desc in cursor.description]
    incidencias = [dict(zip(cols, row)) for row in rows]

    for inc in incidencias:
        if inc.get('creado_en'):
            inc['creado_en'] = inc['creado_en'].isoformat()
        # Hash SHA-256 canónico del registro
        canonical_str = f"{inc['protocol_id']}|{inc['codigo_ine']}|{inc['tipo']}|{inc['descripcion']}"
        inc['hash_sha256'] = hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

    json_path = os.path.join(data_dir, 'incidencias.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(incidencias, f, indent=2, ensure_ascii=False)

    csv_path = os.path.join(data_dir, 'incidencias.csv')
    csv_cols = cols + ['hash_sha256']
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_cols)
        writer.writeheader()
        writer.writerows(incidencias)

    print(f">> Incidencias exportadas: {len(incidencias)} en {json_path}")

    # 2. Exportar Normas Públicas
    cursor.execute("""
        select 
            n.protocol_id,
            m.codigo_ine,
            m.nombre as municipio,
            m.provincia,
            n.tipo,
            n.estado,
            n.plazo_alegaciones_hasta,
            n.url_publicacion,
            n.creado_en
        from public.normas n
        join public.municipios m on m.id = n.municipio_id
        order by n.creado_en desc;
    """)
    rows_normas = cursor.fetchall()
    cols_normas = [desc[0] for desc in cursor.description]
    normas = [dict(zip(cols_normas, row)) for row in rows_normas]

    for nor in normas:
        if nor.get('plazo_alegaciones_hasta'):
            nor['plazo_alegaciones_hasta'] = str(nor['plazo_alegaciones_hasta'])
        if nor.get('creado_en'):
            nor['creado_en'] = nor['creado_en'].isoformat()
        canonical_str = f"{nor['protocol_id']}|{nor['codigo_ine']}|{nor['tipo']}|{nor['estado']}"
        nor['hash_sha256'] = hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

    normas_json = os.path.join(data_dir, 'normas.json')
    with open(normas_json, 'w', encoding='utf-8') as f:
        json.dump(normas, f, indent=2, ensure_ascii=False)

    print(f">> Normas exportadas: {len(normas)} en {normas_json}")

    # 3. Exportar Catálogo de Fuentes
    cursor.execute("select id, provincia, tipo, url_base, activo from public.fuentes order by provincia;")
    fuentes = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    fuentes_json = os.path.join(data_dir, 'fuentes.json')
    with open(fuentes_json, 'w', encoding='utf-8') as f:
        json.dump(fuentes, f, indent=2, ensure_ascii=False)

    print(f">> Fuentes exportadas: {len(fuentes)} en {fuentes_json}")

    cursor.close()
    conn.close()

    # 4. Generar Manifiesto de Integridad y Verificación Criptográfica
    archivos = ['incidencias.json', 'incidencias.csv', 'normas.json', 'fuentes.json']
    file_hashes = {}
    combined_hashes = ""

    for fname in archivos:
        fpath = os.path.join(data_dir, fname)
        h = calcular_hash_archivo(fpath)
        size = os.path.getsize(fpath)
        file_hashes[fname] = {'sha256': h, 'bytes': size}
        combined_hashes += h

    merkle_root = hashlib.sha256(combined_hashes.encode('utf-8')).hexdigest()

    manifest = {
        'version': '1.0',
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'responsable': 'Jose Montero',
        'email_contacto': 'info@slowvan.com',
        'licencia': 'AGPL-3.0',
        'total_incidencias': len(incidencias),
        'total_normas': len(normas),
        'total_fuentes': len(fuentes),
        'archivos': file_hashes,
        'merkle_root_sha256': merkle_root,
        'instrucciones_verificacion': 'Ejecuta python engine/verify_public_data.py para auditar la integridad de todos los archivos sin conexión a la base de datos.'
    }

    manifest_path = os.path.join(data_dir, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f">> Manifiesto criptográfico generado: {manifest_path} (Merkle Root: {merkle_root[:16]}...)")

if __name__ == '__main__':
    export_public_datasets()
