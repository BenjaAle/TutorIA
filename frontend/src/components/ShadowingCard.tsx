import { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Mic,
  Square,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  Pause,
  Award,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FraseShadowing {
  id: string | number;
  en: string;
  es: string;
  ipa?: string;
  foco_ritmo?: string;
  audio?: string;
  origen?: string;
  contexto?: string;
  mejor_score?: number | null;
  fecha?: string;
}

export interface WordAnalysis {
  word: string;
  status: "correct" | "needs_work" | "missed";
  tip?: string | null;
}

export interface EvaluacionShadowing {
  transcription: string;
  overall_score: number;
  status: "excelente" | "bueno" | "regular" | "necesita_practica";
  rhythm: {
    score: number;
    feedback: string;
  };
  words_analysis: WordAnalysis[];
  coach_tip?: string;
  ruta_audio_usuario?: string;
  frase_objetivo?: string;
  mejor_score?: number;
}

interface ShadowingCardProps {
  frase: FraseShadowing;
  numero?: number;
  total?: number;
  onSiguiente?: () => void;
  onAnterior?: () => void;
  puedeAvanzar?: boolean;
  puedeRetroceder?: boolean;
  onEliminar?: (id: string | number) => void;
  onScoreActualizado?: (id: string | number, nuevoScore: number) => void;
}

export default function ShadowingCard({
  frase,
  numero,
  total,
  onSiguiente,
  onAnterior,
  puedeAvanzar = false,
  puedeRetroceder = false,
  onEliminar,
  onScoreActualizado,
}: ShadowingCardProps) {
  // Estado de Audio Modelo
  const [modelAudioUrl, setModelAudioUrl] = useState<string>(frase.audio || "");
  const [isPlayingModel, setIsPlayingModel] = useState(false);
  const [modelSpeed, setModelSpeed] = useState<number>(1.0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);

  // Estado de Grabación del Usuario
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [isPlayingUser, setIsPlayingUser] = useState(false);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Estado de Evaluación de IA
  const [evaluando, setEvaluando] = useState(false);
  const [resultado, setResultado] = useState<EvaluacionShadowing | null>(null);
  const [selectedWordTip, setSelectedWordTip] = useState<WordAnalysis | null>(null);

  // Al cambiar de frase, reiniciar estados de grabación y evaluación
  useEffect(() => {
    // Detener reproducción previa
    if (modelAudioRef.current) {
      modelAudioRef.current.pause();
      setIsPlayingModel(false);
    }
    if (userAudioRef.current) {
      userAudioRef.current.pause();
      setIsPlayingUser(false);
    }

    // Cancelar grabación activa si la hubiera
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (timerRef.current) clearInterval(timerRef.current);

    setUserAudioBlob(null);
    setUserAudioUrl(null);
    setRecordingSeconds(0);
    setResultado(null);
    setSelectedWordTip(null);

    // Si la frase no tiene audio modelo, sintetizarlo bajo demanda
    if (!frase.audio) {
      sintetizarAudio(frase.en);
    } else {
      setModelAudioUrl(frase.audio);
    }
  }, [frase.id, frase.en, frase.audio]);

  // Sintetizar audio bajo demanda
  const sintetizarAudio = async (texto: string) => {
    setLoadingAudio(true);
    try {
      const res = await fetch("/api/speaking/shadowing/sintetizar_frase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio) setModelAudioUrl(data.audio);
      }
    } catch (e) {
      console.error("Error sintetizando audio para shadowing:", e);
    } finally {
      setLoadingAudio(false);
    }
  };

  // Reproducir audio modelo
  const togglePlayModel = () => {
    if (!modelAudioUrl) return;

    if (!modelAudioRef.current) {
      const audio = new Audio(modelAudioUrl);
      audio.playbackRate = modelSpeed;
      audio.onended = () => setIsPlayingModel(false);
      audio.onpause = () => setIsPlayingModel(false);
      audio.onplay = () => setIsPlayingModel(true);
      modelAudioRef.current = audio;
    }

    if (isPlayingModel) {
      modelAudioRef.current.pause();
    } else {
      // Si el audio del usuario estaba sonando, pausarlo
      if (userAudioRef.current) userAudioRef.current.pause();
      modelAudioRef.current.src = modelAudioUrl;
      modelAudioRef.current.playbackRate = modelSpeed;
      modelAudioRef.current.currentTime = 0;
      modelAudioRef.current.play().catch(() => setIsPlayingModel(false));
    }
  };

  const cambiarVelocidad = (velocidad: number) => {
    setModelSpeed(velocidad);
    if (modelAudioRef.current) {
      modelAudioRef.current.playbackRate = velocidad;
    }
  };

  // Reproducir audio del usuario
  const togglePlayUser = () => {
    if (!userAudioUrl) return;

    if (!userAudioRef.current) {
      const audio = new Audio(userAudioUrl);
      audio.onended = () => setIsPlayingUser(false);
      audio.onpause = () => setIsPlayingUser(false);
      audio.onplay = () => setIsPlayingUser(true);
      userAudioRef.current = audio;
    }

    if (isPlayingUser) {
      userAudioRef.current.pause();
    } else {
      // Si el modelo estaba sonando, pausarlo
      if (modelAudioRef.current) modelAudioRef.current.pause();
      userAudioRef.current.src = userAudioUrl;
      userAudioRef.current.currentTime = 0;
      userAudioRef.current.play().catch(() => setIsPlayingUser(false));
    }
  };

  // Lógica de grabación del usuario
  const iniciarGrabacion = async () => {
    try {
      // Pausar cualquier audio reproduciéndose
      if (modelAudioRef.current) modelAudioRef.current.pause();
      if (userAudioRef.current) userAudioRef.current.pause();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      setUserAudioBlob(null);
      setUserAudioUrl(null);
      setResultado(null);
      setSelectedWordTip(null);

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setUserAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setUserAudioUrl(url);
      };

      recorder.start(150);
      setIsRecording(true);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          // Límite de seguridad: 30 segundos
          if (prev >= 30) {
            detenerGrabacion();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert("No se pudo acceder al micrófono. Por favor permite el acceso en tu navegador.");
      console.error(err);
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const descartarGrabacion = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setUserAudioBlob(null);
    setUserAudioUrl(null);
    setRecordingSeconds(0);
    setResultado(null);
    setSelectedWordTip(null);
  };

  // Enviar a evaluar con IA
  const evaluarConIA = async () => {
    if (!userAudioBlob) return;

    setEvaluando(true);
    try {
      const formData = new FormData();
      formData.append("audio", userAudioBlob, "shadowing_recording.webm");
      formData.append("frase_objetivo", frase.en);
      formData.append("ipa_objetivo", frase.ipa || "");

      const res = await fetch("/api/speaking/shadowing/evaluar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error en el servidor al evaluar");
      }

      const data = await res.json();
      if (data.exito && data.evaluacion) {
        setResultado(data.evaluacion);
        if (typeof data.evaluacion.overall_score === "number" && onScoreActualizado) {
          onScoreActualizado(frase.id, data.evaluacion.overall_score);
        }
      }
    } catch (e: any) {
      console.error(e);
      alert("Error al evaluar pronunciación: " + e.message);
    } finally {
      setEvaluando(false);
    }
  };

  // Helper para color de puntuación
  const getScoreColorBadge = (score: number) => {
    if (score >= 85) {
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    }
    if (score >= 70) {
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    }
    if (score >= 50) {
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm flex flex-col gap-6 relative">
      {/* Header de la tarjeta: origen y contador */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {frase.origen && (
            <span className="rounded-md border border-border bg-muted/50 px-2.5 py-0.5 font-medium text-foreground">
              {frase.origen}
            </span>
          )}
          {frase.contexto && (
            <span className="truncate max-w-[200px] sm:max-w-xs">{frase.contexto}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {frase.mejor_score !== undefined && frase.mejor_score !== null && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold font-mono"
              title="Tu puntuación más alta en esta frase"
            >
              <Award className="size-3" />
              {frase.mejor_score}%
            </span>
          )}

          {numero !== undefined && total !== undefined && (
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              Frase {numero} de {total}
            </span>
          )}

          {onEliminar && (
            <button
              type="button"
              onClick={() => onEliminar(frase.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
              title="Eliminar frase de mi biblioteca"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Oración Objetivo (Grande y Clara) */}
      <div className="space-y-2 text-center py-2">
        {/* Si ya hay evaluación, renderizar palabras coloreadas */}
        {resultado ? (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2.5 font-serif text-2xl md:text-3xl leading-relaxed">
            {resultado.words_analysis.map((item, idx) => {
              const isCorrect = item.status === "correct";
              const isNeedsWork = item.status === "needs_work";
              const isMissed = item.status === "missed";
              const isSelected = selectedWordTip?.word === item.word;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedWordTip(item)}
                  className={cn(
                    "rounded-lg px-2 py-0.5 border font-semibold transition-all cursor-pointer relative",
                    isCorrect &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    isNeedsWork &&
                      "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs",
                    isMissed &&
                      "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 line-through decoration-rose-500/60",
                    isSelected && "ring-2 ring-primary ring-offset-2 scale-105"
                  )}
                  title={item.tip || (isCorrect ? "¡Pronunciación precisa!" : item.word)}
                >
                  {item.word}
                  {item.tip && (
                    <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <h3 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-relaxed">
            "{frase.en}"
          </h3>
        )}

        {/* Fonética IPA y Foco de Ritmo */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
          {frase.ipa && (
            <span className="font-mono text-primary/80 bg-primary/5 px-2.5 py-0.5 rounded border border-primary/20">
              {frase.ipa}
            </span>
          )}
          {frase.foco_ritmo && (
            <span className="text-muted-foreground font-medium italic">
              ⚡ {frase.foco_ritmo}
            </span>
          )}
        </div>

        {/* Traducción al Español */}
        <p className="text-sm font-sans text-muted-foreground pt-1">
          {frase.es}
        </p>

        {/* Tip emergente de palabra seleccionada si tiene */}
        {selectedWordTip && selectedWordTip.tip && (
          <div className="mt-3 p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1">
            <span className="font-sans">
              <strong>{selectedWordTip.word}:</strong> {selectedWordTip.tip}
            </span>
            <button
              type="button"
              onClick={() => setSelectedWordTip(null)}
              className="text-[11px] underline font-semibold shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Barra de Controles: Reproductor Modelo + Grabación */}
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Controles del Audio Modelo Nativo */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={togglePlayModel}
            disabled={loadingAudio || !modelAudioUrl}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-sm",
              isPlayingModel
                ? "bg-primary text-primary-foreground shadow-primary/20 ring-2 ring-primary"
                : "border border-border bg-card text-foreground hover:bg-muted"
            )}
            title="Escuchar modelo nativo"
          >
            {loadingAudio ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPlayingModel ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Volume2 className="size-4" />
            )}
            <span>{isPlayingModel ? "Pausar" : "Escuchar modelo"}</span>
          </button>

          {/* Selector de Velocidad */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => cambiarVelocidad(0.8)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                modelSpeed === 0.8
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Velocidad 0.8x (lenta para estudiar detalles)"
            >
              0.8x
            </button>
            <button
              type="button"
              onClick={() => cambiarVelocidad(1.0)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                modelSpeed === 1.0
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Velocidad 1.0x (normal)"
            >
              1.0x
            </button>
          </div>
        </div>

        {/* Controles de Micrófono / Grabación */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {!userAudioUrl ? (
            <button
              type="button"
              onClick={isRecording ? detenerGrabacion : iniciarGrabacion}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-sm",
                isRecording
                  ? "bg-rose-500 text-white animate-pulse shadow-rose-500/40"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {isRecording ? (
                <>
                  <Square className="size-4 fill-current" />
                  <span>Detener ({recordingSeconds}s)</span>
                </>
              ) : (
                <>
                  <Mic className="size-4" />
                  <span>Imitar y Grabar</span>
                </>
              )}
            </button>
          ) : (
            /* Botones una vez grabada la toma */
            <div className="flex items-center gap-2">
              {/* Escuchar mi toma */}
              <button
                type="button"
                onClick={togglePlayUser}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-all shadow-xs",
                  isPlayingUser
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
                title="Escuchar mi propia grabación"
              >
                {isPlayingUser ? (
                  <Pause className="size-3.5 fill-current" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}
                <span>Mi voz</span>
              </button>

              {/* Grabar de nuevo */}
              <button
                type="button"
                onClick={descartarGrabacion}
                disabled={evaluando}
                className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Grabar de nuevo esta frase"
              >
                <RotateCcw className="size-4" />
              </button>

              {/* Botón de Evaluar con IA */}
              {!resultado && (
                <button
                  type="button"
                  onClick={evaluarConIA}
                  disabled={evaluando}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                >
                  {evaluando ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Evaluando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 text-amber-300" />
                      <span>Evaluar con IA</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resultados de la Evaluación */}
      {resultado && (
        <div className="rounded-xl border border-border bg-muted/10 p-5 space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-sm font-bold border",
                  getScoreColorBadge(resultado.overall_score)
                )}
              >
                {resultado.overall_score}/100
              </span>
              <div>
                <h4 className="font-semibold text-foreground text-sm">
                  {resultado.overall_score >= 85
                    ? "¡Excelente entonación e imitación!"
                    : resultado.overall_score >= 70
                    ? "¡Muy buen intento! Ritmo bastante natural"
                    : resultado.overall_score >= 50
                    ? "Comprensible, pero ajustemos fonemas"
                    : "Sigue practicando la mecánica bucal"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Ritmo: {resultado.rhythm.score}/100 • {resultado.rhythm.feedback}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={descartarGrabacion}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 self-start sm:self-center"
            >
              <RotateCcw className="size-3" /> Reintentar para subir nota
            </button>
          </div>

          {/* Tip del Coach / IA */}
          {resultado.coach_tip && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/90 flex items-start gap-2">
              <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-primary block mb-0.5">
                  Consejo del tutor de pronunciación:
                </strong>
                <span>{resultado.coach_tip}</span>
              </div>
            </div>
          )}

          {/* Transcripción real detectada por Gemini */}
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="font-semibold text-foreground/80">Gemini escuchó:</span>
            <span className="italic">"{resultado.transcription}"</span>
          </div>
        </div>
      )}

      {/* Navegación entre frases (Anterior / Siguiente) */}
      {(onAnterior || onSiguiente) && (
        <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs font-medium">
          <button
            type="button"
            onClick={onAnterior}
            disabled={!puedeRetroceder}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="size-4" />
            <span>Frase anterior</span>
          </button>

          <button
            type="button"
            onClick={onSiguiente}
            disabled={!puedeAvanzar}
            className="inline-flex items-center gap-1 rounded-lg bg-foreground text-background px-4 py-1.5 font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none shadow-xs"
          >
            <span>Siguiente frase</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
