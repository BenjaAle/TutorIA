'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { Phoneme } from '@/lib/data'
import { speak } from '@/lib/speech'
import { cn } from '@/lib/utils'

const GROUPS: Phoneme['group'][] = ['Vocales', 'Diptongos', 'Consonantes']

function MarkedWord({ word, mark }: { word: string; mark: string }) {
  const at = word.indexOf(mark)
  if (at === -1) return <>{word}</>
  return (
    <>
      {word.slice(0, at)}
      <span className="text-primary underline decoration-primary/40 underline-offset-2">{mark}</span>
      {word.slice(at + mark.length)}
    </>
  )
}

export function PhonemeChart({ phonemes }: { phonemes: Phoneme[] }) {
  const [selected, setSelected] = useState<Phoneme>(phonemes[0])

  function choose(p: Phoneme) {
    setSelected(p)
    speak(p.word, 0.8)
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        {GROUPS.map((group) => {
          const items = phonemes.filter((p) => p.group === group)
          return (
            <section key={group} aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`} className="mb-3 flex items-baseline gap-2 text-sm font-medium">
                {group}
                <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
              </h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {items.map((p) => {
                  const active = selected.symbol === p.symbol
                  return (
                    <li key={p.symbol}>
                      <button
                        type="button"
                        onClick={() => choose(p)}
                        aria-pressed={active}
                        className={cn(
                          'flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border transition-colors',
                          active
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-card hover:border-foreground/40',
                        )}
                      >
                        <span className="font-ipa text-3xl leading-none">/{p.symbol}/</span>
                        <span
                          className={cn(
                            'text-xs',
                            active ? 'text-background/80 [&_span]:text-highlight [&_span]:decoration-highlight/50' : 'text-muted-foreground',
                          )}
                        >
                          <MarkedWord word={p.word} mark={p.mark} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <aside
        aria-live="polite"
        className="h-fit rounded-lg border border-border bg-card p-6 lg:sticky lg:top-8"
      >
        <p className="text-xs text-muted-foreground">{selected.group}</p>
        <p className="mt-2 font-ipa text-7xl leading-none">/{selected.symbol}/</p>
        <p className="mt-5 font-serif text-2xl">
          <MarkedWord word={selected.word} mark={selected.mark} />
        </p>
        <h3 className="mt-6 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
          Cómo se pronuncia
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-pretty">{selected.description}</p>
        <button
          type="button"
          onClick={() => speak(selected.word, 0.8)}
          className="mt-6 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input text-sm transition-colors hover:bg-muted"
        >
          <Volume2 className="size-4" aria-hidden="true" />
          Escuchar &ldquo;{selected.word}&rdquo;
        </button>
      </aside>
    </div>
  )
}
