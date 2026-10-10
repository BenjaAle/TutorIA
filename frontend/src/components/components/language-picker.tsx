'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const languages = [
  { code: 'es', name: 'Español', note: 'Traducciones y explicaciones en español' },
  { code: 'pt', name: 'Português', note: 'Traduções e explicações em português' },
  { code: 'fr', name: 'Français', note: 'Traductions et explications en français' },
  { code: 'it', name: 'Italiano', note: 'Traduzioni e spiegazioni in italiano' },
  { code: 'de', name: 'Deutsch', note: 'Übersetzungen und Erklärungen auf Deutsch' },
  { code: 'ca', name: 'Català', note: 'Traduccions i explicacions en català' },
]

export function LanguagePicker() {
  const [selected, setSelected] = useState('es')

  return (
    <section
      aria-labelledby="language-heading"
      className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_var(--border)] md:p-6"
    >
      <h2 id="language-heading" className="font-serif text-xl font-semibold">
        ¿Desde qué idioma aprendes?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Podrás cambiarlo más tarde.</p>

      <div role="radiogroup" aria-labelledby="language-heading" className="mt-5 flex flex-col">
        {languages.map((lang) => {
          const active = selected === lang.code
          return (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(lang.code)}
              className={cn(
                'flex items-center gap-4 border-b border-border py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 -mx-2 px-2 rounded-md',
                active && 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded border font-mono text-xs uppercase',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input text-muted-foreground',
                )}
              >
                {lang.code}
              </span>
              <span className="flex-1">
                <span className="block font-medium">{lang.name}</span>
                <span className="block text-xs text-muted-foreground">{lang.note}</span>
              </span>
              {active && <Check className="size-4 text-primary" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <Link
        href={`/inicio?lang=${selected}`}
        className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Empezar
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
