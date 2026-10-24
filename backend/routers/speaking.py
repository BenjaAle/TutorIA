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
from db_models import EvaluacionSpeaking
from models import GenerarTemaRequest

router = APIRouter(tags=["Speaking"])

SPEAKING_AUDIO_DIR = os.path.join("static", "audios", "speaking")
os.makedirs(SPEAKING_AUDIO_DIR, exist_ok=True)

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
        
        Return ONLY valid JSON matching this structure:
        {{
            "id": "custom_{uuid.uuid4().hex[:6]}",
            "categoria": "Personalizado por IA",
            "nivel": "{nivel}",
            "titulo": "Short catchy title in English",
            "pregunta": "The full, engaging question or prompt in English (1-2 sentences)",
            "puntos_guia": [
                "Guiding question 1 to help structure their answer",
                "Guiding question 2",
                "Guiding question 3",
                "Guiding question 4"
            ],
            "duracion_recomendada": "60 - 90 seg"
        }}
        """

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )

        data = json.loads(response.text)
        return {"tema": data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando tema: {str(e)}",
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
        - The JSON schema below defines the OUTPUT STRUCTURE and DATA TYPES only. The numbers and texts shown are placeholders: DO NOT repeat placeholder scores like 82 or B2 unless the student's genuine performance warrants it. Compute real scores from 0 to 100 based strictly on this audio.

        Evaluate across these four dimensions:
        1. Pronunciation & Clarity (0-100): Phoneme accuracy, syllable stress, intonation, comprehensibility. If words were mispronounced or unintelligible, lower the score accordingly.
        2. Fluency & Coherence (0-100): Hesitation, unnatural silences, rate of speech, and filler sounds ("uh", "um", "like", "you know").
        3. Grammatical Accuracy (0-100): Tense consistency, preposition use, word order, subject-verb agreement. Catch real mistakes.
        4. Vocabulary & Lexical Resource (0-100): Breadth of vocabulary, precision, avoidance of overused words, ability to paraphrase.

        CRITICAL FORMATTING RULE FOR "grammar.errors":
        Each element in "errors" MUST be a single, complete JSON object containing all 3 fields together:
        {{"original": "...", "correction": "...", "explanation": "..."}}
        NEVER split an error across multiple objects (never create one object with only original/correction and a separate object with only explanation).

        Return STRICTLY a JSON object matching this schema:
        {{
            "transcription": "<Verbatim transcription in English of what the user actually said. If words were unintelligible, transcribe phonetically or what was audibly clear. Do not invent words.>",
            "overall_score": <calculated weighted average integer from 0 to 100 based on genuine performance>,
            "cefr_level": "<strictly one of: 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'>",
            "fluency": {{
                "score": <integer 0-100>,
                "estimated_wpm": <realistic integer words per minute>,
                "pace_evaluation": "<one of: 'Demasiado lento', 'Vacilante', 'Ritmo natural', 'Demasiado rápido'>",
                "filler_words": [<list of strings of detected filler words such as 'um', 'uh', 'like', or empty list [] if none>],
                "feedback": "<Objective critique in Spanish analyzing rhythm, pauses, and speech flow without sugarcoating.>"
            }},
            "pronunciation": {{
                "score": <integer 0-100>,
                "clarity_rating": "<one of: 'Deficiente', 'Necesita práctica', 'Aceptable', 'Buena', 'Excelente'>",
                "problematic_words": [
                    {{
                        "word": "<exact word mispronounced>",
                        "ipa": "<IPA phonetic transcription of correct pronunciation>",
                        "tip": "<Specific, actionable advice in Spanish on how to position tongue/mouth or stress the syllable>"
                    }}
                ],
                "feedback": "<Honest phonetic critique in Spanish pointing out sound confusions or accent obstacles.>"
            }},
            "grammar": {{
                "score": <integer 0-100>,
                "errors": [
                    {{
                        "original": "<exact incorrect phrase spoken by student>",
                        "correction": "<correct English phrase>",
                        "explanation": "<Clear rule explanation in Spanish>"
                    }}
                ],
                "feedback": "<Objective assessment in Spanish of grammatical range and error frequency.>"
            }},
            "vocabulary": {{
                "score": <integer 0-100>,
                "suggestions": [
                    {{
                        "original_word": "<basic or repetitive word used by student>",
                        "better_alternative": "<higher-register or more natural native collocation>",
                        "example_sentence": "<natural example sentence in English>",
                        "explanation": "<Why this upgrade makes their speech more precise (in Spanish)>"
                    }}
                ],
                "feedback": "<Assessment in Spanish of lexical variety and precision.>"
            }},
            "native_reformulation": "<Natural, fluent reformulation in English of how an articulate native speaker would communicate the student's exact intended message for this topic.>",
            "tutor_feedback": "<Honest, constructive summary in Spanish: highlight what worked, clearly identify the main weaknesses holding them back, and give 2 concrete steps to practice next.>"
        }}
        """

        gemini_response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[part_audio, prompt_evaluacion],
            config={"response_mime_type": "application/json"},
        )

        raw_text = gemini_response.text.strip()
        # Eliminar posibles bloques de markdown ```json ... ``` que a veces incluye la IA
        if raw_text.startswith("```"):
            lineas = raw_text.splitlines()
            if lineas[0].startswith("```"):
                lineas = lineas[1:]
            if lineas and lineas[-1].startswith("```"):
                lineas = lineas[:-1]
            raw_text = "\n".join(lineas).strip()

        # strict=False permite caracteres de control no escapados como saltos de línea literales en strings JSON
        try:
            detalles = json.loads(raw_text, strict=False)
        except Exception:
            # Fallback en caso de caracteres de control problemáticos
            import re
            raw_text_clean = re.sub(r'[\x00-\x1f\x7f-\x9f]', lambda m: '\n' if m.group(0) in '\r\n\t' else ' ', raw_text)
            detalles = json.loads(raw_text_clean, strict=False)

        # Normalizar errores gramaticales si la IA separó frase y explicación en objetos distintos
        raw_errors = detalles.get("grammar", {}).get("errors", [])
        if isinstance(raw_errors, list):
            normalized_errors = []
            i = 0
            while i < len(raw_errors):
                err = raw_errors[i]
                if not isinstance(err, dict):
                    i += 1
                    continue
                orig = str(err.get("original", "") or "").strip()
                corr = str(err.get("correction", "") or "").strip()
                expl = str(err.get("explanation", "") or "").strip()

                # Si tiene original/corr pero no explicación, y el siguiente tiene explicación sin original
                if (orig or corr) and not expl and (i + 1 < len(raw_errors)):
                    next_err = raw_errors[i + 1]
                    if isinstance(next_err, dict) and next_err.get("explanation") and not next_err.get("original"):
                        expl = str(next_err.get("explanation", "") or "").strip()
                        i += 1

                if orig or corr or expl:
                    normalized_errors.append({
                        "original": orig,
                        "correction": corr,
                        "explanation": expl,
                    })
                i += 1
            if "grammar" in detalles and isinstance(detalles["grammar"], dict):
                detalles["grammar"]["errors"] = normalized_errors


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
