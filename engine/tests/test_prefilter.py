import pytest
from engine.prefilter.filter import evaluar_anuncio, normalize_text

class TestPrefilter:
    # -------------------------------------------------------------
    # 1. NIVEL A: Específicos (Candidatos inmediatos)
    # -------------------------------------------------------------
    @pytest.mark.parametrize("titulo,texto,expected_term", [
        (
            "Ayuntamiento de Llanes",
            "Aprobación de la modificación puntual relativa al estacionamiento de autocaravanas en playas.",
            "autocaravanas"
        ),
        (
            "Anuncio de Alcaldía",
            "Queda prohibida la pernocta de cualquier camper en el término municipal.",
            "camper"
        ),
        (
            "Diputación Provincial",
            "Instalación de limitador de altura y gálibos en el acceso al puerto deportivo.",
            "limitador de altura"
        ),
        (
            "Ayuntamiento de Tarifa",
            "Regulación de los vehículos vivienda en viales adyacentes al parque natural.",
            "vehiculos vivienda"
        ),
        (
            "Ayuntamiento de Dénia",
            "Bando municipal sobre estacionamiento de autocaravanas y similares.",
            "autocaravanas y similares"
        ),
        (
            "Ayuntamiento de Noja",
            "Apertura de expediente para habilitar una nueva área de autocaravanas municipal.",
            "area de autocaravanas"
        ),
    ])
    def test_nivel_a_castellano(self, titulo, texto, expected_term):
        res = evaluar_anuncio(titulo, texto)
        assert res.is_candidate is True
        assert res.nivel == "A"
        assert len(res.matched_terms) > 0

    # -------------------------------------------------------------
    # 2. NIVEL A: Variantes en lenguas cooficiales
    # -------------------------------------------------------------
    def test_nivel_a_catalan_valenciano(self):
        res = evaluar_anuncio(
            "Ajuntament de Tossa de Mar",
            "Aprovació inicial de l'ordenança de regulació de la pernoctació de vehicles habitatge."
        )
        assert res.is_candidate is True
        assert res.nivel == "A"

    def test_nivel_a_galego(self):
        res = evaluar_anuncio(
            "Concello de Cangas",
            "Bando sobre a prohibición de pernoita de caravanas nas inmediacións dos areais."
        )
        assert res.is_candidate is True
        assert res.nivel == "A"

    def test_nivel_a_euskera(self):
        res = evaluar_anuncio(
            "Zarauzko Udala",
            "Ibilgailu etxebizitza eta kanpatze kontrolari buruzko udal araudiaren aldaketa."
        )
        assert res.is_candidate is True
        assert res.nivel == "A"

    # -------------------------------------------------------------
    # 3. NIVEL B: Genéricos con co-ocurrencia requerida
    # -------------------------------------------------------------
    def test_nivel_b_ordenanza_circulacion_con_procedimiento(self):
        res = evaluar_anuncio(
            "Ayuntamiento de Peñíscola",
            "Información pública de la aprobación inicial de la ordenanza de circulación y movilidad urbana."
        )
        assert res.is_candidate is True
        assert res.nivel == "B"

    def test_nivel_b_acampada_con_restriccion(self):
        res = evaluar_anuncio(
            "Ayuntamiento de Altea",
            "Normas sobre prohibición de acampada y estacionamientos en espacios del litoral."
        )
        assert res.is_candidate is True
        assert res.nivel == "B"

    def test_nivel_b_peso_mma_con_restriccion(self):
        res = evaluar_anuncio(
            "Ayuntamiento de Conil",
            "Restricción de estacionamiento a vehículos con MMA superior a 3.500 kg en viales costeros."
        )
        assert res.is_candidate is True
        assert res.nivel == "B"

    # -------------------------------------------------------------
    # 4. NEGATIVOS: Ruido administrativo a descartar (~98%)
    # -------------------------------------------------------------
    @pytest.mark.parametrize("titulo,texto", [
        (
            "Licencia urbanística",
            "Concesión de licencia de obras para construcción de vivienda unifamiliar aislada con piscina."
        ),
        (
            "Oferta de Empleo Público",
            "Bases de la convocatoria para proveer dos plazas de Oficial de Policía Local mediante concurso-oposición."
        ),
        (
            "Gestión Tributaria",
            "Aprobación del padrón cobratorio del Impuesto sobre Bienes Inmuebles de naturaleza urbana del ejercicio 2026."
        ),
        (
            "Alcaldía - Matrimonios civiles",
            "Decreto de delegación de atribuciones de la Alcaldía para la autorización de matrimonio civil."
        ),
        (
            "Servicios Sociales",
            "Convocatoria de subvenciones individuales para personas de la tercera edad y ayudas de emergencia social."
        ),
        (
            "Contratación Pública",
            "Licitación del contrato de mantenimiento de alumbrado público y sustitución de luminarias LED."
        ),
        (
            "Padrón de Habitantes",
            "Anuncio de notificación de trámite de audiencia en expedientes de baja de oficio en el Padrón Municipal."
        ),
        (
            "Vado permanente",
            "Solicitud de licencia de vado permanente para acceso de vehículos a garaje privado en Calle Mayor 14."
        )
    ])
    def test_negativos_ruido_administrativo(self, titulo, texto):
        res = evaluar_anuncio(titulo, texto)
        assert res.is_candidate is False
        assert res.nivel is None
        assert len(res.matched_terms) == 0

    # -------------------------------------------------------------
    # 5. RESISTENCIA A DIACRÍTICOS Y OCR DEGRADADO
    # -------------------------------------------------------------
    def test_ocr_degradado_sin_acentos(self):
        texto_degradado = "ORDENANZA DE CIRCULACION: PROHIBICION DE GALIBOS Y AUTOCARAVANAS EN LA VIA PUBLICA"
        res = evaluar_anuncio("Edicto Municipal", texto_degradado)
        assert res.is_candidate is True
        assert res.nivel == "A"
