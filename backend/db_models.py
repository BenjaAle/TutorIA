from sqlalchemy import Integer, String, Text, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
import json


class OracionCloze(Base):
    __tablename__ = "oraciones_cloze"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingles: Mapped[str] = mapped_column(Text, nullable=False)
    espanol: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    chat_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    origen: Mapped[str] = mapped_column(String, nullable=False, default="anki")
    palabra_oculta: Mapped[str] = mapped_column(String, nullable=False, default="")

    def to_dict(self) -> dict:
        """Serializa el modelo a un diccionario compatible con las respuestas JSON esperadas por el frontend."""
        return {
            "id": self.id,
            "ingles": self.ingles,
            "espanol": self.espanol,
            "user_id": self.user_id,
            "chat_id": self.chat_id,
            "origen": self.origen,
            "palabra_oculta": self.palabra_oculta,
        }


class EvaluacionSpeaking(Base):
    __tablename__ = "evaluaciones_speaking"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    fecha: Mapped[str] = mapped_column(String, nullable=True)
    topic: Mapped[str] = mapped_column(Text, nullable=False, default="")
    duracion_segundos: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ruta_audio: Mapped[str] = mapped_column(Text, nullable=False, default="")
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nivel_cefr: Mapped[str] = mapped_column(String, nullable=False, default="")
    transcripcion: Mapped[str] = mapped_column(Text, nullable=False, default="")
    detalles_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    def to_dict(self) -> dict:
        try:
            detalles = json.loads(self.detalles_json)
        except Exception:
            detalles = {}
        if isinstance(detalles, dict):
            detalles["ruta_audio"] = self.ruta_audio
            detalles["duracion_segundos"] = self.duracion_segundos
            detalles["topic"] = self.topic
        return {
            "id": self.id,
            "user_id": self.user_id,
            "fecha": self.fecha,
            "topic": self.topic,
            "duracion_segundos": self.duracion_segundos,
            "ruta_audio": self.ruta_audio,
            "overall_score": self.overall_score,
            "nivel_cefr": self.nivel_cefr,
            "transcripcion": self.transcripcion,
            "detalles": detalles,
        }


class SpeakingAnkiItem(Base):
    __tablename__ = "speaking_anki_items"
    __table_args__ = (
        UniqueConstraint("user_id", "item_key", name="uq_user_item_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    item_key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    fecha: Mapped[str] = mapped_column(String, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "item_key": self.item_key,
            "fecha": self.fecha,
        }

