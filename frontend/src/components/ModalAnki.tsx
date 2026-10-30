import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  Puzzle,
  RotateCcw,
  Search,
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
  url_imagen?: string;
  sin_imagen?: boolean;
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

interface PexelsFoto {
  id: number;
  preview: string;
  medium: string;
  large: string;
  alt: string;
  photographer?: string;
}

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
  const [imageError, setImageError] = useState<{
    index: number;
    termino: string;
    mensaje: string;
  } | null>(null);

  // Cache y estado de búsqueda de imágenes Pexels
  const [pexelsCache, setPexelsCache] = useState<Record<string, PexelsFoto[]>>(
    {},
  );
  const [buscandoFotos, setBuscandoFotos] = useState(false);

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
        sin_imagen: c.sin_imagen ?? false,
        url_imagen: c.url_imagen || "",
      })),
    );
    setCurrentIndex(0);
    setSent(false);
    setImageError(null);
  }, [cartasIniciales, isOpen]);

  const handleFieldChange = (campo: keyof CartaAnki, valor: any) => {
    setCartas((prev) =>
      prev.map((carta, i) =>
        i === currentIndex ? { ...carta, [campo]: valor } : carta,
      ),
    );
  };

  const currentTermino = cartas[currentIndex]?.termino_imagen?.trim() || "";
  const currentSinImagen = Boolean(cartas[currentIndex]?.sin_imagen);
  const currentCacheKey = currentTermino.toLowerCase();
  const fotosDisponibles = pexelsCache[currentCacheKey] || [];

  const buscarFotosPexels = async (termino: string, forzar = false) => {
    const query = (termino || "").trim();
    if (!query) return;

    const cacheKey = query.toLowerCase();
    if (!forzar && pexelsCache[cacheKey]) {
      const cached = pexelsCache[cacheKey];
      if (cached.length > 0) {
        setCartas((prev) =>
          prev.map((c, idx) =>
            idx === currentIndex && !c.url_imagen && !c.sin_imagen
              ? { ...c, url_imagen: cached[0].medium }
              : c,
          ),
        );
      }
      return;
    }

    setBuscandoFotos(true);
    try {
      const res = await fetch(
        `/api/pexels/buscar?query=${encodeURIComponent(query)}&per_page=8`,
      );
      if (res.ok) {
        const data = await res.json();
        const fotos: PexelsFoto[] = data.fotos || [];
        setPexelsCache((prev) => ({ ...prev, [cacheKey]: fotos }));

        if (fotos.length > 0) {
          setCartas((prev) =>
            prev.map((c, idx) => {
              if (idx === currentIndex) {
                return {
                  ...c,
                  url_imagen: fotos[0].medium,
                  sin_imagen: false,
                };
              }
              return c;
            }),
          );
          setImageError(null);
        }
      }
    } catch (err) {
      console.error("Error buscando fotos en Pexels:", err);
    } finally {
      setBuscandoFotos(false);
    }
  };

  // Buscar fotos automáticamente al cambiar de carta o cuando cambia el término
  useEffect(() => {
    if (!isOpen || !currentTermino || currentSinImagen) return;

    const cacheKey = currentTermino.toLowerCase();
    if (pexelsCache[cacheKey]) {
      if (
        !cartas[currentIndex]?.url_imagen &&
        pexelsCache[cacheKey].length > 0
      ) {
        setCartas((prev) =>
          prev.map((c, idx) =>
            idx === currentIndex
              ? { ...c, url_imagen: pexelsCache[cacheKey][0].medium }
              : c,
          ),
        );
      }
      return;
    }

    const timer = setTimeout(() => {
      buscarFotosPexels(currentTermino);
    }, 400);

    return () => clearTimeout(timer);
  }, [currentIndex, currentTermino, currentSinImagen, isOpen]);

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
  const handleConfirmarTodo = async (forzarSinImagen = false) => {
    if (cartas.length === 0) {
      alert("No hay cartas para enviar.");
      return;
    }
    setInjectedLoading(true);
    setImageError(null);
    try {
      const res = await fetch("/inyectar_cartas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          cartas: cartas,
          forzar_sin_imagen: forzarSinImagen,
        }),
      });

      // En caso de error, lo capturo con catch y retorno un objeto vacío
      const data = await res.json().catch(() => ({}));

      // Si el backend detectó que falló la imagen en alguna carta
      if (data.error === "IMAGEN_FALLIDA" || data.codigo === "IMAGEN_FALLIDA") {
        const errorIdx =
          typeof data.carta_index === "number" ? data.carta_index : currentIndex;
        setCurrentIndex(errorIdx);
        setImageError({
          index: errorIdx,
          termino:
            data.termino_imagen || cartas[errorIdx]?.termino_imagen || "",
          mensaje:
            data.mensaje ||
            "No se pudo encontrar o descargar una imagen para esta carta.",
        });
        return;
      }

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

        {/* Banner interactivo de Fallo de Imagen */}
        {imageError && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-100 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  No se pudo encontrar o descargar una imagen para esta carta
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Término de búsqueda:{" "}
                  <span className="font-mono font-bold text-foreground">
                    "{imageError.termino}"
                  </span>{" "}
                  (Carta {imageError.index + 1} de {cartas.length}).
                  {currentIndex !== imageError.index ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(imageError.index)}
                      className="ml-1 underline font-semibold text-amber-600 dark:text-amber-400 hover:opacity-80"
                    >
                      Ir a la carta {imageError.index + 1} para editar
                    </button>
                  ) : (
                    " Modifica el término en el campo \"Imagen Pexels\" para reintentar o inyéctala sin imagen."
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleConfirmarTodo(false)}
                disabled={injectedLoading}
                className="h-8 text-xs border-amber-500/40 hover:bg-amber-500/20"
              >
                <RotateCcw className="size-3.5 mr-1" />
                {injectedLoading ? "Probando..." : "Reintentar"}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleConfirmarTodo(true)}
                disabled={injectedLoading}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                {injectedLoading ? "Inyectando..." : "Inyectar de todos modos"}
              </Button>
            </div>
          </div>
        )}

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
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-2">
                    Reverso
                  </span>

                  {/* Previsualización de Imagen Pexels */}
                  {!card?.sin_imagen && (
                    card?.url_imagen ? (
                      <div className="mb-3 overflow-hidden rounded-lg border border-border shadow-2xs max-h-44 bg-muted/20 flex items-center justify-center">
                        <img
                          src={card.url_imagen}
                          alt={card.termino_imagen || "Imagen Pexels"}
                          className="w-full h-36 sm:h-40 object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : buscandoFotos ? (
                      <div className="mb-3 h-32 rounded-lg border border-dashed border-border/80 flex flex-col items-center justify-center text-xs text-muted-foreground gap-1.5 bg-muted/20 animate-pulse">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        <span>Buscando imagen en Pexels...</span>
                      </div>
                    ) : null
                  )}

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

            <div className="grid gap-3 sm:grid-cols-2">
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

            {/* Selector e Imagen Pexels */}
            <div className="rounded-lg border border-border p-3.5 bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="size-3.5 text-primary" />
                  <Label
                    htmlFor="anki-pexels"
                    className="text-xs font-semibold mb-0 cursor-pointer"
                  >
                    Imagen de Pexels
                  </Label>
                  {imageError && imageError.index === currentIndex && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      ⚠️ No encontrada
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nuevoSinImg = !card?.sin_imagen;
                    handleFieldChange("sin_imagen", nuevoSinImg);
                    if (
                      !nuevoSinImg &&
                      !card?.url_imagen &&
                      fotosDisponibles.length > 0
                    ) {
                      handleFieldChange(
                        "url_imagen",
                        fotosDisponibles[0].medium,
                      );
                    }
                  }}
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer",
                    card?.sin_imagen
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      : "bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted",
                  )}
                >
                  {card?.sin_imagen ? (
                    <>
                      <ImageOff className="size-3" />
                      Omitida (Sin imagen)
                    </>
                  ) : (
                    <>
                      <ImageOff className="size-3" />
                      Quitar imagen
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                <Input
                  id="anki-pexels"
                  value={card?.termino_imagen || ""}
                  onChange={(e) => {
                    handleFieldChange("termino_imagen", e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscarFotosPexels(card?.termino_imagen || "", true);
                    }
                  }}
                  disabled={Boolean(card?.sin_imagen)}
                  placeholder="Buscar en inglés (ej. apple, sunset, dog)..."
                  className={cn(
                    "h-8 text-xs flex-1",
                    imageError &&
                      imageError.index === currentIndex &&
                      "border-amber-500 focus-visible:ring-amber-500 bg-amber-500/10",
                  )}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    Boolean(card?.sin_imagen) ||
                    buscandoFotos ||
                    !card?.termino_imagen?.trim()
                  }
                  onClick={() =>
                    buscarFotosPexels(card?.termino_imagen || "", true)
                  }
                  className="h-8 px-2.5 text-xs shrink-0 cursor-pointer"
                  title="Buscar en Pexels"
                >
                  {buscandoFotos ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Search className="size-3.5 mr-1" />
                  )}
                  Buscar
                </Button>
              </div>

              {/* Miniaturas de selección */}
              {!card?.sin_imagen && (
                <div className="pt-0.5">
                  {buscandoFotos ? (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div
                          key={n}
                          className="aspect-4/3 rounded-md bg-muted animate-pulse border border-border/60"
                        />
                      ))}
                    </div>
                  ) : fotosDisponibles.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Elige una foto para tu carta:</span>
                        <span className="font-medium text-foreground/70">
                          {fotosDisponibles.length} encontradas
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {fotosDisponibles.slice(0, 6).map((foto) => {
                          const estaSeleccionada =
                            card?.url_imagen === foto.medium ||
                            (!card?.url_imagen &&
                              fotosDisponibles[0]?.medium === foto.medium);

                          return (
                            <button
                              key={foto.id}
                              type="button"
                              onClick={() => {
                                handleFieldChange("url_imagen", foto.medium);
                                handleFieldChange("sin_imagen", false);
                                setImageError(null);
                              }}
                              className={cn(
                                "group relative aspect-4/3 rounded-md overflow-hidden border transition-all cursor-pointer text-left focus:outline-hidden",
                                estaSeleccionada
                                  ? "ring-2 ring-primary border-primary shadow-xs"
                                  : "border-border hover:border-primary/50 opacity-70 hover:opacity-100",
                              )}
                              title={foto.alt || "Seleccionar imagen"}
                            >
                              <img
                                src={foto.preview || foto.medium}
                                alt={foto.alt}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {estaSeleccionada && (
                                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-xs">
                                  <Check className="size-2.5 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : card?.termino_imagen?.trim() ? (
                    <p className="text-[11px] text-muted-foreground py-1 text-center italic">
                      No se encontraron fotos para "{card.termino_imagen}".
                      Prueba con otra palabra clave en inglés.
                    </p>
                  ) : null}
                </div>
              )}
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
              onClick={() => handleConfirmarTodo(false)}
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
