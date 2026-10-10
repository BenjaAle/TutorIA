'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowUp, Layers, Plus, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnkiExportDialog } from '@/components/chats/anki-export-dialog'
import type { Chat } from '@/lib/data'
import { speak } from '@/lib/speech'
import { cn } from '@/lib/utils'

export function ChatWorkspace({ initialChats }: { initialChats: Chat[] }) {
  const [chatList, setChatList] = useState(initialChats)
  const [activeId, setActiveId] = useState(initialChats[0].id)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  const active = chatList.find((c) => c.id === activeId) ?? chatList[0]

  function send() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const chatId = active.id
    setChatList((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, updated: 'Ahora', messages: [...c.messages, { id: crypto.randomUUID(), role: 'user', text }] }
          : c,
      ),
    )
    setTimeout(() => {
      setChatList((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'ai',
                    text: 'Good one! (Respuesta de ejemplo: aquí respondería Gemini.)',
                  },
                ],
              }
            : c,
        ),
      )
    }, 700)
  }

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] md:h-dvh">
      <aside
        className={cn(
          'w-full shrink-0 flex-col border-r border-border md:flex md:w-80',
          mobileOpen ? 'hidden' : 'flex',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-5">
          <h1 className="font-serif text-2xl font-semibold">Chats</h1>
          <Button variant="outline" size="sm">
            <Plus aria-hidden="true" />
            Nuevo
          </Button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {chatList.map((chat) => {
            const last = chat.messages[chat.messages.length - 1]
            const selected = chat.id === active.id
            return (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(chat.id)
                    setMobileOpen(true)
                  }}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'relative w-full border-b border-border px-5 py-4 text-left transition-colors hover:bg-muted/60',
                    selected && 'bg-muted',
                  )}
                >
                  {selected && (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />
                  )}
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{chat.kind}</span>
                    <span>{chat.updated}</span>
                  </span>
                  <span className="mt-1 block truncate font-medium">{chat.title}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {last.text.replace(/\n/g, ' ')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section
        aria-label={active.title}
        className={cn('min-w-0 flex-1 flex-col md:flex', mobileOpen ? 'flex' : 'hidden')}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-8 md:py-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Volver a la lista"
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-lg font-semibold md:text-xl">{active.title}</h2>
            <p className="text-xs text-muted-foreground">
              {active.kind} con Gemini · {active.messages.length} mensajes
            </p>
          </div>
          <Button onClick={() => setExportOpen(true)} className="h-9 px-3">
            <Layers aria-hidden="true" />
            <span className="hidden sm:inline">Exportar a Anki</span>
            <span className="sm:hidden">Anki</span>
          </Button>
        </header>

        <ol className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
          {active.messages.map((m) =>
            m.role === 'user' ? (
              <li key={m.id} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-line rounded-lg rounded-br-sm bg-secondary px-4 py-2.5 text-sm leading-relaxed">
                  {m.text}
                </p>
              </li>
            ) : (
              <li key={m.id} className="max-w-2xl border-l-2 border-primary/60 pl-4">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Gemini</span>
                  <button
                    type="button"
                    onClick={() => speak(m.text)}
                    className="rounded p-0.5 transition-colors hover:text-primary"
                    aria-label="Escuchar respuesta"
                  >
                    <Volume2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <p className="whitespace-pre-line font-serif text-[17px] leading-relaxed">{m.text}</p>
              </li>
            ),
          )}
        </ol>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="border-t border-border p-3 md:px-8 md:py-4"
        >
          <div className="flex items-end gap-2 rounded-lg border border-input bg-card p-2 focus-within:border-ring">
            <label htmlFor="chat-input" className="sr-only">
              Escribe un mensaje
            </label>
            <textarea
              id="chat-input"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Escribe en inglés o pregunta una duda…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <Button type="submit" size="icon-lg" aria-label="Enviar" disabled={!draft.trim()}>
              <ArrowUp />
            </Button>
          </div>
        </form>
      </section>

      <AnkiExportDialog
        key={active.id}
        open={exportOpen}
        onOpenChange={setExportOpen}
        card={active.card}
      />
    </div>
  )
}
