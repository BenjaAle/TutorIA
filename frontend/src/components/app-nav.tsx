'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AudioLines, BookOpen, House, Languages, MessagesSquare, TextCursorInput } from 'lucide-react'
import { cn } from '@/lib/utils'

export const sections = [
  { href: '/inicio', label: 'Inicio', icon: House },
  { href: '/chats', label: 'Chats', icon: MessagesSquare },
  { href: '/historias', label: 'Historias', icon: BookOpen },
  { href: '/cloze', label: 'Cloze', icon: TextCursorInput },
  { href: '/fonetica', label: 'Fonética', icon: AudioLines },
]

function useIsActive() {
  const pathname = usePathname()
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const isActive = useIsActive()

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
      <Link href="/inicio" className="px-2 font-serif text-xl font-semibold italic text-primary">
        Cuaderno
      </Link>
      <nav aria-label="Secciones" className="mt-8 flex flex-col gap-0.5">
        {sections.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
            >
              <Icon className={cn('size-4', active && 'text-primary')} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <Languages className="size-4" aria-hidden="true" />
          <span>
            Español <span aria-hidden="true">→</span>
            <span className="sr-only">a</span> English
          </span>
        </Link>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const isActive = useIsActive()

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {sections.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[11px]',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
