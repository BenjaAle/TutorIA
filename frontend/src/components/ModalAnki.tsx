import { useState, useEffect } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Puzzle,
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
import { Input, Label, Select, Textarea } from "@/components/field";
import { cn } from "@/lib/utils";

export interface CartaAnki {
  frente: string;
  reverso: string;
  ejemplo_ingles: string;
  ejemplo_espanol: string;
  termino_imagen: string;
  categoria: string;
  observacion?: string;
  incluir_cloze?: boolean;
  ejemplos_cloze?: boolean[];
  nivel_cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | string;
}

export const NIVELES_CEFR = [
  {
    id: "A1",
    label: "A1",
    desc: "Esencial",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  {
    id: "A2",
    label: "A2",
    desc: "Básico",
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    border: "border-teal-500/30",
  },
  {
    id: "B1",
    label: "B1",
    desc: "Intermedio",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    border: "border-blue-500/30",
  },
  {
    id: "B2",
    label: "B2",
    desc: "Intermedio Alto",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    border: "border-purple-500/30",
  },
  {
    id: "C1",
    label: "C1",
    desc: "Avanzado",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    border: "border-amber-500/30",
  },
  {
    id: "C2",
    label: "C2",
    desc: "Raro / Maestría",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    border: "border-rose-500/30",
  },
];

// 2. Propiedades que nuestro componente espera recibir
interface ModalAnkiProps {
  isOpen: boolean; // ¿El modal está visible u oculto?
  onClose: () => void; // Función para cerrar el modal
  cartasIniciales: CartaAnki[]; // Las cartas que propuso Gemini
  chatId: number; // El ID del chat o historia (0 si es de selección libre)
  onSuccess?: (cartasInyectadas: CartaAnki[]) => void; // Acción opcional al terminar con éxito
  origen?: "chat" | "historia" | "cloze" | "speaking"; // Opcional, para saber de dónde proviene
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
    setCartas(
      cartasIniciales.map((c) => ({
        ...c,
        reverso: (c.reverso || "").replace(/<br\s*\/?>/gi, "\n"),
        observacion: (c.observacion || "").replace(/<br\s*\/?>/gi, "\n"),
        ejemplo_espanol: (c.ejemplo_espanol || "").replace(/\[|\]/g, ""),
        incluir_cloze: c.incluir_cloze ?? false,
        ejemplos_cloze: c.ejemplos_cloze ?? [],
        nivel_cefr: c.nivel_cefr || "B1",
      })),
    );
    setCurrentIndex(0);
    setSent(false);
  }, [cartasIniciales, isOpen]);

  const handleFieldChange = (campo: keyof CartaAnki, valor: any) => {
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

  const handleExampleClozeToggle = (exampleIndex: number, valor: boolean) => {
    const card = cartas[currentIndex];
    if (!card) return;
    const currentCloze = [...(card.ejemplos_cloze || [])];
    while (currentCloze.length <= exampleIndex) {
      currentCloze.push(false);
    }
    currentCloze[exampleIndex] = valor;
    handleFieldChange("ejemplos_cloze", currentCloze);
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
                Vista previa de la carta
              </span>
              {(() => {
                const cefr =
                  NIVELES_CEFR.find((n) => n.id === (card?.nivel_cefr || "B1")) ||
                  NIVELES_CEFR[2];
                return (
                  <span
                    className={cn(
                      "text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs",
                      cefr.bg,
                      cefr.color,
                      cefr.border,
                    )}
                  >
                    Nivel {cefr.label} • {cefr.desc}
                  </span>
                );
              })()}
            </div>

            <div className="flex-1 flex flex-col rounded-xl border border-border bg-card p-5 text-center shadow-sm overflow-y-auto max-h-[460px] justify-between">
              <div className="space-y-4">
                {/* Frente */}
                <div className="py-2 border-b border-border/60">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                    Frente
                  </span>
                  <p className="font-serif text-2xl font-bold text-foreground">
                    {card?.frente || "Concepto"}
                  </p>
                </div>

                {/* Reverso */}
                <div className="py-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                    Reverso
                  </span>
                  <p className="font-sans text-sm font-semibold text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {card?.reverso?.replace(/<br\s*\/?>/gi, "\n") || "Definición"}
                  </p>
                </div>

                {/* Ejemplos si existen */}
                {(() => {
                  const enList = (card?.ejemplo_ingles || "")
                    .split("|")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const esList = (card?.ejemplo_espanol || "")
                    .split("|")
                    .map((s) => s.trim());

                  if (enList.length === 0) return null;

                  return (
                    <div className="space-y-2 text-left">
                      {enList.map((en, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-muted/30 p-2.5 rounded-md border border-border/50 space-y-1"
                        >
                          <p className="font-serif text-foreground italic">
                            "{en.replace(/\[|\]/g, "").trim()}"
                          </p>
                          {esList[idx] && (
                            <p className="text-muted-foreground font-sans">
                              {esList[idx].replace(/\[|\]/g, "")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Nota de uso si existe */}
                {card?.observacion && (
                  <div className="text-left text-[11px] border-l-2 border-primary/50 bg-primary/5 p-2 rounded-r text-muted-foreground">
                    <span className="font-semibold text-foreground">💡 Nota de uso: </span>
                    {card.observacion}
                  </div>
                )}
              </div>

              <div className="pt-3 mt-4 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between items-center">
                <span>Categoría: {card?.categoria || "Vocabulario"}</span>
                <span>Mazo: TutorIA</span>
              </div>
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
              <Textarea
                id="anki-back"
                value={card?.reverso || ""}
                onChange={(e) => handleFieldChange("reverso", e.target.value)}
                className="min-h-[75px] resize-y leading-relaxed"
                rows={3}
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
                      <div className="col-span-2 flex items-center justify-end pt-1">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(card?.ejemplos_cloze?.[i])}
                            onChange={(e) =>
                              handleExampleClozeToggle(i, e.target.checked)
                            }
                            className="size-3.5 rounded border-border text-primary accent-primary cursor-pointer"
                          />
                          <Puzzle className="size-3 text-primary" />
                          <span className="text-[11px] font-medium">
                            Añadir este ejemplo a Cloze
                          </span>
                        </label>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="anki-obs">
                Observación / Notas de uso{" "}
                <span className="font-normal border rounded px-1 text-[10px] ml-1 bg-muted">
                  reverso
                </span>
              </Label>
              <Textarea
                id="anki-obs"
                value={card?.observacion || ""}
                placeholder="Matices de contexto, diferencias con palabras similares, o aclaraciones..."
                onChange={(e) => handleFieldChange("observacion", e.target.value)}
                className="min-h-[70px] resize-y leading-relaxed text-sm"
                rows={2}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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
              <div>
                <Label htmlFor="anki-cefr">Nivel</Label>
                <Select
                  id="anki-cefr"
                  value={card?.nivel_cefr || "B1"}
                  onChange={(e) =>
                    handleFieldChange("nivel_cefr", e.target.value)
                  }
                >
                  {NIVELES_CEFR.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.id}
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
              {injectedLoading ? "Enviando..." : "Enviar a Anki"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
