'use client'

import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import type { ClozeExercise } from '@/lib/data'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'correct' | 'wrong'

export function ClozeItem({
  number,
  exercise,
  onResult,
}: {
  number: number
  exercise: ClozeExercise
  onResult: (correct: boolean) => void
}) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [showHint, setShowHint] = useState(false)

  function check() {
    if (!value.trim()) return
    const ok = value.trim().toLowerCase() === exercise.answer.toLowerCase()
    setStatus(ok ? 'correct' : 'wrong')
    onResult(ok)
  }

  return (
    <li
      className={cn(
        'rounded-lg border bg-card p-4 transition-colors md:p-5',
        status === 'correct' ? 'border-success/50' : status === 'wrong' ? 'border-destructive/40' : 'border-border',
      )}
    >
      <div className="flex items-start gap-4">
        <span className="pt-1 font-serif text-sm text-muted-foreground tabular-nums">
          {String(number).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              check()
            }}
            className="font-serif text-xl leading-loose md:text-2xl"
          >
            {exercise.before}{' '}
            <input
              aria-label={`Hueco del ejercicio ${number}`}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (status !== 'idle') setStatus('idle')
              }}
              readOnly={status === 'correct'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{ width: `${Math.max(exercise.answer.length, 4) + 1.5}ch` }}
              className={cn(
                'border-b-2 bg-transparent px-1 text-center outline-none transition-colors',
                status === 'correct' && 'border-success text-success',
                status === 'wrong' && 'border-destructive text-destructive',
                status === 'idle' && 'border-foreground/40 focus:border-primary focus:bg-highlight/40',
              )}
            />
            {exercise.after.startsWith('.') ? '' : ' '}
            {exercise.after}
          </form>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-sm border border-border px-1.5 py-0.5">{exercise.tag}</span>
            <button
              type="button"
              onClick={() => setShowHint((s) => !s)}
              aria-expanded={showHint}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Lightbulb className="size-3.5" aria-hidden="true" />
              {showHint ? 'Ocultar pista' : 'Ver traducción'}
            </button>
            <span aria-live="polite">
              {status === 'correct' && <span className="text-success">Correcto</span>}
              {status === 'wrong' && (
                <span className="text-destructive">
                  Respuesta: <strong className="font-medium">{exercise.answer}</strong>
                </span>
              )}
            </span>
          </div>
          {showHint && <p className="mt-2 text-sm italic text-muted-foreground">{exercise.hint}</p>}
        </div>
      </div>
    </li>
  )
}
