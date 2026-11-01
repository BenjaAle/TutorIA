# pyrefly: ignore [missing-import]
from pydantic import BaseModel


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

