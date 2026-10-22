import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Resolver la ruta de la base de datos de forma absoluta respecto a este archivo
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "tutor.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# check_same_thread=False es necesario en SQLite con FastAPI debido a múltiples hilos de ejecución
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Facilita la creacion de sesiones para interactuar con la BD
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base de la que heredaran los modelos de SQLAlchemy
Base = declarative_base()


# Sirve para inyectar la sesion de BDD en los endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() # cerrar la conexion despues de cada peticion
