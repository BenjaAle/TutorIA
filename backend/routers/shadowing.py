import asyncio
import hashlib
import json
import os
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
    OracionCloze,
    FraseShadowingDB,
    ShadowingDescartado,
)
from models import (
    DescartarShadowingRequest,
    GenerarFrasesShadowingRequest,
    SintetizarFraseRequest,
    EvaluacionShadowingPropuesta,
    FraseShadowingPropuesta,
)

router = APIRouter(tags=["Shadowing"])

SHADOWING_AUDIO_DIR = os.path.join("static", "audios", "shadowing")
os.makedirs(SHADOWING_AUDIO_DIR, exist_ok=True)

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

