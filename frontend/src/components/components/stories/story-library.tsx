'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label, Select, Textarea } from '@/components/field'
import { LEVELS, type Story } from '@/lib/data'
import { cn } from '@/lib/utils'

const LEVEL_NAMES: Record<Story['level'], string> = {
  A1: 'Inicial',
  A2: 'Básico',
  B1: 'Intermedio',
  B2: 'Intermedio alto',
  C1: 'Avanzado',
}

export function StoryLibrary({ initialStories }: { initialStories: Story[] }) {
  const [list, setList] = useState(initialStories)
  const [prompt, setPrompt] = useState('')
  const [level, setLevel] = useState<Story['level']>('B1')
  const [length, setLength] = useState('Corta')
  const [generating, setGenerating] = useState(false)

  function generate() {
    if (!prompt.trim()) return
    setGenerating(true)
    const template = initialStories[initialStories.length - 1]
    setTimeout(() => {
      setList((prev) => [
        {
          ...template,
          id: template.id,
          title: 'Untitled Story',
          theme: prompt.trim().slice(0, 40),
          level,
          created: 'Ahora',
          prompt: prompt.trim(),
        },
        ...prev,
      ])
      setPrompt('')
      setGenerating(false)
    }, 1200)
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[20rem_1fr]">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          generate()
        }}
        className="h-fit rounded-lg border border-border bg-card p-5 lg:sticky lg:top-8"
      >
        <h2 className="font-serif text-lg font-semibold">Nueva historia</h2>

        <div className="mt-4">
          <Label htmlFor="story-prompt">Temática</Label>
          <Textarea
            id="story-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej.: un detective que resuelve un misterio en una librería antigua"
            className="min-h-24"
          />
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Dificultad</legend>
          <div className="grid grid-cols-5 overflow-hidden rounded-md border border-input">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                aria-pressed={level === l}
                className={cn(
                  'border-r border-input py-2 text-sm last:border-r-0 transition-colors',
                  level === l
                    ? 'bg-foreground text-background'
                    : 'bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{LEVEL_NAMES[level]}</p>
        </fieldset>

        <div className="mt-4">
          <Label htmlFor="story-length">Extensión</Label>
          <Select id="story-length" value={length} onChange={(e) => setLength(e.target.value)}>
            <option>Corta</option>
            <option>Media</option>
            <option>Larga</option>
          </Select>
        </div>

        <Button type="submit" className="mt-5 h-10 w-full" disabled={generating || !prompt.trim()}>
          {generating ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {generating ? 'Escribiendo…' : 'Generar historia'}
        </Button>
      </form>

      <section aria-labelledby="library-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="library-heading" className="text-sm font-medium text-muted-foreground">
            Tu biblioteca
          </h2>
          <span className="text-xs text-muted-foreground">{list.length} historias</span>
        </div>
        <ul className="mt-3 border-t border-foreground/80">
          {list.map((story, i) => (
            <li key={`${story.id}-${i}`} className="border-b border-border">
              <Link
                href={`/historias/${story.id}`}
                className="group flex items-start gap-5 py-5"
              >
                <span className="mt-1 flex size-11 shrink-0 flex-col items-center justify-center rounded border border-input bg-card font-serif">
                  <span className="text-sm font-semibold leading-none">{story.level}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-xl font-semibold transition-colors group-hover:text-primary">
                    {story.title}
                  </span>
                  <span className="mt-1 block truncate text-sm italic text-muted-foreground">
                    &ldquo;{story.prompt}&rdquo;
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{story.theme}</span>
                    <span aria-hidden="true">·</span>
                    <span>{story.sentences.length} frases</span>
                    <span aria-hidden="true">·</span>
                    <span>{story.created}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
