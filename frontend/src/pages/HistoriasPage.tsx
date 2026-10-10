import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  BookOpen,
  Speech,
  Puzzle,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Library,
  Sparkles,
  Loader2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  MoreVertical,
  Volume2,
  ArrowLeft,
} from "lucide-react";
import ModalAnki, { type CartaAnki } from "../components/ModalAnki";
import KindleSelection from "../components/KindleSelection";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/field";
import { cn } from "@/lib/utils";

// Cada historia tiene id, titulo y si esta fijada o no
interface HistoriaPreview {
  id: number;
  titulo: string;
  fijada?: boolean;
}

// Cada linea tiene el texto en ingles, su fonetica, su traduccion y el audio
interface LineaHistoria {
  en: string;
  ipa: string;
  es: string;
  audio: string;
}

type Mode = "completo" | "lectura" | "escucha";
const MODES: { id: Mode; label: string; detail: string }[] = [
  { id: "completo", label: "Inglés + Español", detail: "Subtítulos y audio" },
  { id: "lectura", label: "Inglés + IPA", detail: "Sin español" },
  { id: "escucha", label: "Solo Audio", detail: "Inmersión total" },
];
const RATES = [0.75, 1, 1.25];

export default function HistoriasPage() {
  // Sidebar State
  const [listaHistorias, setListaHistorias] = useState<HistoriaPreview[]>([]);
  const [tema, setTema] = useState("");
  const [dificultad, setDificultad] = useState("C1");
  const [generando, setGenerando] = useState(false);
  const [historiaActiva, setHistoriaActiva] = useState<number | null>(null);
  const [historiaTitulo, setHistoriaTitulo] = useState("Vuelve a leer");

  // Mobile toggle state
  const [isMobileOpen, setIsMobileOpenState] = useState(
    () => localStorage.getItem("sidebarOpen") === "true",
  );
  const setIsMobileOpen = (open: boolean) => {
    setIsMobileOpenState(open);
    localStorage.setItem("sidebarOpen", open ? "true" : "false");
  };

  // Dropdown y Edición de Historia
  const [menuActivoId, setMenuActivoId] = useState<number | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nuevoTitulo, setNuevoTitulo] = useState("");

  // Board State
  const [lineas, setLineas] = useState<LineaHistoria[]>([]);
  const [modo, setModo] = useState<Mode>("completo");
  const [indiceAudio, setIndiceAudio] = useState(-1);
  const [velocidad, setVelocidad] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Vocab State
  const [palabrasEnAnki, setPalabrasEnAnki] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cartasPropuestas, setCartasPropuestas] = useState<CartaAnki[]>([]);

  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const clickTimeout = useRef<any>(null);
  const lastMousePos = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    cargarVocabulario();
    cargarListaHistorias();
  }, []);

  const cargarVocabulario = async () => {
    try {
      const res = await fetch("/api/vocabulario");
      if (res.ok) setPalabrasEnAnki(await res.json());
    } catch (err) {}
  };

  const cargarListaHistorias = async () => {
    try {
      const res = await fetch("/api/lista_historias");
      if (res.ok) setListaHistorias(await res.json());
    } catch (err) {}
  };

  // 2. Resaltador
  const resaltarPalabras = (textoIngles: string) => {
    // Escapar entidades HTML crudas para evitar ataques XSS
    let textoResaltado = textoIngles
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    if (palabrasEnAnki.length === 0) return textoResaltado;
    const palabrasOrdenadas = [...palabrasEnAnki].sort(
      (a, b) => b.length - a.length,
    );
    palabrasOrdenadas.forEach((palabra) => {
      const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b(${p})\\b`, "gi");
      textoResaltado = textoResaltado.replace(
        regex,
        '<span class="bg-primary/20 text-primary px-1 rounded-sm cursor-help transition-colors hover:bg-primary/40 font-medium">$1</span>',
      );
    });
    return textoResaltado;
  };

  // 3. Generar Historia
  const generarHistoria = async () => {
    if (!tema.trim()) return alert("Escribe un tema para la historia.");
    setGenerando(true);
    setLineas([]);
    setHistoriaTitulo("Generando...");

    try {
      const res = await fetch("/generar_historia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tematica: tema.trim(), nivel: dificultad }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await cargarHistoria(data.historia_id);
      cargarListaHistorias();
      setTema("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setGenerando(false);
    }
  };

  const eliminarHistoria = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de que deseas eliminar esta historia?")) {
      await fetch(`/api/historias/${id}`, { method: "DELETE" });
      cargarListaHistorias();
      if (historiaActiva === id) {
        setHistoriaActiva(null);
        setLineas([]);
        setIndiceAudio(-1);
      }
    }
  };

  const renombrarHistoria = async (id: number) => {
    if (!nuevoTitulo.trim()) {
      setEditandoId(null);
      return;
    }
    try {
      await fetch(`/api/historias/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: nuevoTitulo }),
      });
      cargarListaHistorias();
      if (historiaActiva === id) setHistoriaTitulo(nuevoTitulo);
    } catch (e) {}
    setEditandoId(null);
  };

  const fijarHistoria = async (id: number) => {
    try {
      await fetch(`/api/historias/${id}/fijar`, { method: "PUT" });
      cargarListaHistorias();
    } catch (e) {}
    setMenuActivoId(null);
  };

  // Cierra menú si hacemos click afuera
  useEffect(() => {
    const handleMenuClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".story-options-menu"))
        setMenuActivoId(null);
    };
    document.addEventListener("mousedown", handleMenuClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleMenuClickOutside);
  }, []);

  // 4. Cargar y Reproducir
  const cargarHistoria = async (id: number) => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    setHistoriaActiva(id);
    setIndiceAudio(-1);
    setIsPlaying(false);
    setIsMobileOpen(false);

    const h = listaHistorias.find((hi) => hi.id === id);
    if (h) setHistoriaTitulo(h.titulo);

    try {
      const res = await fetch(`/api/historias/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLineas(data.lineas);
        if (!h && data.titulo) setHistoriaTitulo(data.titulo);
      }
    } catch (e) {}
  };

  const reproducirDesde = (index: number) => {
    if (index >= lineas.length || index < 0) {
      setIndiceAudio(-1);
      setIsPlaying(false);
      return;
    }
    setIndiceAudio(index);
    if (audioPlayerRef.current) {
      // audioPlayerRef.current.src = lineas[index].audio;

      // Usamos un cache-buster ?t=... para forzar al navegador a descargar el mp3 real
      // y que no use una versión vieja atrapada en la memoria caché.
      audioPlayerRef.current.src = `${lineas[index].audio}?t=${Date.now()}`;
      audioPlayerRef.current.playbackRate = velocidad;
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (audioPlayerRef.current) {
      if (audioPlayerRef.current.paused) {
        if (indiceAudio === -1) reproducirDesde(0);
        else {
          audioPlayerRef.current.play();
          setIsPlaying(true);
        }
      } else {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  useLayoutEffect(() => {
    if (indiceAudio >= 0) {
      const el = document.getElementById(`linea-${indiceAudio}`);
      const container = document.getElementById("story-board");
      if (el && container) {
        const elRect = el.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        const offsetToCenter =
          elRect.top -
          contRect.top +
          container.scrollTop -
          contRect.height / 2 +
          elRect.height / 2;
        container.scrollTo({ top: offsetToCenter, behavior: "smooth" });
      }
    }
  }, [indiceAudio]);

  const handleAudioEnded = () => reproducirDesde(indiceAudio + 1);

  const handleVelocidadChange = (v: number) => {
    setVelocidad(v);
    if (audioPlayerRef.current) audioPlayerRef.current.playbackRate = v;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    lastMousePos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handleMouseUpPlay = (index: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const dx = Math.abs(e.clientX - lastMousePos.current.x);
    const dy = Math.abs(e.clientY - lastMousePos.current.y);
    if (dx > 5 || dy > 5) return;
    if (clickTimeout.current) clearTimeout(clickTimeout.current);

    clickTimeout.current = setTimeout(() => {
      // Confirmamos que la selección nativa del usuario no tenga nada seleccionado
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;
      if (indiceAudio === index) toggleMute();
      else reproducirDesde(index);
    }, 200);
  };

  // Enviar a Anki (llamado desde el nuevo componente KindleSelection)
  const abrirAnkiDesdeFloating = async (palabra: string, contexto: string) => {
    try {
      const res = await fetch("/proponer_carta_unica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palabra, contexto }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else if (!data.cartas || data.cartas.length === 0)
        alert("No se pudo generar la carta.");
      else {
        setCartasPropuestas(data.cartas);
        setIsModalOpen(true);
      }
    } catch (err) {}
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background font-sans">
      {/* SIDEBAR */}
      <aside
        className={cn(
          "w-full shrink-0 flex-col border-r border-border md:flex md:w-80",
          isMobileOpen ? "flex" : "hidden",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-foreground font-semibold hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-4" /> Tutor IA
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-5 border-b border-border">
            <h3 className="font-serif text-lg font-semibold mb-4">
              Nueva Historia
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Temática
                </Label>
                <textarea
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder="Ej.: un misterio en Londres..."
                  className="w-full min-h-[80px] rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Nivel
                </Label>
                <select
                  value={dificultad}
                  onChange={(e) => setDificultad(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="A1">A1 - Principiante</option>
                  <option value="A2">A2 - Elemental</option>
                  <option value="B1">B1 - Intermedio</option>
                  <option value="B2">B2 - Intermedio Alto</option>
                  <option value="C1">C1 - Avanzado</option>
                </select>
              </div>
              <Button
                onClick={generarHistoria}
                disabled={generando}
                className="w-full"
              >
                {generando ? (
                  <Loader2 className="animate-spin mr-2 size-4" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                {generando ? "Generando..." : "Mágia IA"}
              </Button>
            </div>
          </div>

          <div className="p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Library className="size-4" /> Historias Guardadas
            </h3>
            <ul className="space-y-1">
              {listaHistorias.map((h) => (
                <li key={h.id} className="relative group">
                  {editandoId === h.id ? (
                    <input
                      type="text"
                      value={nuevoTitulo}
                      onChange={(e) => setNuevoTitulo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renombrarHistoria(h.id);
                        if (e.key === "Escape") setEditandoId(null);
                      }}
                      onBlur={() => renombrarHistoria(h.id)}
                      autoFocus
                      className="w-full rounded border-primary px-3 py-2 text-sm shadow-sm ring-1 ring-primary focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => cargarHistoria(h.id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 border border-transparent px-3 py-2.5 text-left rounded-md transition-colors hover:bg-muted/60",
                        historiaActiva === h.id
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground font-normal",
                      )}
                    >
                      <span className="truncate flex items-center gap-2">
                        {h.fijada && (
                          <Pin
                            size={14}
                            className="fill-foreground text-foreground shrink-0"
                          />
                        )}
                        <span className="truncate">{h.titulo}</span>
                      </span>
                    </button>
                  )}

                  {/* Dropdown Options Hover */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity story-options-menu bg-background/80 rounded z-10 backdrop-blur-sm shadow-sm border border-border">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuActivoId(menuActivoId === h.id ? null : h.id);
                      }}
                    >
                      <MoreVertical size={14} />
                    </Button>
                    {menuActivoId === h.id && (
                      <div className="absolute right-0 top-8 w-32 bg-popover text-popover-foreground rounded-md shadow-md border border-border py-1 text-xs">
                        <button
                          className="w-full text-left px-3 py-1.5 hover:bg-muted/60 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            fijarHistoria(h.id);
                          }}
                        >
                          {h.fijada ? <PinOff size={14} /> : <Pin size={14} />}{" "}
                          {h.fijada ? "Soltar" : "Fijar"}
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 hover:bg-muted/60 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditandoId(h.id);
                            setNuevoTitulo(h.titulo);
                            setMenuActivoId(null);
                          }}
                        >
                          <Pencil size={14} /> Renombrar
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 hover:bg-destructive/10 text-destructive flex items-center gap-2"
                          onClick={(e) => {
                            setMenuActivoId(null);
                            eliminarHistoria(h.id, e);
                          }}
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* STORY MAIN CONTENT */}
      <main
        className={cn(
          "flex-1 overflow-hidden relative flex flex-col bg-background",
          isMobileOpen ? "hidden" : "flex",
        )}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-8 md:py-4 bg-background z-10 h-[69px]">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileOpen(true)}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-lg font-semibold md:text-xl">
              {historiaActiva ? historiaTitulo : "Biblioteca de Historias"}
            </h2>
          </div>
        </header>

        {!historiaActiva ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-muted/10">
            <div className="size-20 mb-6 bg-secondary text-primary rounded-full flex items-center justify-center">
              <BookOpen className="size-10" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Lectura Bilingüe
            </h2>
            <p className="mt-2 text-sm max-w-sm">
              Genera una nueva historia sobre lo que quieras a la izquierda, o
              selecciona una de tu biblioteca.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col bg-card">
            {/* Top Tabs */}
            <div className="px-4 py-4 md:px-8 border-b border-border bg-background shadow-xs shrink-0 overflow-x-auto">
              <div
                role="tablist"
                className="flex md:grid md:grid-cols-3 gap-2 min-w-max md:min-w-0"
              >
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    role="tab"
                    aria-selected={modo === m.id}
                    onClick={() => setModo(m.id)}
                    className={cn(
                      "rounded-md border px-3 mt-1 py-1 text-left transition-colors whitespace-nowrap",
                      modo === m.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card hover:border-foreground/30",
                    )}
                  >
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span
                      className={cn(
                        "hidden text-[11px] sm:block mt-0.5",
                        modo === m.id
                          ? "text-background/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {m.detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Board */}
            <div
              id="story-board"
              className="flex-1 overflow-y-auto px-4 py-6 md:px-8 bg-muted/10 pb-40"
            >
              {modo === "escucha" && indiceAudio === -1 ? (
                <div className="flex flex-col items-center py-12 text-center h-full justify-center">
                  <Volume2 className="size-20 text-muted-foreground/30 mb-4" />
                  <p className="font-serif text-2xl font-medium text-foreground">
                    Modo Inmersión
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                    Haz click en Play abajo para escuchar la historia de corrido
                    sin ver el texto.
                  </p>
                </div>
              ) : (
                <ol className="space-y-1 max-w-3xl mx-auto">
                  {lineas.map((s, i) => {
                    const current = i === indiceAudio;
                    return (
                      <li key={i} id={`linea-${i}`}>
                        <button
                          type="button"
                          onMouseDown={handleMouseDown}
                          onMouseUp={(e) => handleMouseUpPlay(i, e)}
                          aria-current={current ? "true" : undefined}
                          className={cn(
                            "grid w-full grid-cols-[1.75rem_1fr] md:grid-cols-[2.5rem_1fr] gap-x-2 rounded-xl px-2 py-3 md:px-4 text-left transition-all",
                            current
                              ? "bg-secondary/60 shadow-sm border border-border/50 scale-[1.01]"
                              : "hover:bg-muted/40 border border-transparent",
                          )}
                        >
                          <span className="pt-1.5 font-serif text-[13px] text-muted-foreground tabular-nums text-center opacity-60">
                            {i + 1}
                          </span>

                          <span
                            className={cn(
                              "block transition-opacity",
                              modo === "escucha" && !current
                                ? "opacity-0"
                                : "opacity-100",
                            )}
                          >
                            {modo === "escucha" ? (
                              /* Modo Escucha - Solo mostramos el texto si es el actual, pero igual atenuado */
                              <span className="block font-serif text-[20px] md:text-2xl leading-[1.6] text-foreground/40 italic flex items-center min-h-[3rem]">
                                Escuchando diálogo...
                              </span>
                            ) : (
                              <>
                                <span
                                  className={cn(
                                    "block font-serif text-[19px] md:text-2xl leading-[1.6] text-foreground transition-colors",
                                    current && "text-primary font-bold",
                                  )}
                                  dangerouslySetInnerHTML={{
                                    __html: resaltarPalabras(s.en),
                                  }}
                                />

                                {modo === "lectura" && (
                                  <span className="mt-1 block font-ipa text-[16px] md:text-lg text-primary/70 font-medium">
                                    /{s.ipa}/
                                  </span>
                                )}

                                {modo === "completo" && (
                                  <span className="mt-1 block text-[14px] md:text-[15px] text-muted-foreground/90">
                                    {s.es}
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Floating Player */}
            {lineas.length > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xl flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md z-20 transition-all">
                <button
                  type="button"
                  onClick={() => reproducirDesde(indiceAudio - 1)}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
                >
                  <SkipBack className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex size-12 shadow-md items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="size-5 fill-current" />
                  ) : (
                    <Play className="size-5 translate-x-px fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => reproducirDesde(indiceAudio + 1)}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
                >
                  <SkipForward className="size-5" />
                </button>

                <div className="mx-2 hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60 sm:block relative cursor-pointer">
                  <div
                    className="absolute top-0 left-0 h-full bg-foreground transition-all rounded-full"
                    style={{
                      width: `${((indiceAudio + 1) / lineas.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="ml-auto text-[11px] font-medium text-muted-foreground tabular-nums sm:ml-0 font-serif">
                  {Math.max(0, indiceAudio + 1)}{" "}
                  <span className="text-muted-foreground/40">/</span>{" "}
                  {lineas.length}
                </span>

                <div
                  className="flex rounded-md border border-input text-[11px] font-semibold bg-muted/20"
                  role="group"
                >
                  {RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleVelocidadChange(r)}
                      className={cn(
                        "px-2 py-1.5 tabular-nums transition-colors",
                        velocidad === r
                          ? "bg-foreground text-background shadow-xs rounded-md"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {r}×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reproductor Real oculto */}
      <audio
        ref={audioPlayerRef}
        onEnded={handleAudioEnded}
        style={{ display: "none" }}
      />

      <KindleSelection onRequestAnki={abrirAnkiDesdeFloating} />
      <ModalAnki
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          cargarVocabulario();
        }}
        cartasIniciales={cartasPropuestas}
        chatId={historiaActiva || 0}
        origen="historia"
      />
    </div>
  );
}
