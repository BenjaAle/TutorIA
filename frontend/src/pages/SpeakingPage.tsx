import { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  Clock,
  Brain,
  History,
  Trash2,
  ChevronRight,
  Loader2,
  Check,
  Headphones,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ModalAnki, { type CartaAnki } from "../components/ModalAnki";
import ShadowingCard, { type FraseShadowing } from "../components/ShadowingCard";

interface TemaSpeaking {
  id: string;
  categoria: string;
  nivel: string;
  titulo: string;
  pregunta: string;
  puntos_guia: string[];
  duracion_recomendada: string;
}

interface EvaluacionDetalles {
  transcription: string;
  overall_score: number;
  cefr_level: string;
  ruta_audio?: string;
  duracion_segundos?: number;
  topic?: string;
  fluency: {
    score: number;
    estimated_wpm?: number;
    pace_evaluation?: string;
    filler_words?: string[];
    feedback?: string;
  };
  pronunciation: {
    score: number;
    clarity_rating?: string;
    problematic_words?: {
      word: string;
      ipa?: string;
      tip: string;
    }[];
    feedback?: string;
  };
  grammar: {
    score: number;
    errors?: {
      original: string;
      correction: string;
      explanation: string;
    }[];
    feedback?: string;
  };
  vocabulary: {
    score: number;
    suggestions?: {
      original_word: string;
      better_alternative: string;
      example_sentence: string;
      explanation: string;
    }[];
    feedback?: string;
  };
  native_reformulation: string;
  tutor_feedback: string;
}

interface EvaluacionHistorial {
  id: number;
  fecha: string;
  topic: string;
  duracion_segundos: number;
  ruta_audio: string;
  overall_score: number;
  nivel_cefr: string;
  transcripcion: string;
  detalles: EvaluacionDetalles;
}

type TabType = "practica" | "shadowing" | "historial";
type ShadowingSource = "estudiadas" | "ia";

const CATEGORIAS_SHADOWING = [
  "Casual & Conversación",
  "Connected Speech & Ritmo",
  "Expresiones Idiomáticas & Coloquiales",
  "Profesional & Negocios",
  "Preguntas & Entonación",
];

const NIVELES_SHADOWING = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function SpeakingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("practica");

  // Shadowing
  const [shadowingSource, setShadowingSource] = useState<ShadowingSource>("estudiadas");
  const [frasesShadowing, setFrasesShadowing] = useState<FraseShadowing[]>([]);
  const [currentShadowingIndex, setCurrentShadowingIndex] = useState(0);
  const [loadingShadowing, setLoadingShadowing] = useState(false);
  const [generandoShadowingIA, setGenerandoShadowingIA] = useState(false);
  const [shadowingNivel, setShadowingNivel] = useState("B1");
  const [shadowingCategoria, setShadowingCategoria] = useState("Casual & Conversación");
  const [totalDescartadas, setTotalDescartadas] = useState(0);

  // Temas
  const [temas, setTemas] = useState<TemaSpeaking[]>([]);
  const [selectedTema, setSelectedTema] = useState<TemaSpeaking | null>(null);
  const [customTopic, setCustomTopic] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [generandoTema, setGenerandoTema] = useState(false);

  // Grabación
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const isCancelledRef = useRef(false);

  // Audio Context & Analyser para visualizador en tiempo real
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Evaluación
  const [evaluando, setEvaluando] = useState(false);
  const [evaluandoPaso, setEvaluandoPaso] = useState("Escuchando tu pronunciación...");
  const [currentResult, setCurrentResult] = useState<EvaluacionDetalles | null>(null);

  // Historial
  const [historial, setHistorial] = useState<EvaluacionHistorial[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Anki Modal
  const [ankiModalOpen, setAnkiModalOpen] = useState(false);
  const [cartasAExportar, setCartasAExportar] = useState<CartaAnki[]>([]);
  const [pendingAnkiKey, setPendingAnkiKey] = useState<string | null>(null);
  const [addedAnkiKeys, setAddedAnkiKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("speaking_anki_added");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsAdded = async (key: string) => {
    setAddedAnkiKeys((prev) => {
      const updated = new Set(prev);
      updated.add(key);
      try {
        localStorage.setItem(
          "speaking_anki_added",
          JSON.stringify([...updated]),
        );
      } catch (e) {
        console.error("Error guardando en localStorage:", e);
      }
      return updated;
    });

    // Guardar en la BDD para sincronizar
    try {
      await fetch("/api/speaking/anki_items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    } catch (e) {
      console.error("Error sincronizando tarjeta de Anki con la BD:", e);
    }
  };

  // Cargar temas iniciales y sincronizar tarjetas añadidas de Anki desde la BD
  useEffect(() => {
    cargarTemas();
    cargarAnkiItems();
  }, []);

  const cargarAnkiItems = async () => {
    try {
      const res = await fetch("/api/speaking/anki_items");
      if (res.ok) {
        const data = await res.json();
        const serverKeys: string[] = Array.isArray(data.keys) ? data.keys : [];

        setAddedAnkiKeys((prev) => {
          const merged = new Set([...prev, ...serverKeys]);

          // Si el navegador local tenía claves previas que el servidor aún no tiene,
          // sincronizarlas a la BD para que los demás dispositivos las tengan
          const serverKeySet = new Set(serverKeys);
          const pendingSync = [...prev].filter((k) => !serverKeySet.has(k));
          if (pendingSync.length > 0) {
            pendingSync.forEach((k) => {
              fetch("/api/speaking/anki_items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: k }),
              }).catch(() => {});
            });
          }

          try {
            localStorage.setItem("speaking_anki_added", JSON.stringify([...merged]));
          } catch {}
          return merged;
        });
      }
    } catch (e) {
      console.error("Error cargando tarjetas de Anki desde la BD:", e);
    }
  };

  const cargarTemas = async () => {
    try {
      const res = await fetch("/api/speaking/temas");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.temas && data.temas.length > 0) {
        setTemas(data.temas);
        setSelectedTema(data.temas[0]);
      }
    } catch (e) {
      console.error("Error cargando temas:", e);
    }
  };

  // Cargar historial cuando se cambia a pestaña historial
  useEffect(() => {
    if (activeTab === "historial") {
      cargarHistorial();
    }
  }, [activeTab]);

  const cargarHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const res = await fetch("/api/speaking/historial");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setHistorial(data.historial || []);
    } catch (e) {
      console.error("Error cargando historial:", e);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Cargar frases de Shadowing cuando se entra a la pestaña
  useEffect(() => {
    if (activeTab === "shadowing") {
      if (shadowingSource === "estudiadas") {
        cargarFrasesShadowingEstudiadas();
      } else {
        cargarFrasesShadowingIA();
      }
    }
  }, [activeTab, shadowingSource]);

  const cargarFrasesShadowingEstudiadas = async () => {
    setLoadingShadowing(true);
    try {
      const res = await fetch("/api/speaking/shadowing/frases_estudiadas");
      if (!res.ok) throw new Error("Error cargando frases");
      const data = await res.json();
      setFrasesShadowing(data.frases || []);
      setTotalDescartadas(data.total_descartadas || 0);
      setCurrentShadowingIndex(0);
    } catch (e) {
      console.error("Error cargando frases estudiadas:", e);
    } finally {
      setLoadingShadowing(false);
    }
  };

  const cargarFrasesShadowingIA = async () => {
    setLoadingShadowing(true);
    try {
      const res = await fetch("/api/speaking/shadowing/frases_ia");
      if (!res.ok) throw new Error("Error cargando frases de IA");
      const data = await res.json();
      setFrasesShadowing(data.frases || []);
      setCurrentShadowingIndex(0);
    } catch (e) {
      console.error("Error cargando frases de IA:", e);
    } finally {
      setLoadingShadowing(false);
    }
  };

  const generarFrasesShadowingConIA = async () => {
    setGenerandoShadowingIA(true);
    try {
      const res = await fetch("/api/speaking/shadowing/generar_frases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nivel: shadowingNivel,
          categoria: shadowingCategoria,
        }),
      });
      if (!res.ok) throw new Error("Error al generar frases con IA");
      const data = await res.json();
      if (data.exito && Array.isArray(data.frases)) {
        // Prepend las 5 nuevas a las existentes para conservarlas todas
        setFrasesShadowing((prev) => [...data.frases, ...prev]);
        setCurrentShadowingIndex(0);
      }
    } catch (e: any) {
      alert("Error al generar frases de shadowing: " + e.message);
    } finally {
      setGenerandoShadowingIA(false);
    }
  };

  const handleEliminarFrase = async (id: string | number) => {
    if (shadowingSource === "ia") {
      if (!window.confirm("¿Seguro que deseas eliminar esta frase generada con IA?")) return;
      try {
        const res = await fetch(`/api/speaking/shadowing/frases_ia/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setFrasesShadowing((prev) => prev.filter((f) => f.id !== id));
          setCurrentShadowingIndex((prev) => Math.max(0, Math.min(prev, frasesShadowing.length - 2)));
        }
      } catch (e) {
        console.error("Error eliminando frase IA:", e);
      }
    } else {
      if (
        !window.confirm(
          "¿Deseas descartar esta frase de tus sesiones de shadowing? (Tu historia original permanecerá 100% intacta)"
        )
      ) {
        return;
      }
      try {
        const res = await fetch("/api/speaking/shadowing/descartar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: String(id) }),
        });
        if (res.ok) {
          setFrasesShadowing((prev) => prev.filter((f) => f.id !== id));
          setTotalDescartadas((prev) => prev + 1);
          setCurrentShadowingIndex((prev) => Math.max(0, Math.min(prev, frasesShadowing.length - 2)));
        }
      } catch (e) {
        console.error("Error descartando frase estudiada:", e);
      }
    }
  };

  const handleRestablecerDescartadas = async () => {
    if (
      !window.confirm(
        "¿Deseas volver a incluir todas las frases que habías descartado de tus historias y cartas?"
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/speaking/shadowing/restablecer_descartadas", {
        method: "POST",
      });
      if (res.ok) {
        await cargarFrasesShadowingEstudiadas();
      }
    } catch (e) {
      console.error("Error restableciendo frases descartadas:", e);
    }
  };

  const handleScoreActualizado = (id: string | number, score: number) => {
    setFrasesShadowing((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const actual = f.mejor_score ?? 0;
          return { ...f, mejor_score: Math.max(actual, score) };
        }
        return f;
      })
    );
  };

  const handleSwitchShadowingSource = (src: ShadowingSource) => {
    setShadowingSource(src);
    if (src === "estudiadas") {
      cargarFrasesShadowingEstudiadas();
    } else {
      cargarFrasesShadowingIA();
    }
  };

  // Generar nuevo tema con IA
  const generarTemaConIA = async () => {
    setGenerandoTema(true);
    try {
      const res = await fetch("/api/speaking/generar_tema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nivel: selectedTema?.nivel || "B2",
          intereses: "Tecnología, viajes, vida cotidiana, superación personal",
        }),
      });
      const data = await res.json();
      if (data.tema) {
        setTemas((prev) => [data.tema, ...prev]);
        setSelectedTema(data.tema);
        setIsCustomMode(false);
      }
    } catch (e) {
      alert("Error al generar tema con IA");
    } finally {
      setGenerandoTema(false);
    }
  };

  // Lógica de Grabación de Audio
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      isCancelledRef.current = false;
      setRecordingSeconds(0);
      setIsPaused(false);
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);
      setCurrentResult(null);

      // Crear visualizador de ondas con Web Audio
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser.fftSize = 64;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        dibujarOndas();
      } catch (err) {
        console.warn("Visualizador no disponible:", err);
      }

      // Determinar el MIME type
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Detener microfono
        stream.getTracks().forEach((track) => track.stop());

        // Limpiar visualizador
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close().catch(() => {});

        // Si fue cancelado expresamente, no procesar el audio
        if (isCancelledRef.current) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
      };

      mediaRecorder.start(200); // chunk cada 200ms
      setIsRecording(true);
      setIsPaused(false);

      // Iniciar temporizador
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("No se pudo acceder al micrófono. Por favor permite el acceso en tu navegador.");
      console.error(err);
    }
  };

  const pausarGrabacion = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      } catch (err) {
        console.error("Error al pausar la grabación:", err);
      }
    }
  };

  const reanudarGrabacion = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      try {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error("Error al reanudar la grabación:", err);
      }
    }
  };

  const detenerGrabacion = () => {
    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === "recording" || mediaRecorderRef.current.state === "paused")
    ) {
      isCancelledRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const cancelarGrabacion = () => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setCurrentResult(null);
  };

  // Visualizador Canvas animado
  const dibujarOndas = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      animFrameRef.current = requestAnimationFrame(renderFrame);

      // Si está en pausa, limpiamos el visualizador para dar retroalimentación tranquila
      if (mediaRecorderRef.current?.state === "paused") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

        // Gradiente vibrante
        ctx.fillStyle = `rgb(${Math.min(255, 220 + barHeight)}, ${Math.max(60, 100 - barHeight)}, ${Math.max(100, 150 - barHeight)})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }
    };

    renderFrame();
  };

  // Enviar audio a FastAPI para evaluación con Gemini
  const enviarAEvaluar = async () => {
    if (!recordedAudioBlob) return;

    if (recordingSeconds < 4) {
      alert("La grabación es muy corta. Por favor habla un poco más para que la IA pueda evaluar tu fluidez.");
      return;
    }

    setEvaluando(true);
    setEvaluandoPaso("Enviando audio a la IA...");

    // Pasos visuales simulados mientras se procesa el audio
    const pasoTimer1 = setTimeout(() => {
      setEvaluandoPaso("Analizando pronunciación acústica y ritmo...");
    }, 2000);
    const pasoTimer2 = setTimeout(() => {
      setEvaluandoPaso("Detectando muletillas, pausas y gramática...");
    }, 4500);
    const pasoTimer3 = setTimeout(() => {
      setEvaluandoPaso("Generando reporte de nivel y vocabulario...");
    }, 7000);

    try {
      const topicText = isCustomMode
        ? customTopic.trim() || "Free Speech"
        : selectedTema?.titulo + ": " + selectedTema?.pregunta;

      const formData = new FormData();
      formData.append("audio", recordedAudioBlob, "recording.webm");
      formData.append("topic", topicText);
      formData.append("duracion_segundos", String(recordingSeconds));

      const res = await fetch("/api/speaking/evaluar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error en el servidor al evaluar");
      }

      const data = await res.json();
      if (data.evaluacion && data.evaluacion.detalles) {
        const audioUrl = data.evaluacion.ruta_audio || recordedAudioUrl;
        const duracion = Math.round(data.evaluacion.duracion_segundos || recordingSeconds);
        setCurrentResult({
          ...data.evaluacion.detalles,
          ruta_audio: audioUrl,
          duracion_segundos: duracion,
          topic: topicText,
        });
        if (data.evaluacion.ruta_audio) {
          setRecordedAudioUrl(data.evaluacion.ruta_audio);
        }
      }
    } catch (e: any) {
      console.error(e);
      alert("Error al evaluar el audio: " + e.message);
    } finally {
      clearTimeout(pasoTimer1);
      clearTimeout(pasoTimer2);
      clearTimeout(pasoTimer3);
      setEvaluando(false);
    }
  };

  // Eliminar evaluación del historial
  const handleEliminarHistorial = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta grabación de tu historial?")) return;
    try {
      const res = await fetch(`/api/speaking/historial/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.exito) {
        setHistorial((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (e) {
      alert("Error eliminando registro: " + e);
    }
  };

  // Preparar carta de gramática para exportar a Anki
  const handleGuardarGramaticaEnAnki = (
    err: { original: string; correction: string; explanation: string },
    key: string,
  ) => {
    const cleanWordForImage = err.correction
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");

    setPendingAnkiKey(key);
    setCartasAExportar([
      {
        frente: err.correction,
        reverso: `❌ Error previo: "${err.original}"\n\n💡 Explicación: ${err.explanation}`,
        ejemplo_ingles: "",
        ejemplo_espanol: "",
        termino_imagen: cleanWordForImage || err.correction,
        categoria: "Gramatica y Teoria",
      },
    ]);
    setAnkiModalOpen(true);
  };

  // Preparar carta de vocabulario para exportar a Anki
  const handleGuardarVocabularioEnAnki = (
    sug: {
      original_word: string;
      better_alternative: string;
      example_sentence: string;
      explanation: string;
    },
    key: string,
  ) => {
    setPendingAnkiKey(key);
    setCartasAExportar([
      {
        frente: sug.better_alternative,
        reverso: sug.original_word,
        ejemplo_ingles: sug.example_sentence,
        ejemplo_espanol: `Uso contextual en speaking.`,
        termino_imagen: sug.better_alternative,
        categoria: "Expresiones Nativas",
        observacion: `Alternativa nativa más natural a "${sug.original_word}": ${sug.explanation}`,
      },
    ]);
    setAnkiModalOpen(true);
  };

  // Reproducir audio con Text-to-Speech nativo del navegador
  const reproducirTextoTTS = (texto: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Formatear segundos en mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Helper para normalizar errores si la IA los separó en objetos consecutivos
  const normalizeGrammarErrors = (
    errors?: { original?: string; correction?: string; explanation?: string }[]
  ) => {
    if (!errors || !Array.isArray(errors)) return [];
    const result: { original: string; correction: string; explanation: string }[] = [];
    for (let i = 0; i < errors.length; i++) {
      const err = errors[i];
      let orig = (err.original || "").trim();
      let corr = (err.correction || "").trim();
      let expl = (err.explanation || "").trim();

      // Si tiene original o correction pero no explanation, y el siguiente tiene explanation sin original:
      if ((orig || corr) && !expl && i + 1 < errors.length) {
        const nextErr = errors[i + 1];
        if (nextErr && nextErr.explanation && !nextErr.original) {
          expl = (nextErr.explanation || "").trim();
          i++; // saltar el siguiente porque ya se combinó
        }
      }

      // Si es un objeto huérfano con solo explicación y el anterior no tenía:
      if (!orig && !corr && expl && result.length > 0 && !result[result.length - 1].explanation) {
        result[result.length - 1].explanation = expl;
        continue;
      }

      if (orig || corr || expl) {
        result.push({ original: orig, correction: corr, explanation: expl });
      }
    }
    return result;
  };

  // Helper para color de score
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 65) return "text-amber-500 border-amber-500/30 bg-amber-500/10";
    return "text-rose-500 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background font-sans">
      <main className="flex-1 overflow-y-auto relative flex flex-col bg-background">
        {/* Header Superior idéntico al estilo de Cloze y Fonética */}
        <header className="flex items-center gap-3 border-b border-border pl-16 pr-4 py-3 md:px-8 md:py-4 bg-background z-10 sticky top-0">
          <div className="min-w-0 flex-1 flex flex-col">
            <h2 className="truncate font-serif text-2xl font-bold md:text-3xl flex items-center gap-2">
              {/*<Mic className="size-6 text-rose-500" />*/}
              Speaking
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Entrena tu fluidez verbal, pronunciación y vocabulario con retroalimentación de la IA.
            </p>
          </div>
        </header>

        {/* Contenido principal */}
        <div className="px-4 py-6 md:px-8 max-w-5xl mx-auto w-full flex-1 flex flex-col">
          {/* Selector de pestañas */}
          <div
            role="tablist"
            aria-label="Vistas de Speaking"
            className="flex gap-6 border-b border-border mb-6"
          >
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "practica"}
              onClick={() => setActiveTab("practica")}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 pb-3 text-[15px] transition-colors",
                activeTab === "practica"
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Mic className="size-4" />
              Discurso Libre
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "shadowing"}
              onClick={() => setActiveTab("shadowing")}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 pb-3 text-[15px] transition-colors",
                activeTab === "shadowing"
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Headphones className="size-4" />
              Shadowing Guiado
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "historial"}
              onClick={() => setActiveTab("historial")}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 pb-3 text-[15px] transition-colors",
                activeTab === "historial"
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="size-4" />
              Mi Historial & Progreso
            </button>
          </div>

          {/* VISTA 1: PRÁCTICA EN VIVO */}
          {activeTab === "practica" && (
            <div className="space-y-6">
              {/* Sección Selección de Tema */}
              {!currentResult && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium">
                        {isCustomMode ? "Tema Libre" : selectedTema?.categoria || "Tema"}
                      </span>
                      {!isCustomMode && selectedTema && (
                        <span className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                          Nivel {selectedTema.nivel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCustomMode(!isCustomMode)}
                        className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                      >
                        {isCustomMode ? "Usar temas sugeridos" : "Escribir tema propio"}
                      </button>
                      <button
                        type="button"
                        onClick={generarTemaConIA}
                        disabled={generandoTema}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {generandoTema ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5 text-amber-500" />
                        )}
                        Sugerir tema con IA
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo del Tema */}
                  {isCustomMode ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Escribe el tema o pregunta sobre la que deseas hablar:
                      </label>
                      <textarea
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="Ejemplo: Describe your favorite childhood memory and what you learned from it."
                        className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                      />
                    </div>
                  ) : (
                    selectedTema && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {temas.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setSelectedTema(t);
                                cancelarGrabacion();
                              }}
                              className={cn(
                                "rounded-lg px-3 py-1 text-xs transition-colors font-medium border",
                                selectedTema.id === t.id
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {t.titulo}
                            </button>
                          ))}
                        </div>

                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                          <h3 className="font-serif text-lg font-semibold text-foreground">
                            {selectedTema.pregunta}
                          </h3>
                          <div className="pt-2 border-t border-border/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                              Ideas para estructurar tu respuesta:
                            </p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                              {selectedTema.puntos_guia.map((pt, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-primary font-bold">•</span>
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                            <Clock className="size-3.5 text-primary" />
                            <span>Duración recomendada: {selectedTema.duracion_recomendada}</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Área de Grabación Interactiva */}
              {!currentResult && (
                <div className="rounded-2xl border border-border bg-card p-8 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                  {/* Visualizador de ondas Canvas en el fondo cuando se está grabando */}
                  {isRecording && (
                    <div className="absolute inset-x-0 bottom-0 top-1/2 opacity-35 pointer-events-none flex items-end justify-center">
                      <canvas ref={canvasRef} width={600} height={100} className="w-full h-24" />
                    </div>
                  )}

                  <div className="z-10 flex flex-col items-center gap-4 max-w-md w-full">
                    {/* Controles de Grabación */}
                    {!recordedAudioUrl ? (
                      !isRecording ? (
                        /* Estado 1: Botón Central para Iniciar Grabación */
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={iniciarGrabacion}
                            disabled={evaluando}
                            className="relative size-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-md bg-primary text-primary-foreground hover:scale-105 hover:shadow-primary/30"
                            title="Comenzar a hablar"
                          >
                            <Mic className="size-9" />
                          </button>
                          <span className="text-xs font-medium text-muted-foreground">Toca para hablar</span>
                        </div>
                      ) : (
                        /* Estado 2: Grabando / En Pausa con Controles: Descartar, Detener y Pausar/Reanudar */
                        <div className="flex items-center justify-center gap-6">
                          {/* Botón Descartar */}
                          <div className="flex flex-col items-center gap-1.5">
                            <button
                              type="button"
                              onClick={cancelarGrabacion}
                              title="Descartar grabación"
                              className="size-12 rounded-full border border-border bg-muted/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 flex items-center justify-center transition-all shadow-sm"
                            >
                              <RotateCcw className="size-5" />
                            </button>
                            <span className="text-[11px] font-medium text-muted-foreground">Descartar</span>
                          </div>

                          {/* Botón Finalizar / Terminar */}
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="relative">
                              {!isPaused && (
                                <div className="absolute -inset-3 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
                              )}
                              <button
                                type="button"
                                onClick={detenerGrabacion}
                                title="Terminar y guardar grabación"
                                className="relative size-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg bg-rose-500 text-white hover:bg-rose-600 hover:scale-105 shadow-rose-500/40"
                              >
                                <Square className="size-7 fill-current" />
                              </button>
                            </div>
                            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Terminar</span>
                          </div>

                          {/* Botón Pausar / Reanudar */}
                          <div className="flex flex-col items-center gap-1.5">
                            <button
                              type="button"
                              onClick={isPaused ? reanudarGrabacion : pausarGrabacion}
                              title={isPaused ? "Reanudar grabación" : "Pausar grabación"}
                              className={cn(
                                "size-12 rounded-full border flex items-center justify-center transition-all shadow-sm",
                                isPaused
                                  ? "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 animate-pulse scale-105"
                                  : "border-border bg-muted/60 text-foreground hover:bg-muted hover:text-amber-600 dark:hover:text-amber-400"
                              )}
                            >
                              {isPaused ? (
                                <Play className="size-5 fill-current ml-0.5 text-amber-600 dark:text-amber-400" />
                              ) : (
                                <Pause className="size-5 fill-current" />
                              )}
                            </button>
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                isPaused ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"
                              )}
                            >
                              {isPaused ? "Reanudar" : "Pausar"}
                            </span>
                          </div>
                        </div>
                      )
                    ) : (
                      /* Reproductor previo al envío */
                      <div className="w-full rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Grabación lista ({formatTime(recordingSeconds)})
                          </span>
                          <button
                            type="button"
                            onClick={cancelarGrabacion}
                            disabled={evaluando}
                            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="size-3" /> Grabar de nuevo
                          </button>
                        </div>
                        <audio src={recordedAudioUrl} controls className="w-full h-10" />
                      </div>
                    )}

                    {/* Estado y Cronómetro */}
                    <div className="space-y-1.5 flex flex-col items-center">
                      <div className="flex items-center gap-2.5">
                        <p className="font-mono text-2xl font-bold tracking-wider text-foreground">
                          {formatTime(recordingSeconds)}
                        </p>
                        {isRecording && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                              isPaused
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse"
                            )}
                          >
                            <span className={cn("size-2 rounded-full", isPaused ? "bg-amber-500" : "bg-rose-500")} />
                            {isPaused ? "EN PAUSA" : "GRABANDO"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isRecording
                          ? isPaused
                            ? "Grabación en pausa. Haz clic en Reanudar cuando quieras continuar."
                            : "Grabando tu voz... Habla con naturalidad y claridad."
                          : recordedAudioUrl
                          ? "Escucha tu grabación o envíala para análisis."
                          : "Haz clic en el micrófono cuando estés listo para comenzar."}
                      </p>
                    </div>

                    {/* Botón de Analizar */}
                    {recordedAudioUrl && !evaluando && (
                      <button
                        type="button"
                        onClick={enviarAEvaluar}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-all w-full sm:w-auto"
                      >
                        <Sparkles className="size-4 text-amber-300" />
                        Analizar mi Speaking con IA
                      </button>
                    )}

                    {/* Animación durante el análisis */}
                    {evaluando && (
                      <div className="flex flex-col items-center gap-3 pt-4">
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <span className="text-sm font-medium text-foreground animate-pulse">
                          {evaluandoPaso}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Gemini está escuchando tu entonación, dicción y pausas...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* REPORTE DE RESULTADOS */}
              {currentResult && (
                <div className="space-y-6">
                  {/* Tarjeta de Resumen / Hero Score */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-border">
                      <div className="flex items-center gap-5">
                        {/* Círculo de Puntuación General */}
                        <div
                          className={cn(
                            "size-24 rounded-2xl border-2 flex flex-col items-center justify-center font-bold shadow-sm",
                            getScoreColor(currentResult.overall_score)
                          )}
                        >
                          <span className="text-3xl font-mono leading-none">
                            {currentResult.overall_score}
                          </span>
                          <span className="text-[11px] font-sans tracking-wide uppercase opacity-80 mt-1">
                            Puntaje
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                              Nivel: {currentResult.cefr_level}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3" />{" "}
                              {currentResult.duracion_segundos ?? recordingSeconds} seg grabados
                            </span>
                            {currentResult.topic && (
                              <span
                                className="text-xs text-muted-foreground max-w-[220px] truncate hidden sm:inline"
                                title={currentResult.topic}
                              >
                                • {currentResult.topic}
                              </span>
                            )}
                          </div>
                          <h3 className="font-serif text-2xl font-semibold mt-1">
                            {currentResult.overall_score >= 80
                              ? "¡Excelente presentación!"
                              : currentResult.overall_score >= 65
                              ? "¡Buen intento! Tienes una buena base"
                              : "Continúa practicando"}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
                            {currentResult.tutor_feedback}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            cancelarGrabacion();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <RotateCcw className="size-3.5" /> Reintentar
                        </button>
                      </div>
                    </div>

                    {/* Grilla de las 4 Métricas Clave */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                      {/* 1. Pronunciación */}
                      <div className="rounded-xl border border-border p-4 bg-muted/15 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="flex items-center gap-1 font-medium">
                              🗣️ Pronunciación
                            </span>
                            <span className="font-bold text-foreground">
                              {currentResult.pronunciation.score}/100
                            </span>
                          </div>
                          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden mb-2">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${currentResult.pronunciation.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {currentResult.pronunciation.feedback}
                          </p>
                        </div>
                        {currentResult.pronunciation.clarity_rating && (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-2">
                            Claridad: {currentResult.pronunciation.clarity_rating}
                          </span>
                        )}
                      </div>

                      {/* 2. Fluidez & Ritmo */}
                      <div className="rounded-xl border border-border p-4 bg-muted/15 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="flex items-center gap-1 font-medium">
                              ⚡ Fluidez & Ritmo
                            </span>
                            <span className="font-bold text-foreground">
                              {currentResult.fluency.score}/100
                            </span>
                          </div>
                          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden mb-2">
                            <div
                              className="bg-blue-500 h-full rounded-full"
                              style={{ width: `${currentResult.fluency.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {currentResult.fluency.feedback}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                          <span>
                            {currentResult.fluency.estimated_wpm
                              ? `${currentResult.fluency.estimated_wpm} WPM`
                              : "Ritmo fluido"}
                          </span>
                          <span className="font-medium text-foreground">
                            {currentResult.fluency.pace_evaluation || "Natural"}
                          </span>
                        </div>
                      </div>

                      {/* 3. Gramática */}
                      <div className="rounded-xl border border-border p-4 bg-muted/15 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="flex items-center gap-1 font-medium">
                              ✍️ Gramática
                            </span>
                            <span className="font-bold text-foreground">
                              {currentResult.grammar.score}/100
                            </span>
                          </div>
                          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden mb-2">
                            <div
                              className="bg-purple-500 h-full rounded-full"
                              style={{ width: `${currentResult.grammar.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {currentResult.grammar.feedback}
                          </p>
                        </div>
                        <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 mt-2">
                          {currentResult.grammar.errors && currentResult.grammar.errors.length > 0
                            ? `${currentResult.grammar.errors.length} detalle(s) a corregir`
                            : "Estructura impecable"}
                        </span>
                      </div>

                      {/* 4. Vocabulario */}
                      <div className="rounded-xl border border-border p-4 bg-muted/15 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="flex items-center gap-1 font-medium">
                              💡 Vocabulario
                            </span>
                            <span className="font-bold text-foreground">
                              {currentResult.vocabulary.score}/100
                            </span>
                          </div>
                          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden mb-2">
                            <div
                              className="bg-amber-500 h-full rounded-full"
                              style={{ width: `${currentResult.vocabulary.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {currentResult.vocabulary.feedback}
                          </p>
                        </div>
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-2">
                          {currentResult.vocabulary.suggestions?.length || 0} alternativa(s) nativas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Transcripción y Audio */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h4 className="font-serif text-lg font-semibold flex items-center gap-2">
                        <span>Transcripción de tu voz</span>
                      </h4>
                      {(recordedAudioUrl || currentResult.ruta_audio) && (
                        <audio
                          src={recordedAudioUrl || currentResult.ruta_audio}
                          controls
                          className="h-8 w-full sm:max-w-[260px]"
                        />
                      )}
                    </div>
                    <div className="rounded-xl border border-border/80 bg-muted/30 p-4 font-serif text-base leading-relaxed text-foreground italic">
                      "{currentResult.transcription || "No se detectaron palabras claras."}"
                    </div>

                    {/* Muletillas detectadas si hay */}
                    {currentResult.fluency.filler_words &&
                      currentResult.fluency.filler_words.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-rose-500">
                            Muletillas detectadas:
                          </span>
                          {currentResult.fluency.filler_words.map((w, idx) => (
                            <span
                              key={idx}
                              className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-600 dark:text-rose-400 font-mono text-[11px]"
                            >
                              "{w}"
                            </span>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Desglose de Pronunciación Fonética & Palabras Clave */}
                  {currentResult.pronunciation.problematic_words &&
                    currentResult.pronunciation.problematic_words.length > 0 && (
                      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                        <h4 className="font-serif text-lg font-semibold flex items-center gap-2">
                          <span className="text-emerald-500">🗣️</span> Palabras para afinar pronunciación
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentResult.pronunciation.problematic_words.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-border p-3.5 bg-muted/20 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground text-sm">
                                  {item.word}
                                </span>
                                {item.ipa && (
                                  <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                                    {item.ipa}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{item.tip}</p>
                              <button
                                type="button"
                                onClick={() => reproducirTextoTTS(item.word)}
                                className="text-[11px] text-primary hover:underline flex items-center gap-1 pt-1 font-medium"
                              >
                                <Volume2 className="size-3" /> Escuchar modelo nativo
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Correcciones Gramaticales */}
                  {currentResult.grammar.errors &&
                    normalizeGrammarErrors(currentResult.grammar.errors).length > 0 && (
                      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-serif text-lg font-semibold flex items-center gap-2">
                            <span className="text-purple-500">✍️</span> Correcciones Gramaticales
                          </h4>
                    {/*
                          <span className="text-xs text-muted-foreground">
                            Añade estas reglas a tu mazo de Anki
                          </span>
                    */}
                        </div>
                        <div className="space-y-3">
                          {normalizeGrammarErrors(currentResult.grammar.errors).map((err, idx) => {
                            const ankiKey = `grammar:${err.original}:${err.correction}`;
                            const isAdded = addedAnkiKeys.has(ankiKey);

                            return (
                              <div
                                key={idx}
                                className="rounded-xl border border-border p-4 bg-muted/20 space-y-3"
                              >
                                {(err.original || err.correction) && (
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                                    {err.original && (
                                      <span className="line-through text-destructive font-medium">
                                        "{err.original}"
                                      </span>
                                    )}
                                    {err.original && err.correction && (
                                      <ChevronRight className="size-4 text-muted-foreground hidden sm:block" />
                                    )}
                                    {err.correction && (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        "{err.correction}"
                                      </span>
                                    )}
                                  </div>
                                )}
                                {err.explanation && (
                                  <p className="text-xs text-muted-foreground border-l-2 border-purple-500/40 pl-2.5">
                                    {err.explanation}
                                  </p>
                                )}

                                {/* Acción Añadir a Anki con indicador de estado */}
                                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                  {isAdded ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                      <Check className="size-3.5" /> Ya añadido a Anki
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Aprende esta corrección
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleGuardarGramaticaEnAnki(err, ankiKey)}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                      isAdded
                                        ? "border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        : "border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                                    )}
                                  >
                                    <Brain className="size-3.5" />
                                    {isAdded ? "Añadir de nuevo" : "Añadir a Anki"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* Sugerencias de Vocabulario Avanzado con botón a Anki */}
                  {currentResult.vocabulary.suggestions &&
                    currentResult.vocabulary.suggestions.length > 0 && (
                      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-serif text-lg font-semibold flex items-center gap-2">
                            <span className="text-amber-500">💡</span> Eleva tu Vocabulario con Alternativas Nativas
                          </h4>
                          {/*
                          <span className="text-xs text-muted-foreground">
                            Añade estas frases a tu mazo de Anki
                          </span>
                          */}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {currentResult.vocabulary.suggestions.map((sug, idx) => {
                            const ankiKey = `vocab:${sug.original_word}:${sug.better_alternative}`;
                            const isAdded = addedAnkiKeys.has(ankiKey);

                            return (
                              <div
                                key={idx}
                                className="rounded-xl border border-border p-4 bg-muted/20 flex flex-col justify-between space-y-3"
                              >
                                <div className="space-y-1.5">
                                  <div className="text-xs text-muted-foreground">
                                    En vez de decir:{" "}
                                    <span className="font-medium text-foreground">
                                      "{sug.original_word}"
                                    </span>
                                  </div>
                                  <div className="text-base font-semibold text-primary">
                                    "{sug.better_alternative}"
                                  </div>
                                  <p className="text-xs text-muted-foreground italic">
                                    Ej: {sug.example_sentence}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{sug.explanation}</p>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                  {isAdded ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                      <Check className="size-3.5" /> Ya añadido a Anki
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleGuardarVocabularioEnAnki(sug, ankiKey)
                                    }
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                      isAdded
                                        ? "border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        : "border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-500/20"
                                    )}
                                  >
                                    <Brain className="size-3.5" />
                                    {isAdded ? "Añadir de nuevo" : "Añadir a Anki"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* Así lo diría un nativo */}  
                  {currentResult.native_reformulation && (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                          <Sparkles className="size-4 text-primary" />
                          Así lo expresaría un hablante nativo:
                        </h4>
                        <button
                          type="button"
                          onClick={() => reproducirTextoTTS(currentResult.native_reformulation)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Volume2 className="size-3.5" /> Escuchar
                        </button>
                      </div>
                      <p className="font-serif text-base leading-relaxed text-foreground">
                        "{currentResult.native_reformulation}"
                      </p>
                    </div>
                  )}

                  {/* Botones de acción inferiores */}
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        cancelarGrabacion();
                      }}
                      className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Probar otro tema
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: SHADOWING (REPETICIÓN GUIADA) */}
          {activeTab === "shadowing" && (
            <div className="space-y-6">
              {/* Selector de Origen de Frases (Estilo Cloze) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchShadowingSource("estudiadas")}
                    className={cn(
                      "rounded-xl px-4 py-2 text-xs font-semibold border transition-all flex items-center gap-1.5",
                      shadowingSource === "estudiadas"
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <BookOpen className="size-3.5" />
                    <span>Mis Historias & Anki</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchShadowingSource("ia")}
                    className={cn(
                      "rounded-xl px-4 py-2 text-xs font-semibold border transition-all flex items-center gap-1.5",
                      shadowingSource === "ia"
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Sparkles className="size-3.5" />
                    <span>Generador con IA</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {shadowingSource === "estudiadas" && totalDescartadas > 0 && (
                    <button
                      type="button"
                      onClick={handleRestablecerDescartadas}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/70 rounded-lg px-2.5 py-1 bg-muted/30 hover:bg-muted"
                      title="Recuperar frases que habías descartado de tus historias y cartas"
                    >
                      <RotateCcw className="size-3 text-primary" />
                      <span>Restablecer ({totalDescartadas}) descartadas</span>
                    </button>
                  )}

                  <span className="text-xs text-muted-foreground">
                    {shadowingSource === "estudiadas"
                      ? "Frases tomadas de tus lecturas y tarjetas"
                      : "Sesiones guiadas con audio neural creadas por Gemini"}
                  </span>
                </div>
              </div>

              {/* Panel de configuración si el origen es IA */}
              {shadowingSource === "ia" && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <Sparkles className="size-4 text-amber-500" />
                        Entrenamiento guiado con IA
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Elige tu nivel y foco temático para generar un nuevo set de 5 oraciones con pronunciación nativa.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={generarFrasesShadowingConIA}
                      disabled={generandoShadowingIA}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background px-4 py-2 text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm shrink-0"
                    >
                      {generandoShadowingIA ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5 text-amber-300" />
                      )}
                      <span>{generandoShadowingIA ? "Sintetizando audios..." : "Generar 5 Frases"}</span>
                    </button>
                  </div>

                  {/* Selectores de Nivel y Categoría */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Nivel de dificultad
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {NIVELES_SHADOWING.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setShadowingNivel(lvl)}
                            className={cn(
                              "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all",
                              shadowingNivel === lvl
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Foco temático o de ritmo
                      </label>
                      <select
                        value={shadowingCategoria}
                        onChange={(e) => setShadowingCategoria(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {CATEGORIAS_SHADOWING.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Estado de carga */}
              {loadingShadowing ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Cargando oraciones de shadowing...</p>
                </div>
              ) : frasesShadowing.length === 0 ? (
                /* Estado vacío */
                <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4">
                  <Headphones className="size-12 text-muted-foreground/60 mx-auto stroke-1" />
                  <div className="space-y-1">
                    <h3 className="font-serif text-xl font-medium text-foreground">
                      {shadowingSource === "estudiadas"
                        ? totalDescartadas > 0
                          ? "Has descartado todas las oraciones estudiadas"
                          : "Aún no tienes oraciones de historias"
                        : "Genera tu primer set de Shadowing"}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      {shadowingSource === "estudiadas"
                        ? totalDescartadas > 0
                          ? `Tienes ${totalDescartadas} frases que fueron ocultadas de shadowing. Puedes restablecerlas cuando quieras o generar más historias.`
                          : "Genera una historia en la sección 'Historias' para practicar sus líneas, o utiliza el 'Generador con IA' para empezar a practicar ahora."
                        : "Haz clic en 'Generar 5 Frases' para que Gemini cree un set con audio neural y notas de entonación."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {shadowingSource === "estudiadas" && totalDescartadas > 0 && (
                      <button
                        type="button"
                        onClick={handleRestablecerDescartadas}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-all shadow-sm"
                      >
                        <RotateCcw className="size-4 text-primary" />
                        <span>Restablecer {totalDescartadas} descartadas</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (shadowingSource === "estudiadas") {
                          handleSwitchShadowingSource("ia");
                        } else {
                          generarFrasesShadowingConIA();
                        }
                      }}
                      disabled={generandoShadowingIA}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
                    >
                      {generandoShadowingIA ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4 text-amber-300" />
                      )}
                      <span>
                        {shadowingSource === "estudiadas"
                          ? "Probar Generador con IA"
                          : "Generar 5 Frases Ahora"}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Tarjeta de Shadowing Activa */
                <div className="space-y-4">
                  <ShadowingCard
                    frase={frasesShadowing[currentShadowingIndex]}
                    numero={currentShadowingIndex + 1}
                    total={frasesShadowing.length}
                    onSiguiente={() =>
                      setCurrentShadowingIndex((prev) =>
                        Math.min(prev + 1, frasesShadowing.length - 1)
                      )
                    }
                    onAnterior={() =>
                      setCurrentShadowingIndex((prev) => Math.max(prev - 1, 0))
                    }
                    puedeAvanzar={currentShadowingIndex < frasesShadowing.length - 1}
                    puedeRetroceder={currentShadowingIndex > 0}
                    onEliminar={handleEliminarFrase}
                    eliminarTooltip={
                      shadowingSource === "ia"
                        ? "Eliminar frase generada con IA"
                        : "Descartar de shadowing (tu historia original queda intacta)"
                    }
                    onScoreActualizado={handleScoreActualizado}
                  />

                  {/* Selector de índice rápido (Frase 1, 2, 3...) */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {frasesShadowing.map((f, idx) => (
                      <button
                        key={f.id || idx}
                        type="button"
                        onClick={() => setCurrentShadowingIndex(idx)}
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-mono font-medium border transition-all flex items-center gap-1",
                          currentShadowingIndex === idx
                            ? "border-primary bg-primary text-primary-foreground shadow-sm scale-105 font-bold"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <span>#{idx + 1}</span>
                        {f.mejor_score !== undefined && f.mejor_score !== null && (
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              f.mejor_score >= 80 ? "bg-emerald-500" : "bg-amber-500"
                            )}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 3: HISTORIAL Y PROGRESO */}
          {activeTab === "historial" && (
            <div className="space-y-4">
              {loadingHistorial ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm">Cargando tus grabaciones anteriores...</p>
                </div>
              ) : historial.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
                  <Mic className="size-10 text-muted-foreground mx-auto stroke-1" />
                  <h3 className="font-serif text-xl font-medium">Aún no tienes prácticas registradas</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Graba tu primer discurso en la pestaña "Práctica en Vivo" para recibir retroalimentación detallada y ver tu progreso aquí.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("practica")}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    <Mic className="size-4" /> Comenzar primera práctica
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Total de sesiones completadas: <span className="font-semibold text-foreground">{historial.length}</span>
                  </p>

                  <div className="grid gap-4">
                    {historial.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 relative group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "size-12 rounded-xl border flex flex-col items-center justify-center font-bold font-mono text-lg",
                                getScoreColor(item.overall_score)
                              )}
                            >
                              {item.overall_score}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                  {item.nivel_cefr || "B1"}
                                </span>
                                <span className="text-xs text-muted-foreground">{item.fecha}</span>
                                <span className="text-xs text-muted-foreground">• {item.duracion_segundos}s</span>
                              </div>
                              <h4 className="font-medium text-foreground text-sm mt-0.5">
                                {item.topic}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.ruta_audio && (
                              <audio
                                src={item.ruta_audio}
                                controls
                                className="h-8 max-w-[200px]"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => handleEliminarHistorial(item.id)}
                              className="text-muted-foreground hover:text-destructive p-2 rounded-lg transition-colors opacity-70 hover:opacity-100"
                              title="Eliminar práctica"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>

                        {item.transcripcion && (
                          <div className="text-xs text-muted-foreground italic border-l-2 border-border pl-3 line-clamp-2">
                            "{item.transcripcion}"
                          </div>
                        )}

                        {/* Botón para ver detalles del reporte en modal o expandido */}
                        <div className="pt-2 flex items-center justify-between border-t border-border/50 text-xs">
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>Pronunciación: {item.detalles?.pronunciation?.score || item.overall_score}%</span>
                            <span>Fluidez: {item.detalles?.fluency?.score || item.overall_score}%</span>
                            <span>Gramática: {item.detalles?.grammar?.score || item.overall_score}%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const audioUrl = item.ruta_audio || item.detalles?.ruta_audio || null;
                              const duracion = Math.round(item.duracion_segundos || item.detalles?.duracion_segundos || 0);
                              setCurrentResult({
                                ...item.detalles,
                                ruta_audio: audioUrl || undefined,
                                duracion_segundos: duracion,
                                topic: item.topic,
                              });
                              setRecordedAudioUrl(audioUrl);
                              setRecordingSeconds(duracion);
                              setActiveTab("practica");
                            }}
                            className="text-primary hover:underline font-medium flex items-center gap-1"
                          >
                            Ver reporte completo <ChevronRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal de Exportación a Anki */}
        {ankiModalOpen && (
          <ModalAnki
            isOpen={ankiModalOpen}
            onClose={() => {
              setAnkiModalOpen(false);
              setPendingAnkiKey(null);
            }}
            cartasIniciales={cartasAExportar}
            chatId={0}
            origen="speaking"
            onSuccess={() => {
              if (pendingAnkiKey) {
                markAsAdded(pendingAnkiKey);
                setPendingAnkiKey(null);
              }
              alert("¡Carta exportada a Anki exitosamente!");
              setAnkiModalOpen(false);
            }}
          />
        )}
      </main>
    </div>
  );
}
