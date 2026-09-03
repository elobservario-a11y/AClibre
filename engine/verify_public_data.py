import os
import sys
import json
import hashlib

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def verificar_integridad_descentralizada():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, 'data')
    manifest_path = os.path.join(data_dir, 'manifest.json')

    if not os.path.exists(manifest_path):
        print(f"❌ Error: Manifiesto no encontrado en {manifest_path}")
        sys.exit(1)

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    print("=== Auditoría Descentralizada de Integridad Slowvan ===")
    print(f"Fecha de export: {manifest.get('exported_at')}")
    print(f"Responsable: {manifest.get('responsable')} ({manifest.get('email_contacto')})")
    print(f"Licencia: {manifest.get('licencia')}")
    print(f"Merkle Root declarado: {manifest.get('merkle_root_sha256')}\n")

    errores = 0
    combined_hashes = ""

    # 1. Verificar hashes de archivos
    for fname, meta in manifest.get('archivos', {}).items():
        fpath = os.path.join(data_dir, fname)
        if not os.path.exists(fpath):
            print(f"❌ Archivo faltante: {fname}")
            errores += 1
            continue

        h = hashlib.sha256()
        with open(fpath, 'rb') as f:
            while chunk := f.read(8192):
                h.update(chunk)
        calc_sha = h.hexdigest()

        if calc_sha == meta['sha256']:
            print(f"  ✓ {fname:<18} [SHA-256 OK: {calc_sha[:12]}... ({meta['bytes']} bytes)]")
            combined_hashes += calc_sha
        else:
            print(f"  ❌ DISCREPANCIA en {fname}: esperado {meta['sha256']}, calculado {calc_sha}")
            errores += 1

    # 2. Verificar Merkle Root Hash
    calc_merkle = hashlib.sha256(combined_hashes.encode('utf-8')).hexdigest()
    if calc_merkle == manifest.get('merkle_root_sha256'):
        print(f"\n  ✓ Merkle Root Hash verificado matemáticamente: {calc_merkle}")
    else:
        print(f"\n  ❌ Merkle Root Hash no coincide: esperado {manifest.get('merkle_root_sha256')}, obtenido {calc_merkle}")
        errores += 1

    # 3. Verificar registros internos de incidencias
    inc_path = os.path.join(data_dir, 'incidencias.json')
    if os.path.exists(inc_path):
        with open(inc_path, 'r', encoding='utf-8') as f:
            incidencias = json.load(f)
        reg_err = 0
        for inc in incidencias:
            expected_str = f"{inc['protocol_id']}|{inc['codigo_ine']}|{inc['tipo']}|{inc['descripcion']}"
            computed = hashlib.sha256(expected_str.encode('utf-8')).hexdigest()
            if computed != inc.get('hash_sha256'):
                reg_err += 1
        if reg_err == 0:
            print(f"  ✓ {len(incidencias)} registros de incidencias validados uno a uno contra su hash canónico.")
        else:
            print(f"  ❌ {reg_err} registros de incidencias con hash no válido.")
            errores += reg_err

    if errores == 0:
        print("\n🏆 INTEGRIDAD 100% VERIFICADA: Los datos públicos no han sido alterados ni manipulados.")
        sys.exit(0)
    else:
        print(f"\n⚠️ AUDITORÍA FALLIDA: Se detectaron {errores} errores de integridad.")
        sys.exit(1)

if __name__ == '__main__':
    verificar_integridad_descentralizada()
