import os
import sys
import urllib.request
import json
from datetime import date
from typing import List, Dict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import psycopg2

def enviar_alertas_pendientes():
    conn = psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB", "postgres"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", 54332))
    )
    cursor = conn.cursor()

    # 1. Buscar normas en información pública con plazo vigente
    cursor.execute("""
        select n.id, n.protocol_id, n.tipo, n.plazo_alegaciones_hasta,
               m.id as municipio_id, m.codigo_ine, m.nombre as municipio, m.provincia
        from public.normas n
        join public.municipios m on m.id = n.municipio_id
        where n.estado = 'informacion_publica'
          and n.plazo_alegaciones_hasta >= current_date;
    """)
    normas_activas = cursor.fetchall()
    print(f"=== Envío de Alertas por Correo Slowvan ===")
    print(f"Normas con plazo de alegaciones abierto: {len(normas_activas)}")

    total_enviadas = 0

    for n_id, prot_id, tipo, plazo, m_id, ine, muni, prov in normas_activas:
        dias_restantes = (plazo - date.today()).days

        # Buscar suscriptores del municipio o la provincia que no hayan recibido alerta de esta norma
        cursor.execute("""
            select s.id, s.email, s.token_baja
            from public.suscripciones_alertas s
            where s.activa = true
              and (s.municipio_id = %s or s.provincia = %s)
              and not exists (
                  select 1 from public.alertas_enviadas a
                  where a.norma_id = %s and a.suscripcion_id = s.id
              );
        """, (m_id, prov, n_id))
        suscriptores = cursor.fetchall()

        if not suscriptores:
            continue

        print(f"Enviando alertas para {muni} ({prov}) - Quedan {dias_restantes} días a {len(suscriptores)} suscriptor(es)...")

        # Obtener hallazgos de la norma para el correo
        cursor.execute("select articulo, fundamento_ilegalidad from public.hallazgos where norma_id = %s;", (n_id,))
        hallazgos = cursor.fetchall()
        resumen_hallazgos = "\n".join([f"• {h[0]}: {h[1]}" for h in hallazgos[:3]]) or "Restricción injustificada a vehículos vivienda."

        resend_key = os.environ.get("RESEND_API_KEY")

        for s_id, email, token_baja in suscriptores:
            asunto = f"🚨 Alerta Caravaning: Nueva ordenanza en {muni} — Quedan {dias_restantes} días para alegar"
            ficha_url = f"https://slowvan.com/municipio/{ine}"
            baja_url = f"https://slowvan.com/alertas/baja?token={token_baja}"

            html_body = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                <h2 style="color: #ea580c;">🚨 Alerta de Ordenanza en {muni} ({prov})</h2>
                <p>El radar de Slowvan ha detectado una nueva ordenanza en período de alegaciones que afecta al caravaning:</p>
                
                <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 12px; margin: 16px 0;">
                    <p style="margin: 0; font-weight: bold; color: #9a3412;">
                        ⏳ Cuenta atrás: Quedan {dias_restantes} días para presentar alegaciones (vence el {plazo.strftime('%d/%m/%Y')})
                    </p>
                </div>

                <h3>Hallazgos jurídicos detectados:</h3>
                <pre style="background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 12px; white-space: pre-wrap;">{resumen_hallazgos}</pre>

                <p style="margin-top: 20px;">
                    <a href="{ficha_url}" style="background: #ea580c; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                        Ver ficha completa y preparar alegación →
                    </a>
                </p>

                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0 10px 0;" />
                <p style="font-size: 11px; color: #9ca3af;">
                    Recibes este correo porque te suscribiste a las alertas de {muni} o {prov}. 
                    <a href="{baja_url}" style="color: #6b7280;">Darse de baja</a> con 1 clic.
                </p>
            </div>
            """

            if resend_key:
                try:
                    payload = {
                        "from": "Slowvan Radar <alertas@slowvan.com>",
                        "to": [email],
                        "subject": asunto,
                        "html": html_body
                    }
                    req = urllib.request.Request(
                        "https://api.resend.com/emails",
                        data=json.dumps(payload).encode('utf-8'),
                        headers={
                            "Authorization": f"Bearer {resend_key}",
                            "Content-Type": "application/json"
                        },
                        method="POST"
                    )
                    urllib.request.urlopen(req)
                except Exception as e:
                    print(f"Error enviando correo a {email} con Resend: {e}")
            else:
                # Simulación local
                print(f"  ✉️ [Simulación Resend] Correo enviado a {email}: '{asunto}'")

            # Registrar alerta enviada
            cursor.execute("""
                insert into public.alertas_enviadas (norma_id, suscripcion_id)
                values (%s, %s);
            """, (n_id, s_id))
            conn.commit()
            total_enviadas += 1

    print(f">> Total alertas enviadas: {total_enviadas}")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    enviar_alertas_pendientes()
