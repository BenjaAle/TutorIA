import { useState, useEffect } from "react";
import { Speech, Volume2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Fonema {
  id: string;
  simbolo: string;
  nombre: string;
  desc: string;
  ejemplos: string[];
  // Campos derivados para UI
  grupo?: string;
  palabra?: string;
  ipa?: string;
}

interface ReglaSpeech {
  id: string;
  regla: string;
  nombre: string;
  desc: string;
  ejemplos: string[];
}

const FONEMA_GROUPS = ["Vocales", "Diptongos", "Consonantes"];

export default function FoneticaPage() {
  const [fonemas, setFonemas] = useState<Fonema[]>([]);
  const [reglas, setReglas] = useState<ReglaSpeech[]>([]);
  const [activeFonema, setActiveFonema] = useState<Fonema | null>(null);

  useEffect(() => {
    // 1. Cargar la Tabla Fonética
    const cargarFonemas = async () => {
      try {
        const res = await fetch("/api/fonemas");
        if (res.ok) {
          const data: Fonema[] = await res.json();
          // Procesar y agrupar por índice, ya que el backend los envía en orden
          const procesados = data.map((f, i) => {
            let grupo = "Consonantes";
            if (i < 12) grupo = "Vocales";
            else if (i < 20) grupo = "Diptongos";

            const primerEjemplo = f.ejemplos.length > 0 ? f.ejemplos[0] : "";
            const partes = primerEjemplo.split(" ");
            const palabra = partes[0] || "";
            const ipa = partes.slice(1).join(" ") || "";

            return { ...f, grupo, palabra, ipa };
          });
          setFonemas(procesados);
          if (procesados.length > 0) setActiveFonema(procesados[0]);
        }
      } catch (err) {
        console.error("Error al cargar fonemas:", err);
      }
    };

    // 2. Cargar Connected Speech
    const cargarConnectedSpeech = async () => {
      try {
        const res = await fetch("/api/connected_speech");
        if (res.ok) {
          const data = await res.json();
          setReglas(data);
        }
      } catch (err) {
        console.error("Error al cargar connected speech:", err);
      }
    };

    cargarFonemas();
    cargarConnectedSpeech();
  }, []);

  // Manejador de click en tarjeta de fonema
  const handleClickFonema = (f: Fonema) => {
    setActiveFonema(f);
    if ((window as any).currentFoneticaAudio) {
      (window as any).currentFoneticaAudio.pause();
    }

    // Ruta donde el backend (FastAPI) sirve los audios estáticos
    const url = `http://localhost:8000/static/audios/fonemas/${f.id}.mp3`;
    const audio = new Audio(url);
    (window as any).currentFoneticaAudio = audio;
    audio
      .play()
      .catch((e) => console.error("Error al reproducir audio pregenerado:", e));
  };

  const reproducirFonemaActivo = () => {
    if (activeFonema) handleClickFonema(activeFonema);
  };

  const reproducirConnected = (r: ReglaSpeech) => {
    window.speechSynthesis.cancel();
    const frasesLimpias = r.ejemplos.map((ej) => {
      const match = ej.match(/\((.*?)\)/);
      return match && match[1] ? match[1] : ej.split(" (")[0];
    });
    const textoAReproducir = frasesLimpias.join(". ");

    const utterance = new SpeechSynthesisUtterance(textoAReproducir);
    utterance.lang = "en-US";
    utterance.rate = 0.9; // Velocidad 90%

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background font-sans">
      <main className="flex-1 overflow-y-auto relative flex flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-8 md:py-4 bg-background z-10 sticky top-0">
          <Link to="/" className="md:hidden">
            <ArrowLeft className="size-5 text-muted-foreground mr-2" />
          </Link>
          <div className="min-w-0 flex-1 flex flex-col">
            <h2 className="truncate font-serif text-2xl font-bold md:text-3xl">
              Fonética
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Los 44 fonemas del inglés y reglas de discurso conectado.
            </p>
          </div>
        </header>

        <div className="px-4 py-8 md:px-8 max-w-7xl mx-auto w-full">
          {/* Seccion FONEMAS */}
          <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-10">
              {FONEMA_GROUPS.map((group) => {
                const items = fonemas.filter((p) => p.grupo === group);
                if (items.length === 0) return null;
                return (
                  <section key={group} aria-labelledby={`group-${group}`}>
                    <h2
                      id={`group-${group}`}
                      className="mb-4 flex items-baseline gap-3 font-serif text-lg font-semibold text-foreground border-b border-border pb-2"
                    >
                      {group}
                      <span className="text-sm font-sans font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </h2>
                    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                      {items.map((p) => {
                        const active = activeFonema?.id === p.id;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => handleClickFonema(p)}
                              aria-pressed={active}
                              className={cn(
                                "flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border transition-all duration-200",
                                active
                                  ? "border-foreground bg-foreground text-background shadow-md scale-[1.02]"
                                  : "border-border bg-card hover:border-foreground/30 hover:bg-muted/30 hover:scale-[1.02] active:scale-[0.98]",
                              )}
                            >
                              <span className="font-ipa text-3xl font-medium tracking-wider">
                                {p.simbolo}
                              </span>
                              <span
                                className={cn(
                                  "text-xs mt-1 transition-colors",
                                  active
                                    ? "text-background/80 font-medium"
                                    : "text-muted-foreground",
                                )}
                              >
                                {p.palabra}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>

            {/* Asignacion dinamica de Fonema Seleccionado */}
            <div>
              <aside className="sticky top-[100px] h-fit rounded-xl border border-border bg-card p-6 shadow-sm">
                {activeFonema ? (
                  <>
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      {activeFonema.grupo}
                    </p>
                    <p className="mt-4 font-ipa text-[5.5rem] leading-[1] text-foreground font-light">
                      {activeFonema.simbolo}
                    </p>
                    <div className="mt-4 border-b border-border/50 pb-5">
                      <p className="font-serif text-3xl font-medium text-destructive">
                        {activeFonema.palabra}
                      </p>
                      <p className="text-sm font-ipa text-muted-foreground mt-1">
                        {activeFonema.ipa}
                      </p>
                    </div>

                    <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Cómo se pronuncia
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-foreground/90 font-medium">
                      {activeFonema.desc}
                    </p>
                    <button
                      type="button"
                      onClick={reproducirFonemaActivo}
                      className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground shadow-sm active:scale-95"
                    >
                      <Volume2 className="size-4" />
                      Escuchar &ldquo;{activeFonema.palabra}&rdquo;
                    </button>
                  </>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <Speech className="size-10 mb-4 opacity-20" />
                    <p className="text-sm">
                      Selecciona un fonema para ver sus detalles
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </div>

          <div className="my-16 h-px w-full bg-border/60" />

          {/* Sección CONNECTED SPEECH */}
          <section className="mb-20">
            <header className="mb-8">
              <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
                Discurso Conectado
              </h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
                Cómo los hablantes nativos unen, cortan y transforman las
                palabras a velocidad real. Haz click en cualquier tarjeta para
                escuchar.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {reglas.map((r) => (
                <button
                  key={r.id}
                  onClick={() => reproducirConnected(r)}
                  className="flex flex-col text-left bg-card border border-border p-5 rounded-xl transition-all hover:shadow-md hover:border-foreground/30 active:scale-[0.98] group"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <span className="font-serif text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {r.regla}
                    </span>
                    <Volume2 className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {r.nombre}
                  </span>
                  <p className="text-sm text-foreground/80 leading-relaxed mb-4 flex-1">
                    {r.desc}
                  </p>

                  <div className="w-full bg-muted/40 rounded-lg p-3 space-y-1.5 border border-border/50">
                    {r.ejemplos.map((ej, index) => {
                      const [texto, pronunciacion] = ej.split(" (");
                      return (
                        <div key={index} className="flex flex-col">
                          <span className="text-sm font-medium">{texto}</span>
                          <span className="text-xs font-ipa text-primary/70">
                            {pronunciacion ? `(${pronunciacion}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
