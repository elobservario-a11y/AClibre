import urllib.request
import json
import csv
import io
import os

print("Descargando coordenadas de OpenDataSoft...")
url_ods = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-spain-municipio/exports/json?select=mun_code,mun_name,prov_name,acom_name,geo_point_2d'
req = urllib.request.Request(url_ods, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=30) as resp:
    ods_data = json.loads(resp.read())

ods_dict = {}
for r in ods_data:
    code = r.get('mun_code')
    if code and code not in ods_dict and r.get('geo_point_2d'):
        ods_dict[code] = r

print(f"Coordenadas cargadas en memoria: {len(ods_dict)}")

print("Descargando listado oficial de municipios...")
url_muni = 'https://raw.githubusercontent.com/codeforspain/ds-organizacion-administrativa/master/data/municipios.csv'
req2 = urllib.request.Request(url_muni, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req2, timeout=30) as resp2:
    csv_text = resp2.read().decode('utf-8')

reader = csv.DictReader(io.StringIO(csv_text))

# Provincias a Comunidades Autónomas
PROV_CCAA = {
    '01': ('Araba/Álava', 'País Vasco'),
    '02': ('Albacete', 'Castilla-La Mancha'),
    '03': ('Alicante/Alacant', 'Comunitat Valenciana'),
    '04': ('Almería', 'Andalucía'),
    '05': ('Ávila', 'Castilla y León'),
    '06': ('Badajoz', 'Extremadura'),
    '07': ('Illes Balears', 'Illes Balears'),
    '08': ('Barcelona', 'Cataluña'),
    '09': ('Burgos', 'Castilla y León'),
    '10': ('Cáceres', 'Extremadura'),
    '11': ('Cádiz', 'Andalucía'),
    '12': ('Castellón/Castelló', 'Comunitat Valenciana'),
    '13': ('Ciudad Real', 'Castilla-La Mancha'),
    '14': ('Córdoba', 'Andalucía'),
    '15': ('A Coruña', 'Galicia'),
    '16': ('Cuenca', 'Castilla-La Mancha'),
    '17': ('Girona', 'Cataluña'),
    '18': ('Granada', 'Andalucía'),
    '19': ('Guadalajara', 'Castilla-La Mancha'),
    '20': ('Gipuzkoa', 'País Vasco'),
    '21': ('Huelva', 'Andalucía'),
    '22': ('Huesca', 'Aragón'),
    '23': ('Jaén', 'Andalucía'),
    '24': ('León', 'Castilla y León'),
    '25': ('Lleida', 'Cataluña'),
    '26': ('La Rioja', 'La Rioja'),
    '27': ('Lugo', 'Galicia'),
    '28': ('Madrid', 'Comunidad de Madrid'),
    '29': ('Málaga', 'Andalucía'),
    '30': ('Murcia', 'Región de Murcia'),
    '31': ('Navarra', 'Comunidad Foral de Navarra'),
    '32': ('Ourense', 'Galicia'),
    '33': ('Asturias', 'Principado de Asturias'),
    '34': ('Palencia', 'Castilla y León'),
    '35': ('Las Palmas', 'Canarias'),
    '36': ('Pontevedra', 'Galicia'),
    '37': ('Salamanca', 'Castilla y León'),
    '38': ('Santa Cruz de Tenerife', 'Canarias'),
    '39': ('Cantabria', 'Cantabria'),
    '40': ('Segovia', 'Castilla y León'),
    '41': ('Sevilla', 'Andalucía'),
    '42': ('Soria', 'Castilla y León'),
    '43': ('Tarragona', 'Cataluña'),
    '44': ('Teruel', 'Aragón'),
    '45': ('Toledo', 'Castilla y León'),
    '46': ('Valencia/València', 'Comunitat Valenciana'),
    '47': ('Valladolid', 'Castilla y León'),
    '48': ('Bizkaia', 'País Vasco'),
    '49': ('Zamora', 'Castilla y León'),
    '50': ('Zaragoza', 'Aragón'),
    '51': ('Ceuta', 'Ceuta'),
    '52': ('Melilla', 'Melilla'),
}

records = []
for row in reader:
    ine = row['municipio_id'].strip().zfill(5)
    nombre = row['nombre'].strip()
    prov_code = ine[:2]
    prov_default, ccaa_default = PROV_CCAA.get(prov_code, ('Desconocida', 'Desconocida'))
    
    if ine in ods_dict:
        ods = ods_dict[ine]
        lon = ods['geo_point_2d']['lon']
        lat = ods['geo_point_2d']['lat']
        prov = ods.get('prov_name') or prov_default
        ccaa = ods.get('acom_name') or ccaa_default
    elif ine == '48916':  # Usansolo
        lon = -2.805
        lat = 43.228
        prov = 'Bizkaia'
        ccaa = 'País Vasco'
    else:
        continue
    
    # Escape single quotes for SQL
    nombre_escaped = nombre.replace("'", "''")
    prov_escaped = prov.replace("'", "''")
    ccaa_escaped = ccaa.replace("'", "''")
    
    records.append((ine, nombre_escaped, prov_escaped, ccaa_escaped, lon, lat))

print(f"Total municipios procesados para SQL: {len(records)}")

output_sql = os.path.join(os.path.dirname(__file__), '02_municipios.sql')
with open(output_sql, 'w', encoding='utf-8') as f:
    f.write("-- Semilla 02: 8.131+ Municipios con coordenadas oficiales WGS84\n")
    f.write("insert into public.municipios (codigo_ine, nombre, provincia, comunidad, poblacion, geom) values\n")
    
    batch = []
    for ine, nombre, prov, ccaa, lon, lat in records:
        point = f"ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)::geography"
        batch.append(f"('{ine}', '{nombre}', '{prov}', '{ccaa}', null, {point})")
    
    f.write(",\n".join(batch))
    f.write("\non conflict (codigo_ine) do update set\n")
    f.write("  nombre = excluded.nombre,\n")
    f.write("  provincia = excluded.provincia,\n")
    f.write("  comunidad = excluded.comunidad,\n")
    f.write("  geom = excluded.geom;\n")

print(f"Fichero generado con éxito: {output_sql} ({os.path.getsize(output_sql)} bytes)")

# Generar supabase/seed.sql maestro
seed_master = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'seed.sql')
fuentes_sql = os.path.join(os.path.dirname(__file__), '01_fuentes.sql')

with open(seed_master, 'w', encoding='utf-8') as f_out:
    f_out.write("-- Maestro de Semillas Supabase\n")
    with open(fuentes_sql, 'r', encoding='utf-8') as f_in:
        f_out.write(f_in.read())
        f_out.write("\n\n")
    with open(output_sql, 'r', encoding='utf-8') as f_in:
        f_out.write(f_in.read())
        f_out.write("\n")

print(f"Maestro supabase/seed.sql generado con éxito ({os.path.getsize(seed_master)} bytes)")
