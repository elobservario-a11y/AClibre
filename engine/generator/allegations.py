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
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)

def generar_pdf_alegacion(
    norma_protocol_id: str,
    ciudadano: Dict[str, str],
    output_path: Optional[str] = None
) -> bytes:
    """
    Genera un escrito formal de alegaciones en PDF listo para firma y presentación.
    """
    conn = psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB", "postgres"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", 54332))
    )
    cursor = conn.cursor()

    # 1. Obtener datos de la norma y municipio
    cursor.execute("""
        select n.id, n.protocol_id, n.tipo, n.estado, n.plazo_alegaciones_hasta, n.url_publicacion,
               m.codigo_ine, m.nombre as municipio, m.provincia, m.comunidad
        from public.normas n
        join public.municipios m on m.id = n.municipio_id
        where n.protocol_id = %s;
    """, (norma_protocol_id,))
    norma_row = cursor.fetchone()

    if not norma_row:
        cursor.close()
        conn.close()
        raise ValueError(f"No se encontró norma con protocolo {norma_protocol_id}")

    n_id, prot_id, tipo_norma, estado_norma, plazo_hasta, url_pub, ine, muni, prov, ca = norma_row

    # 2. Obtener hallazgos de la norma ordenados dinámicamente por peso y tasa de éxito
    cursor.execute("""
        select h.articulo, h.cita_literal, h.tipo_restriccion, h.fundamento_ilegalidad,
               coalesce(e.tasa_exito, 75.0) as tasa_exito,
               coalesce(e.peso_prioridad, 50) as peso
        from public.hallazgos h
        left join public.efectividad_argumentos e on e.tipo_restriccion = h.tipo_restriccion
        where h.norma_id = %s
        order by coalesce(e.peso_prioridad, 50) desc, coalesce(e.tasa_exito, 75.0) desc, h.id asc;
    """, (n_id,))
    hallazgos = cursor.fetchall()

    cursor.close()
    conn.close()

    # Preparar buffer PDF
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
        'HeaderAdmin',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=0, # Left
        textColor=colors.HexColor('#111827'),
        spaceAfter=15
    )

    style_title = ParagraphStyle(
        'TitleAdmin',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=1, # Center
        textColor=colors.HexColor('#9a3412'),
        spaceBefore=10,
        spaceAfter=15
    )

    style_body = ParagraphStyle(
        'BodyAdmin',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        alignment=4, # Justify
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=8
    )

    style_bold = ParagraphStyle(
        'BoldAdmin',
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#111827'),
        spaceAfter=4,
        spaceBefore=8
    )

    style_cita = ParagraphStyle(
        'CitaAdmin',
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        leftIndent=15,
        rightIndent=15,
        textColor=colors.HexColor('#374151'),
        spaceBefore=4,
        spaceAfter=6
    )

    style_instrucciones = ParagraphStyle(
        'Instrucciones',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1f2937')
    )

    story = []

    # ENCABEZADO
    story.append(Paragraph(
        f"<b>AL ILMO./A. SR./A. ALCALDE/SA - PRESIDENTE/A DEL AYUNTAMIENTO DE {muni.upper()}</b><br/>"
        f"Registro General / Área de Tráfico y Movilidad Urbana<br/>"
        f"Provincia de {prov}",
        style_header
    ))

    # TÍTULO DEL EXPEDIENTE
    story.append(Paragraph(
        f"<b>ESCRITO DE ALEGACIONES EN TRÁMITE DE INFORMACIÓN PÚBLICA</b><br/>"
        f"<font size='9'>Expediente: Ordenanza municipal de {tipo_norma} · Protocolo: {prot_id}</font>",
        style_title
    ))

    # COMPARECENCIA
    nombre = ciudadano.get('nombre_completo', '[NOMBRE Y APELLIDOS]').strip()
    dni = ciudadano.get('dni', '[DNI/NIE]').strip()
    domicilio = ciudadano.get('domicilio', '[DOMICILIO A EFECTOS DE NOTIFICACIONES]').strip()
    email = ciudadano.get('email', '[CORREO ELECTRÓNICO]').strip()

    story.append(Paragraph(
        f"<b>D./Dña. {nombre}</b>, mayor de edad, con DNI/NIE número <b>{dni}</b>, "
        f"con domicilio a efectos de notificaciones en {domicilio}, y correo electrónico {email}, "
        f"en calidad de ciudadano interesado y usuario de vehículos de uso recreativo, "
        f"ante este Ayuntamiento comparece y, como mejor proceda en Derecho, <b>EXPONE:</b>",
        style_body
    ))

    # HECHOS
    story.append(Paragraph(
        f"<b>PRIMERO.-</b> Que habiéndose publicado en el Boletín Oficial correspondiente el anuncio relativo al trámite de "
        f"información pública y audiencia a los interesados de la aprobación inicial de la "
        f"<i>Ordenanza reguladora de {tipo_norma} en el término municipal de {muni}</i>, "
        f"encontrándose el procedimiento en plazo legal de conformidad con lo previsto en el artículo 83 de la Ley 39/2015, "
        f"de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas (LPAC), "
        f"mediante el presente escrito formula en tiempo y forma las siguientes <b>ALEGACIONES:</b>",
        style_body
    ))

    # ALEGACIÓN PRIMERA
    story.append(Paragraph("ALEGACIÓN PRIMERA.- Incompetencia municipal para desvirtuar las normas generales de tráfico.", style_bold))
    story.append(Paragraph(
        f"El artículo 93.2 del Reglamento General de Circulación (Real Decreto 1428/2003) impone una limitación expresa y "
        f"terminante a la potestad normativa local: <i>«En ningún caso podrán las ordenanzas municipales oponerse, alterar, "
        f"desvirtuar o inducir a confusión con los preceptos de este reglamento»</i>.<br/>"
        f"Asimismo, el artículo 7 del Real Decreto Legislativo 6/2015 (Ley sobre Tráfico y Seguridad Vial) encomienda a los "
        f"municipios la <i>«equitativa distribución de los aparcamientos entre todos los usuarios»</i>, lo que prohíbe de raíz "
        f"el establecimiento de exclusiones no fundadas en criterios objetivos de fluidez o seguridad vial.",
        style_body
    ))

    # ALEGACIÓN SEGUNDA: HALLAZGOS Y CITAS TEXTUALES
    story.append(Paragraph("ALEGACIÓN SEGUNDA.- Ilegalidad de los preceptos que discriminan por tipología o uso interno.", style_bold))
    story.append(Paragraph(
        f"La doctrina administrativa vinculante de la Dirección General de Tráfico, materializada en la <b>Instrucción PROT 2023/14</b> "
        f"(y en la histórica Instrucción 08/V-74), establece con claridad meridiana que el estacionamiento de autocaravanas y vehículos "
        f"vivienda no puede ser objeto de discriminación cuando concurran las mismas circunstancias de masa y dimensiones que en el resto de vehículos.<br/>"
        f"En el texto sometido a información pública se han detectado los siguientes preceptos contrarios al marco estatal:",
        style_body
    ))

    if hallazgos:
        for idx, h in enumerate(hallazgos, 1):
            art, cita, tipo_rest, fund, tasa, peso = h
            badge_efectividad = f" <font size='8' color='#16a34a'>[Efectividad jurídica contrastada: {tasa}% de resoluciones favorables]</font>" if tasa >= 80 else ""
            story.append(Paragraph(f"<b>2.{idx}. Respecto al precepto: {art}</b>{badge_efectividad}", style_bold))
            story.append(Paragraph(f"«{cita}»", style_cita))
            story.append(Paragraph(f"<b>Fundamento de ilegalidad:</b> {fund}", style_body))
    else:
        story.append(Paragraph(
            "Los preceptos del proyecto que limitan genéricamente el tiempo de estacionamiento o la pernocta en el interior "
            "del vehículo sin que la actividad trascienda al exterior vulneran la jurisprudencia contencioso-administrativa "
            "consolidada (Sentencias de los TSJ de Asturias, Cantabria y Comunitat Valenciana).",
            style_body
        ))

    # ALEGACIÓN TERCERA: PROPORCIONALIDAD
    story.append(Paragraph("ALEGACIÓN TERCERA.- Vulneración del principio de proporcionalidad y necesidad.", style_bold))
    story.append(Paragraph(
        f"El artículo 84 de la Ley 7/1985 (LRBRL) y el artículo 4 de la Ley 40/2015 exigen que la intervención municipal se rija "
        f"por los principios de necesidad y proporcionalidad, eligiendo la medida menos restrictiva para la libertad individual. "
        f"La prohibición general de estacionamiento o pernocta a vehículos habitables es manifiestamente desproporcionada "
        f"cuando existen mecanismos ordinarios de control de orden público, ruidos y vertidos aplicables a cualquier infractor.",
        style_body
    ))

    # SUPLICO
    story.append(Paragraph(
        f"Por todo lo expuesto,<br/>"
        f"<b>SOLICITA:</b> Que teniendo por presentado este escrito, se sirva admitirlo, tenga por formuladas en tiempo y forma "
        f"las presentes alegaciones al proyecto de Ordenanza de {tipo_norma} de {muni}, y previos los trámites legales oportunos, "
        f"acuerde la <b>supresión o rectificación de los preceptos impugnados</b> a fin de acomodarlos plenamente a la legislación "
        f"estatal de tráfico y a la doctrina vinculante de la DGT con anterioridad a su aprobación definitiva.",
        style_body
    ))

    # LUGAR, FECHA Y FIRMA
    fecha_hoy = date.today().strftime("%d de septiembre de %Y")
    story.append(Spacer(1, 15))
    story.append(Paragraph(f"En {muni}, a {fecha_hoy}.", style_body))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"Fdo.: <b>{nombre}</b><br/>DNI: {dni}", style_body))

    # ====================================================================
    # PÁGINA ANEXA: HOJA DE INSTRUCCIONES DE PRESENTACIÓN
    # ====================================================================
    story.append(PageBreak())

    story.append(Paragraph(
        f"<b>INSTRUCCIONES DE PRESENTACIÓN OFICIAL</b><br/>"
        f"<font size='9' color='#6b7280'>Guía paso a paso para que tu alegación tenga plena validez jurídica</font>",
        style_title
    ))

    instrucciones_html = f"""
    <b>1. Firma del documento:</b><br/>
    • Si vas a presentarlo online: firma el PDF descargado con tu Certificado Digital (utilizando AutoFirma o Adobe Reader).<br/>
    • Si vas a presentarlo en papel: imprime el documento y fíchalo a mano en el espacio reservado.<br/><br/>

    <b>2. Vías de presentación oficial (Ley 39/2015, Art. 16.4):</b><br/>
    • <b>Vía A (Recomendada · Inmediata): Sede Electrónica del Ayuntamiento de {muni}</b><br/>
      Accede a la sede electrónica municipal con Cl@ve o Certificado Digital, busca el trámite de «Instancia General» o «Alegaciones en Información Pública» y adjunta este PDF firmado. Guarda el justificante con sello de tiempo.<br/><br/>
    • <b>Vía B (Sin certificado del ayuntamiento): Registro Electrónico Común (REC - Red SARA)</b><br/>
      Entra en <u>https://rec.redsara.es</u>, selecciona en el buscador de organismos el <i>Ayuntamiento de {muni}</i> (código INE: {ine}) y presenta el escrito. Válido legalmente en toda España.<br/><br/>
    • <b>Vía C (Presencial por Correos):</b><br/>
      Lleva dos copias del documento a una oficina de Correos en sobre abierto, solicita «Envío por Registro Administrativo ORVE/SIR». Te sellarán tu copia para que te sirva de justificante.<br/><br/>

    <b>3. Aviso de responsabilidad y transparencia:</b><br/>
    Este escrito ha sido parametrizado automáticamente por la infraestructura abierta de <b>Slowvan</b> (slowvan.com) a partir de los datos oficiales detectados por el radar normativo y el corpus de jurisprudencia estatal.
    La presentación de este escrito se realiza bajo tu exclusiva responsabilidad y en ejercicio de tu derecho constitucional de participación ciudadana.
    """

    tabla_data = [[Paragraph(instrucciones_html, style_instrucciones)]]
    tabla = Table(tabla_data, colWidths=[16 * cm])
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(tabla)

    doc.build(story)

    if output_path:
        print(f">> PDF generado con éxito en: {output_path}")
        return b""
    else:
        return buffer.getvalue()

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Generador de alegaciones en PDF de Slowvan")
    parser.add_argument("--protocol", required=False, default="ES-MU-33056-NOR-2026-002", help="Protocol ID de la norma")
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

    out_file = args.out or os.path.join(BASE_DIR, 'data', f"alegacion_{args.protocol}.pdf")
    generar_pdf_alegacion(args.protocol, ciudadano_input, output_path=out_file)
