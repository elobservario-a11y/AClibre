import os
import sys
import io
from datetime import date
from typing import Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import psycopg2
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

def generar_pdf_solicitud_transparencia(
    incidencia_protocol_id: str,
    ciudadano: Dict[str, str],
    output_path: Optional[str] = None
) -> bytes:
    """
    Genera una Solicitud de Información Pública al amparo de la Ley 19/2013 (Transparencia)
    para exigir el expediente administrativo y técnico de una señal o limitador de gálibo.
    """
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

    cursor.execute("""
        select i.id, i.protocol_id, i.tipo, i.descripcion,
               ST_X(i.geom_publica::geometry) as lon, ST_Y(i.geom_publica::geometry) as lat,
               m.codigo_ine, m.nombre as municipio, m.provincia
        from public.incidencias i
        join public.municipios m on m.id = i.municipio_id
        where i.protocol_id = %s;
    """, (incidencia_protocol_id,))
    row = cursor.fetchone()

    if not row:
        cursor.close()
        conn.close()
        raise ValueError(f"No se encontró incidencia con protocolo {incidencia_protocol_id}")

    inc_id, prot_id, tipo_inc, desc_inc, lon, lat, ine, muni, prov = row

    cursor.close()
    conn.close()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        output_path or buffer,
        pagesize=A4,
        leftMargin=2.2 * cm,
        rightMargin=2.2 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.2 * cm
    )

    styles = getSampleStyleSheet()

    style_header = ParagraphStyle(
        'HeaderTransp', fontName='Helvetica-Bold', fontSize=11, leading=14,
        textColor=colors.HexColor('#111827'), spaceAfter=15
    )
    style_title = ParagraphStyle(
        'TitleTransp', fontName='Helvetica-Bold', fontSize=12, leading=15,
        alignment=1, textColor=colors.HexColor('#1e40af'), spaceBefore=8, spaceAfter=14
    )
    style_body = ParagraphStyle(
        'BodyTransp', fontName='Helvetica', fontSize=9.5, leading=13.5,
        alignment=4, textColor=colors.HexColor('#1f2937'), spaceAfter=8
    )
    style_bold = ParagraphStyle(
        'BoldTransp', fontName='Helvetica-Bold', fontSize=9.5, leading=13.5,
        textColor=colors.HexColor('#111827'), spaceAfter=4, spaceBefore=8
    )
    style_cita = ParagraphStyle(
        'CitaTransp', fontName='Helvetica-Oblique', fontSize=9, leading=13,
        leftIndent=15, rightIndent=15, textColor=colors.HexColor('#374151'),
        spaceBefore=4, spaceAfter=6
    )
    style_inst = ParagraphStyle(
        'InstTransp', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#1f2937')
    )

    story = []

    nombre = ciudadano.get('nombre_completo', '[NOMBRE Y APELLIDOS]').strip()
    dni = ciudadano.get('dni', '[DNI/NIE]').strip()
    domicilio = ciudadano.get('domicilio', '[DOMICILIO]').strip()
    email = ciudadano.get('email', '[CORREO ELECTRÓNICO]').strip()

    # ENCABEZADO
    story.append(Paragraph(
        f"<b>AL ÓRGANO COMPETENTE EN MATERIA DE TRANSPARENCIA Y ACCESO A LA INFORMACIÓN</b><br/>"
        f"EXCMO. AYUNTAMIENTO DE {muni.upper()}<br/>"
        f"Provincia de {prov} · Código INE: {ine}",
        style_header
    ))

    # TÍTULO
    story.append(Paragraph(
        f"<b>SOLICITUD DE ACCESO A LA INFORMACIÓN PÚBLICA</b><br/>"
        f"<font size='9'>Al amparo de los artículos 12 y siguientes de la Ley 19/2013, de Transparencia<br/>"
        f"Referencia documental: {prot_id}</font>",
        style_title
    ))

    # COMPARECENCIA
    story.append(Paragraph(
        f"<b>D./Dña. {nombre}</b>, con DNI/NIE número <b>{dni}</b>, "
        f"con domicilio a efectos de notificaciones en {domicilio}, y correo electrónico de contacto {email}, "
        f"en ejercicio del derecho fundamental de acceso a la información pública reconocido en el artículo 105.b de la "
        f"Constitución Española y desarrollado en la Ley 19/2013, de 9 de diciembre, ante este Ayuntamiento comparece y <b>EXPONE:</b>",
        style_body
    ))

    # HECHOS
    story.append(Paragraph(
        f"<b>PRIMERO.-</b> Que en el término municipal de {muni}, en las inmediaciones de las coordenadas "
        f"aproximadas ({lat:.4f}, {lon:.4f}), se ha constatado la instalación en la vía pública del siguiente elemento:<br/>"
        f"<i>«{desc_inc}»</i> (Incidencia registrada con código {prot_id}).",
        style_body
    ))

    story.append(Paragraph(
        f"<b>SEGUNDO.-</b> Que conforme a lo dispuesto en el artículo 139 del Reglamento General de Circulación, "
        f"corresponde con carácter exclusivo a la autoridad encargada de la regulación del tráfico la instalación y "
        f"mantenimiento de las señales en las vías públicas, debiendo estar debidamente justificadas mediante el oportuno "
        f"expediente administrativo y ajustarse con exactitud al Catálogo Oficial de Señales de la Circulación.<br/>"
        f"Cualquier limitador físico de gálibo o señal no homologada colocado sin expediente técnico vulnera la legalidad vigente "
        f"y genera indefensión a los usuarios de la vía pública.",
        style_body
    ))

    # PETITUM
    story.append(Paragraph("Por todo ello, al amparo del artículo 17 de la Ley 19/2013, <b>SOLICITA:</b>", style_bold))
    story.append(Paragraph(
        f"Que se expida y remita al compareciente en formato electrónico accesible copia de la siguiente información pública:<br/><br/>"
        f"<b>1.</b> Copia del <b>Acuerdo del órgano municipal competente</b> (Pleno, Junta de Gobierno o Decreto de Alcaldía) "
        f"por el que se autorizó y ordenó la instalación física de la referida señalética o limitador de gálibo.<br/><br/>"
        f"<b>2.</b> Copia del <b>Informe técnico preceptivo</b> del Área de Seguridad Vial o Policía Local que motive "
        f"la necesidad de la medida y su compatibilidad con el catálogo oficial de señales del Reglamento General de Circulación.<br/><br/>"
        f"<b>3.</b> En caso de no existir expediente administrativo formal que ampare dicha instalación, <b>Certificado negativo "
        f"acreditativo de dicho extremo</b>, a los efectos oportunos de instar la inmediata retirada del obstáculo de la vía pública.",
        style_body
    ))

    fecha_hoy = date.today().strftime("%d de septiembre de %Y")
    story.append(Spacer(1, 15))
    story.append(Paragraph(f"En {muni}, a {fecha_hoy}.", style_body))
    story.append(Spacer(1, 15))
    story.append(Paragraph(f"Fdo.: <b>{nombre}</b><br/>DNI: {dni}", style_body))

    # INSTRUCCIONES
    story.append(PageBreak())
    story.append(Paragraph(
        f"<b>INSTRUCCIONES DE PRESENTACIÓN DE LA SOLICITUD DE TRANSPARENCIA</b><br/>"
        f"<font size='9' color='#6b7280'>Plazo máximo de respuesta de la Administración: 1 mes (Art. 20 Ley 19/2013)</font>",
        style_title
    ))

    inst_text = f"""
    <b>1. Sin tasa y sin justificar motivo:</b> La solicitud de información pública es gratuita. No necesitas justificar ningún interés particular ni dar explicaciones (Art. 17.3 Ley 19/2013).<br/><br/>
    <b>2. Presentación en Sede Electrónica:</b><br/>
    • Entra en la Sede Electrónica del Ayuntamiento de {muni} en el trámite específico de «Acceso a la Información Pública / Transparencia» o «Instancia General».<br/>
    • O preséntalo a través del <b>Registro Electrónico Común (REC - Red SARA)</b>: <u>https://rec.redsara.es</u> buscando Ayuntamiento de {muni}.<br/><br/>
    <b>3. ¿Qué ocurre si no responden en 1 mes?</b><br/>
    El silencio administrativo es desestimatorio, pero tienes derecho a interponer <b>Reclamación gratuita ante el Consejo de Transparencia</b> (estatal o autonómico), que obligará al Ayuntamiento a contestar o a certificar que la señal carece de expediente administrativo, lo cual es la prueba definitiva para forzar su retirada judicial.
    """

    tabla = Table([[Paragraph(inst_text, style_inst)]], colWidths=[16 * cm])
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#eff6ff')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#93c5fd')),
        ('PADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(tabla)

    doc.build(story)

    if output_path:
        print(f">> Solicitud de Transparencia generada en: {output_path}")
        return b""
    return buffer.getvalue()

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Generador de Solicitud de Transparencia de Slowvan")
    parser.add_argument("--protocol", required=False, default="ES-MU-39047-INC-2026-001", help="Protocol ID de la incidencia")
    parser.add_argument("--nombre", default="[NOMBRE Y APELLIDOS]", help="Nombre del ciudadano")
    parser.add_argument("--dni", default="[DNI/NIE]", help="DNI del ciudadano")
    parser.add_argument("--domicilio", default="[DOMICILIO]", help="Domicilio")
    parser.add_argument("--email", default="info@slowvan.com", help="Email")
    parser.add_argument("--out", default="", help="Ruta de salida")

    args = parser.parse_args()

    ciudadano_input = {
        'nombre_completo': args.nombre,
        'dni': args.dni,
        'domicilio': args.domicilio,
        'email': args.email
    }

    out_file = args.out or os.path.join(BASE_DIR, 'data', f"solicitud_transparencia_{args.protocol}.pdf")
    generar_pdf_solicitud_transparencia(args.protocol, ciudadano_input, output_path=out_file)
