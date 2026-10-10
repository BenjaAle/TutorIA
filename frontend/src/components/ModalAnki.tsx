import { useState, useEffect } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/field";

export interface CartaAnki {
  frente: string;
  reverso: string;
  ejemplo_ingles: string;
  ejemplo_espanol: string;
  termino_imagen: string;
  categoria: string;
}

// 2. Propiedades que nuestro componente espera recibir
interface ModalAnkiProps {
  isOpen: boolean; // ¿El modal está visible u oculto?
  onClose: () => void; // Función para cerrar el modal
  cartasIniciales: CartaAnki[]; // Las cartas que propuso Gemini
  chatId: number; // El ID del chat o historia (0 si es de selección libre)
  onSuccess?: (cartasInyectadas: CartaAnki[]) => void; // Acción opcional al terminar con éxito
  origen?: "chat" | "historia" | "cloze"; // Opcional, para saber si viene de chat o historia
}

const CATEGORIAS_VALIDAS = [
  "Vocabulario",
  "Phrasal Verbs",
  "Falsos Amigos",
  "Verbos Irregulares",
  "Gramatica y Teoria",
  "Expresiones Nativas",
  "Colocaciones",
  "Otros",
];

export default function ModalAnki({
  isOpen,
  onClose,
  cartasIniciales,
  chatId,
  onSuccess,
  origen,
}: ModalAnkiProps) {
  // 3. Estado local para manejar las cartas mientras el usuario las edita o borra
  const [cartas, setCartas] = useState<CartaAnki[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [injectedLoading, setInjectedLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Cuando se abre el modal o cambian las cartas iniciales, cargamos esas cartas al estado
  useEffect(() => {
    setCartas(cartasIniciales);
    setCurrentIndex(0);
    setSent(false);
  }, [cartasIniciales, isOpen]);

  const handleFieldChange = (campo: keyof CartaAnki, valor: string) => {
    setCartas((prev) =>
      prev.map((carta, i) =>
        i === currentIndex ? { ...carta, [campo]: valor } : carta,
      ),
    );
  };

  const handleExampleChange = (
    exampleIndex: number,
    lang: "ejemplo_ingles" | "ejemplo_espanol",
    value: string,
  ) => {
    const card = cartas[currentIndex];
    if (!card) return;
    const examples = (card[lang] || "").split("|").map((s) => s.trim());

    while (examples.length <= exampleIndex) examples.push("");

    const newExamplesArray = [...examples];
    newExamplesArray[exampleIndex] = value;
    handleFieldChange(lang, newExamplesArray.join(" | "));
  };

  const handleAddExample = () => {
    const card = cartas[currentIndex];
    if (!card) return;
    const currentEn = card.ejemplo_ingles ? card.ejemplo_ingles.trim() : "";
    const currentEs = card.ejemplo_espanol ? card.ejemplo_espanol.trim() : "";

    handleFieldChange("ejemplo_ingles", currentEn ? currentEn + " | " : "");
    handleFieldChange("ejemplo_espanol", currentEs ? currentEs + " | " : "");
  };

  const handleEliminarCarta = () => {
    setCartas((prev) => {
      const newCartas = prev.filter((_, i) => i !== currentIndex);
      if (currentIndex >= newCartas.length && currentIndex > 0) {
        setCurrentIndex(newCartas.length - 1);
      }
      return newCartas;
    });
  };

  const handleCerrar = (next: boolean) => {
    if (next === false) {
      if (injectedLoading) {
        alert("Por favor espera a que termine la inyección.");
        return;
      }
      if (cartas.length > 0 && !sent) {
        const confirmar = window.confirm(
          "⚠️ ¿Estás seguro de cerrar? Se perderán las cartas no guardadas.",
        );
        if (!confirmar) return;
      }
      onClose();
    }
  };

  // 7. Enviar y procesar las cartas con el backend
  const handleConfirmarTodo = async () => {
    if (cartas.length === 0) {
      alert("No hay cartas para enviar.");
      return;
    }
    setInjectedLoading(true);
    try {
      const res = await fetch("/inyectar_cartas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, cartas: cartas }),
      });

      // En caso de error, lo capturo con catch y retorno un objeto vacío
      const data = await res.json().catch(() => ({}));

      if (
        !res.ok ||
        data.error ||
        (typeof data.mensaje === "string" &&
          data.mensaje.toLowerCase().includes("error"))
      ) {
        alert(data.error || data.mensaje || "Error de conexión");
        return;
      }

      // Guardar vocabulario al local DB si es historia (Lógica antigua mantenida)
      if (origen === "historia") {
        try {
          const palabrasNuevas = cartas.map((c) =>
            c.frente.replace(/\(.*\)/g, "").trim(),
          );
          await fetch("/api/vocabulario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ palabras: palabrasNuevas }),
          });
        } catch (e) {
          console.error("Error BD local", e);
        }
      }

      setSent(true);
      if (onSuccess) onSuccess(cartas);
      setTimeout(() => onClose(), 2000); // Cerramos tras un breve exito
    } catch (err) {
      alert("Error al conectar.");
    } finally {
      setInjectedLoading(false);
    }
  };

  if (!isOpen) return null;

  const card = cartas[currentIndex];
  if (!card && cartas.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={handleCerrar}>
        <DialogContent className="p-6">
          <p className="text-center text-muted-foreground">No quedan cartas.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCerrar}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-4xl bg-background rounded-lg border border-border shadow-lg">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="font-serif text-2xl font-semibold">
            Revisa tus cartas para Anki
          </DialogTitle>
          <DialogDescription>
            Revisa los campos antes de integrarlos al mazo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
          <div className="border-b border-border bg-muted/30 p-6 md:border-b-0 md:border-r relative flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Vista previa ficticia
              </span>
            </div>

            <div className="flex-1 flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-border bg-card p-6 text-center shadow-sm">
              <p className="font-serif text-xl font-semibold text-muted-foreground">
                (El frente y reverso irían aquí)
              </p>
            </div>

            {/* Navigador de Cartas */}
            {cartas.length > 1 && (
              <div className="mt-6 flex items-center justify-between px-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((c) => c - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="text-sm font-medium">
                  Carta {currentIndex + 1} de {cartas.length}
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentIndex === cartas.length - 1}
                  onClick={() => setCurrentIndex((c) => c + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-5 p-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">
                Campos de la carta actual
              </span>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive px-2 h-7"
                onClick={handleEliminarCarta}
              >
                <Trash2 className="size-4 mr-1" />
                Descartar Carta
              </Button>
            </div>

            <div>
              <Label htmlFor="anki-front">Frente (Concepto)</Label>
              <Input
                id="anki-front"
                value={card?.frente || ""}
                onChange={(e) => handleFieldChange("frente", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="anki-back">Reverso (Definición)</Label>
              <Input
                id="anki-back"
                value={card?.reverso || ""}
                onChange={(e) => handleFieldChange("reverso", e.target.value)}
              />
            </div>

            <fieldset>
              <legend className="mb-4 text-xs font-medium text-muted-foreground flex items-center justify-between w-full">
                <span>
                  Frases de ejemplo{" "}
                  <span className="font-normal border rounded px-1 text-[10px] ml-1 bg-muted">
                    reverso
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 text-muted-foreground mr-1"
                  onClick={handleAddExample}
                  title="Añadir frase"
                >
                  +
                </Button>
              </legend>
              <div className="space-y-4">
                {(() => {
                  const englishExamples = (card?.ejemplo_ingles || "")
                    .split("|")
                    .map((s) => s.trim());
                  const spanishExamples = (card?.ejemplo_espanol || "")
                    .split("|")
                    .map((s) => s.trim());
                  const count = Math.max(
                    englishExamples.length,
                    spanishExamples.length,
                    1,
                  );

                  return Array.from({ length: count }).map((_, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1.75rem_1fr] gap-x-2 gap-y-1.5 focus-within:ring-1 ring-border p-2 -mx-2 rounded-md transition-all"
                    >
                      <span
                        className="pt-2 flex justify-center font-serif text-[11px] font-bold text-muted-foreground/50 border-r border-muted pr-1"
                        title={`Ejemplo ${i + 1}`}
                      >
                        EN
                      </span>
                      <Input
                        aria-label={`Ejemplo ${i + 1} en inglés`}
                        value={englishExamples[i] || ""}
                        placeholder="Ejemplo en inglés..."
                        className="h-8 shadow-none"
                        onChange={(e) =>
                          handleExampleChange(
                            i,
                            "ejemplo_ingles",
                            e.target.value,
                          )
                        }
                      />
                      <span className="pt-2 flex justify-center font-serif text-[11px] font-bold text-muted-foreground/50 border-r border-muted pr-1">
                        ES
                      </span>
                      <Input
                        aria-label={`Traducción ${i + 1} en español`}
                        value={spanishExamples[i] || ""}
                        placeholder="Traducción en español..."
                        onChange={(e) =>
                          handleExampleChange(
                            i,
                            "ejemplo_espanol",
                            e.target.value,
                          )
                        }
                        className="bg-muted/30 text-muted-foreground h-8 shadow-none border-dashed border-t-0 focus-visible:border-solid focus-visible:border-t"
                      />
                    </div>
                  ));
                })()}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="anki-pexels">Imagen Pexels</Label>
                <Input
                  id="anki-pexels"
                  value={card?.termino_imagen || ""}
                  onChange={(e) =>
                    handleFieldChange("termino_imagen", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="anki-category">Categoría</Label>
                <Select
                  id="anki-category"
                  value={card?.categoria || "Vocabulario"}
                  onChange={(e) =>
                    handleFieldChange("categoria", e.target.value as any)
                  }
                >
                  {CATEGORIAS_VALIDAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="m-0 items-center rounded-none px-6 py-4 sm:justify-between border-t border-border bg-muted/10">
          <p
            className="text-xs text-muted-foreground hidden md:block"
            aria-live="polite"
          >
            {sent ? (
              <span className="flex items-center gap-1.5 text-success font-medium">
                <Check className="size-3.5" aria-hidden="true" />
                Añadidas al mazo del PC
              </span>
            ) : (
              <>
                Mazo destino: <span className="text-foreground">TutorIA</span>
              </>
            )}
          </p>
          <div className="flex gap-2 w-full md:w-auto">
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="h-9 px-3 flex-1 md:flex-initial"
                />
              }
            >
              {sent ? "Cerrar" : "Cancelar"}
            </DialogClose>
            <Button
              className="h-9 px-4 flex-1 md:flex-initial"
              onClick={handleConfirmarTodo}
              disabled={sent || injectedLoading}
            >
              {injectedLoading ? "Enviando..." : "Enviar al PC (FastAPI)"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
