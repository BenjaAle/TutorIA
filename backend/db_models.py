from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


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
