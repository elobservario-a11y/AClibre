import psycopg2
import json
import os

CASOS_DATA = [
    {
        "ine": "33036", "nombre": "Llanes", "prov": "Asturias",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Señalización discriminatoria en accesos a playas de Torimbia y Cuevas del Mar",
        "desc": "Instalación de señales con silueta de autocaravana tachada prohibiendo estacionar de 22:00 a 08:00 sin número de acuerdo plenario ni amparo en el RGC.",
        "articulo": "Art. 18.3", "cita": "Queda prohibido el estacionamiento de autocaravanas, caravanas y similares en todos los aparcamientos de las playas del municipio.",
        "fundamento": "Vulnera el Art. 93 del RGC y la Instrucción PROT 2023/14 al discriminar por tipología de vehículo sin justificación de masa o gálibo.",
        "nivel": 3, "estrategico": 8
    },
    {
        "ine": "33056", "nombre": "Ribadesella", "prov": "Asturias",
        "tipo_inc": "multa", "tipo_norma": "circulacion",
        "titulo": "Limitación horaria de 24 horas exclusiva para vehículos vivienda",
        "desc": "Sanción de 100€ a autocaravana estacionada 28 horas continuadas en aparcamiento libre donde los turismos pueden estacionar indefinidamente.",
        "articulo": "Art. 22", "cita": "Las autocaravanas no podrán permanecer estacionadas en el mismo lugar de la vía pública más de veinticuatro horas consecutivas.",
        "fundamento": "Discriminación arbitraria no motivada en criterios técnicos de fluidez circulatoria (LTSV Art. 7 y RGC Art. 93).",
        "nivel": 4, "estrategico": 7
    },
    {
        "ine": "39047", "nombre": "Noja", "prov": "Cantabria",
        "tipo_inc": "bloqueo_acceso", "tipo_norma": "costas",
        "titulo": "Gálibo físico limitador a 2,00 metros en playa de Helgueras",
        "desc": "Estructura metálica soldada a 2 metros en entrada de aparcamiento público asfaltado fuera de zona de servidumbre de protección de Costas.",
        "articulo": "Bando Municipal", "cita": "Se limita la altura máxima de acceso al estacionamiento municipal a dos metros para evitar la ocupación por autocaravanas.",
        "fundamento": "Obstáculo físico no homologado en el Catálogo Oficial de Señales. Doctrina TSJ Comunitat Valenciana 2018.",
        "nivel": 4, "estrategico": 9
    },
    {
        "ine": "39080", "nombre": "San Vicente de la Barquera", "prov": "Cantabria",
        "tipo_inc": "desalojo", "tipo_norma": "convivencia",
        "titulo": "Desalojo nocturno y prohibición de pernocta en todo el término",
        "desc": "Requerimiento de abandono a las 01:30 en el aparcamiento de El Tostadero a usuarios que dormían dentro de su camper sin elementos exteriores.",
        "articulo": "Art. 12", "cita": "Se prohíbe la pernocta en el interior de cualquier vehículo fuera de las instalaciones de campamento de turismo autorizadas.",
        "fundamento": "Invasión de competencias de tráfico e infracción de la Instrucción DGT PROT 2023/14: el uso interior no constituye acampada.",
        "nivel": 3, "estrategico": 8
    },
    {
        "ine": "11035", "nombre": "Tarifa", "prov": "Cádiz",
        "tipo_inc": "multa", "tipo_norma": "circulacion",
        "titulo": "Multas automáticas en el litoral urbano alegando acampada",
        "desc": "Denuncia de 150€ por estacionar en calle pública asfaltada de Los Lances con el argumento de que el vehículo contiene cama y cocina.",
        "articulo": "Art. 31", "cita": "Se presumirá acampada cuando un vehículo vivienda permanezca estacionado entre la puesta y la salida del sol.",
        "fundamento": "Presunción ilegal contraria a la jurisprudencia del Tribunal Supremo y al Art. 38 de la Ley de Tráfico.",
        "nivel": 4, "estrategico": 9
    },
    {
        "ine": "11014", "nombre": "Conil de la Frontera", "prov": "Cádiz",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Señales de R-308 con texto adicional 'Exclusivo Turismos'",
        "desc": "Colocación masiva de señales de prohibido estacionar con placa complementaria excluyendo autocaravanas en Fontanilla y Roche.",
        "articulo": "Art. 15", "cita": "Queda prohibido el estacionamiento de autocaravanas y vehículos habitables en primera línea de playa.",
        "fundamento": "Señalización antirreglamentaria no contemplada en el Reglamento General de Circulación.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "03018", "nombre": "Altea", "prov": "Alicante",
        "tipo_inc": "bloqueo_acceso", "tipo_norma": "circulacion",
        "titulo": "Barreras de gálibo en aparcamiento de Cap Negret",
        "desc": "Limitador a 2.10m impidiendo el estacionamiento de cualquier furgoneta o autocaravana mientras se permite a furgones de reparto matinales.",
        "articulo": "Art. 27", "cita": "Instalación de dispositivos reductores de gálibo en zonas costeras.",
        "fundamento": "Vulneración de la libre circulación y discriminación arbitraria de usuarios (Art. 14 CE).",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "03047", "nombre": "Calp", "prov": "Alicante",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Pictograma no homologado en acceso a Las Salinas",
        "desc": "Placa municipal con dibujo de camper tachada y amenaza de sanción de hasta 500 euros.",
        "articulo": "Art. 41", "cita": "Prohibición de estancia y pernocta de campers y autocaravanas.",
        "fundamento": "Falta de tipicidad sancionadora e incompetencia local para alterar el catálogo estatal de señales.",
        "nivel": 3, "estrategico": 8
    },
    {
        "ine": "12089", "nombre": "Peñíscola", "prov": "Castellón",
        "tipo_inc": "multa", "tipo_norma": "circulacion",
        "titulo": "Restricción a más de 5 metros de longitud aplicada solo a autocaravanas",
        "desc": "Multa a autocaravana de 5.4m en avenida de 12 metros de ancho mientras camionetas tipo pick-up de 5.8m no son sancionadas.",
        "articulo": "Art. 9.b", "cita": "No podrán estacionar autocaravanas cuya longitud exceda de cinco metros.",
        "fundamento": "Desviación de poder: la norma invoca longitud pero la Policía Local solo multa a vehículos vivienda.",
        "nivel": 4, "estrategico": 8
    },
    {
        "ine": "43905", "nombre": "Salou", "prov": "Tarragona",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Prohibición total en toda la fachada marítima",
        "desc": "Cartelería municipal advirtiendo de retirada con grúa a vehículos vivienda en aparcamientos públicos de pago.",
        "articulo": "Art. 14", "cita": "Prohibido el estacionamiento de autocaravanas y asimilados en todo el frente litoral.",
        "fundamento": "Exceso de la potestad reglamentaria municipal según jurisprudencia contenciosa de Cataluña.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "17032", "nombre": "Cadaqués", "prov": "Girona",
        "tipo_inc": "desalojo", "tipo_norma": "convivencia",
        "titulo": "Prohibición de pernocta en todo el término municipal",
        "desc": "Ordenanza municipal que prohíbe pasar la noche dentro del vehículo en suelo urbano consolidado.",
        "articulo": "Art. 8", "cita": "No se permite la pernoctación en vehículos habitables en ninguna vía o espacio público de Cadaqués.",
        "fundamento": "Nulidad de pleno derecho por vulnerar la Instrucción DGT PROT 2023/14 y la doctrina del Defensor del Pueblo.",
        "nivel": 4, "estrategico": 9
    },
    {
        "ine": "17202", "nombre": "Tossa de Mar", "prov": "Girona",
        "tipo_inc": "bloqueo_acceso", "tipo_norma": "circulacion",
        "titulo": "Gálibo de 2.20m en la cala Pola",
        "desc": "Cierre físico del acceso al aparcamiento público mediante barra horizontal con candado.",
        "articulo": "Acuerdo de Pleno", "cita": "Cierre de accesos a vehículos de gran altura en zonas de interés paisajístico.",
        "fundamento": "Obstáculo no justificado por razones técnicas de la vía o seguridad vial.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "29075", "nombre": "Nerja", "prov": "Málaga",
        "tipo_inc": "desalojo", "tipo_norma": "costas",
        "titulo": "Requerimiento nocturno en el aparcamiento de Maro",
        "desc": "Patrulla policial requirió a 6 autocaravanas marcharse a las 02:30 alegando ordenanza de playas sin estar en zona de arena.",
        "articulo": "Art. 21", "cita": "Se prohíbe el estacionamiento nocturno en las explanadas cercanas a las playas.",
        "fundamento": "Infracción del principio de tipicidad y vulneración de la LRBRL Art. 84.",
        "nivel": 3, "estrategico": 8
    },
    {
        "ine": "04064", "nombre": "Mojácar", "prov": "Almería",
        "tipo_inc": "multa", "tipo_norma": "convivencia",
        "titulo": "Sanción por 'indicios de habitabilidad' con oscurecedores puestos",
        "desc": "Boletín de denuncia por tener los aislantes térmicos colocados en el parabrisas mientras el vehículo estaba legalmente aparcado.",
        "articulo": "Art. 19", "cita": "Tener cerradas las cortinas o colocados elementos opacos en las ventanas se considerará prueba de acampada.",
        "fundamento": "Vulneración frontal de la Instrucción 08/V-74 y PROT 2023/14: los elementos internos no trascienden al exterior.",
        "nivel": 4, "estrategico": 9
    },
    {
        "ine": "30003", "nombre": "Águilas", "prov": "Murcia",
        "tipo_inc": "senal_ilegal", "tipo_norma": "medioambiente",
        "titulo": "Señalización restrictiva en Cuatro Calas",
        "desc": "Cartel no homologado prohibiendo expresamente a furgonetas camper mientras se permite el aparcamiento a turismos y todoterrenos.",
        "articulo": "Art. 16", "cita": "Acceso restringido a vehículos vivienda en parajes naturales municipales.",
        "fundamento": "Discriminación por criterio de uso interno del vehículo sin amparo legal.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "03082", "nombre": "Xàbia", "prov": "Alicante",
        "tipo_inc": "bloqueo_acceso", "tipo_norma": "circulacion",
        "titulo": "Limitación nocturna en Cala Blanca y Portitxol",
        "desc": "Colocación de barrera móvil que se cierra de 21:00 a 08:00 únicamente en temporada alta.",
        "articulo": "Art. 34", "cita": "Regulación horaria de espacios públicos de estacionamiento en el litoral.",
        "fundamento": "Limitación horaria selectiva que afecta desproporcionadamente al turismo itinerante.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "15030", "nombre": "A Coruña", "prov": "A Coruña",
        "tipo_inc": "multa", "tipo_norma": "circulacion",
        "titulo": "Denuncia por estacionamiento de más de 48h en el Paseo Marítimo",
        "desc": "Sanción recurrida al demostrarse que el vehículo cambió de plaza dentro del mismo tramo regulado.",
        "articulo": "Art. 52", "cita": "Permanencia máxima de autocaravanas en el término municipal.",
        "fundamento": "Criterio limitativo no aplicado a otros usuarios de las vías públicas urbanas.",
        "nivel": 3, "estrategico": 6
    },
    {
        "ine": "36051", "nombre": "Sanxenxo", "prov": "Pontevedra",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Carteles con R-308 modificada en Silgar y Portonovo",
        "desc": "Prohibición expresa a vehículos clasificados como 3200 o 3148 en aparcamientos de superficie.",
        "articulo": "Art. 11", "cita": "Queda prohibido el aparcamiento de vehículos clasificados técnicamente como autocaravanas.",
        "fundamento": "La Instrucción 08/V-74 declara que la clasificación por criterios de construcción no puede ser causa de discriminación en tráfico.",
        "nivel": 4, "estrategico": 8
    },
    {
        "ine": "36008", "nombre": "Cangas", "prov": "Pontevedra",
        "tipo_inc": "desalojo", "tipo_norma": "costas",
        "titulo": "Requerimientos en playas de Nerga y Barra",
        "desc": "Desalojo policial a autocaravanas correctamente estacionadas en batería sin invasión de servidumbre.",
        "articulo": "Art. 23", "cita": "Control de vehículos vivienda en inmediaciones de espacios litorales protegidos.",
        "fundamento": "Extralimitación sobre la Ley de Costas al aplicar prohibiciones en viales urbanos asfaltados.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "17160", "nombre": "Sant Feliu de Guíxols", "prov": "Girona",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Señal R-400 no reglamentaria en el puerto",
        "desc": "Señal indicativa con silueta tachada carente de código oficial en el catálogo de señales del RGC.",
        "articulo": "Art. 14", "cita": "Regulación de aparcamientos en zona portuaria y de ribera.",
        "fundamento": "Infracción del Art. 93.2 RGC: las ordenanzas no pueden alterar o inducir a confusión con la señalización reglamentaria.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "03063", "nombre": "Dénia", "prov": "Alicante",
        "tipo_inc": "bloqueo_acceso", "tipo_norma": "circulacion",
        "titulo": "Gálibo físico en el inicio de Les Rotes",
        "desc": "Limitador a 2.05m sin señalización previa de advertencia, provocando daños en vehículos y maniobras peligrosas.",
        "articulo": "Bando de Tráfico", "cita": "Instalación de barreras para preservar la tranquilidad vecinal en Les Rotes.",
        "fundamento": "Riesgo para la seguridad vial e infracción de la normativa sobre obstáculos en calzada (RGC Art. 5).",
        "nivel": 3, "estrategico": 8
    },
    {
        "ine": "18017", "nombre": "Almuñécar", "prov": "Granada",
        "tipo_inc": "multa", "tipo_norma": "circulacion",
        "titulo": "Sanción de 200 euros en playa de San Cristóbal",
        "desc": "Multa impuesta por Policía Local a camper aparcada dentro de las marcas viales de la calzada.",
        "articulo": "Art. 29", "cita": "El estacionamiento continuado de vehículos recreativos en zona costera queda sujeto a autorización previa.",
        "fundamento": "Exigencia de autorización inexistente en la legislación general de tráfico.",
        "nivel": 4, "estrategico": 8
    },
    {
        "ine": "43038", "nombre": "Cambrils", "prov": "Tarragona",
        "tipo_inc": "multa", "tipo_norma": "circulacion",
        "titulo": "Retirada con grúa de autocaravana en línea blanca",
        "desc": "Retirada del vehículo sin constituir obstáculo grave ni estar en zona de carga y descarga.",
        "articulo": "Art. 37", "cita": "Se retirarán aquellos vehículos vivienda que ocupen plazas de aparcamiento durante más de 3 días.",
        "fundamento": "Desproporción en la medida cautelar de retirada según Art. 105 LTSV.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "23028", "nombre": "Cazorla", "prov": "Jaén",
        "tipo_inc": "desalojo", "tipo_norma": "medioambiente",
        "titulo": "Conflicto en Parque Natural: extralimitación municipal",
        "desc": "La Policía Local desaloja vehículos en el casco urbano de Cazorla argumentando el Plan de Ordenación del Parque Natural.",
        "articulo": "Art. 15", "cita": "Prohibición de pernocta en casco urbano en consonancia con la normativa del Parque.",
        "fundamento": "El casco urbano clasificado como suelo urbano no forma parte de la zona de reserva del PORN.",
        "nivel": 4, "estrategico": 8
    },
    {
        "ine": "16078", "nombre": "Cuenca", "prov": "Cuenca",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Señales prohibitivas en el Barrio del Castillo y hoces",
        "desc": "Placas metálicas prohibiendo estacionar de 22:00 a 08:00 a autocaravanas en aparcamientos asfaltados con vistas a las hoces.",
        "articulo": "Art. 24", "cita": "Restricción de estacionamiento nocturno en el Casco Histórico y zonas de miradores.",
        "fundamento": "Discriminación de vehículos de masa inferior a 3.500 kg sin afección al patrimonio histórico demostrada.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "29084", "nombre": "Ronda", "prov": "Málaga",
        "tipo_inc": "senal_ilegal", "tipo_norma": "circulacion",
        "titulo": "Señal inventada prohibiendo estacionar y pernoctar a campers",
        "desc": "Señalética municipal con prohibición específica para vehículos camper en aparcamiento del recinto ferial.",
        "articulo": "Art. 18", "cita": "Regulación del estacionamiento de furgonetas camperizadas en el término municipal.",
        "fundamento": "Inexistencia de la categoría legal 'furgoneta camperizada' en el Reglamento General de Vehículos.",
        "nivel": 3, "estrategico": 7
    },
    {
        "ine": "07024", "nombre": "Formentera", "prov": "Illes Balears",
        "tipo_inc": "multa", "tipo_norma": "medioambiente",
        "titulo": "Prohibición insular total de pernocta en autocaravanas",
        "desc": "Régimen especial insular sancionando la pernocta en cualquier espacio público o privado de la isla.",
        "articulo": "Art. 5", "cita": "Se prohíbe pernoctar en vehículos vivienda en todo el ámbito insular de Formentera.",
        "fundamento": "Conflicto entre competencias de ordenación turística insular y libre circulación y estancia estatal.",
        "nivel": 4, "estrategico": 10
    },
    {
        "ine": "13028", "nombre": "Daimiel", "prov": "Ciudad Real",
        "tipo_inc": "multa", "tipo_norma": "circulacion",
        "titulo": "Ordenanza municipal con artículo impugnado sobre pernocta",
        "desc": "Artículo de ordenanza municipal que asimila pernoctar dentro del vehículo con acampada ilegal en vía pública urbana.",
        "articulo": "Art. 22", "cita": "Prohibido el estacionamiento de autocaravanas de más de 5 metros en todo el término municipal.",
        "fundamento": "Contrario a la Instrucción PROT 2023/14 y competencia municipal sobre tráfico y ordenación de usos.",
        "nivel": 4, "estrategico": 8
    }
]

def seed_corpus_casos():
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="postgres",
        host="127.0.0.1",
        port=54332
    )
    cursor = conn.cursor()

    print(f"Cargando {len(CASOS_DATA)} casos semilla en la base de datos...")

    casos_insertados = 0
    normas_insertadas = 0
    incidencias_insertadas = 0

    for caso in CASOS_DATA:
        ine = caso["ine"]

        # 1. Obtener ID del municipio
        cursor.execute("select id, ST_X(geom::geometry), ST_Y(geom::geometry) from public.municipios where codigo_ine = %s;", (ine,))
        row = cursor.fetchone()
        if not row:
            print(f"Municipio no encontrado para INE {ine}")
            continue
        m_id, lon, lat = row

        # 2. Generar protocol_id para el CASO
        cursor.execute("select public.generar_protocol_id(%s, 'CAS');", (ine,))
        cas_protocol = cursor.fetchone()[0]

        cursor.execute("""
            insert into public.casos (
                protocol_id, municipio_id, titulo, descripcion,
                nivel_verificacion, potencial_estrategico, es_campana, es_semilla
            ) values (
                %s, %s, %s, %s, %s, %s, false, true
            ) returning id;
        """, (cas_protocol, m_id, caso["titulo"], caso["desc"], caso["nivel"], caso["estrategico"]))
        caso_id = cursor.fetchone()[0]
        casos_insertados += 1

        # 3. Generar NORMA asociada
        cursor.execute("select public.generar_protocol_id(%s, 'NOR');", (ine,))
        nor_protocol = cursor.fetchone()[0]

        cursor.execute("""
            insert into public.normas (
                protocol_id, municipio_id, tipo, estado, url_publicacion
            ) values (
                %s, %s, %s, 'vigente', %s
            ) returning id;
        """, (nor_protocol, m_id, caso["tipo_norma"], f"https://bop.{caso['prov'].lower().replace(' ', '')}.es/norma/{nor_protocol}"))
        norma_id = cursor.fetchone()[0]
        normas_insertadas += 1

        # 4. Insertar HALLAZGO
        cursor.execute("""
            insert into public.hallazgos (
                norma_id, articulo, cita_literal, tipo_restriccion,
                fundamento_ilegalidad, confianza_ia, verificado
            ) values (
                %s, %s, %s, 'pernocta', %s, 1.0, true
            );
        """, (norma_id, caso["articulo"], caso["cita"], caso["fundamento"]))

        # 5. Generar INCIDENCIA asociada aprobada (nivel verificado)
        cursor.execute("select public.generar_protocol_id(%s, 'INC');", (ine,))
        inc_protocol = cursor.fetchone()[0]

        cursor.execute("""
            insert into public.incidencias (
                protocol_id, municipio_id, tipo, descripcion,
                geom, geom_publica, nivel_confianza, estado_moderacion
            ) values (
                %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                %s, 'aprobado'
            ) returning id;
        """, (
            inc_protocol, m_id, caso["tipo_inc"], caso["desc"],
            lon, lat, lon + 0.0006, lat + 0.0006,
            caso["nivel"]
        ))
        inc_id = cursor.fetchone()[0]
        incidencias_insertadas += 1

        # 6. EVIDENCIA
        cursor.execute("select public.generar_protocol_id(%s, 'EVI');", (ine,))
        evi_protocol = cursor.fetchone()[0]

        cursor.execute("""
            insert into public.evidencias (
                protocol_id, incidencia_id, url_storage, hash_sha256
            ) values (
                %s, %s, %s, %s
            );
        """, (
            evi_protocol, inc_id,
            f"semilla/{ine}/evidencia_{cas_protocol}.jpg",
            "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"
        ))

    conn.commit()
    print(f"\n>> CARGA COMPLETADA <<")
    print(f"Casos semilla insertados: {casos_insertados}")
    print(f"Normas insertadas: {normas_insertadas}")
    print(f"Incidencias verificadas aprobadas: {incidencias_insertadas}")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    seed_corpus_casos()
