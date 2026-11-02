import asyncio
import hashlib
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from google.genai import types
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from config import GEMINI_MODEL, client, generar_audio, get_current_user
from database import get_db
from db_models import (
    EvaluacionSpeaking,
    OracionCloze,
    SpeakingAnkiItem,
    FraseShadowingDB,
    ShadowingDescartado,
)
from models import (
    DescartarShadowingRequest,
    GenerarFrasesShadowingRequest,
    GenerarTemaRequest,
    SintetizarFraseRequest,
    SpeakingAnkiItemRequest,
    TemaSpeakingPropuesto,
    EvaluacionSpeakingPropuesta,
    EvaluacionShadowingPropuesta,
    FraseShadowingPropuesta,
    SugerirVocabularioTemaRequest,
    VocabularioSugeridoItem,
)

router = APIRouter(tags=["Speaking"])

SPEAKING_AUDIO_DIR = os.path.join("static", "audios", "speaking")
os.makedirs(SPEAKING_AUDIO_DIR, exist_ok=True)

SHADOWING_AUDIO_DIR = os.path.join("static", "audios", "shadowing")
os.makedirs(SHADOWING_AUDIO_DIR, exist_ok=True)

TEMAS_PREDEFINIDOS = [
    {
        "id": "daily_routine",
        "categoria": "Casual & Vida Diaria",
        "nivel": "A2 - B1",
        "titulo": "My Typical Day",
        "pregunta": "Describe your typical daily routine from morning to night. What part of the day do you enjoy the most and why?",
        "puntos_guia": [
            "What time do you usually wake up?",
            "What are your main morning activities or habits?",
            "How do you spend your afternoons and evenings?",
            "Which part of the day is your favorite and why?",
        ],
        "vocabulario_sugerido": [
            {"en": "early bird / night owl", "es": "madrugador / noctámbulo", "tipo": "expresión"},
            {"en": "wind down", "es": "desconectar / relajarse", "tipo": "phrasal verb"},
            {"en": "commute", "es": "trayecto diario al trabajo/estudio", "tipo": "sustantivo/verbo"},
            {"en": "kick off the day", "es": "comenzar el día", "tipo": "expresión"},
            {"en": "hectic schedule", "es": "agenda o rutina ajetreada", "tipo": "colocación"},
        ],
        "duracion_recomendada": "45 - 60 seg",
    },
    {
        "id": "hometown",
        "categoria": "Casual & Vida Diaria",
        "nivel": "A2 - B1",
        "titulo": "My City or Hometown",
        "pregunta": "Talk about the city or town where you currently live. What are its best attractions and what could be improved?",
        "puntos_guia": [
            "Where is it located and what is it known for?",
            "What do you like most about living there?",
            "Where would you take a friend visiting for the first time?",
            "Is there anything you would change about it?",
        ],
        "vocabulario_sugerido": [
            {"en": "bustling / peaceful", "es": "bullicioso / apacible", "tipo": "adjetivo"},
            {"en": "local landmarks", "es": "lugares emblemáticos", "tipo": "sustantivo"},
            {"en": "public amenities", "es": "servicios y comodidades públicas", "tipo": "sustantivo"},
            {"en": "stroll around", "es": "dar un paseo / recorrer", "tipo": "phrasal verb"},
            {"en": "green spaces", "es": "áreas verdes o parques", "tipo": "colocación"},
        ],
        "duracion_recomendada": "45 - 60 seg",
    },
    {
        "id": "memorable_trip",
        "categoria": "IELTS & Narrativa",
        "nivel": "B1 - B2",
        "titulo": "A Memorable Journey",
        "pregunta": "Describe a trip or vacation that was especially memorable for you. Explain why it left such a lasting impression.",
        "puntos_guia": [
            "Where did you go and who did you travel with?",
            "What memorable activities or sights did you experience?",
            "Did anything unexpected happen?",
            "Why does this trip stand out in your memory?",
        ],
        "vocabulario_sugerido": [
            {"en": "breathtaking scenery", "es": "paisajes que quitan el aliento", "tipo": "colocación"},
            {"en": "off the beaten path", "es": "fuera de las rutas turísticas habituales", "tipo": "expresión"},
            {"en": "set off on a journey", "es": "emprender un viaje", "tipo": "phrasal verb"},
            {"en": "warm hospitality", "es": "cálida hospitalidad", "tipo": "colocación"},
            {"en": "unwind", "es": "despejarse y recargar energías", "tipo": "verbo"},
        ],
        "duracion_recomendada": "60 - 90 seg",
    },
    {
        "id": "difficult_decision",
        "categoria": "IELTS & Narrativa",
        "nivel": "B2 - C1",
        "titulo": "An Important Decision",
        "pregunta": "Talk about a difficult decision you had to make in your personal or professional life. How did you handle it?",
        "puntos_guia": [
            "What was the situation and why was the choice tough?",
            "What options or factors did you consider?",
            "What decision did you eventually make?",
            "Looking back, how did it shape where you are today?",
        ],
        "vocabulario_sugerido": [
            {"en": "weigh the pros and cons", "es": "sopesar pros y contras", "tipo": "expresión"},
            {"en": "at a crossroads", "es": "en una encrucijada", "tipo": "expresión"},
            {"en": "take a leap of faith", "es": "dar un salto de fe / arriesgarse", "tipo": "expresión"},
            {"en": "turn out for the best", "es": "resultar para mejor", "tipo": "phrasal verb"},
            {"en": "in hindsight", "es": "en retrospectiva / visto después", "tipo": "expresión"},
        ],
        "duracion_recomendada": "60 - 90 seg",
    },
    {
        "id": "work_challenge",
        "categoria": "Profesional & Negocios",
        "nivel": "B2 - C1",
        "titulo": "Overcoming a Professional Challenge",
        "pregunta": "Describe a difficult challenge you faced at work, in university, or on a project, and explain the steps you took to overcome it.",
        "puntos_guia": [
            "What was the context and what problem arose?",
            "What actions or strategy did you implement?",
            "How did you communicate or collaborate with others?",
            "What was the outcome and what did you learn?",
        ],
        "vocabulario_sugerido": [
            {"en": "tight deadline", "es": "plazo o fecha límite ajustada", "tipo": "colocación"},
            {"en": "troubleshoot", "es": "detectar y resolver problemas", "tipo": "verbo"},
            {"en": "tackle an obstacle", "es": "afrontar un obstáculo de frente", "tipo": "colocación"},
            {"en": "team player", "es": "persona que trabaja bien en equipo", "tipo": "sustantivo"},
            {"en": "valuable takeaway", "es": "lección o conclusión valiosa", "tipo": "sustantivo"},
        ],
        "duracion_recomendada": "60 - 90 seg",
    },
    {
        "id": "ai_impact",
        "categoria": "Debate & Sociedad",
        "nivel": "B2 - C2",
        "titulo": "The Future of AI & Human Work",
        "pregunta": "How do you believe Artificial Intelligence will change work, education, and creativity over the coming decade?",
        "puntos_guia": [
            "Which fields do you think will be most positively affected?",
            "What concerns or challenges should society be mindful of?",
            "How are you personally adapting to AI tools?",
            "Will human connection become more or less valuable?",
        ],
        "vocabulario_sugerido": [
            {"en": "cutting-edge tools", "es": "herramientas de vanguardia", "tipo": "colocación"},
            {"en": "automate tedious tasks", "es": "automatizar tareas tediosas", "tipo": "colocación"},
            {"en": "double-edged sword", "es": "arma de doble filo", "tipo": "expresión"},
            {"en": "upskill and adapt", "es": "capacitarse y adaptarse", "tipo": "verbo"},
            {"en": "ethical implications", "es": "implicaciones éticas", "tipo": "sustantivo"},
        ],
        "duracion_recomendada": "60 - 90 seg",
    },
]


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


# ============================================================================
# ENDPOINTS DE SHADOWING (REPETICIÓN GUIADA Y PRECISIÓN FONÉTICA)
# ============================================================================


@router.post("/shadowing/evaluar")
async def evaluar_shadowing(
    audio: UploadFile = File(...),
    frase_objetivo: str = Form(...),
    ipa_objetivo: str = Form(""),
    item_id: str = Form(""),
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evalúa la grabación de shadowing del usuario comparándola contra la frase objetivo.
    Gemini analiza la precisión fonética palabra por palabra, ritmo e intonación.
    """
    frase_limpia = frase_objetivo.strip()
    if not frase_limpia:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La frase objetivo es requerida.",
        )

    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) < 300:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El audio grabado es demasiado corto o está vacío.",
            )

        # Detectar extensión
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

        nombre_archivo = f"user_{uuid.uuid4().hex}.{ext}"
        ruta_archivo = os.path.join(SHADOWING_AUDIO_DIR, nombre_archivo)
        with open(ruta_archivo, "wb") as f:
            f.write(audio_bytes)

        ruta_relativa_audio = f"/static/audios/shadowing/{nombre_archivo}"

        # Preparar multimodal part
        part_audio = types.Part.from_bytes(data=audio_bytes, mime_type=content_type)

        prompt_shadowing = f"""
        You are an expert English pronunciation coach and phonetician evaluating a Shadowing / Speech Imitation exercise.
        The student listened to a native reference audio and attempted to shadow (repeat aloud) the following sentence:

        TARGET SENTENCE: "{frase_limpia}"
        {f'TARGET PHONETIC IPA: "{ipa_objetivo.strip()}"' if ipa_objetivo and ipa_objetivo.strip() else ''}

        Listen carefully to the student's audio recording.
        Compare what the student actually uttered against the TARGET SENTENCE.

        EVALUATION CRITERIA:
        1. Word-by-word fidelity:
           Analyze EVERY SINGLE word of the TARGET SENTENCE in exact sequence.
           For each word, determine its status:
           - "correct": Accurately pronounced with good vowel/consonant quality and correct lexical stress.
           - "needs_work": Recognizable, but with noticeably inaccurate vowel/consonant sounds, wrong syllable stress, or awkward hesitation.
           - "missed": Omitted, replaced with a different word, or unintelligible.
           For words marked "needs_work" or "missed", provide a brief, actionable phonetic tip in Spanish (e.g. "Alarga el sonido /iː/", "Pronuncia la 'th' con la lengua entre los dientes"). If "correct", tip must be null.

        2. Rhythm, Intonation & Cadence:
           Evaluate how well the student captured the natural flow, word linking (connected speech), and sentence stress.
           Assign a rhythm score from 0 to 100 and a 1-sentence critique in Spanish.

        3. Overall Imitation Score (0-100):
           - 90-100: Flawless or near-native clarity, cadence, and phonetics.
           - 75-89: Very good, clear and intelligible with minor non-native slips.
           - 55-74: Understandable but strained, robotic, or multiple phoneme substitutions.
           - <55: Substantially incomplete, wrong words, or heavily distorted.

        CRITICAL CONTENT REQUIREMENTS:
        - "transcription": Verbatim transcription in English of what the student uttered.
        - "overall_score": Integer 0-100 reflecting overall phonetic and cadence fidelity.
        - "status": Strictly one of 'excelente', 'bueno', 'regular', 'necesita_practica'.
        - "rhythm": Score 0-100 and a 1-sentence assessment in Spanish of pacing and connected speech.
        - "words_analysis": An element for EVERY single word in the TARGET SENTENCE in exact sequence. For each, indicate status ('correct', 'needs_work', 'missed') and specific tip in Spanish (or null if correct).
        - "coach_tip": High-impact, encouraging advice in Spanish for the student to sound more natural on the next try.
        """

        configuracion = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=EvaluacionShadowingPropuesta,
            temperature=0.2,
        )

        gemini_response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[part_audio, prompt_shadowing],
            config=configuracion,
        )

        respuesta_limpia = (
            gemini_response.text.replace("```json", "").replace("```", "").strip()
        )
        detalles = json.loads(respuesta_limpia)

        detalles["ruta_audio_usuario"] = ruta_relativa_audio
        detalles["frase_objetivo"] = frase_limpia

        # Actualizar mejor_score en la BD (para Frases IA, Líneas de Historia o Cloze)
        score_val = int(detalles.get("overall_score", 0))
        mejor_score_registrado = score_val

        try:
            # 1. Si el item_id identifica una línea de historia (ej. "hist_123")
            if item_id.startswith("hist_"):
                linea_id = int(item_id.split("_")[1])
                conn = sqlite3.connect("tutor.db")
                c = conn.cursor()
                c.execute(
                    "SELECT mejor_score FROM lineas_historia WHERE id = ?",
                    (linea_id,),
                )
                row = c.fetchone()
                if row:
                    prev = row[0]
                    if prev is None or score_val > prev:
                        c.execute(
                            "UPDATE lineas_historia SET mejor_score = ? WHERE id = ?",
                            (score_val, linea_id),
                        )
                        conn.commit()
                        mejor_score_registrado = score_val
                    else:
                        mejor_score_registrado = prev
                conn.close()

            # 2. Si el item_id identifica una carta cloze (ej. "cloze_45")
            elif item_id.startswith("cloze_"):
                cloze_id = int(item_id.split("_")[1])
                cloze_db = db.get(OracionCloze, cloze_id)
                if cloze_db and cloze_db.user_id == user_id:
                    if cloze_db.mejor_score is None or score_val > cloze_db.mejor_score:
                        cloze_db.mejor_score = score_val
                        db.commit()
                        mejor_score_registrado = score_val
                    else:
                        mejor_score_registrado = cloze_db.mejor_score

            # 3. Frases IA (por id numérico o por coincidencia de texto en frases_shadowing)
            else:
                stmt = None
                if item_id.isdigit():
                    stmt = select(FraseShadowingDB).where(
                        FraseShadowingDB.id == int(item_id),
                        FraseShadowingDB.user_id == user_id,
                    )
                else:
                    stmt = select(FraseShadowingDB).where(
                        FraseShadowingDB.user_id == user_id,
                        FraseShadowingDB.en == frase_limpia,
                    )
                frase_db = db.scalar(stmt)
                if frase_db:
                    if frase_db.mejor_score is None or score_val > frase_db.mejor_score:
                        frase_db.mejor_score = score_val
                        db.commit()
                        mejor_score_registrado = score_val
                    else:
                        mejor_score_registrado = frase_db.mejor_score
                else:
                    # Fallback: intentar ver si coincide con alguna línea de historia del usuario por texto
                    conn = sqlite3.connect("tutor.db")
                    c = conn.cursor()
                    c.execute(
                        """
                        SELECT lh.id, lh.mejor_score
                        FROM lineas_historia lh
                        JOIN historias h ON lh.historia_id = h.id
                        WHERE (h.user_id = ? OR h.user_id = 'migrado')
                          AND TRIM(LOWER(lh.oracion_en)) = TRIM(LOWER(?))
                        LIMIT 1
                        """,
                        (user_id, frase_limpia),
                    )
                    row = c.fetchone()
                    if row:
                        lh_id, prev = row
                        if prev is None or score_val > prev:
                            c.execute(
                                "UPDATE lineas_historia SET mejor_score = ? WHERE id = ?",
                                (score_val, lh_id),
                            )
                            conn.commit()
                            mejor_score_registrado = score_val
                        else:
                            mejor_score_registrado = prev
                    conn.close()

            detalles["mejor_score"] = mejor_score_registrado
        except Exception:
            pass

        return {"exito": True, "evaluacion": detalles}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al evaluar shadowing con IA: {str(e)}",
        )


@router.get("/shadowing/frases_estudiadas")
def obtener_frases_estudiadas(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Obtiene frases reales para hacer shadowing tomadas de las historias generadas
    por el usuario (lineas_historia) o de sus cartas de Anki / oraciones Cloze.
    Filtra automáticamente cualquier frase que el usuario haya descartado previamente.
    """
    try:
        # Obtener IDs de frases descartadas por el usuario
        stmt_descartados = select(ShadowingDescartado.item_id).where(
            ShadowingDescartado.user_id == user_id
        )
        descartados = set(db.scalars(stmt_descartados).all())

        frases = []

        # 1. Frases de historias del usuario (filtrando descartadas a nivel de SQL)
        conn = sqlite3.connect("tutor.db")
        c = conn.cursor()
        c.execute(
            """
            SELECT lh.id, lh.oracion_en, lh.oracion_es, lh.oracion_ipa, lh.ruta_audio, h.titulo, lh.mejor_score
            FROM lineas_historia lh
            JOIN historias h ON lh.historia_id = h.id
            WHERE (h.user_id = ? OR h.user_id = 'migrado')
              AND lh.ruta_audio IS NOT NULL
              AND lh.ruta_audio != ''
              AND ('hist_' || lh.id) NOT IN (
                  SELECT item_id FROM shadowing_descartados WHERE user_id = ?
              )
            ORDER BY RANDOM()
            LIMIT 50
            """,
            (user_id, user_id),
        )
        filas = c.fetchall()
        conn.close()

        for f in filas:
            item_id = f"hist_{f[0]}"

            ruta_audio = str(f[4] or "").strip()
            if ruta_audio and not ruta_audio.startswith("/"):
                ruta_audio = f"/{ruta_audio}"

            # Validar que el archivo físico exista para no mostrar audios rotos
            ruta_fisica = ruta_audio.lstrip("/").replace("/", os.sep)
            if os.path.exists(ruta_fisica):
                frases.append(
                    {
                        "id": item_id,
                        "en": f[1],
                        "es": f[2],
                        "ipa": f[3] or "",
                        "audio": ruta_audio,
                        "origen": "Historia",
                        "contexto": f[5],
                        "mejor_score": f[6],
                    }
                )

        # 2. Si no hay suficientes historias, complementar con oraciones de Cloze / Anki
        if len(frases) < 15:
            stmt = (
                select(OracionCloze)
                .where(OracionCloze.user_id == user_id)
                .limit(50)
            )
            clozes = db.scalars(stmt).all()
            for cz in clozes:
                item_id = f"cloze_{cz.id}"
                if item_id in descartados:
                    continue
                frases.append(
                    {
                        "id": item_id,
                        "en": cz.ingles,
                        "es": cz.espanol,
                        "ipa": "",
                        "audio": "",  # Se sintetiza bajo demanda
                        "origen": "Anki / Cloze",
                        "contexto": "Vocabulario Estudiado",
                        "mejor_score": cz.mejor_score,
                    }
                )

        return {"frases": frases, "total_descartadas": len(descartados)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo frases estudiadas: {str(e)}",
        )


@router.post("/shadowing/descartar")
def descartar_frase_shadowing(
    payload: DescartarShadowingRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marca una frase de historia o cloze como descartada para shadowing de forma no destructiva.
    La historia y la carta cloze original permanecen 100% intactas.
    """
    try:
        item_id = payload.item_id.strip()
        if not item_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="item_id no puede estar vacío",
            )

        stmt = select(ShadowingDescartado).where(
            ShadowingDescartado.user_id == user_id,
            ShadowingDescartado.item_id == item_id,
        )
        existente = db.scalar(stmt)
        if not existente:
            nuevo = ShadowingDescartado(
                user_id=user_id,
                item_id=item_id,
                fecha=datetime.now().strftime("%Y-%m-%d %H:%M"),
            )
            db.add(nuevo)
            db.commit()

        return {"exito": True, "item_id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error descartando frase: {str(e)}",
        )


@router.post("/shadowing/restablecer_descartadas")
def restablecer_frases_descartadas(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Restablece todas las frases descartadas por el usuario,
    volviéndolas a incluir en sus sesiones de Shadowing.
    """
    try:
        stmt = delete(ShadowingDescartado).where(
            ShadowingDescartado.user_id == user_id
        )
        resultado = db.execute(stmt)
        db.commit()
        return {"exito": True, "restablecidas": resultado.rowcount}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error restableciendo frases descartadas: {str(e)}",
        )


@router.post("/shadowing/generar_frases")
async def generar_frases_shadowing(
    payload: GenerarFrasesShadowingRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Genera un set de 5 frases prácticas para shadowing según el nivel y categoría seleccionada,
    sintetiza sus audios con voces neurales (Edge-TTS) y las guarda persistentemente en SQLite.
    """
    nivel = payload.nivel.strip() or "B1"
    categoria = payload.categoria.strip() or "Casual & Conversación"

    prompt_generacion = f"""
    Eres un entrenador de pronunciación y speaking en inglés especializado en 'Shadowing'.
    Genera EXACTAMENTE 5 oraciones auténticas, útiles y modernas en inglés para que un estudiante de nivel {nivel} practique entonación, ritmo y conectividad de palabras (connected speech).
    Categoría o temática: "{categoria}".

    DIRECTRICES PEDAGÓGICAS:
    1. Longitud ideal para shadowing: oraciones de entre 6 y 14 palabras (ni demasiado cortas que no tengan ritmo, ni tan largas que no se puedan retener en memoria de trabajo).
    2. Deben contener contracciones naturales (I'd, we've, don't, could've) y enlaces fonéticos comunes.
    3. ESTÁNDAR ESTRICTO SIN CORCHETES:
       - En "en", escribe ÚNICAMENTE la oración en inglés en texto limpio con puntuación correcta.
       - ESTRICTAMENTE PROHIBIDO usar corchetes [ ] o guiones bajos (____).
    4. Para cada oración proporciona:
       - "en": Oración en inglés limpia.
       - "es": Traducción natural al español.
       - "ipa": Transcripción fonética IPA precisa de toda la oración.
       - "foco_ritmo": Breve nota en español (3-6 palabras) sobre qué entonar o enlazar (ej. "Enlaza 'pick it up' como una sola palabra").
    """

    try:
        configuracion = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=list[FraseShadowingPropuesta],
            temperature=0.8,
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt_generacion,
            config=configuracion,
        )

        respuesta_limpia = (
            response.text.replace("```json", "").replace("```", "").strip()
        )
        frases_data = json.loads(respuesta_limpia)
        if not isinstance(frases_data, list):
            frases_data = [frases_data]

        # Sanitización de corchetes y espacios
        for item in frases_data:
            item["en"] = (
                str(item.get("en", ""))
                .replace("[", "")
                .replace("]", "")
                .strip()
            )
            item["es"] = (
                str(item.get("es", ""))
                .replace("[", "")
                .replace("]", "")
                .strip()
            )

        # Generar audios con Edge-TTS concurrentemente
        tareas_audio = []
        rutas_relativas = []
        sesion_id = uuid.uuid4().hex[:8]

        for idx, item in enumerate(frases_data):
            texto_en = item.get("en", "").strip()
            archivo_audio = f"shadow_ia_{sesion_id}_{idx}.mp3"
            ruta_fisica = os.path.join(SHADOWING_AUDIO_DIR, archivo_audio)
            ruta_rel = f"/static/audios/shadowing/{archivo_audio}"
            rutas_relativas.append(ruta_rel)
            tareas_audio.append(generar_audio(texto_en, ruta_fisica))

        if tareas_audio:
            await asyncio.gather(*tareas_audio, return_exceptions=True)

        # Guardar en SQLite persistentemente
        fecha_actual = datetime.now().strftime("%Y-%m-%d %H:%M")
        frases_insertadas = []
        for idx, item in enumerate(frases_data):
            nueva_db = FraseShadowingDB(
                user_id=user_id,
                en=item.get("en", "").strip(),
                es=item.get("es", "").strip(),
                ipa=item.get("ipa", "").strip(),
                foco_ritmo=item.get("foco_ritmo", "").strip(),
                audio=rutas_relativas[idx],
                categoria=categoria,
                nivel=nivel,
                fecha=fecha_actual,
            )
            db.add(nueva_db)
            frases_insertadas.append(nueva_db)

        db.commit()

        # Refrescar para obtener los IDs generados por SQLite
        for f in frases_insertadas:
            db.refresh(f)

        resultado = [f.to_dict() for f in frases_insertadas]

        return {"exito": True, "frases": resultado}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar frases de shadowing: {str(e)}",
        )


@router.get("/shadowing/frases_ia")
def obtener_frases_shadowing_ia(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Obtiene todas las frases generadas previamente por IA para este usuario,
    ordenadas desde la más reciente.
    """
    try:
        stmt = (
            select(FraseShadowingDB)
            .where(FraseShadowingDB.user_id == user_id)
            .order_by(FraseShadowingDB.id.desc())
        )
        filas = db.scalars(stmt).all()
        return {"frases": [f.to_dict() for f in filas]}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo frases generadas: {str(e)}",
        )


@router.delete("/shadowing/frases_ia/{frase_id}")
def eliminar_frase_shadowing_ia(
    frase_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Elimina permanentemente una frase de shadowing generada por IA y su audio asociado.
    """
    try:
        stmt = select(FraseShadowingDB).where(
            FraseShadowingDB.id == frase_id,
            FraseShadowingDB.user_id == user_id,
        )
        frase = db.scalar(stmt)
        if not frase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Frase no encontrada",
            )

        # Borrar audio físico si existe
        if frase.audio:
            ruta_local = frase.audio.lstrip("/").replace("/", os.sep)
            if os.path.exists(ruta_local):
                try:
                    os.remove(ruta_local)
                except Exception:
                    pass

        db.delete(frase)
        db.commit()
        return {"exito": True, "id": frase_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando frase: {str(e)}",
        )


@router.post("/shadowing/sintetizar_frase")
async def sintetizar_frase_shadowing(
    payload: SintetizarFraseRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Sintetiza audio bajo demanda con Edge-TTS para cualquier frase que no tenga audio previo.
    """
    texto = payload.texto.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Texto vacío")

    h = hashlib.md5(texto.encode("utf-8")).hexdigest()[:12]
    archivo_audio = f"tts_{h}.mp3"
    ruta_fisica = os.path.join(SHADOWING_AUDIO_DIR, archivo_audio)
    ruta_rel = f"/static/audios/shadowing/{archivo_audio}"

    if not os.path.exists(ruta_fisica):
        await generar_audio(texto, ruta_fisica)

    return {"audio": ruta_rel}


