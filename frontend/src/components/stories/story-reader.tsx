'use client'

import { useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { Story } from '@/lib/data'
import { useSentencePlayer } from '@/lib/speech'
import { cn } from '@/lib/utils'

type Mode = 'translation' | 'ipa' | 'audio'

const MODES: { id: Mode; label: string; detail: string }[] = [
  { id: 'translation', label: 'Inglés + español', detail: 'Subtítulos y audio' },
  { id: 'ipa', label: 'Inglés + IPA', detail: 'Transcripción y audio' },
  { id: 'audio', label: 'Solo audio', detail: 'Escucha sin apoyo' },
]

const RATES = [0.75, 1, 1.25]

export function StoryReader({ story }: { story: Story }) {
  const [mode, setMode] = useState<Mode>('translation')
  const player = useSentencePlayer(story.sentences.map((s) => s.en))
  const total = story.sentences.length

  return (
    <div className="mt-6">
      <div role="tablist" aria-label="Modo de lectura" className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            type="button"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              'rounded-md border px-3 py-2.5 text-left transition-colors',
              mode === m.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card hover:border-foreground/30',
            )}
          >
            <span className="block text-sm font-medium">{m.label}</span>
            <span
              className={cn(
                'hidden text-xs sm:block',
                mode === m.id ? 'text-background/70' : 'text-muted-foreground',
              )}
            >
              {m.detail}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-8">
        {mode === 'audio' ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="font-serif text-7xl font-semibold tabular-nums">
              {player.index + 1}
              <span className="text-3xl text-muted-foreground">/{total}</span>
            </p>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Escucha con atención. Si te pierdes, vuelve a la frase anterior o baja la velocidad.
            </p>
            <div className="mt-8 flex gap-1.5" aria-hidden="true">
              {story.sentences.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 w-8 rounded-full transition-colors',
                    i < player.index ? 'bg-foreground' : i === player.index ? 'bg-primary' : 'bg-border',
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          <ol className="space-y-1">
            {story.sentences.map((s, i) => {
              const current = i === player.index
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => player.playFrom(i)}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'grid w-full grid-cols-[1.75rem_1fr] gap-x-2 rounded-md px-3 py-3 text-left transition-colors',
                      current ? 'bg-highlight/60' : 'hover:bg-muted',
                    )}
                  >
                    <span className="pt-1 font-serif text-sm text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-serif text-xl leading-relaxed md:text-2xl">{s.en}</span>
                      {mode === 'translation' ? (
                        <span className="mt-1 block text-sm text-muted-foreground">{s.es}</span>
                      ) : (
                        <span className="mt-1 block font-ipa text-lg text-primary">
                          /{s.ipa}/
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="sticky bottom-20 mt-8 flex items-center gap-3 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur md:bottom-6">
        <button
          type="button"
          onClick={() => player.jump(player.index - 1)}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Frase anterior"
        >
          <SkipBack className="size-4" />
        </button>
        <button
          type="button"
          onClick={player.toggle}
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          aria-label={player.playing ? 'Pausar' : 'Reproducir'}
        >
          {player.playing ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 translate-x-px fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={() => player.jump(player.index + 1)}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Frase siguiente"
        >
          <SkipForward className="size-4" />
        </button>

        <div className="mx-2 hidden h-1 flex-1 overflow-hidden rounded-full bg-border sm:block">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${((player.index + 1) / total) * 100}%` }}
          />
        </div>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums sm:ml-0">
          {player.index + 1} / {total}
        </span>

        <div className="flex rounded-md border border-input text-xs" role="group" aria-label="Velocidad">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => player.setRate(r)}
              aria-pressed={player.rate === r}
              className={cn(
                'px-2 py-1 tabular-nums transition-colors',
                player.rate === r ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
