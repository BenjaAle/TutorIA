import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquarePlus,
  MessageSquare,
  BookOpen,
  Speech,
  Puzzle,
  Pencil,
  Trash2,
  House,
  Languages,
  TextCursorInput,
  AudioLines,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Los chats tienen id y titulo
interface Chat {
  id: number;
  titulo: string;
}

// - selectedChatId es el id del chat seleccionado
// - onSelectChat es una funcion que se ejecuta cuando se selecciona un chat
//   Recibe el id del chat seleccionado y no devuelve nada
interface SidebarProps {
  selectedChatId: number | null;
  onSelectChat: (chatId: number | null) => void;
}

export const sections = [
  { href: "/", label: "Chats", icon: MessageSquare },
  { href: "/historias", label: "Historias", icon: BookOpen },
  { href: "/cloze", label: "Cloze", icon: TextCursorInput },
  { href: "/fonetica", label: "Fonética", icon: AudioLines },
];

export default function Sidebar({
  selectedChatId,
  onSelectChat,
}: SidebarProps) {
  const navigate = useNavigate();
  // Mobile toggle state
  const [isMobileOpen, setIsMobileOpenState] = useState(
    () => localStorage.getItem("sidebarOpen") === "true",
  );

  const setIsMobileOpen = (open: boolean) => {
    setIsMobileOpenState(open);
    localStorage.setItem("sidebarOpen", open ? "true" : "false");
  };

  // Saber si estamos en la página de chats para alternar el botón principal
  const location = useLocation();
  const isChatPage = location.pathname === "/";

  /*2. Estados (Variables que, al cambiar, redibujan la pantalla)
  Cada vez que un estado cambia, React vuelve a dibujar el componente (Sidebar en este caso).

  const [variable, funcionParaActualizar] = useState(valorInicial)
  useState devuelve un arreglo de dos elementos:
  - variable guarda el valor actual, y - funcionParaActualizar lo cambia y redibuja la pantalla
  funcionParaActualizar es una funcion prefabricada por React, no la define uno

  2.1. Estados para la lista de chats
  - chats: arreglo de chats que vienen de FastAPI
  - mostrarFormulario: booleano que indica si se muestra el formulario para crear un nuevo chat
  - nuevoTitulo: string que guarda el título del nuevo chat que se va a crear */

  const [chats, setChats] = useState<Chat[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState("");

  /* 2.2. Estados para la edición de un chat existente
  - editandoId: guarda el id (number) del chat que se está editando, o null si no se está editando ninguno*/
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");

  // 3. funcion para cargar los chats cuando el componente aparece en pantalla
  const cargarChats = async () => {
    try {
      const res = await fetch("/chats");
      const data = await res.json(); // lo transformo a json
      setChats(data); // Actualizo el estado de los chats con la data
    } catch (error) {
      console.error("Error cargando chats:", error);
    }
  };

  // useEffect le dice a React "Haz esto después de dibujar el componente en pantalla"
  // se usa [] para que solo se ejecute una vez (cuando aparece el componente), y no cada vez que se redibuja
  // si la variable que está dentro del arreglo cambia, se vuelve a ejecutar el useEffect, en este caso, no hay variables
  // Los useEffect siempre se ejecutan después de que el componente se dibuja en pantalla
  useEffect(() => {
    cargarChats();
  }, []);

  // 4. Funciones de interacción con FastAPI: crear, eliminar y guardar edición de chats
  const crearChat = async () => {
    if (!nuevoTitulo.trim()) return; // si el titulo está vacío (solo espacios), no hago nada

    await fetch("/crear_chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: nuevoTitulo }),
    });

    setNuevoTitulo(""); // Limpio el input para un segundo futuro chat nuevo
    setMostrarFormulario(false); // fue verdadero para crear el chat, ahora vuelve a ser falso
    cargarChats(); // Volvemos a pedir la lista para que aparezca el nuevo chat
  };

  const eliminarChat = async (id: number) => {
    await fetch(`/chats/${id}`, { method: "DELETE" });

    // si se borra el chat seleccionado, se deselecciona
    if (selectedChatId === id) {
      onSelectChat(null);
    }

    cargarChats(); // actualizo la lista
  };

  // Tomo un objeto { titulo: "Titulo del chat" } y lo convierto en string con forma JSON
  const guardarEdicion = async (id: number) => {
    if (tituloEditado.trim()) {
      await fetch(`/chats/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: tituloEditado }),
      });
    }
    setEditandoId(null); // vuelvo a poner null para que no se muestre el input de edición
    cargarChats(); // actualizo la lista
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className={cn(
          "fixed top-4 left-4 z-50 rounded-md bg-sidebar p-2 text-sidebar-foreground shadow-md transition-all md:hidden",
          isMobileOpen && "hidden",
        )}
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu size={24} />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 hidden md:flex shrink-0",
          isMobileOpen ? "translate-x-0 flex w-72" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="px-2 font-serif text-2xl font-semibold italic text-primary"
            onClick={() => setIsMobileOpen(false)}
          >
            TutorIA
          </Link>
          <button className="md:hidden" onClick={() => setIsMobileOpen(false)}>
            <X size={24} className="text-muted-foreground" />
          </button>
        </div>

        <nav
          aria-label="Secciones"
          className="flex flex-col gap-1 mb-8 shrink-0"
        >
          {sections.map(({ href, label, icon: Icon }) => {
            const active = location.pathname === href;
            return (
              <Link
                key={href}
                to={href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-4", active && "text-primary")}
                  aria-hidden="true"
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Chats Section */}
        {isChatPage && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-sidebar-border mb-2 shrink-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Historial de Chats
              </span>
              <button
                onClick={() => setMostrarFormulario(true)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Nuevo Chat"
              >
                <MessageSquarePlus size={16} />
              </button>
            </div>

            {mostrarFormulario && (
              <div className="px-2 py-2 mb-2 bg-sidebar-accent/30 rounded-md shrink-0">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nuevo chat..."
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && crearChat()}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={crearChat}
                    className="flex-1 bg-primary text-primary-foreground text-xs py-1 rounded hover:bg-primary/90 transition-colors"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => setMostrarFormulario(false)}
                    className="flex-1 bg-muted text-muted-foreground text-xs py-1 rounded hover:bg-muted/80 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1 space-y-1">
              {chats.map((chat) => {
                const active = selectedChatId === chat.id;
                return (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors cursor-pointer",
                      active
                        ? "bg-sidebar-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                    onClick={() => {
                      onSelectChat(chat.id);
                      setIsMobileOpen(false);
                      navigate("/");
                    }}
                  >
                    {editandoId === chat.id ? (
                      <input
                        type="text"
                        value={tituloEditado}
                        onChange={(e) => setTituloEditado(e.target.value)}
                        onBlur={() => guardarEdicion(chat.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && guardarEdicion(chat.id)
                        }
                        autoFocus
                        className="flex-1 bg-background border border-primary/50 text-foreground px-1 py-[2px] text-sm rounded outline-none w-full min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate flex-1">{chat.titulo}</span>
                    )}

                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditandoId(chat.id);
                          setTituloEditado(chat.titulo);
                        }}
                        className="p-1 hover:text-primary transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          eliminarChat(chat.id);
                        }}
                        className="p-1 hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-sidebar-border pt-4 shrink-0">
          <div className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <Languages className="size-4" aria-hidden="true" />
              <span>TutorIA v2</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
