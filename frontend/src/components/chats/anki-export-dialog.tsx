'use client'

import { useState } from 'react'
import { Check, ImageIcon, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/field'
import { ANKI_CATEGORIES, type AnkiCard } from '@/lib/data'
import { cn } from '@/lib/utils'

export function AnkiExportDialog({
  open,
  onOpenChange,
  card: initialCard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: AnkiCard
}) {
  const [card, setCard] = useState(initialCard)
  const [side, setSide] = useState<'front' | 'back'>('back')
  const [sent, setSent] = useState(false)

  function updateExample(i: number, key: 'en' | 'es', value: string) {
    setCard((c) => ({
      ...c,
      examples: c.examples.map((ex, idx) => (idx === i ? { ...ex, [key]: value } : ex)),
    }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setSent(false)
      }}
    >
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="font-serif text-2xl font-semibold">Nueva carta para Anki</DialogTitle>
          <DialogDescription>
            Gemini ha resumido la conversación en una carta. Revisa los campos antes de enviarla.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[1fr_1.1fr]">
          <div className="border-b border-border bg-muted/50 p-6 md:border-b-0 md:border-r">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Vista previa</span>
              <div className="flex rounded-md border border-input bg-card p-0.5 text-xs">
                {(['front', 'back'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    aria-pressed={side === s}
                    className={cn(
                      'rounded px-2.5 py-1 transition-colors',
                      side === s ? 'bg-foreground text-background' : 'text-muted-foreground',
                    )}
                  >
                    {s === 'front' ? 'Anverso' : 'Reverso'}
                  </button>
                ))}
              </div>
            </div>

            <CardPreview card={card} side={side} />

            <button
              type="button"
              onClick={() => setSide(side === 'front' ? 'back' : 'front')}
              className="mx-auto mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Girar carta
            </button>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <Label htmlFor="anki-front">Campo frontal</Label>
              <Input
                id="anki-front"
                value={card.front}
                onChange={(e) => setCard({ ...card, front: e.target.value })}
              />
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                Frases de ejemplo <span className="font-normal">(reverso)</span>
              </legend>
              <ol className="space-y-3">
                {card.examples.map((ex, i) => (
                  <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-1.5">
                    <span className="pt-2 font-serif text-sm text-muted-foreground">{i + 1}</span>
                    <Input
                      aria-label={`Ejemplo ${i + 1} en inglés`}
                      value={ex.en}
                      onChange={(e) => updateExample(i, 'en', e.target.value)}
                    />
                    <Input
                      aria-label={`Traducción ${i + 1} en español`}
                      value={ex.es}
                      onChange={(e) => updateExample(i, 'es', e.target.value)}
                      className="col-start-2 bg-muted/60 text-muted-foreground"
                    />
                  </li>
                ))}
              </ol>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="anki-pexels">Término de imagen (Pexels)</Label>
                <Input
                  id="anki-pexels"
                  value={card.pexels}
                  onChange={(e) => setCard({ ...card, pexels: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="anki-category">Categoría</Label>
                <Select
                  id="anki-category"
                  value={card.category}
                  onChange={(e) => setCard({ ...card, category: e.target.value })}
                >
                  {ANKI_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="m-0 items-center rounded-none px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {sent ? (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="size-3.5" aria-hidden="true" />
                Añadida al mazo Inglés::{card.category}
              </span>
            ) : (
              <>
                Mazo: <span className="text-foreground">Inglés::{card.category}</span>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" className="h-9 px-3" />}>
              {sent ? 'Cerrar' : 'Cancelar'}
            </DialogClose>
            <Button className="h-9 px-4" onClick={() => setSent(true)} disabled={sent}>
              Enviar a Anki
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CardPreview({ card, side }: { card: AnkiCard; side: 'front' | 'back' }) {
  if (side === 'front') {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-md border border-border bg-card p-6 text-center shadow-sm">
        <p className="font-serif text-2xl font-semibold text-balance">{card.front}</p>
      </div>
    )
  }

  return (
    <div className="flex aspect-[4/5] flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="truncate font-serif text-sm font-semibold">{card.front}</p>
        <span className="shrink-0 rounded-sm bg-highlight px-1.5 py-0.5 text-[10px] font-medium">
          {card.category}
        </span>
      </div>
      <div className="flex h-24 shrink-0 flex-col items-center justify-center gap-1 border-b border-dashed border-border bg-muted/60 text-muted-foreground">
        <ImageIcon className="size-5" aria-hidden="true" />
        <span className="text-[11px]">
          Pexels: <span className="text-foreground">&ldquo;{card.pexels}&rdquo;</span>
        </span>
      </div>
      <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {card.examples.map((ex, i) => (
          <li key={i}>
            <p className="font-serif text-[15px] leading-snug">{ex.en}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{ex.es}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
