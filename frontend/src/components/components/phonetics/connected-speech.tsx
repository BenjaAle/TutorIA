'use client'

import { Volume2 } from 'lucide-react'
import type { ConnectedSpeech } from '@/lib/data'
import { speak } from '@/lib/speech'

export function ConnectedSpeechList({ items }: { items: ConnectedSpeech[] }) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col rounded-lg border border-border bg-card p-5">
          <h3 className="font-medium">{item.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.rule}</p>
          <div className="mt-auto pt-5">
            <p className="font-serif text-xl">{item.written}</p>
            <p className="mt-0.5 font-ipa text-lg text-primary">{item.spoken}</p>
            <button
              type="button"
              onClick={() => speak(item.written.split(' · ')[0], 0.9)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Volume2 className="size-3.5" aria-hidden="true" />
              Escuchar
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
