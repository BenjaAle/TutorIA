import { useState, useEffect } from "react";
import {
  Loader2,
  Sparkles,
  Puzzle,
  BookOpen,
  Trash2,
  Lightbulb,
  PartyPopper,
  Volume2,
  Brain,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ModalAnki, { type CartaAnki } from "../components/ModalAnki";

type Token =
  | { type: "text"; val: string }
  | { type: "input"; val: string; id: number };

interface Oracion {
  id: number;
  ingles: string;
  espanol: string;
  palabra_oculta?: string;
}

type Source = "anki" | "ia";
type Status = "idle" | "correct" | "wrong";

function getClozeDetails(frase: string, palabra_oculta?: string) {
  if (!frase) return { tokens: [], answerMap: {} };

  // 1. Array de palabras a ocultar
  let wordsToHide: string[] = [];
  if (palabra_oculta) {
    wordsToHide = palabra_oculta
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
  }

  // 2. Fallback por si backend omitió
  if (wordsToHide.length === 0) {
    const preposiciones = [
      "in",
      "on",
      "at",
      "to",
      "into",
      "for",
      "with",
      "about",
      "of",
      "from",
      "by",
      "onto",
    ];
    const palabras = frase.split(" ");
    const found = palabras.find((w) =>
      preposiciones.includes(w.toLowerCase().replace(/[^a-z]/g, "")),
    );
    if (found) {
      wordsToHide.push(found.replace(/[^a-zA-Z]/g, ""));
    } else {
      const midWord = palabras[Math.max(0, Math.floor(palabras.length / 2))];
      if (midWord) {
        wordsToHide.push(midWord.replace(/[^a-zA-Z]/g, ""));
      }
    }
  }

  wordsToHide = wordsToHide.filter((w) => w.length > 0);
  if (wordsToHide.length === 0)
    return { tokens: [{ type: "text", val: frase }], answerMap: {} };

  // 3. Crear regex mágico de palabra completa (escapando caracteres especiales para no romper JS)
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = `\\b(${wordsToHide.map(escapeRegex).join("|")})\\b`;
  const regex = new RegExp(regexPattern, "gi");

  let match;
  let lastIndex = 0;
  let idCounter = 0;
  const tokens: Token[] = [];
  const answerMap: Record<number, string> = {};

  while ((match = regex.exec(frase)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        val: frase.substring(lastIndex, match.index),
      });
    }
    tokens.push({ type: "input", val: match[0], id: idCounter });
    answerMap[idCounter] = match[0];
    idCounter++;
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < frase.length) {
    tokens.push({ type: "text", val: frase.substring(lastIndex) });
  }

  if (tokens.length === 0) {
    tokens.push({ type: "text", val: frase });
  }

  return { tokens, answerMap };
}

function playAudio(text: string) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }
}

interface ClozeItemProps {
  number: number;
  exercise: Oracion;
  source: Source;
  onResult: (id: number, ok: boolean) => void;
  onDelete: (id: number) => void;
  onSaveToAnki: (frente: string, reverso: string, ejer: Oracion) => void;
}

function ClozeItemComponent({
  number,
  exercise,
  source,
  onResult,
  onDelete,
  onSaveToAnki,
}: ClozeItemProps) {
  const { tokens, answerMap } = getClozeDetails(
    exercise.ingles,
    exercise.palabra_oculta,
  );

  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [showHint, setShowHint] = useState(false);
  const [wrongTokens, setWrongTokens] = useState<number[]>([]);

  const check = () => {
    let allCorrect = true;
    const errors: number[] = [];

    Object.keys(answerMap).forEach((key) => {
      const id = Number(key);
      const expected = answerMap[id].toLowerCase().trim();
      const actual = (userInputs[id] || "").toLowerCase().trim();
      if (actual !== expected) {
        allCorrect = false;
        errors.push(id);
      }
    });

    if (allCorrect) {
      if (status !== "correct") {
        setStatus("correct");
        setWrongTokens([]);
        onResult(exercise.id, true);
        playAudio(exercise.ingles);
      }
    } else {
      setStatus("wrong");
      setWrongTokens(errors);
      onResult(exercise.id, false);
    }
  };

  const handleHint = () => {
    if (Object.keys(answerMap).length === 0) return;
    const newInputs = { ...userInputs };
    Object.keys(answerMap).forEach((key) => {
      const id = Number(key);
      const expected = answerMap[id];
      const current = userInputs[id] || "";
      if (current.toLowerCase().trim() !== expected.toLowerCase().trim()) {
        if (current.length < expected.length) {
          newInputs[id] = expected.substring(0, current.length + 1);
        }
      }
    });
    setUserInputs(newInputs);
    setStatus("idle");
    setWrongTokens([]);
  };

  const triggerSaveToAnki = () => {
    let frenteHTML = "";
    let palabrasSecretas = "";
    tokens.forEach((tok) => {
      if (tok.type === "text") frenteHTML += tok.val;
      else {
        frenteHTML += "____";
        if (palabrasSecretas.length > 0) palabrasSecretas += ", ";
        palabrasSecretas += tok.val;
      }
    });

    if (!palabrasSecretas) palabrasSecretas = "Palabras Clave";
    onSaveToAnki(frenteHTML, palabrasSecretas, exercise);
  };

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors md:p-6 shadow-sm relative group",
        status === "correct"
          ? "border-success/50 bg-success/5"
          : status === "wrong"
            ? "border-destructive/40"
            : "border-border",
      )}
    >
      <button
        onClick={() => onDelete(exercise.id)}
        className="absolute top-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        title="Eliminar este ejercicio"
      >
        <Trash2 className="size-4" />
      </button>

      <div className="flex items-start gap-4">
        <span className="pt-1.5 font-serif text-sm text-muted-foreground tabular-nums opacity-70">
          {String(number).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
            className="font-serif text-xl leading-loose md:text-2xl mb-4"
          >
            {tokens.map((tok, i) => {
              if (tok.type === "text") {
                return (
                  <span
                    key={i}
                    className={
                      status === "correct" ? "text-success" : "text-foreground"
                    }
                  >
                    {tok.val}
                  </span>
                );
              } else {
                const id = tok.id;
                const isWrong = wrongTokens.includes(id);
                return (
                  <input
                    key={i}
                    aria-label={`Hueco del ejercicio`}
                    value={userInputs[id] || ""}
                    onChange={(e) => {
                      setUserInputs({ ...userInputs, [id]: e.target.value });
                      if (status !== "idle") setStatus("idle");
                    }}
                    onBlur={() => {
                      // Solo validar si todos los espacios vacios fueron llenados.
                      const allFilled = Object.keys(answerMap).every(
                        (key) => (userInputs[Number(key)] || "").trim() !== "",
                      );
                      if (allFilled) check();
                    }}
                    readOnly={status === "correct"}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    style={{
                      width: `${Math.max(answerMap[id].length, 4) + 1}ch`,
                    }}
                    className={cn(
                      "border-b-2 bg-transparent px-1 mx-1 text-center font-sans font-medium outline-none transition-colors inline-block text-[0.9em]",
                      status === "correct" && "border-success text-success",
                      isWrong && "border-destructive text-destructive",
                      status === "idle" &&
                        !isWrong &&
                        "border-border placeholder:text-muted-foreground hover:border-primary/50 focus:border-primary focus:bg-primary/5",
                    )}
                  />
                );
              }
            })}
          </form>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border bg-muted/50 px-2 py-1 flex items-center gap-1.5 font-medium">
              <span
                className={
                  source === "anki" ? "text-blue-500" : "text-orange-500"
                }
              >
                {source === "anki" ? "Anki" : "IA"}
              </span>
            </span>

            <button
              type="button"
              onClick={() => setShowHint((s) => !s)}
              className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
            >
              <Languages className="size-3.5" />
              {showHint ? "Ocultar traducción" : "Ver traducción"}
            </button>

            {status === "idle" && (
              <button
                type="button"
                onClick={handleHint}
                className="flex items-center gap-1 hover:text-foreground transition-colors font-medium border-l border-border pl-4"
              >
                <Lightbulb className="size-3.5" /> Dar una pista
              </button>
            )}

            <div className="flex items-center gap-3 border-l border-border pl-4">
              {status === "correct" && (
                <>
                  <span className="text-success font-medium flex items-center gap-1">
                    <PartyPopper className="size-3.5" /> ¡Correcto!
                  </span>
                  <button
                    type="button"
                    onClick={() => playAudio(exercise.ingles)}
                    className="hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Volume2 className="size-3.5" /> Escuchar
                  </button>
                  {source === "ia" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        triggerSaveToAnki();
                      }}
                      className="hover:text-fuchsia-500 transition-colors flex items-center gap-1 text-fuchsia-600 font-medium"
                    >
                      <Brain className="size-3.5" /> A Anki
                    </button>
                  )}
                </>
              )}
              {status === "wrong" && (
                <span className="text-destructive font-medium">
                  Vuelve a intentarlo
                </span>
              )}
            </div>
          </div>
          {showHint && (
            <p className="mt-4 text-[15px] font-medium text-muted-foreground border-l-2 border-primary/40 pl-3">
              {exercise.espanol}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ClozePage() {
  const [oraciones, setOraciones] = useState<Oracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [source, setSource] = useState<Source>("anki");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cartasAExportar, setCartasAExportar] = useState<CartaAnki[]>([]);

  useEffect(() => {
    cargarOraciones();
  }, [source]);

  const cargarOraciones = async () => {
    setLoading(true);
    setResults({});
    setError(null);
    try {
      const res = await fetch(`/ejercicios/cloze?origen=${source}`);
      if (!res.ok) throw new Error("Error en la petición de ejercicios.");
      const data = await res.json();
      setOraciones(data.oraciones || []);
    } catch (e: any) {
      setError("Error cargando ejercicios: " + e.message);
      setOraciones([]);
    } finally {
      setLoading(false);
    }
  };

  const generarConIA = async () => {
    setGenerando(true);
    try {
      const res = await fetch("/ejercicios/generar_cloze", { method: "POST" });
      const data = await res.json();
      if (data.exito) {
        if (source === "ia") await cargarOraciones();
        else setSource("ia");
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Error al conectar con IA.");
    } finally {
      setGenerando(false);
    }
  };

  const handleEliminar = async (id: number) => {
    const confirm = window.confirm(
      "¿Seguro que deseas eliminar permanentemente este ejercicio?",
    );
    if (!confirm) return;

    try {
      const res = await fetch(`/ejercicios/cloze/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.exito) {
        setOraciones(oraciones.filter((o) => o.id !== id));
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Error eliminando ejercicio: " + e);
    }
  };

  const handleSaveToAnki = (frente: string, reverso: string, ejer: Oracion) => {
    setCartasAExportar([
      {
        frente,
        reverso,
        ejemplo_ingles: ejer.ingles,
        ejemplo_espanol: ejer.espanol,
        termino_imagen: reverso,
        categoria: "Vocabulario",
      },
    ]);
    setIsModalOpen(true);
  };

  const tabs: { id: Source; label: string; count: number; icon: any }[] = [
    {
      id: "anki",
      label: "De tus cartas Anki",
      count: source === "anki" ? oraciones.length : 0,
      icon: BookOpen,
    },
    {
      id: "ia",
      label: "Generados con IA",
      count: source === "ia" ? oraciones.length : 0,
      icon: Sparkles,
    },
  ];
  const correct = oraciones.filter((e) => results[e.id]).length;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background font-sans">
      <main className="flex-1 overflow-y-auto relative flex flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border pl-16 pr-4 py-3 md:px-8 md:py-4 bg-background z-10 sticky top-0">
          <div className="min-w-0 flex-1 flex flex-col">
            <h2 className="truncate font-serif text-2xl font-bold md:text-3xl flex items-center gap-2">
              <Puzzle className="size-6 text-foreground" /> Práctica de Cloze
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Completa la palabra faltante según el contexto de la traducción en
              español.
            </p>
          </div>
        </header>

        <div className="px-4 py-8 md:px-8 max-w-4xl mx-auto w-full">
          <div
            role="tablist"
            aria-label="Origen de los ejercicios"
            className="flex gap-6 border-b border-border"
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={source === id}
                onClick={() => setSource(id)}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 pb-3 text-[15px] transition-colors",
                  source === id
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          {source === "ia" && (
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center shadow-sm">
              <div className="flex-1">
                <h3 className="font-medium text-foreground">
                  Creación automática con IA
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  La IA escaneará tu base de datos generando espacios vacios
                  para completarlos.
                </p>
              </div>
              <button
                onClick={generarConIA}
                disabled={generando}
                className="inline-flex h-10 px-5 items-center justify-center gap-2 rounded-md bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap active:scale-95 shadow-sm"
              >
                {generando ? (
                  <Loader2 className="animate-spin size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {generando ? "Analizando chats..." : "Generar más con IA"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="mt-12 flex flex-col items-center text-muted-foreground">
              <Loader2 className="size-8 animate-spin mb-4 text-primary/50" />
              <p>Cargando ejercicios...</p>
            </div>
          ) : error ? (
            <div className="mt-12 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg text-center">
              {error}
            </div>
          ) : oraciones.length === 0 ? (
            <div className="mt-12 p-8 border border-border bg-card rounded-xl text-center flex flex-col items-center">
              <div className="bg-muted size-16 rounded-full flex items-center justify-center mb-4">
                <Puzzle className="size-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-foreground">
                El cofre está vacío
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {source === "anki"
                  ? "Extrae vocabulario de tus conversaciones en los chats a tus mazos de Anki para que aparezcan aquí automáticamente."
                  : "No tienes ejercicios IA creados. ¡Presiona el botón superior para crear algunos ahora!"}
              </p>
            </div>
          ) : (
            <>
              <ol className="mt-8 space-y-4 pb-20">
                {oraciones.map((exercise, i) => (
                  <ClozeItemComponent
                    key={exercise.id}
                    number={i + 1}
                    exercise={exercise}
                    source={source}
                    onResult={(id, ok) =>
                      setResults((r) => ({ ...r, [id]: ok }))
                    }
                    onDelete={handleEliminar}
                    onSaveToAnki={handleSaveToAnki}
                  />
                ))}
              </ol>

              {/* Fixated progress bar bottom left/right or inline relative */}
              <div className="fixed bottom-0 md:bottom-6 left-0 md:left-1/2 md:-translate-x-1/2 w-full md:w-[90%] md:max-w-xl bg-card/95 backdrop-blur-md border-t md:border border-border p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] md:rounded-2xl z-20 flex items-center justify-between gap-6">
                <span className="text-muted-foreground text-sm flex-shrink-0">
                  <span className="font-bold text-foreground tabular-nums text-base mr-1">
                    {correct}
                  </span>
                  de {oraciones.length} correctas
                </span>
                <div className="h-2 flex-grow overflow-hidden rounded-full bg-muted/60 relative">
                  <div
                    className="absolute top-0 left-0 h-full bg-success transition-all duration-500 ease-out rounded-full"
                    style={{
                      width: `${oraciones.length ? (correct / oraciones.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <ModalAnki
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cartasIniciales={cartasAExportar}
        chatId={0}
        origen="cloze"
      />
    </div>
  );
}
