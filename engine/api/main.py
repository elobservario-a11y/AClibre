import os
import sys
import re
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel

# Añadir el directorio raíz de engine al sys.path para importar generadores
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from generator.allegations import generar_pdf_alegacion
from generator.recurso_reposicion import generar_pdf_recurso_reposicion
from generator.solicitud_transparencia import generar_pdf_solicitud_transparencia

app = FastAPI(
    title="Slowvan PDF Generator Microservice",
    description="Microservicio desacoplado para generación de documentos jurídicos en PDF",
    version="1.0.0"
)

PROTOCOL_REGEX = re.compile(r"^ES-MU-\d{5}-[A-Z]{3}-\d{4}-\d+$")

class GenerarDocumentoPayload(BaseModel):
    protocolId: str
    nombre: Optional[str] = "[NOMBRE Y APELLIDOS]"
    dni: Optional[str] = "[DNI/NIE]"
    domicilio: Optional[str] = "[DOMICILIO]"
    email: Optional[str] = "info@slowvan.com"

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "ok", "service": "slowvan-pdf-generator"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok", "service": "slowvan-pdf-generator"}

@app.post("/generar/{tipo_documento}")
def generar_documento(
    tipo_documento: str,
    payload: GenerarDocumentoPayload,
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token")
):
    # 1. Verificación de seguridad por token compartido
    expected_token = os.environ.get("INTERNAL_GENERATOR_TOKEN")
    if expected_token and x_internal_token != expected_token:
        raise HTTPException(status_code=401, detail="Token interno de generador no válido")

    # 2. Validación de protocolo
    if not PROTOCOL_REGEX.match(payload.protocolId):
        raise HTTPException(status_code=400, detail="protocolId no válido o con formato incorrecto")

    tipo = tipo_documento.lower().strip()
    if tipo not in ["alegacion", "reposicion", "transparencia"]:
        raise HTTPException(status_code=400, detail="tipo_documento no válido (alegacion, reposicion, transparencia)")

    ciudadano = {
        "nombre_completo": (payload.nombre or "[NOMBRE Y APELLIDOS]")[:150],
        "dni": (payload.dni or "[DNI/NIE]")[:20],
        "domicilio": (payload.domicilio or "[DOMICILIO]")[:200],
        "email": (payload.email or "info@slowvan.com")[:100],
    }

    try:
        if tipo == "alegacion":
            pdf_bytes = generar_pdf_alegacion(payload.protocolId, ciudadano, output_path=None)
            filename = f"Alegaciones_{payload.protocolId}.pdf"
        elif tipo == "reposicion":
            pdf_bytes = generar_pdf_recurso_reposicion(payload.protocolId, ciudadano, output_path=None)
            filename = f"Recurso_Reposicion_{payload.protocolId}.pdf"
        else:
            pdf_bytes = generar_pdf_solicitud_transparencia(payload.protocolId, ciudadano, output_path=None)
            filename = f"Solicitud_Transparencia_{payload.protocolId}.pdf"

        if not pdf_bytes:
            raise HTTPException(status_code=500, detail="No se generó contenido para el PDF solicitado")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store, no-cache, must-revalidate",
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al generar documento: {str(e)}")
