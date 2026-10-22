import json
import random

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from google.genai import types

from config import (
    get_current_user,
    client,
    GEMINI_MODEL,
)
from database import get_db
from db_models import OracionCloze

router = APIRouter(prefix="/ejercicios", tags=["Ejercicios"])


@router.get("/cloze")
def obtener_oraciones_cloze(
    origen: str = "anki",
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        stmt = select(OracionCloze).where(
            OracionCloze.user_id == user_id,
            OracionCloze.origen == origen,
        )
        filas = db.scalars(stmt).all()

        if not filas:
            return {"oraciones": []}

        oraciones = [f.to_dict() for f in filas]
        return {"oraciones": oraciones}
    except Exception as e:
        return {"error": f"Error obteniendo oraciones: {str(e)}"}


@router.post("/generar_cloze")
def generar_cloze_con_ia(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # Obtener los últimos 20 mensajes del usuario
        stmt_mensajes = text(
            "SELECT rol, texto FROM mensajes WHERE user_id = :user_id ORDER BY id DESC LIMIT 20"
        )
        mensajes_raw = db.execute(stmt_mensajes, {"user_id": user_id}).fetchall()
        historial_bd = reversed(mensajes_raw)

        historial_texto = ""
        for rol, texto in historial_bd:
            quien = "Alumno" if rol == "user" else "Tutor"
            historial_texto += f"{quien}: {texto}\n\n"

        instrucciones = """
        Eres un creador de ejercicios de inglés que genera oraciones para un minijuego 'Cloze' de rellenar huecos.
        Analiza este historial reciente de conversación del estudiante (delimitado por <historial>).
        Genera EXACTAMENTE 5 oraciones muy útiles en inglés basadas en sus errores o usando conectores o preposiciones comunes (in, on, at, to, for, with).
        REGLA 1: Devuelve ESTRICTAMENTE un arreglo JSON puro. Nada de markdown.
        REGLA 2: Cada objeto debe tener la oración completa en "ingles", su "espanol", y OBLIGATORIAMENTE la "palabra_oculta" que consideres más desafiante.
        REGLA 3: PROHIBIDO usar guiones bajos (____) o huecos en la propiedad "ingles". Debe ser una oración en inglés perfectamente estructurada y completa. El programa frontend se encargará visualmente de ocultar la palabra.
        REGLA 4: Si deseas ocultar más de una palabra (ya sean juntas o separadas en la oración), sepáralas por coma en "palabra_oculta".
        Formato esperado:
        [
          {
            "ingles": "She is interested in learning French.",
            "espanol": "Ella está interesada en aprender francés.",
            "palabra_oculta": "interested, in"
          }
        ]
        """

        historial_seguro = historial_texto.replace("</historial>", "")
        if not historial_seguro.strip():
            historial_seguro = "El alumno ingresó a la plataforma por primera vez. Haz unas oraciones básicas B1."

        usuario_input = f"<historial>\n{historial_seguro}\n</historial>"

        configuracion = types.GenerateContentConfig(
            system_instruction=instrucciones,
            response_mime_type="application/json",
            temperature=0.7,
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL, contents=usuario_input, config=configuracion
        )

        respuesta_limpia = (
            response.text.replace("```json", "").replace("```", "").strip()
        )
        oraciones_ia = json.loads(respuesta_limpia)

        if isinstance(oraciones_ia, dict):
            oraciones_ia = next(
                (v for v in oraciones_ia.values() if isinstance(v, list)), []
            )

        insertadas = 0
        for oracion in oraciones_ia:
            ingles = str(oracion.get("ingles", "")).strip()
            espanol = str(oracion.get("espanol", "")).strip()
            palabra_oculta = str(oracion.get("palabra_oculta", "")).strip()
            if ingles and espanol:
                nueva_oracion = OracionCloze(
                    ingles=ingles,
                    espanol=espanol,
                    user_id=user_id,
                    chat_id=0,
                    origen="ia",
                    palabra_oculta=palabra_oculta,
                )
                db.add(nueva_oracion)
                insertadas += 1

        db.commit()

        return {
            "mensaje": f"Se generaron e insertaron {insertadas} oraciones nuevas.",
            "exito": True,
        }

    except Exception as e:
        db.rollback()
        return {"error": f"Error al generar con IA: {str(e)}"}


@router.delete("/cloze/{oracion_id}")
async def eliminar_ejercicio_cloze(
    oracion_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        stmt = select(OracionCloze).where(
            OracionCloze.id == oracion_id,
            OracionCloze.user_id == user_id,
        )
        ejercicio = db.scalars(stmt).first()
        if not ejercicio:
            return {"error": "Ejercicio no encontrado"}

        db.delete(ejercicio)
        db.commit()
        return {"exito": True, "mensaje": "Ejercicio eliminado"}
    except Exception as e:
        db.rollback()
        return {"error": f"Error eliminando ejercicio: {str(e)}"}
