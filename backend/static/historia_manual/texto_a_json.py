import json
import os

# cd static/historia_manual
# python texto_a_json.py

BASE_DIR = os.path.dirname(__file__)

TXT_EN = os.path.join(BASE_DIR, "texto_en.txt")
TXT_ES = os.path.join(BASE_DIR, "texto_es.txt")
TXT_IPA = os.path.join(BASE_DIR, "texto_ipa.txt")
JSON_PATH = os.path.join(BASE_DIR, "historia_manual.json")

def verificar_crear_archivos():
    """Verifica si los archivos .txt existen. Si no, los crea en blanco."""
    archivos = [TXT_EN, TXT_ES, TXT_IPA]
    faltan = False
    for ruta in archivos:
        if not os.path.exists(ruta):
            with open(ruta, "w", encoding="utf-8") as f:
                f.write("")
            print(f"Se creó el archivo vacío: {os.path.basename(ruta)}")
            faltan = True
    return faltan

def texto_a_json():
    print("--- CONVERTIDOR DE TEXTO PLANO A JSON ---")
    
    if verificar_crear_archivos():
        print("Faltaban archivos de texto.")
        print("Por favor pega el contenido en texto_en.txt, texto_es.txt y texto_ipa.txt, y vuelve a ejecutar este script.")
        return


    nuevo_titulo = input("Escribe un titulo para la canción: ")

    # 1. Leer el texto plano
    with open(TXT_EN, "r", encoding="utf-8") as f:
        lineas_en = [linea.strip() for linea in f.readlines() if linea.strip()]
    
    with open(TXT_ES, "r", encoding="utf-8") as f:
        lineas_es = [linea.strip() for linea in f.readlines() if linea.strip()]
    
    with open(TXT_IPA, "r", encoding="utf-8") as f:
        lineas_ipa = [linea.strip() for linea in f.readlines() if linea.strip()]
    
    if len(lineas_en) != len(lineas_es) or len(lineas_en) != len(lineas_ipa):
        print("\n⚠️ ADVERTENCIA: Los archivos no tienen la misma cantidad de líneas.")
        print(f"   Líneas en Inglés: {len(lineas_en)}")
        print(f"   Líneas en Español: {len(lineas_es)}")
        print(f"   Líneas en IPA: {len(lineas_ipa)}\n")
    
    lineas_formateadas = []

    # 2. Combinar las líneas tomando como base el archivo en inglés
    for i in range(len(lineas_en)):
        texto_en = lineas_en[i]
        texto_es = lineas_es[i] if i < len(lineas_es) else ""
        texto_ipa = lineas_ipa[i] if i < len(lineas_ipa) else ""
        lineas_formateadas.append({
            "en": texto_en,
            "es": texto_es,
            "ipa": texto_ipa
        })

    # 3. Empaquetar como la estructura final
    datos = {
        "titulo": nuevo_titulo,
        "tematica": "Canción",
        "lineas": lineas_formateadas,
    }

    # 4. Sobrescribir el viejo historia_manual.json
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)

    print(
        f"✅ ¡Éxito! Se han procesado {len(lineas_formateadas)} líneas correctamente."
    )
    print("El archivo 'historia_manual.json' acaba de ser sobrescrito y actualizado.")
    print("Ahora puedes ejecutar: python inyectar_historia.py")


if __name__ == "__main__":
    texto_a_json()
