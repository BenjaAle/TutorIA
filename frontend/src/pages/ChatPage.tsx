import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Loader2, ArrowUp, Layers, Volume2 } from "lucide-react";
import ModalAnki, { type CartaAnki } from "../components/ModalAnki";
import { Button } from "@/components/ui/button";

// Los mensajes tienen un rol y un texto
interface Mensaje {
  rol: "user" | "bot";
  texto: string;
}

// -selectedChatId: Es el ID del chat que se está mostrando
interface ChatPageProps {
  selectedChatId: number | null;
}

export default function ChatPage({ selectedChatId }: ChatPageProps) {
  const [prevChatId, setPrevChatId] = useState(selectedChatId);

  // Estados
  const [isModalOpen, setIsModalOpen] = useState(false);

  // almacena arreglo de cartas para enviar a anki
  const [cartasPropuestas, setCartasPropuestas] = useState<CartaAnki[]>([]);
  const [cargandoAnki, setCargandoAnki] = useState(false);

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [inputTexto, setInputTexto] = useState("");

  // La IA esta escribiendo
  const [isEscribiendo, setIsEscribiendo] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(
    () => selectedChatId !== null,
  );

  // Sincronizar estado cuando se cambia de chat antes de que React dibuje el DOM
  if (selectedChatId !== prevChatId) {
    setPrevChatId(selectedChatId);
    setMensajes([]);
    setInputTexto("");
    setIsEscribiendo(false);
    setCargandoHistorial(!!selectedChatId);
  }

  const chatBoxRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Utilidad de lectura (TTS)
  const speak = (htmlText: string) => {
    if (!window.speechSynthesis) return;

    // Convert html to plain text
    const temp = document.createElement("div");
    temp.innerHTML = htmlText;
    const textContext = temp.textContent || temp.innerText || "";

    const utterance = new SpeechSynthesisUtterance(textContext);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const formatearMarkdown = (texto: string) => {
    // Se anulan <> para evitar inyeccion
    let html = texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Captura todo despues de los # (lo almacena en $1) y lo convierte en titulo
    html = html.replace(/^###### (.*$)/gim, "<h6>$1</h6>");
    html = html.replace(/^##### (.*$)/gim, "<h5>$1</h5>");
    html = html.replace(/^#### (.*$)/gim, "<h4>$1</h4>");
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // (^|\n) captura el inicio de una linea o un salto de linea
    // \s*[\*-]\s+ captura un asterisco o guion rodeado de espacios
    // $1 es el grupo capturado por (^|\n)
    // • es el bullet point que se inserta
    html = html.replace(/(^|\n)\s*[\*-]\s+/g, "$1• ");

    // Transforma los **texto** y *texto* en negrita y cursiva respectivamente
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Transforma los saltos de linea en <br>
    html = html.replace(/\n/g, "<br>");

    // Elimina los <br> que quedan despues de los titulos
    html = html.replace(/<\/h[1-6]><br>/g, (match) =>
      match.replace("<br>", ""),
    );
    return html;
  };

  // 5. Cargar historial cuando el chatId cambie
  useEffect(() => {
    if (!selectedChatId) return;

    // Cancela esta carga si el usuario cambia otra vez de chat.
    const controlador = new AbortController();

    const cargarHistorial = async () => {
      try {
        const res = await fetch(`/chats/${selectedChatId}/mensajes`, {
          signal: controlador.signal,
        });
        if (!res.ok) throw new Error(`Error ${selectedChatId}`);
        const data = await res.json();
        if (controlador.signal.aborted) return;

        if (data.length === 0) {
          setMensajes([
            {
              rol: "bot",
              texto:
                "¡Hello! Soy tu tutor de inglés. ¿De qué hablaremos hoy?",
            },
          ]);
        } else {
          setMensajes(data);
        }
      } catch (error) {
        if (!controlador.signal.aborted)
          console.error("Error cargando historial", error);
      } finally {
        if (!controlador.signal.aborted) setCargandoHistorial(false);
      }
    };

    cargarHistorial();
    return () => controlador.abort();
  }, [selectedChatId]); // Se ejecuta cuando una de las variables dentro de [] cambia su valor

  // 6. Efecto para auto-scroll hacia abajo cada vez que haya nuevos mensajes
  useLayoutEffect(() => {
    // current es la referencia al div del chat. Verificamos que exista antes del scroll
    // Al usar useLayoutEffect en lugar de useEffect, React cambia el scroll ANTES
    // de que el navegador dibuje en pantalla, evitando el parpadeo de ver el inicio del chat.
    if (chatBoxRef.current) {
      // scrollHeight es la altura total del contenido, scrollTop es la posición actual del scroll
      // de esta forma, se va altiro al final del chat.
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [mensajes, isEscribiendo]);

  /* 7. Autoajustar altura del textarea
  El evento "e" que recibo es porque alguien modificó un textarea
  */
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputTexto(e.target.value);
    if (textareaRef.current) {
      // Por si el usuario borra texto, primero reseteo la altura
      textareaRef.current.style.height = "auto";
      // Luego ajusto la altura al scrollHeight, que es la altura del contenido
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // 8. Enviar Mensaje
  const enviarMensaje = async () => {
    if (!selectedChatId || inputTexto.trim() === "") return;

    const nuevoMensaje: Mensaje = { rol: "user", texto: inputTexto.trim() };

    // Agregamos el mensaje del usuario inmediatamente a la pantalla
    // prev es la lista de mensajes que ya estaban en pantalla, y le agregamos el nuevo al final
    // ...prev es el spread operator, que toma todos los elementos de prev y los agrega al nuevo array
    setMensajes((prev) => [...prev, nuevoMensaje]);
    setInputTexto("");
    setIsEscribiendo(true); // Mostrar "Escribiendo..."

    // Restaurar altura del textarea
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // pasar la id como entero
        body: JSON.stringify({
          texto: nuevoMensaje.texto,
          chat_id: selectedChatId,
        }),
      });
      const data = await res.json();

      // Quitar "Escribiendo..." y agregar la respuesta del bot
      setMensajes((prev) => [...prev, { rol: "bot", texto: data.respuesta }]);
    } catch (error) {
      setMensajes((prev) => [...prev, { rol: "bot", texto: "Error de red." }]);
    } finally {
      setIsEscribiendo(false); // quitar "Escribiendo..."
    }
  };

  // 9. Manejar la tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Evita el salto de línea
      enviarMensaje();
    }
  };

  const extraerAAnki = async () => {
    if (!selectedChatId) return;

    setCargandoAnki(true);
    try {
      const res = await fetch("/proponer_cartas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: selectedChatId }),
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else if (!data.cartas || data.cartas.length === 0) {
        alert("🤷‍♂️ Gemini no encontró vocabulario nuevo para extraer.");
      } else {
        setCartasPropuestas(data.cartas);
        setIsModalOpen(true); // Abre el modal con las cartas
      }
    } catch (err) {
      alert("Error de conexión al extraer las cartas.");
    } finally {
      setCargandoAnki(false);
    }
  };

  // Si no hay ningún chat seleccionado (pantalla inicial)
  if (!selectedChatId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground w-full bg-background rounded-l-3xl shadow-sm border border-l-0 md:border-l-border">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          Selecciona o crea un chat para comenzar
        </h2>
        <p className="mt-2 text-sm max-w-sm">
          Puedes crear un nuevo chat desde la barra lateral para practicar tu
          inglés con TutorIA.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col min-w-0 flex-1 h-full max-h-screen bg-background md:rounded-l-3xl shadow-sm border md:border-l-border lg:overflow-hidden relative">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-8 md:py-4 bg-background z-10 w-full shrink-0 md:rounded-tl-3xl">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-lg font-semibold md:text-xl">
            Tutor IA
          </h2>
          <p className="text-xs text-muted-foreground">
            Conversación Libre con Gemini · {mensajes.length} mensajes
          </p>
        </div>
        <Button
          onClick={extraerAAnki}
          disabled={cargandoAnki}
          className="h-9 px-3 gap-2"
        >
          {cargandoAnki ? (
            <Loader2 className="animate-spin size-4" />
          ) : (
            <Layers className="size-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {cargandoAnki ? "Analizando..." : "Exportar a Anki"}
          </span>
          <span className="sm:hidden">{cargandoAnki ? "..." : "Anki"}</span>
        </Button>
      </header>

      <ol
        ref={chatBoxRef}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8 bg-muted/20 scroll-smooth"
      >
        {cargandoHistorial ? (
          <div className="flex justify-center p-4">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          mensajes.map((m, idx) =>
            m.rol === "user" ? (
              <li key={idx} className="flex justify-end relative z-0">
                <p className="max-w-[85%] sm:max-w-[75%] whitespace-pre-line rounded-[20px] rounded-br-sm bg-secondary px-4 py-2.5 text-[15px] leading-relaxed text-secondary-foreground shadow-sm">
                  {m.texto}
                </p>
              </li>
            ) : (
              <li
                key={idx}
                className="max-w-2xl border-l-2 border-primary/60 pl-4 mb-4 relative z-0"
              >
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Gemini</span>
                  <button
                    type="button"
                    onClick={() => speak(m.texto)}
                    className="rounded p-0.5 transition-colors hover:text-primary hover:bg-primary/10"
                    aria-label="Escuchar respuesta"
                  >
                    <Volume2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div
                  className="whitespace-pre-line font-serif text-[17px] leading-[1.7] text-foreground [&_h6]:font-bold [&_h6]:mt-2 [&_h5]:font-bold [&_h4]:font-bold [&_h3]:font-bold [&_h3]:text-lg [&_em]:font-sans [&_em]:not-italic [&_em]:bg-muted [&_em]:rounded [&_em]:px-1"
                  dangerouslySetInnerHTML={{
                    __html: formatearMarkdown(m.texto),
                  }}
                />
              </li>
            ),
          )
        )}

        {isEscribiendo && (
          <li className="max-w-2xl border-l-2 border-primary/60 pl-4 mb-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Gemini</span>
            </div>
            <p className="whitespace-pre-line font-serif text-[15px] leading-relaxed text-muted-foreground italic animate-pulse">
              Escribiendo...
            </p>
          </li>
        )}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviarMensaje();
        }}
        className="border-t border-border p-3 md:px-8 md:py-4 bg-background w-full shrink-0 md:rounded-bl-3xl"
      >
        <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-shadow max-w-4xl mx-auto shadow-sm">
          <label htmlFor="chat-input" className="sr-only">
            Escribe un mensaje
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            rows={1}
            value={inputTexto}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Escribe en inglés o pregunta una duda..."
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
            disabled={cargandoHistorial || isEscribiendo}
          />
          <Button
            type="button"
            onClick={enviarMensaje}
            size="icon-lg"
            aria-label="Enviar"
            disabled={!inputTexto.trim() || isEscribiendo}
            className="mb-0.5 h-10 w-10 shrink-0 rounded-lg"
          >
            <ArrowUp className="size-5" />
          </Button>
        </div>
      </form>

      <ModalAnki
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cartasIniciales={cartasPropuestas}
        chatId={selectedChatId}
        origen="chat"
      />
    </section>
  );
}
