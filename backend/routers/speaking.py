import json
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from google.genai import types
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import GEMINI_MODEL, client, get_current_user
from database import get_db
from db_models import (
    EvaluacionSpeaking,
    SpeakingAnkiItem,
)
from models import (
    GenerarTemaRequest,
    SpeakingAnkiItemRequest,
    TemaSpeakingPropuesto,
    EvaluacionSpeakingPropuesta,
    SugerirVocabularioTemaRequest,
    VocabularioSugeridoItem,
)

router = APIRouter(tags=["Speaking"])

SPEAKING_AUDIO_DIR = os.path.join("static", "audios", "speaking")
os.makedirs(SPEAKING_AUDIO_DIR, exist_ok=True)

# Cargar temas predefinidos desde el archivo JSON externo
RUTA_TEMAS = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "temas_predefinidos.json")
)


def cargar_temas_predefinidos() -> list:
    try:
        with open(RUTA_TEMAS, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error cargando temas_predefinidos.json: {e}")
        return []


TEMAS_PREDEFINIDOS = cargar_temas_predefinidos()


@router.get("/temas")
def obtener_temas():
    """Retorna la lista de temas sugeridos para practicar speaking."""
    return {"temas": TEMAS_PREDEFINIDOS}


@router.post("/generar_tema")
def generar_tema_con_ia(
    req: GenerarTemaRequest,
    user_id: str = Depends(get_current_user),
):
    """Genera un tema o pregunta de speaking personalizado con IA."""
    try:
        nivel = req.nivel or "B2"
        intereses = req.intereses or "General topics, hobbies, technology, culture"

        prompt = f"""
        Generate an engaging and natural English Speaking prompt for an English learner at level {nivel}.
        Student interests: {intereses}.
        
        Requirements:
        1. "titulo": Short catchy title in English.
        2. "pregunta": Full, engaging question or prompt in English (1-2 sentences).
        3. "puntos_guia": 3 to 4 guiding questions in English.
        4. "vocabulario_sugerido": Exactly 4 to 6 high-value words, collocations, or phrasal verbs in English with natural Spanish translations and part-of-speech type to equip the student with vocabulary beforehand.
        5. "duracion_recomendada": e.g. "60 - 90 seg".
        """

        configuracion = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TemaSpeakingPropuesto,
            temperature=0.7,
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=configuracion,
        )

        respuesta_limpia = (
            response.text.replace("```json", "").replace("```", "").strip()
        )
        data = json.loads(respuesta_limpia)
        if not data.get("id"):
            data["id"] = f"custom_{uuid.uuid4().hex[:6]}"
        return {"tema": data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando tema: {str(e)}",
        )


@router.post("/sugerir_vocabulario")
def sugerir_vocabulario_tema(
    req: SugerirVocabularioTemaRequest,
    user_id: str = Depends(get_current_user),
):
    """Genera entre 5 y 6 palabras o colocaciones clave para preparar al alumno sobre un tema específico."""
    tema_limpio = req.tema.strip()
    if not tema_limpio:
        raise HTTPException(status_code=400, detail="El tema no puede estar vacío.")

    prompt = f"""
    Eres un entrenador experto de English Speaking para hispanohablantes.
    El estudiante va a hablar sobre este tema o pregunta:
    "{tema_limpio}"
    Nivel de inglés del estudiante: {req.nivel or "B2"}.

    Tu misión es entregarle entre 5 y 6 'Power Words', colocaciones auténticas o phrasal verbs indispensables en inglés que un nativo usaría naturalmente para este tema.
    Para cada término, incluye su traducción concisa y natural al español y su tipo (ej: 'sustantivo', 'phrasal verb', 'colocación', 'expresión').
    """

    try:
        configuracion = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=list[VocabularioSugeridoItem],
            temperature=0.7,
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL, contents=prompt, config=configuracion
        )
        respuesta_limpia = (
            response.text.replace("```json", "").replace("```", "").strip()
        )
        vocabulario = json.loads(respuesta_limpia)
        if isinstance(vocabulario, dict):
            vocabulario = next(
                (v for v in vocabulario.values() if isinstance(v, list)), []
            )
        return vocabulario
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al sugerir vocabulario para el tema: {str(e)}",
        )


@router.post("/evaluar")
async def evaluar_speaking(
    audio: UploadFile = File(...),
    topic: str = Form("Free Speech"),
    duracion_segundos: float = Form(0.0),
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recibe la grabación de voz del usuario, la evalúa con Gemini y retorna sus métricas."""
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) < 500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El audio grabado es demasiado corto o está vacío. Graba al menos un par de oraciones.",
            )

        # Detectar extensión y mime type
        content_type = audio.content_type or "audio/webm"
        ext = "webm"
        if "mp4" in content_type:
            ext = "mp4"
        elif "wav" in content_type:
            ext = "wav"
        elif "ogg" in content_type:
            ext = "ogg"
        elif "mp3" in content_type or "mpeg" in content_type:
            ext = "mp3"

        nombre_archivo = f"{uuid.uuid4().hex}.{ext}"
        ruta_archivo = os.path.join(SPEAKING_AUDIO_DIR, nombre_archivo)
        with open(ruta_archivo, "wb") as f:
            f.write(audio_bytes)

        ruta_relativa_audio = f"/static/audios/speaking/{nombre_archivo}"

        # Audio listo para gemini
        part_audio = types.Part.from_bytes(data=audio_bytes, mime_type=content_type)

        prompt_evaluacion = f"""
        You are an official, objective, and rigorous English speaking examiner and speech evaluation specialist (similar to a certified IELTS/TOEFL Speaking Examiner).
        Listen carefully to the student's audio recording.
        Topic assigned: "{topic}".
        Duration of recording: approximately {duracion_segundos:.1f} seconds.

        CRITICAL EVALUATION GUIDELINES:
        - BE COMPLETELY OBJECTIVE, IMPARTIAL, AND REALISTIC. Do NOT inflate scores out of politeness or false encouragement. True progress requires honest diagnostic feedback.
        - If the student speaks broken English, makes frequent pauses, has poor pronunciation, or commits basic grammar errors, REFLECT THIS ACCURATELY in the scores (e.g., A1/A2 with scores in the 30-55 range).
        - If they perform well with minor slips, evaluate at B1 or B2 (60-79). Only award 80+ (C1/C2) to genuinely fluent, articulate, and grammatically complex speech.

        SPANISH CODE-SWITCHING & LEXICAL BRIDGES ("puentes_lexicos"):
        - If the student used Spanish words or short phrases when stuck or missing an English word (e.g. "I went to the centro de acopio to give away some clothes"):
          * DO NOT treat this as a humiliating or severe grammatical failure; it is a valid learning bridge.
          * In "transcription", transcribe faithfully what they said (both the English parts and Spanish parts).
          * In "puentes_lexicos", include an item for EVERY Spanish word/phrase used:
            - "dicho_espanol": The exact Spanish word or phrase spoken (e.g. "centro de acopio").
            - "equivalente_ingles": The most natural, idiomatic native English expression/collocation (e.g. "donation drop-off center" or "collection point").
            - "ejemplo": A clean, natural example sentence in English demonstrating this equivalent in action (ESTRICTAMENTE PROHIBIDO corchetes [ ]).
            - "explicacion": A concise, clear tip in Spanish explaining why this term fits and how to remember it.
          * If the student spoke purely in English without using any Spanish words, set "puentes_lexicos" to an empty list [].

        Evaluate across these four dimensions:
        1. Pronunciation & Clarity (0-100): Phoneme accuracy, syllable stress, intonation, comprehensibility. If words were mispronounced or unintelligible, lower the score accordingly.
        2. Fluency & Coherence (0-100): Hesitation, unnatural silences, rate of speech, and filler sounds ("uh", "um", "like", "you know").
        3. Grammatical Accuracy (0-100): Tense consistency, preposition use, word order, subject-verb agreement. Catch real mistakes.
        4. Vocabulary & Lexical Resource (0-100): Breadth of vocabulary, precision, avoidance of overused words, ability to paraphrase.

        CRITICAL FORMATTING RULE FOR "grammar.errors":
        Each element in "errors" MUST be a single, complete object containing all 3 fields together:
        original, correction, and explanation.

        CRITICAL CONTENT REQUIREMENTS:
        - "transcription": Verbatim transcription of what the user said (English and any Spanish bridges used). Do not invent words.
        - "overall_score": Realistic integer 0-100 reflecting the 4 dimensions.
        - "cefr_level": Strictly one of 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'.
        - "fluency": Score 0-100, estimated WPM, pace evaluation ('Demasiado lento', 'Vacilante', 'Ritmo natural', 'Demasiado rápido'), detected filler words (e.g. 'um', 'uh', 'like'), and objective critique in Spanish.
        - "pronunciation": Score 0-100, clarity rating ('Deficiente', 'Necesita práctica', 'Aceptable', 'Buena', 'Excelente'), problematic words (word, IPA, actionable tip in Spanish), and phonetic feedback in Spanish.
        - "grammar": Score 0-100, errors list (each containing original phrase, correction, and rule explanation in Spanish), and feedback in Spanish.
        - "vocabulary": Score 0-100, suggestions list (original word, better native alternative, natural example sentence WITHOUT square brackets [ ], explanation in Spanish), and lexical feedback in Spanish.
        - "puentes_lexicos": List of bridges for words/phrases spoken in Spanish, or empty list [] if user spoke only English.
        - "native_reformulation": Natural, fluent English reformulation of the student's intended message.
        - "tutor_feedback": Constructive summary in Spanish with strengths, main weaknesses, and 2 concrete next steps.
        """

        configuracion = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=EvaluacionSpeakingPropuesta,
            temperature=0.2,
        )

        gemini_response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[part_audio, prompt_evaluacion],
            config=configuracion,
        )

        respuesta_limpia = (
            gemini_response.text.replace("```json", "").replace("```", "").strip()
        )
        detalles = json.loads(respuesta_limpia)

        # Asegurar formato estándar y limpio en errores gramaticales
        raw_errors = detalles.get("grammar", {}).get("errors", [])
        if isinstance(raw_errors, list):
            detalles["grammar"]["errors"] = [
                {
                    "original": str(e.get("original", "")).strip(),
                    "correction": str(e.get("correction", "")).strip(),
                    "explanation": str(e.get("explanation", "")).strip(),
                }
                for e in raw_errors
                if isinstance(e, dict) and (e.get("original") or e.get("correction"))
            ]


        # Ajuste de WPM si es posible calcularlo
        transcription = detalles.get("transcription", "").strip()
        word_count = len(transcription.split())
        if duracion_segundos > 3 and word_count > 0:
            calc_wpm = int((word_count / duracion_segundos) * 60)
            if "fluency" in detalles and isinstance(detalles["fluency"], dict):
                # Si Gemini no lo estimó o está muy lejos, usamos el cálculo exacto
                if not detalles["fluency"].get("estimated_wpm"):
                    detalles["fluency"]["estimated_wpm"] = calc_wpm

        overall_score = int(detalles.get("overall_score", 70))
        cefr_level = str(detalles.get("cefr_level", "B1"))

        detalles["ruta_audio"] = ruta_relativa_audio
        detalles["duracion_segundos"] = round(duracion_segundos, 1)
        detalles["topic"] = topic

        # Guardamos el audio y la respuesta de gemini en la base de datos
        nueva_evaluacion = EvaluacionSpeaking(
            user_id=user_id,
            fecha=datetime.now().strftime("%Y-%m-%d %H:%M"),
            topic=topic,
            duracion_segundos=round(duracion_segundos, 1),
            ruta_audio=ruta_relativa_audio,
            overall_score=overall_score,
            nivel_cefr=cefr_level,
            transcripcion=transcription,
            detalles_json=json.dumps(detalles, ensure_ascii=False),
        )
        db.add(nueva_evaluacion)
        db.commit()
        db.refresh(nueva_evaluacion)

        return {
            "exito": True,
            "id": nueva_evaluacion.id,
            "evaluacion": nueva_evaluacion.to_dict(),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al evaluar audio con IA: {str(e)}",
        )


@router.get("/historial")
def obtener_historial_speaking(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna las evaluaciones anteriores de speaking del usuario."""
    try:
        stmt = (
            select(EvaluacionSpeaking)
            .where(EvaluacionSpeaking.user_id == user_id)
            .order_by(EvaluacionSpeaking.id.desc())
        )
        filas = db.scalars(stmt).all()
        return {"historial": [f.to_dict() for f in filas]}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo historial: {str(e)}",
        )


@router.delete("/historial/{evaluacion_id}")
def eliminar_evaluacion_speaking(
    evaluacion_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Elimina una sesión de speaking del historial y su archivo de audio."""
    try:
        stmt = select(EvaluacionSpeaking).where(
            EvaluacionSpeaking.id == evaluacion_id,
            EvaluacionSpeaking.user_id == user_id,
        )
        evaluacion = db.scalar(stmt)
        if not evaluacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluación no encontrada",
            )

        # Borrar audio del disco si existe
        if evaluacion.ruta_audio:
            ruta_local = evaluacion.ruta_audio.lstrip("/").replace("/", os.sep)
            if os.path.exists(ruta_local):
                try:
                    os.remove(ruta_local)
                except Exception:
                    pass

        db.delete(evaluacion)
        db.commit()
        return {"exito": True, "mensaje": "Evaluación eliminada correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando evaluación: {str(e)}",
        )


@router.get("/anki_items")
def obtener_anki_items(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtiene las claves de correcciones y vocabulario ya añadidas a Anki por el usuario."""
    try:
        stmt = select(SpeakingAnkiItem.item_key).where(
            SpeakingAnkiItem.user_id == user_id
        )
        keys = db.scalars(stmt).all()
        return {"keys": list(keys)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo tarjetas de Anki: {str(e)}",
        )


@router.post("/anki_items")
def registrar_anki_item(
    payload: SpeakingAnkiItemRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra una clave de corrección o vocabulario como añadida a Anki."""
    try:
        key = payload.key.strip()
        if not key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La clave no puede estar vacía",
            )

        stmt = select(SpeakingAnkiItem).where(
            SpeakingAnkiItem.user_id == user_id,
            SpeakingAnkiItem.item_key == key,
        )
        existente = db.scalar(stmt)
        if not existente:
            nuevo = SpeakingAnkiItem(
                user_id=user_id,
                item_key=key,
                fecha=datetime.now().strftime("%Y-%m-%d %H:%M"),
            )
            db.add(nuevo)
            db.commit()

        return {"exito": True, "key": key}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error registrando tarjeta de Anki: {str(e)}",
        )

