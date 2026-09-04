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

def generar_pdf_recurso_reposicion(
    norma_protocol_id: str,
    ciudadano: Dict[str, str],
    output_path: Optional[str] = None
) -> bytes:
    """
    Genera un Recurso Potestativo de Reposición (Arts. 123 y 124 LPAC)
    frente a una ordenanza aprobada definitivamente.
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
        select n.id, n.protocol_id, n.tipo, n.estado, n.url_publicacion,
               m.codigo_ine, m.nombre as municipio, m.provincia
        from public.normas n
        join public.municipios m on m.id = n.municipio_id
        where n.protocol_id = %s;
    """, (norma_protocol_id,))
    row = cursor.fetchone()

    if not row:
        cursor.close()
        conn.close()
        raise ValueError(f"No se encontró norma con protocolo {norma_protocol_id}")

    n_id, prot_id, tipo_norma, estado_norma, url_pub, ine, muni, prov = row

    # 2. Obtener hallazgos ordenados dinámicamente por prioridad y tasa de éxito
    cursor.execute("""
        select h.articulo, h.cita_literal, h.fundamento_ilegalidad,
               coalesce(e.tasa_exito, 0.0) as tasa_exito,
               coalesce(e.peso_prioridad, 0) as peso
        from public.hallazgos h
        left join public.efectividad_argumentos e on e.tipo_restriccion = h.tipo_restriccion
        where h.norma_id = %s
        order by coalesce(e.peso_prioridad, 0) desc, coalesce(e.tasa_exito, 0.0) desc, h.id asc;
    """, (n_id,))
    hallazgos = cursor.fetchall()

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
        'HeaderRep', fontName='Helvetica-Bold', fontSize=11, leading=14,
        textColor=colors.HexColor('#111827'), spaceAfter=15
    )
    style_title = ParagraphStyle(
        'TitleRep', fontName='Helvetica-Bold', fontSize=12, leading=15,
        alignment=1, textColor=colors.HexColor('#b91c1c'), spaceBefore=8, spaceAfter=14
    )
    style_body = ParagraphStyle(
        'BodyRep', fontName='Helvetica', fontSize=9.5, leading=13.5,
        alignment=4, textColor=colors.HexColor('#1f2937'), spaceAfter=8
    )
    style_bold = ParagraphStyle(
        'BoldRep', fontName='Helvetica-Bold', fontSize=9.5, leading=13.5,
        textColor=colors.HexColor('#111827'), spaceAfter=4, spaceBefore=8
    )
    style_cita = ParagraphStyle(
        'CitaRep', fontName='Helvetica-Oblique', fontSize=9, leading=13,
        leftIndent=15, rightIndent=15, textColor=colors.HexColor('#374151'),
        spaceBefore=4, spaceAfter=6
    )
    style_inst = ParagraphStyle(
        'InstRep', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#1f2937')
    )

    story = []

    nombre = ciudadano.get('nombre_completo', '[NOMBRE Y APELLIDOS]').strip()
    dni = ciudadano.get('dni', '[DNI/NIE]').strip()
    domicilio = ciudadano.get('domicilio', '[DOMICILIO]').strip()
    email = ciudadano.get('email', '[CORREO ELECTRÓNICO]').strip()

    # ENCABEZADO
    story.append(Paragraph(
        f"<b>AL PLENO DEL EXCMO. AYUNTAMIENTO DE {muni.upper()}</b><br/>"
        f"Secretaría General / Registro General<br/>"
        f"Provincia de {prov} · Código INE: {ine}",
        style_header
    ))

    # TÍTULO
    story.append(Paragraph(
        f"<b>RECURSO POTESTATIVO DE REPOSICIÓN</b><br/>"
        f"<font size='9'>Artículos 123 y 124 de la Ley 39/2015 (LPAC)<br/>"
        f"Frente a la aprobación definitiva de la Ordenanza de {tipo_norma} · Protocolo: {prot_id}</font>",
        style_title
    ))

    # COMPARECENCIA
    story.append(Paragraph(
        f"<b>D./Dña. {nombre}</b>, mayor de edad, con DNI/NIE número <b>{dni}</b>, "
        f"con domicilio a efectos de notificaciones en {domicilio}, y correo electrónico {email}, "
        f"actuando en su condición de ciudadano interesado, ante este Ayuntamiento comparece y, "
        f"como mejor proceda en Derecho, <b>DICE:</b>",
        style_body
    ))

    story.append(Paragraph(
        f"Que por medio del presente escrito, y dentro del plazo legal de un mes previsto en el artículo 124.1 "
        f"de la Ley 39/2015, interpone formalmente <b>RECURSO POTESTATIVO DE REPOSICIÓN</b> contra el acuerdo del Pleno "
        f"de aprobación definitiva de la <i>Ordenanza de {tipo_norma} del Ayuntamiento de {muni}</i>, "
        f"en base a los siguientes <b>MOTIVOS:</b>",
        style_body
    ))

    # MOTIVO PRIMERO
    story.append(Paragraph("MOTIVO PRIMERO.- Nulidad de pleno derecho por vulneración de la jerarquía normativa.", style_bold))
    story.append(Paragraph(
        f"El artículo 47.2 de la Ley 39/2015 sanciona con <b>nulidad de pleno derecho</b> las disposiciones administrativas "
        f"que vulneren la Constitución, las leyes u otras disposiciones administrativas de rango superior. "
        f"El artículo 93.2 del Reglamento General de Circulación (RGC) prohíbe taxativamente que las ordenanzas locales "
        f"se opongan, alteren o desvirtúen los preceptos estatales de tráfico. La ordenanza recurrida incurre en causa legal "
        f"de nulidad radical al imponer restricciones a vehículos homologados M1 sin causa de masa o gálibo.",
        style_body
    ))

    # MOTIVO SEGUNDO
    story.append(Paragraph("MOTIVO SEGUNDO.- Preceptos específicos recurridos e infracción de la doctrina estatal.", style_bold))
    story.append(Paragraph(
        f"La Instrucción DGT PROT 2023/14 y la reiterada jurisprudencia de los Tribunales Superiores de Justicia determinan "
        f"que pernoctar dentro de un vehículo correctamente estacionado sin desplegar elementos exteriores no es acampada. "
        f"Los siguientes preceptos del texto aprobado definitivamente infringen directamente dicho marco:",
        style_body
    ))

    if hallazgos:
        for idx, h in enumerate(hallazgos, 1):
            art, cita, fund, tasa, peso = h
            story.append(Paragraph(f"<b>2.{idx}. Precepto impugnado: {art}</b>", style_bold))
            story.append(Paragraph(f"«{cita}»", style_cita))
            story.append(Paragraph(f"<b>Fundamento de nulidad:</b> {fund}", style_body))
    else:
        story.append(Paragraph(
            "Los artículos que establecen prohibiciones temporales o genéricas de estancia en el término municipal "
            "vulneran el artículo 19 de la Constitución Española y el artículo 7 del Texto Refundido de la Ley de Tráfico.",
            style_body
        ))

    # MOTIVO TERCERO
    story.append(Paragraph("MOTIVO TERCERO.- Falta de motivación y vulneración del principio de proporcionalidad.", style_bold))
    story.append(Paragraph(
        f"El artículo 35.1.i de la Ley 39/2015 impone la obligada motivación de los actos que se aparten del criterio seguido "
        f"en actuaciones precedentes o del dictamen de órganos consultivos. La corporación municipal no ha aportado "
        f"ningún informe técnico que acredite cómo la presencia de un vehículo vivienda perturba el tráfico en mayor medida "
        f"que cualquier otro vehículo de idéntica masa o volumen.",
        style_body
    ))

    # SUPLICO
    story.append(Paragraph(
        f"Por todo lo expuesto,<br/>"
        f"<b>SUPLICA AL PLENO:</b> Que teniendo por presentado este escrito en tiempo y forma, se sirva admitirlo, "
        f"tenga por interpuesto <b>RECURSO POTESTATIVO DE REPOSICIÓN</b> contra el acuerdo de aprobación definitiva de la "
        f"Ordenanza de {tipo_norma} de {muni}, y acuerde declarar la <b>nulidad de pleno derecho</b> y consiguiente supresión "
        f"de los preceptos impugnados, o en su defecto, dicte resolución expresa desestimatoria que deje expedita la vía "
        f"jurisdiccional contencioso-administrativa.",
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
        f"<b>INSTRUCCIONES DE PRESENTACIÓN DEL RECURSO DE REPOSICIÓN</b><br/>"
        f"<font size='9' color='#6b7280'>Plazo: 1 mes a contar desde el día siguiente a la publicación en el BOP</font>",
        style_title
    ))

    inst_text = f"""
    <b>1. Plazo improrrogable:</b> El recurso de reposición debe presentarse dentro del mes siguiente a la publicación oficial de la aprobación definitiva (Art. 124.1 LPAC).<br/><br/>
    <b>2. Firma obligatoria:</b> Firma el documento electrónicamente con Certificado Digital o AutoFirma antes de subirlo, o imprímelo y fírmalo a mano.<br/><br/>
    <b>3. Canales oficiales válidos:</b><br/>
    • <b>Sede Electrónica del Ayuntamiento de {muni}:</b> En el apartado «Recurso de Reposición» o «Instancia General».<br/>
    • <b>Registro Electrónico Común (REC):</b> <u>https://rec.redsara.es</u> buscando el Ayuntamiento de {muni} (INE: {ine}).<br/>
    • <b>Oficinas de Correos:</b> Por correo administrativo con dos copias (sobre abierto para sellado).<br/><br/>
    <b>4. Efectos:</b> La administración tiene 1 mes para resolver. Transcurrido dicho plazo sin resolución expresa, el recurso se entenderá desestimado por silencio administrativo (Art. 124.2 LPAC), quedando abierta la vía judicial ante el Tribunal Superior de Justicia.
    """

    tabla = Table([[Paragraph(inst_text, style_inst)]], colWidths=[16 * cm])
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef2f2')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#fca5a5')),
        ('PADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(tabla)

    doc.build(story)

    if output_path:
        print(f">> Recurso de Reposición generado en: {output_path}")
        return b""
    return buffer.getvalue()

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Generador de Recurso de Reposición de Slowvan")
    parser.add_argument("--protocol", required=False, default="ES-MU-33036-NOR-2026-001", help="Protocol ID de la norma")
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

    out_file = args.out or os.path.join(BASE_DIR, 'data', f"recurso_reposicion_{args.protocol}.pdf")
    generar_pdf_recurso_reposicion(args.protocol, ciudadano_input, output_path=out_file)
