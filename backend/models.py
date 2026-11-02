# pyrefly: ignore [missing-import]
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class EjemploCarta(BaseModel):
    en: str = Field(
        description="Oración de ejemplo en inglés limpia y natural. PROHIBIDO usar corchetes [ ] o guiones bajos"
    )
    es: str = Field(description="Traducción natural al español de la oración")
    palabra_oculta: str = Field(
        default="",
        description="Palabra, raíz o colocación exacta a ocultar en ejercicios Cloze",
    )


class OracionClozePropuesta(BaseModel):
    ingles: str = Field(
        description="Oración completa en inglés, limpia y natural. PROHIBIDO usar corchetes [ ] o guiones bajos"
    )
    espanol: str = Field(
        description="Traducción natural al español de la oración"
    )
    palabra_oculta: str = Field(
        description="Palabra o colocación exacta de la oración que el estudiante debe completar en el ejercicio"
    )
    pista: Optional[str] = Field(
        default="",
        description="Pista breve opcional en español sobre el significado o categoría gramatical",
    )


class CartaPropuesta(BaseModel):
    frente: str = Field(
        description="Palabra, colocación o expresión principal con pronunciación IPA entre paréntesis"
    )
    palabra_clave: str = Field(
        default="",
        description="Palabra o lema exacto que el estudiante está aprendiendo",
    )
    reverso: str = Field(
        description="Definición o significado contextual preciso en español"
    )
    ejemplos: List[EjemploCarta] = Field(
        description="Lista de oraciones de ejemplo (mínimo 2), cada una con su traducción correspondiente"
    )
    termino_imagen: str = Field(
        description="Palabra clave visual en inglés para buscar una foto representativa en Pexels"
    )
    categoria: str = Field(
        default="Vocabulario",
        description="Una de: Vocabulario, Phrasal Verbs, Falsos Amigos, Verbos Irregulares, Gramatica y Teoria, Expresiones Nativas, Colocaciones, Otros",
    )
    observacion: str = Field(
        default="",
        description="Notas de uso, grado de formalidad o contrastes con términos similares",
    )
    nivel_cefr: str = Field(
        default="B1",
        description="Nivel de dificultad CEFR: A1, A2, B1, B2, C1 o C2",
    )
    # Campos opcionales para retrocompatibilidad
    ejemplo_ingles: Optional[str] = ""
    ejemplo_espanol: Optional[str] = ""
    url_imagen: Optional[str] = ""
    sin_imagen: bool = False
    incluir_cloze: bool = False
    ejemplos_cloze: List[bool] = []


class Mensaje(BaseModel):
    texto: str
    chat_id: int


class NuevoChat(BaseModel):
    titulo: str


class ExtraerRequest(BaseModel):
    chat_id: int


class RenombrarRequest(BaseModel):
    titulo: str


class InyectarRequest(BaseModel):
    chat_id: int
    cartas: list
    forzar_sin_imagen: bool = False


class NuevaHistoria(BaseModel):
    tematica: str
    nivel: str = "Avanzado C1"


class LineaHistoriaPropuesta(BaseModel):
    en: str = Field(
        description="Oración en inglés limpia, natural y fluida. ESTRICTAMENTE PROHIBIDO usar corchetes [ ] o marcas"
    )
    es: str = Field(description="Traducción natural al español de la oración")
    ipa: str = Field(
        description="Transcripción fonética IPA precisa de la oración completa"
    )
    vocabulario_clave: Optional[List[str]] = Field(
        default=[],
        description="1 o 2 términos o colocaciones clave de esta oración",
    )


class HistoriaPropuesta(BaseModel):
    titulo: str = Field(
        description="Título corto, atractivo y evocador en español para la historia"
    )
    lineas: List[LineaHistoriaPropuesta] = Field(
        description="Lista de oraciones consecutivas que componen la historia (mínimo 30 oraciones)"
    )


class CartaUnicaRequest(BaseModel):
    palabra: str
    contexto: str
    traduccion_contexto: str = ""


class EntrenamientoPares(BaseModel):
    fonema_1: str
    fonema_2: str


class GenerarTemaRequest(BaseModel):
    nivel: str = "B2"
    intereses: str = ""


class SpeakingAnkiItemRequest(BaseModel):
    key: str


class GenerarFrasesShadowingRequest(BaseModel):
    nivel: str = "B1"
    categoria: str = "Casual & Conversación"


class SintetizarFraseRequest(BaseModel):
    texto: str


class DescartarShadowingRequest(BaseModel):
    item_id: str


class SugerirVocabularioTemaRequest(BaseModel):
    tema: str
    nivel: str = "B2"


class VocabularioSugeridoItem(BaseModel):
    en: str = Field(
        description="Término, colocación o phrasal verb útil en inglés para el tema"
    )
    es: str = Field(description="Traducción concisa al español")
    tipo: Optional[str] = Field(
        default="",
        description="Categoría gramatical opcional (ej: 'verbo', 'sustantivo', 'phrasal verb', 'expresión')",
    )


class TemaSpeakingPropuesto(BaseModel):
    id: str = Field(description="Identificador único, ej. custom_a1b2c3")
    categoria: str = Field(
        default="Personalizado por IA",
        description="Categoría temática del prompt de speaking",
    )
    nivel: str = Field(description="Nivel CEFR objetivo, ej. B2")
    titulo: str = Field(description="Título corto y atractivo en inglés")
    pregunta: str = Field(
        description="La pregunta o consigna completa y estimulante en inglés (1-2 oraciones)"
    )
    puntos_guia: List[str] = Field(
        description="3 o 4 preguntas guía en inglés para estructurar la respuesta oral"
    )
    vocabulario_sugerido: List[VocabularioSugeridoItem] = Field(
        default=[],
        description="4 a 6 palabras o colocaciones clave sugeridas en inglés con su traducción para preparar al estudiante",
    )
    duracion_recomendada: str = Field(
        default="60 - 90 seg", description="Duración recomendada sugerida"
    )


class ProblematicWordPropuesta(BaseModel):
    word: str = Field(
        description="Palabra exacta que tuvo pronunciación defectuosa o confusa"
    )
    ipa: str = Field(
        description="Transcripción fonética IPA precisa de la pronunciación correcta"
    )
    tip: str = Field(
        description="Consejo específico y accionable en español para colocar la lengua/boca o acentuar"
    )


class GrammarErrorPropuesta(BaseModel):
    original: str = Field(description="Frase incorrecta exacta dicha por el estudiante")
    correction: str = Field(
        description="Frase en inglés corregida de forma natural y gramaticalmente correcta"
    )
    explanation: str = Field(
        description="Explicación concisa y clara de la regla gramatical en español"
    )


class VocabularyUpgradePropuesta(BaseModel):
    original_word: str = Field(
        description="Palabra básica o repetitiva usada por el estudiante"
    )
    better_alternative: str = Field(
        description="Alternativa más precisa, idiomática o de mayor registro nativo"
    )
    example_sentence: str = Field(
        description="Oración de ejemplo natural en inglés limpia (sin corchetes)"
    )
    explanation: str = Field(
        description="Por qué esta alternativa hace la expresión más natural o precisa (en español)"
    )


class FluencyDetalles(BaseModel):
    score: int = Field(ge=0, le=100, description="Puntuación objetiva de fluidez de 0 a 100")
    estimated_wpm: int = Field(ge=0, description="Palabras por minuto estimadas")
    pace_evaluation: Literal[
        "Demasiado lento", "Vacilante", "Ritmo natural", "Demasiado rápido"
    ] = Field(description="Evaluación cualitativa del ritmo de habla")
    filler_words: List[str] = Field(
        default=[],
        description="Lista de muletillas detectadas ('um', 'uh', 'like') o lista vacía si no hubo",
    )
    feedback: str = Field(
        description="Crítica constructiva y objetiva en español sobre el flujo, pausas y cadencia"
    )


class PronunciationDetalles(BaseModel):
    score: int = Field(
        ge=0, le=100, description="Puntuación objetiva de pronunciación de 0 a 100"
    )
    clarity_rating: Literal[
        "Deficiente", "Necesita práctica", "Aceptable", "Buena", "Excelente"
    ] = Field(description="Claridad general")
    problematic_words: List[ProblematicWordPropuesta] = Field(
        default=[], description="Palabras específicas con pronunciación defectuosa"
    )
    feedback: str = Field(
        description="Evaluación fonética honesta en español señalando obstáculos o confusiones de sonido"
    )


class GrammarDetalles(BaseModel):
    score: int = Field(
        ge=0, le=100, description="Puntuación objetiva gramatical de 0 a 100"
    )
    errors: List[GrammarErrorPropuesta] = Field(
        default=[],
        description="Lista de errores gramaticales identificados. Cada objeto DEBE incluir original, correction y explanation",
    )
    feedback: str = Field(
        description="Evaluación objetiva en español del rango y precisión gramatical"
    )


class VocabularyDetalles(BaseModel):
    score: int = Field(ge=0, le=100, description="Puntuación objetiva léxica de 0 a 100")
    suggestions: List[VocabularyUpgradePropuesta] = Field(
        default=[], description="Propuestas de mejora de vocabulario y colocaciones"
    )
    feedback: str = Field(
        description="Evaluación en español de la variedad léxica y naturalidad de las expresiones"
    )


class PuenteLexicoPropuesta(BaseModel):
    dicho_espanol: str = Field(
        description="Palabra o frase exacta que el estudiante dijo en español al quedarse trabado"
    )
    equivalente_ingles: str = Field(
        description="Término, colocación o phrasal verb en inglés más natural para expresar esa idea en ese contexto"
    )
    ejemplo: str = Field(
        description="Oración de ejemplo natural y limpia en inglés usando el término equivalente (sin corchetes)"
    )
    explicacion: str = Field(
        description="Explicación breve en español sobre por qué se usa este término y cómo recordarlo"
    )


class EvaluacionSpeakingPropuesta(BaseModel):
    transcription: str = Field(
        description="Transcripción textual verbatim de lo dicho en inglés (y español si usó puente) por el usuario. No inventar palabras"
    )
    overall_score: int = Field(
        ge=0, le=100, description="Puntuación global calculada objetivamente de 0 a 100"
    )
    cefr_level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] = Field(
        description="Nivel CEFR demostrado según el estándar oficial"
    )
    fluency: FluencyDetalles
    pronunciation: PronunciationDetalles
    grammar: GrammarDetalles
    vocabulary: VocabularyDetalles
    puentes_lexicos: List[PuenteLexicoPropuesta] = Field(
        default=[],
        description="Palabras o frases que el estudiante dijo en español al trabarse, con su equivalente natural en inglés, ejemplo y explicación. Si no dijo nada en español, lista vacía []",
    )
    native_reformulation: str = Field(
        description="Reformulación natural en inglés de cómo un hablante nativo comunicaría el mensaje pretendido"
    )
    tutor_feedback: str = Field(
        description="Resumen honesto y constructivo en español con fortalezas, debilidades clave y 2 pasos para practicar"
    )


class ShadowingWordAnalysisPropuesta(BaseModel):
    word: str = Field(description="Palabra analizada de la frase objetivo")
    status: Literal["correct", "needs_work", "missed"] = Field(
        description="Estado de la pronunciación de esta palabra: 'correct', 'needs_work' o 'missed'"
    )
    tip: Optional[str] = Field(
        default=None,
        description="Consejo fonético breve en español si status es 'needs_work' o 'missed', o null si fue correcta",
    )


class ShadowingRhythmPropuesta(BaseModel):
    score: int = Field(
        ge=0, le=100, description="Puntuación de ritmo y entonación de 0 a 100"
    )
    feedback: str = Field(
        description="Breve evaluación en español del ritmo y conectividad de palabras (connected speech)"
    )


class EvaluacionShadowingPropuesta(BaseModel):
    transcription: str = Field(
        description="Transcripción exacta de lo que pronunció el estudiante"
    )
    overall_score: int = Field(
        ge=0, le=100, description="Puntuación global de 0 a 100 según la fidelidad acústica"
    )
    status: Literal["excelente", "bueno", "regular", "necesita_practica"] = Field(
        description="Estado cualitativo general de la imitación"
    )
    rhythm: ShadowingRhythmPropuesta
    words_analysis: List[ShadowingWordAnalysisPropuesta] = Field(
        description="Análisis fonético palabra por palabra de toda la oración objetivo en secuencia exacta"
    )
    coach_tip: str = Field(
        description="Consejo de alto impacto en español para sonar más natural en el próximo intento"
    )


class FraseShadowingPropuesta(BaseModel):
    en: str = Field(
        description="Oración en inglés auténtica y moderna (6-14 palabras). ESTRICTAMENTE PROHIBIDO corchetes [ ] o guiones bajos"
    )
    es: str = Field(description="Traducción natural al español")
    ipa: str = Field(
        description="Transcripción fonética IPA precisa de la oración completa"
    )
    foco_ritmo: str = Field(
        description="Breve nota en español (3-6 palabras) sobre qué entonar o enlazar"
    )

