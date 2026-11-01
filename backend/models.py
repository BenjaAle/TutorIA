# pyrefly: ignore [missing-import]
from typing import List, Optional
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

