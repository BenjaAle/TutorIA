'use client'

import { useState } from 'react'
import { Layers, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/field'
import { ClozeItem } from '@/components/cloze/cloze-item'
import { LEVELS, type ClozeExercise } from '@/lib/data'
import { cn } from '@/lib/utils'

type Source = 'anki' | 'ai'

export function ClozeTrainer({
  anki,
  ai,
  pool,
}: {
  anki: ClozeExercise[]
  ai: ClozeExercise[]
  pool: ClozeExercise[]
}) {
  const [source, setSource] = useState<Source>('anki')
  const [aiList, setAiList] = useState(ai)
  const [creating, setCreating] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})

  const list = source === 'anki' ? anki : aiList
  const correct = list.filter((e) => results[e.id]).length

  function create() {
    setCreating(true)
    setTimeout(() => {
      setAiList((prev) => [
        ...pool.map((p) => ({ ...p, id: `${p.id}-${crypto.randomUUID().slice(0, 6)}` })),
        ...prev,
      ])
      setCreating(false)
    }, 1000)
  }

  const tabs: { id: Source; label: string; count: number; icon: typeof Layers }[] = [
    { id: 'anki', label: 'De tus cartas Anki', count: anki.length, icon: Layers },
    { id: 'ai', label: 'Generados con IA', count: aiList.length, icon: Sparkles },
  ]

  return (
    <div className="mt-6">
      <div role="tablist" aria-label="Origen de los ejercicios" className="flex gap-6 border-b border-border">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={source === id}
            onClick={() => setSource(id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors',
              source === id
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            <span className="rounded-sm bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
              {count}
            </span>
          </button>
        ))}
      </div>

      {source === 'ai' ? (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="cloze-topic">Tema</Label>
            <Select id="cloze-topic" defaultValue="Mezcla">
              <option>Mezcla</option>
              <option>Phrasal verbs</option>
              <option>Condicionales</option>
              <option>Preposiciones</option>
              <option>Tiempos verbales</option>
            </Select>
          </div>
          <div className="sm:w-28">
            <Label htmlFor="cloze-level">Nivel</Label>
            <Select id="cloze-level" defaultValue="B1">
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </div>
          <Button onClick={create} disabled={creating} className="h-9 px-4">
            {creating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {creating ? 'Creando…' : 'Crear ejercicios'}
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Generados automáticamente a partir de las frases de ejemplo de tus últimas cartas.
        </p>
      )}

      <ol className="mt-6 space-y-3">
        {list.map((exercise, i) => (
          <ClozeItem
            key={exercise.id}
            number={i + 1}
            exercise={exercise}
            onResult={(ok) => setResults((r) => ({ ...r, [exercise.id]: ok }))}
          />
        ))}
      </ol>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{correct}</span> de {list.length} correctas
        </span>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${list.length ? (correct / list.length) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
