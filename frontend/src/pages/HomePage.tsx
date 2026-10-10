import { Link } from "react-router-dom";
import { MessageSquare, BookOpen, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-10 md:grid md:grid-cols-[1fr_1.1fr] md:items-center md:gap-16 md:py-16">
        <section>
          <p className="font-serif text-lg italic text-primary">Cuaderno</p>
          <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-balance md:text-5xl text-foreground">
            Tu inglés, en un solo cuaderno.
          </h1>
          <p className="mt-5 max-w-md leading-relaxed text-muted-foreground text-pretty">
            Conversa, escucha historias, practica con huecos y entrena tu
            pronunciación. Elige tu ritmo y nosotros nos encargamos del resto
            mediante Inteligencia Artificial adaptativa.
          </p>
          <dl className="mt-10 grid max-w-sm grid-cols-3 gap-4 border-t border-border pt-6 text-sm">
            <div>
              <dt className="text-muted-foreground">Chats</dt>
              <dd className="mt-1 font-serif text-2xl text-foreground">
                Gemini
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Flashcards</dt>
              <dd className="mt-1 font-serif text-2xl text-foreground">Anki</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Imágenes</dt>
              <dd className="mt-1 font-serif text-2xl text-foreground">
                Pexels
              </dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-serif text-xl font-medium mb-4">
              ¿Qué quieres aprender hoy?
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                to="/chats"
                className="group flex flex-col gap-2 rounded-xl border border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <MessageSquare className="size-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-medium">Ir a los Chats</span>
                <span className="text-xs text-muted-foreground">
                  Conversaciones guiadas por IA para extraer vocabulario.
                </span>
              </Link>
              <Link
                to="/historias"
                className="group flex flex-col gap-2 rounded-xl border border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <BookOpen className="size-6 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Lectura Bilingüe</span>
                <span className="text-xs text-muted-foreground">
                  Lee cuentos adaptados e inyecta palabras a tu mazo.
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
