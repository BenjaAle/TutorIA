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
  Check,
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

function getClozeDetails(
  frase: string,
  palabra_oculta?: string,
): { tokens: Token[]; answerMap: Record<number, string> } {
  if (!frase) return { tokens: [], answerMap: {} };

  // Limpiar cualquier corchete residual de la oración y de la palabra oculta
  const cleanFrase = frase.replace(/\[|\]/g, "").trim();
  const rawOculta = (palabra_oculta || "").replace(/\[|\]/g, "").trim();

  // 1. Array de palabras/frases a ocultar
  let wordsToHide: string[] = [];
  if (rawOculta) {
    if (rawOculta.includes(",")) {
      wordsToHide = rawOculta
        .split(",")
        .map((w) => w.replace(/^[^\w']+|[^\w']+$/g, "").trim())
        .filter(Boolean);
    } else {
      const limpia = rawOculta.replace(/^[^\w']+|[^\w']+$/g, "").trim();
      if (limpia) wordsToHide = [limpia];
    }
  }

  // 2. Fallback inteligente si no hay palabra oculta
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
    const palabras = cleanFrase.split(" ");
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
  wordsToHide.sort((a, b) => b.length - a.length);
  if (wordsToHide.length === 0)
    return { tokens: [{ type: "text", val: cleanFrase }], answerMap: {} };

  // 3. Crear regex de palabra completa evitando interferencias
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = `\\b(${wordsToHide.map(escapeRegex).join("|")})\\b`;
  const regex = new RegExp(regexPattern, "gi");

  let match;
  let lastIndex = 0;
  let idCounter = 0;
  const tokens: Token[] = [];
  const answerMap: Record<number, string> = {};

  while ((match = regex.exec(cleanFrase)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        val: cleanFrase.substring(lastIndex, match.index),
      });
    }

    const matchedPhrase = match[0];
    if (/\s+/.test(matchedPhrase)) {
      // Si la frase oculta contiene varias palabras, generamos una casilla individual por cada palabra
      const parts = matchedPhrase.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          tokens.push({ type: "text", val: part });
        } else {
          // Si la palabra tiene signos de puntuación adosados (ej: "word." o "word,")
          const punctMatch = part.match(/^([\w'-]+)([^\w'-]*)$/);
          if (punctMatch && punctMatch[2]) {
            const wordOnly = punctMatch[1];
            const punct = punctMatch[2];
            tokens.push({ type: "input", val: wordOnly, id: idCounter });
            answerMap[idCounter] = wordOnly;
            idCounter++;
            tokens.push({ type: "text", val: punct });
          } else {
            tokens.push({ type: "input", val: part, id: idCounter });
            answerMap[idCounter] = part;
            idCounter++;
          }
        }
      }
    } else {
      tokens.push({ type: "input", val: matchedPhrase, id: idCounter });
      answerMap[idCounter] = matchedPhrase;
      idCounter++;
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanFrase.length) {
    tokens.push({ type: "text", val: cleanFrase.substring(lastIndex) });
  }

  if (tokens.length === 0) {
    tokens.push({ type: "text", val: cleanFrase });
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
      const expected = (answerMap[id] || "").toLowerCase().trim();
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
    const allIds = Object.keys(answerMap)
      .map(Number)
      .sort((a, b) => a - b);
    if (allIds.length === 0) return;

    // Buscar de izquierda a derecha la primera casilla que no esté completa y correcta
    let targetId: number | null = null;
    let nextVal = "";

    for (const id of allIds) {
      const expected = answerMap[id] || "";
      const current = (userInputs[id] || "").trim();

      // Si ya está completamente correcta, pasa a la siguiente casilla
      if (current.toLowerCase() === expected.toLowerCase()) {
        continue;
      }

      // Calculamos cuántos caracteres consecutivos iniciales coinciden con la palabra esperada
      let matchLen = 0;
      while (
        matchLen < current.length &&
        matchLen < expected.length &&
        current[matchLen].toLowerCase() === expected[matchLen].toLowerCase()
      ) {
        matchLen++;
      }

      // Si tenía letras incorrectas, matchLen descarta los errores.
      // Si tenía letras correctas (o estaba vacía), revela una letra más de la palabra correcta.
      const nextLen = Math.min(expected.length, matchLen + 1);
      nextVal = expected.substring(0, nextLen);
      targetId = id;
      break;
    }

    if (targetId !== null) {
      setUserInputs((prev) => ({ ...prev, [targetId!]: nextVal }));
      setStatus("idle");
      setWrongTokens((prev) => prev.filter((id) => id !== targetId));

      setTimeout(() => {
        const el = document.getElementById(
          `cloze-input-${exercise.id}-${targetId}`
        );
        el?.focus();
      }, 10);
    }
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

  const handleInputChange = (id: number, val: string) => {
    if (status !== "idle") setStatus("idle");

    // Si el usuario escribe o pega texto con espacios, distribuir en casillas consecutivas
    if (val.includes(" ")) {
      const words = val.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        const allIds = Object.keys(answerMap).map(Number).sort((a, b) => a - b);
        const currentIdx = allIds.indexOf(id);
        const nextInputs = { ...userInputs };

        words.forEach((w, offset) => {
          const targetId = allIds[currentIdx + offset];
          if (targetId !== undefined) {
            nextInputs[targetId] = w;
          }
        });
        setUserInputs(nextInputs);

        setTimeout(() => {
          const nextTargetId = allIds[currentIdx + words.length];
          if (nextTargetId !== undefined) {
            const el = document.getElementById(
              `cloze-input-${exercise.id}-${nextTargetId}`
            );
            el?.focus();
          }
        }, 10);
        return;
      }
    }

    setUserInputs((prev) => ({ ...prev, [id]: val }));
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: number
  ) => {
    const allIds = Object.keys(answerMap).map(Number).sort((a, b) => a - b);
    const currentIdx = allIds.indexOf(id);

    if (e.key === " " || e.key === "Spacebar") {
      // Avanzar a la siguiente casilla al presionar espacio si ya escribió la palabra
      if ((userInputs[id] || "").trim().length > 0) {
        e.preventDefault();
        const nextId = allIds[currentIdx + 1];
        if (nextId !== undefined) {
          const nextEl = document.getElementById(
            `cloze-input-${exercise.id}-${nextId}`
          );
          nextEl?.focus();
        }
      }
    } else if (e.key === "Backspace") {
      // Si la casilla está vacía y presiona retroceso, volver a la anterior
      if (!userInputs[id] || userInputs[id].length === 0) {
        const prevId = allIds[currentIdx - 1];
        if (prevId !== undefined) {
          const prevEl = document.getElementById(
            `cloze-input-${exercise.id}-${prevId}`
          );
          prevEl?.focus();
        }
      }
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget;
      if (input.selectionStart === input.value.length) {
        const nextId = allIds[currentIdx + 1];
        if (nextId !== undefined) {
          const nextEl = document.getElementById(
            `cloze-input-${exercise.id}-${nextId}`
          );
          nextEl?.focus();
        }
      }
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget;
      if (input.selectionStart === 0) {
        const prevId = allIds[currentIdx - 1];
        if (prevId !== undefined) {
          const prevEl = document.getElementById(
            `cloze-input-${exercise.id}-${prevId}`
          );
          prevEl?.focus();
        }
      }
    }
  };

  return (
    <li
      className={cn(
        // Reglas base
        "rounded-xl border bg-card p-4 transition-colors md:p-6 shadow-sm relative group",
        status === "correct" // inyecta solo si acertó (si hay coincidencia con base, prioriza este)
          ? "border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/15"
          : status === "wrong" // inyecta solo si se equivocó
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
                      status === "correct"
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-foreground"
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
                    id={`cloze-input-${exercise.id}-${id}`}
                    aria-label={`Hueco del ejercicio`}
                    value={userInputs[id] || ""}
                    onChange={(e) => handleInputChange(id, e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, id)}
                    readOnly={status === "correct"}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    style={{
                      width: `${Math.max((answerMap[id] || "").length, 3) + 1}ch`,
                    }}
                    className={cn(
                      "border-b-2 bg-transparent px-1 mx-1 text-center font-sans font-medium outline-none transition-colors inline-block text-[0.9em]",
                      status === "correct" &&
                        "border-emerald-500 text-emerald-600 dark:text-emerald-400",
                      isWrong && "border-destructive text-destructive",
                      status === "idle" &&
                        !isWrong &&
                        "border-border placeholder:text-muted-foreground hover:border-primary/50 focus:border-primary focus:bg-primary/5",
                    )}
                  />
                );
              }
            })}
            {status === "idle" && (
              <button
                type="submit"
                className="ml-2 inline-flex translate-y-[-2px] items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 transition-colors"
                title="Comprobar respuesta (Enter)"
              >
                <Check className="size-5" />
              </button>
            )}
            <button type="submit" className="hidden" aria-hidden="true" />
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

            {status !== "correct" && (
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
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
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
                      <Brain className="size-3.5" /> Añadir a Anki
                    </button>
                  )}
                </>
              )}
              {status === "wrong" && (
                <span className="text-destructive font-medium">
                  {" "}
                  {/*Aplicacion de text-destructive que es ROJO*/}
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
              Ejercicios Cloze
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
                  Crear ejercicios con IA
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  La IA creará ejercicios basados en tu estudio.
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
                {generando ? "Analizando chats..." : "Generar ejercicios"}
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
